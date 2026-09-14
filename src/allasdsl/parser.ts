import { nodeBase, semanticId } from "../canonical.js";
import {
  emptyIR,
  type AllasCodeIR,
  type Behavior,
  type Entity,
  type Flow,
  type Intent,
  type Provenance,
  type RuleNode,
  type TestContract,
} from "../types.js";

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function provenance(line: number, sourceRef?: string): Provenance {
  return { sourceKind: "allasdsl", sourceRef, locator: `line:${line}`, confidence: 1 };
}

type RuleKind = "invariant" | "constraint" | "policy";
type Block =
  | { type: "entity"; node: Entity }
  | { type: "intent"; node: Intent }
  | { type: "behavior"; node: Behavior }
  | { type: "flow"; node: Flow }
  | null;

function appendRule(ir: AllasCodeIR, kind: RuleKind, node: RuleNode): void {
  if (kind === "invariant") ir.invariants.push(node);
  else if (kind === "constraint") ir.constraints.push(node);
  else ir.policies.push(node);
}

export function parseAllasDSL(source: string, sourceRef?: string): AllasCodeIR {
  const lines = source.split(/\r?\n/);
  let systemName = "UnnamedSystem";
  const ir = emptyIR(systemName);
  let block: Block = null;

  const pushRule = (kind: RuleKind, raw: string, lineNo: number) => {
    const match = raw.match(/^(\S+)(?:\s+for\s+(\S+))?\s*=\s*(.+)$/);
    if (!match) {
      ir.diagnostics.push({ severity: "error", code: "ALLASDSL_RULE_SYNTAX", message: `Invalid ${kind} declaration`, path: `line:${lineNo}` });
      return;
    }
    const [, name, scope, expressionRaw] = match;
    const base = nodeBase(systemName, kind, name, provenance(lineNo, sourceRef));
    appendRule(ir, kind, { ...base, scope, expression: unquote(expressionRaw) });
  };

  const closeBlock = () => {
    if (!block) return;
    if (block.type === "entity") ir.entities.push(block.node);
    else if (block.type === "intent") ir.intents.push(block.node);
    else if (block.type === "flow") ir.flows.push(block.node);
    else if (block.type === "behavior") {
      ir.behaviors.push(block.node);
      const base = nodeBase(systemName, "test", `${block.node.name}.behavior`, block.node.provenance[0]);
      const test: TestContract = {
        ...base,
        kind: "behavior",
        behavior: block.node.canonicalLabel,
        given: [...block.node.given],
        when: [...block.node.when],
        then: [...block.node.then],
        mustNot: [...block.node.mustNot],
      };
      ir.tests.push(test);
    }
    block = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const raw = lines[index].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//")) continue;

    if (raw.toLowerCase() === "end") {
      closeBlock();
      continue;
    }

    if (block?.type === "entity") {
      const property = raw.match(/^property\s+(\S+)\s*:\s*(\S+)(?:\s+(required|optional))?$/i);
      if (property) {
        block.node.properties.push({ name: property[1], type: property[2], required: property[3]?.toLowerCase() === "required" });
        continue;
      }
      const relation = raw.match(/^relation\s+(\S+)\s*->\s*(\S+)(?:\s+(one|zero-or-one|many|one-or-many))?$/i);
      if (relation) {
        block.node.relations.push({ name: relation[1], target: relation[2], cardinality: relation[3] as Entity["relations"][number]["cardinality"] });
        continue;
      }
      const nestedRule = raw.match(/^(invariant|constraint|policy)\s+(\S+)\s*=\s*(.+)$/i);
      if (nestedRule) {
        pushRule(nestedRule[1].toLowerCase() as RuleKind, `${nestedRule[2]} for ${block.node.name} = ${nestedRule[3]}`, lineNo);
        continue;
      }
    }

    if (block?.type === "intent") {
      const uses = raw.match(/^uses\s+(.+)$/i);
      if (uses) {
        block.node.entities.push(...uses[1].split(",").map((x) => x.trim()).filter(Boolean));
        continue;
      }
      const usesBehavior = raw.match(/^behavior\s+(.+)$/i);
      if (usesBehavior) {
        block.node.behaviors.push(...usesBehavior[1].split(",").map((x) => x.trim()).filter(Boolean));
        continue;
      }
      const usesFlow = raw.match(/^flow\s+(\S+)$/i);
      if (usesFlow) {
        block.node.flow = usesFlow[1];
        continue;
      }
      const expects = raw.match(/^expects\s+(.+)$/i);
      if (expects) {
        block.node.expectedResult = unquote(expects[1]);
        continue;
      }
    }

    if (block?.type === "behavior") {
      const clause = raw.match(/^(given|when|then|must_not)\s+(.+)$/i);
      if (clause) {
        const value = unquote(clause[2]);
        const key = clause[1].toLowerCase();
        if (key === "given") block.node.given.push(value);
        else if (key === "when") block.node.when.push(value);
        else if (key === "then") block.node.then.push(value);
        else block.node.mustNot.push(value);
        continue;
      }
    }

    if (block?.type === "flow") {
      const step = raw.match(/^step\s+(.+?)(?:\s+invokes\s+(\S+))?$/i);
      if (step) {
        const description = unquote(step[1]);
        block.node.steps.push({
          id: semanticId("flow-step", `${block.node.canonicalLabel}:${block.node.steps.length + 1}:${description}`),
          description,
          invokes: step[2],
        });
        continue;
      }
    }

    if (block) {
      ir.diagnostics.push({ severity: "error", code: "ALLASDSL_UNKNOWN_BLOCK_STATEMENT", message: `Unknown ${block.type} statement: ${raw}`, path: `line:${lineNo}` });
      continue;
    }

    const system = raw.match(/^system\s+(.+)$/i);
    if (system) {
      systemName = unquote(system[1]);
      ir.system.name = systemName;
      continue;
    }

    const meta = raw.match(/^(problem|context|objective)\s*=\s*(.+)$/i);
    if (meta) {
      const key = meta[1].toLowerCase() as "problem" | "context" | "objective";
      ir.system[key] = unquote(meta[2]);
      continue;
    }

    const entity = raw.match(/^entity\s+(\S+)$/i);
    if (entity) {
      const base = nodeBase(systemName, "entity", entity[1], provenance(lineNo, sourceRef));
      block = { type: "entity", node: { ...base, properties: [], relations: [] } };
      continue;
    }

    const intent = raw.match(/^intent\s+(\S+)$/i);
    if (intent) {
      const base = nodeBase(systemName, "intent", intent[1], provenance(lineNo, sourceRef));
      block = { type: "intent", node: { ...base, entities: [], behaviors: [] } };
      continue;
    }

    const behavior = raw.match(/^behavior\s+(\S+)(?:\s+for\s+(\S+))?$/i);
    if (behavior) {
      const base = nodeBase(systemName, "behavior", behavior[1], provenance(lineNo, sourceRef));
      block = { type: "behavior", node: { ...base, entity: behavior[2], given: [], when: [], then: [], mustNot: [] } };
      continue;
    }

    const flow = raw.match(/^flow\s+(\S+)$/i);
    if (flow) {
      const base = nodeBase(systemName, "flow", flow[1], provenance(lineNo, sourceRef));
      block = { type: "flow", node: { ...base, steps: [] } };
      continue;
    }

    const topRule = raw.match(/^(invariant|constraint|policy)\s+(.+)$/i);
    if (topRule) {
      pushRule(topRule[1].toLowerCase() as RuleKind, topRule[2], lineNo);
      continue;
    }

    ir.diagnostics.push({ severity: "error", code: "ALLASDSL_UNKNOWN_STATEMENT", message: `Unknown statement: ${raw}`, path: `line:${lineNo}` });
  }

  closeBlock();
  validateReferences(ir, sourceRef);
  return ir;
}

function validateReferences(ir: AllasCodeIR, sourceRef?: string): void {
  const entities = new Set(ir.entities.map((x) => x.name));
  const behaviors = new Set(ir.behaviors.map((x) => x.name));
  const flows = new Set(ir.flows.map((x) => x.name));

  for (const entity of ir.entities) {
    for (const relation of entity.relations) {
      if (!entities.has(relation.target)) {
        ir.unresolved.push({
          id: semanticId("unresolved", `${entity.canonicalLabel}:relation:${relation.name}`),
          question: `Which Entity should relation ${entity.name}.${relation.name} target?`,
          relatedTo: [entity.id],
          reason: `Target Entity '${relation.target}' is not declared`,
          provenance: [{ sourceKind: "allasdsl", sourceRef, confidence: 1 }],
        });
      }
    }
  }

  for (const intent of ir.intents) {
    for (const entity of intent.entities) {
      if (!entities.has(entity)) ir.diagnostics.push({ severity: "error", code: "IR_MISSING_ENTITY", message: `Intent ${intent.name} references missing Entity ${entity}` });
    }
    for (const behavior of intent.behaviors) {
      if (!behaviors.has(behavior)) ir.diagnostics.push({ severity: "error", code: "IR_MISSING_BEHAVIOR", message: `Intent ${intent.name} references missing Behavior ${behavior}` });
    }
    if (intent.flow && !flows.has(intent.flow)) ir.diagnostics.push({ severity: "error", code: "IR_MISSING_FLOW", message: `Intent ${intent.name} references missing Flow ${intent.flow}` });
  }

  for (const behavior of ir.behaviors) {
    if (behavior.entity && !entities.has(behavior.entity)) ir.diagnostics.push({ severity: "error", code: "IR_MISSING_ENTITY", message: `Behavior ${behavior.name} references missing Entity ${behavior.entity}` });
    if (behavior.then.length === 0) ir.diagnostics.push({ severity: "warning", code: "BEHAVIOR_WITHOUT_OUTCOME", message: `Behavior ${behavior.name} has no 'then' outcome` });
  }
}

export function toCanonicalReferences(ir: AllasCodeIR): AllasCodeIR {
  const entityLabels = new Map(ir.entities.map((x) => [x.name, x.canonicalLabel]));
  const behaviorLabels = new Map(ir.behaviors.map((x) => [x.name, x.canonicalLabel]));
  const flowLabels = new Map(ir.flows.map((x) => [x.name, x.canonicalLabel]));
  return {
    ...ir,
    intents: ir.intents.map((intent) => ({
      ...intent,
      entities: intent.entities.map((x) => entityLabels.get(x) ?? x),
      behaviors: intent.behaviors.map((x) => behaviorLabels.get(x) ?? x),
      flow: intent.flow ? flowLabels.get(intent.flow) ?? intent.flow : undefined,
    })),
    behaviors: ir.behaviors.map((behavior) => ({ ...behavior, entity: behavior.entity ? entityLabels.get(behavior.entity) ?? behavior.entity : undefined })),
    policies: ir.policies.map((x) => ({ ...x, scope: x.scope ? entityLabels.get(x.scope) ?? x.scope : undefined })),
    invariants: ir.invariants.map((x) => ({ ...x, scope: x.scope ? entityLabels.get(x.scope) ?? x.scope : undefined })),
    constraints: ir.constraints.map((x) => ({ ...x, scope: x.scope ? entityLabels.get(x.scope) ?? x.scope : undefined })),
  };
}
