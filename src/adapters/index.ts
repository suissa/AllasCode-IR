import { parse as parseYaml } from "yaml";
import { canonicalizeIR, nodeBase, semanticId } from "../canonical.js";
import { parseAllasDSL } from "../allasdsl/parser.js";
import {
  emptyIR,
  type AllasCodeIR,
  type Behavior,
  type Entity,
  type Intent,
  type Provenance,
  type SourceKind,
} from "../types.js";

type StructuredSourceKind = Exclude<SourceKind, "allasdsl" | "chat">;

function asArray<T = unknown>(value: unknown): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nameOf(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  const obj = record(value);
  return String(obj.name ?? obj.id ?? obj.title ?? fallback);
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const obj = record(value);
  const found = obj.description ?? obj.text ?? obj.summary ?? obj.statement ?? obj.result;
  return found == null ? undefined : String(found);
}

function prov(sourceKind: SourceKind, sourceRef?: string, locator?: string, confidence = 1): Provenance {
  return { sourceKind, sourceRef, locator, confidence };
}

function parseProperty(value: unknown): Entity["properties"][number] {
  if (typeof value === "string") {
    const match = value.match(/^(\S+)\s*:\s*(\S+)(?:\s+(required|optional))?$/i);
    if (match) return { name: match[1], type: match[2], required: match[3]?.toLowerCase() === "required" };
    return { name: value, type: "unknown" };
  }
  const obj = record(value);
  return {
    name: String(obj.name ?? obj.id ?? "unknown"),
    type: String(obj.type ?? obj.schema ?? "unknown"),
    required: obj.required === true,
    description: textOf(obj),
  };
}

function parseEntity(system: string, value: unknown, sourceKind: SourceKind, sourceRef: string | undefined, index: number): Entity {
  const obj = record(value);
  const name = nameOf(value, `Entity${index + 1}`);
  const base = nodeBase(system, "entity", name, prov(sourceKind, sourceRef, `entities[${index}]`));
  const properties = asArray(obj.properties ?? obj.fields ?? obj.attributes).map(parseProperty);
  const relations: Entity["relations"] = asArray(obj.relations ?? obj.relationships).map((relation, relationIndex) => {
    if (typeof relation === "string") {
      const match = relation.match(/^(\S+)\s*->\s*(\S+)/);
      return { name: match?.[1] ?? `relation${relationIndex + 1}`, target: match?.[2] ?? relation };
    }
    const rel = record(relation);
    return {
      name: String(rel.name ?? rel.id ?? `relation${relationIndex + 1}`),
      target: String(rel.target ?? rel.entity ?? rel.to ?? "Unknown"),
      cardinality: rel.cardinality as Entity["relations"][number]["cardinality"],
      description: textOf(rel),
    };
  });
  return { ...base, description: textOf(value), properties, relations };
}

function parseBehavior(system: string, value: unknown, sourceKind: SourceKind, sourceRef: string | undefined, index: number): Behavior {
  const obj = record(value);
  const name = nameOf(value, `Behavior${index + 1}`);
  const base = nodeBase(system, "behavior", name, prov(sourceKind, sourceRef, `behaviors[${index}]`));
  return {
    ...base,
    description: textOf(value),
    entity: obj.entity ? String(obj.entity) : undefined,
    given: asArray(obj.given ?? obj.preconditions).map(String),
    when: asArray(obj.when ?? obj.trigger).map(String),
    then: asArray(obj.then ?? obj.postconditions ?? obj.expected).map(String),
    mustNot: asArray(obj.mustNot ?? obj.must_not ?? obj.forbidden).map(String),
  };
}

function parseIntent(system: string, value: unknown, sourceKind: SourceKind, sourceRef: string | undefined, index: number): Intent {
  const obj = record(value);
  const name = nameOf(value, `Intent${index + 1}`);
  const base = nodeBase(system, "intent", name, prov(sourceKind, sourceRef, `intents[${index}]`));
  return {
    ...base,
    description: textOf(value),
    entities: asArray(obj.entities ?? obj.uses).map((x) => nameOf(x, String(x))),
    behaviors: asArray(obj.behaviors ?? obj.capabilities).map((x) => nameOf(x, String(x))),
    flow: obj.flow ? nameOf(obj.flow, String(obj.flow)) : undefined,
    expectedResult: obj.expectedResult ? String(obj.expectedResult) : obj.result ? String(obj.result) : undefined,
  };
}

function addRules(
  ir: AllasCodeIR,
  system: string,
  sourceKind: SourceKind,
  sourceRef: string | undefined,
  kind: "invariant" | "constraint" | "policy",
  values: unknown,
): void {
  asArray(values).forEach((value, index) => {
    const obj = record(value);
    const name = nameOf(value, `${kind}${index + 1}`);
    const base = nodeBase(system, kind, name, prov(sourceKind, sourceRef, `${kind}s[${index}]`));
    const node = {
      ...base,
      description: textOf(value),
      scope: obj.scope ? String(obj.scope) : obj.entity ? String(obj.entity) : undefined,
      expression: String(obj.expression ?? obj.rule ?? obj.value ?? textOf(value) ?? value),
    };
    ir[`${kind}s` as "invariants" | "constraints" | "policies"].push(node);
  });
}

export function fromStructured(value: unknown, sourceKind: StructuredSourceKind, sourceRef?: string): AllasCodeIR {
  const root = record(value);
  if (root.irVersion === "0.1" && Array.isArray(root.entities) && Array.isArray(root.intents)) {
    return canonicalizeIR(value as AllasCodeIR);
  }

  const systemObj = record(root.system);
  const system = String(systemObj.name ?? root.name ?? root.title ?? "UnnamedSystem");
  const ir = emptyIR(system);
  ir.system.description = textOf(systemObj) ?? textOf(root);
  ir.system.problem = root.problem ? String(root.problem) : systemObj.problem ? String(systemObj.problem) : undefined;
  ir.system.context = root.context ? String(root.context) : systemObj.context ? String(systemObj.context) : undefined;
  ir.system.objective = root.objective ? String(root.objective) : root.goal ? String(root.goal) : systemObj.objective ? String(systemObj.objective) : undefined;

  const entityValues = root.entities ?? root.domainObjects ?? root.models ?? [];
  ir.entities = asArray(entityValues).map((item, index) => parseEntity(system, item, sourceKind, sourceRef, index));

  const behaviorValues = root.behaviors ?? root.capabilities ?? [];
  ir.behaviors = asArray(behaviorValues).map((item, index) => parseBehavior(system, item, sourceKind, sourceRef, index));

  const intentValues = root.intents ?? root.operations ?? root.useCases ?? root.requirements ?? [];
  ir.intents = asArray(intentValues).map((item, index) => parseIntent(system, item, sourceKind, sourceRef, index));

  asArray(root.flows ?? root.workflows ?? root.scenarios).forEach((value, index) => {
    const obj = record(value);
    const name = nameOf(value, `Flow${index + 1}`);
    const base = nodeBase(system, "flow", name, prov(sourceKind, sourceRef, `flows[${index}]`));
    const rawSteps = asArray(obj.steps ?? obj.sequence ?? obj.actions ?? (typeof value === "string" ? [value] : []));
    ir.flows.push({
      ...base,
      description: textOf(value),
      steps: rawSteps.map((step, stepIndex) => ({
        id: semanticId("flow-step", `${base.canonicalLabel}:${stepIndex + 1}:${textOf(step) ?? String(step)}`),
        description: textOf(step) ?? String(step),
        invokes: record(step).invokes ? String(record(step).invokes) : undefined,
      })),
    });
  });

  addRules(ir, system, sourceKind, sourceRef, "invariant", root.invariants ?? root.businessRules);
  addRules(ir, system, sourceKind, sourceRef, "constraint", root.constraints ?? root.restrictions);
  addRules(ir, system, sourceKind, sourceRef, "policy", root.policies);

  asArray(root.schemas ?? root.dataDefinitions).forEach((value, index) => {
    const name = nameOf(value, `Schema${index + 1}`);
    const base = nodeBase(system, "schema", name, prov(sourceKind, sourceRef, `schemas[${index}]`));
    ir.schemas.push({ ...base, description: textOf(value), definition: record(value).definition ?? value });
  });

  for (const behavior of ir.behaviors) {
    const base = nodeBase(system, "test", `${behavior.name}.behavior`, behavior.provenance[0]);
    ir.tests.push({ ...base, kind: "behavior", behavior: behavior.canonicalLabel, given: behavior.given, when: behavior.when, then: behavior.then, mustNot: behavior.mustNot });
  }

  if (ir.entities.length === 0) {
    ir.unresolved.push({
      id: semanticId("unresolved", `${system}:entities`),
      question: "Which Entities exist in this problem domain?",
      reason: "No Entities were found in the source specification",
      provenance: [prov(sourceKind, sourceRef, undefined, 0.5)],
    });
  }

  return canonicalizeIR(ir);
}

export function fromJson(source: string, sourceRef?: string): AllasCodeIR {
  return fromStructured(JSON.parse(source), "json", sourceRef);
}

export function fromYaml(source: string, sourceRef?: string): AllasCodeIR {
  return fromStructured(parseYaml(source), "yaml", sourceRef);
}

export function fromSpecKit(value: unknown, sourceRef?: string): AllasCodeIR {
  return fromStructured(value, "spec-kit", sourceRef);
}

export function fromOpenSpec(value: unknown, sourceRef?: string): AllasCodeIR {
  return fromStructured(value, "openspec", sourceRef);
}

export function fromCustomRequirements(source: string, sourceRef?: string): AllasCodeIR {
  return fromMarkdown(source, sourceRef, "custom");
}

export interface ChatInterviewInput {
  system?: string;
  problem: string;
  solution?: string;
  primaryFlow?: string;
  entities?: Array<string | Record<string, unknown>>;
  intents?: Array<string | Record<string, unknown>>;
  behaviors?: Array<string | Record<string, unknown>>;
  invariants?: Array<string | Record<string, unknown>>;
  constraints?: Array<string | Record<string, unknown>>;
  policies?: Array<string | Record<string, unknown>>;
  transcript?: Array<{ role: "developer" | "forger"; text: string }>;
}

export function fromChatInterview(input: ChatInterviewInput, sourceRef?: string): AllasCodeIR {
  const structured = {
    name: input.system ?? "InterviewedSystem",
    problem: input.problem,
    objective: input.solution,
    entities: input.entities,
    intents: input.intents,
    behaviors: input.behaviors,
    invariants: input.invariants,
    constraints: input.constraints,
    policies: input.policies,
    flows: input.primaryFlow ? [{ name: "Primary", steps: input.primaryFlow.split(/\s*(?:->|→)\s*/).filter(Boolean) }] : [],
  };
  const ir = fromStructured(structured, "custom", sourceRef);
  const remap = <T extends { provenance: Provenance[] }>(nodes: T[]): T[] => nodes.map((node) => ({
    ...node,
    provenance: node.provenance.map((p) => ({ ...p, sourceKind: "chat" as const })),
  }));
  ir.entities = remap(ir.entities);
  ir.intents = remap(ir.intents);
  ir.behaviors = remap(ir.behaviors);
  ir.flows = remap(ir.flows);
  ir.invariants = remap(ir.invariants);
  ir.constraints = remap(ir.constraints);
  ir.policies = remap(ir.policies);
  ir.schemas = remap(ir.schemas);
  ir.tests = remap(ir.tests);
  ir.unresolved = ir.unresolved.map((item) => ({ ...item, provenance: item.provenance.map((p) => ({ ...p, sourceKind: "chat" as const })) }));
  if (input.transcript) {
    input.transcript.forEach((message, index) => {
      if (message.role === "developer" && /\?$/.test(message.text.trim())) return;
      if (message.role === "forger") return;
      if (index === 0 && !ir.system.problem) ir.system.problem = message.text;
    });
  }
  return ir;
}

export function fromMarkdown(source: string, sourceRef?: string, sourceKind: "markdown" | "custom" = "markdown"): AllasCodeIR {
  const fenced = source.match(/```allas(?:dsl)?\s*\n([\s\S]*?)```/i);
  if (fenced) {
    const ir = parseAllasDSL(fenced[1], sourceRef);
    const remap = <T extends { provenance: Provenance[] }>(nodes: T[]): T[] => nodes.map((node) => ({
      ...node,
      provenance: node.provenance.map((p) => ({ ...p, sourceKind })),
    }));
    ir.entities = remap(ir.entities);
    ir.intents = remap(ir.intents);
    ir.behaviors = remap(ir.behaviors);
    ir.flows = remap(ir.flows);
    ir.invariants = remap(ir.invariants);
    ir.constraints = remap(ir.constraints);
    ir.policies = remap(ir.policies);
    ir.schemas = remap(ir.schemas);
    ir.tests = remap(ir.tests);
    ir.unresolved = ir.unresolved.map((item) => ({ ...item, provenance: item.provenance.map((p) => ({ ...p, sourceKind })) }));
    return ir;
  }

  const sections = new Map<string, string[]>();
  let current = "root";
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      current = heading[1].trim().toLowerCase();
      sections.set(current, []);
    } else {
      const bucket = sections.get(current) ?? [];
      bucket.push(line);
      sections.set(current, bucket);
    }
  }

  const list = (names: string[]) => {
    for (const [heading, body] of sections) {
      if (names.some((name) => heading.includes(name))) {
        return body
          .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1])
          .filter((x): x is string => Boolean(x));
      }
    }
    return [];
  };
  const text = (names: string[]) => {
    for (const [heading, body] of sections) if (names.some((name) => heading.includes(name))) return body.join("\n").trim();
    return undefined;
  };

  const rootTitle = source.match(/^#\s+(.+)$/m)?.[1] ?? "MarkdownSystem";
  return fromStructured(
    {
      name: rootTitle,
      problem: text(["problem"]),
      context: text(["context"]),
      objective: text(["goal", "objective", "result"]),
      entities: list(["entities", "entity"]),
      intents: list(["intents", "intent"]),
      behaviors: list(["behaviors", "behavior"]),
      flows: list(["flows", "flow"]).map((flow, index) => ({ name: `Flow${index + 1}`, steps: flow.split(/\s*(?:->|→)\s*/) })),
      invariants: list(["invariants", "invariant"]),
      constraints: list(["constraints", "constraint", "restrictions"]),
      policies: list(["policies", "policy"]),
    },
    sourceKind,
    sourceRef,
  );
}
