import { fromMarkdown } from "./adapters/index.js";
import { nodeBase, semanticId } from "./canonical.js";
import type { AllasCodeIR, Provenance } from "./types.js";

export interface RequirementInferenceOptions {
  sourceRef?: string;
  defaultConfidence?: number;
}

function provenance(sourceRef: string | undefined, line: number, confidence: number, excerpt: string): Provenance {
  return { sourceKind: "custom", sourceRef, locator: `line:${line}`, excerpt, confidence };
}

/**
 * Deterministic, intentionally conservative fallback for requirement documents that
 * do not expose a known structure. It extracts only explicit linguistic markers and
 * leaves everything else as unresolved context instead of inventing domain facts.
 */
export function inferCustomRequirements(source: string, options: RequirementInferenceOptions = {}): AllasCodeIR {
  const explicit = fromMarkdown(source, options.sourceRef, "custom");
  if (
    explicit.entities.length || explicit.intents.length || explicit.behaviors.length || explicit.flows.length ||
    explicit.invariants.length || explicit.constraints.length || explicit.policies.length
  ) return explicit;

  const confidence = options.defaultConfidence ?? 0.7;
  const systemName = source.match(/(?:system|project)\s*[:=-]\s*([A-Za-z][\w-]*)/i)?.[1] ?? "CustomRequirements";
  explicit.system.name = systemName;

  const lines = source.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const p = provenance(options.sourceRef, index + 1, confidence, line);

    const problem = line.match(/^problem\s*[:=-]\s*(.+)$/i);
    if (problem) { explicit.system.problem = problem[1].trim(); return; }

    const objective = line.match(/^(?:objective|goal|expected result)\s*[:=-]\s*(.+)$/i);
    if (objective) { explicit.system.objective = objective[1].trim(); return; }

    const entity = line.match(/^entity\s*[:=-]?\s*([A-Za-z][\w-]*)(?:\s*[-:]\s*(.+))?$/i);
    if (entity) {
      const base = nodeBase(systemName, "entity", entity[1], p, "inferred");
      explicit.entities.push({ ...base, description: entity[2], properties: [], relations: [] });
      return;
    }

    const intent = line.match(/^intent\s*[:=-]?\s*([A-Za-z][\w-]*)(?:\s*[-:]\s*(.+))?$/i);
    if (intent) {
      const base = nodeBase(systemName, "intent", intent[1], p, "inferred");
      explicit.intents.push({ ...base, description: intent[2], entities: [], behaviors: [] });
      return;
    }

    const invariant = line.match(/^invariant\s*[:=-]?\s*([A-Za-z][\w-]*)\s*[:=-]\s*(.+)$/i);
    if (invariant) {
      const base = nodeBase(systemName, "invariant", invariant[1], p, "inferred");
      explicit.invariants.push({ ...base, expression: invariant[2].trim() });
      return;
    }

    const constraint = line.match(/^constraint\s*[:=-]?\s*([A-Za-z][\w-]*)\s*[:=-]\s*(.+)$/i);
    if (constraint) {
      const base = nodeBase(systemName, "constraint", constraint[1], p, "inferred");
      explicit.constraints.push({ ...base, expression: constraint[2].trim() });
      return;
    }

    const policy = line.match(/^policy\s*[:=-]?\s*([A-Za-z][\w-]*)\s*[:=-]\s*(.+)$/i);
    if (policy) {
      const base = nodeBase(systemName, "policy", policy[1], p, "inferred");
      explicit.policies.push({ ...base, expression: policy[2].trim() });
    }
  });

  if (!explicit.system.problem) {
    explicit.unresolved.push({
      id: semanticId("unresolved", `${systemName}:problem`),
      question: "Qual problema este conjunto de requisitos pretende resolver?",
      reason: "No explicit problem marker was found in the custom requirements",
      provenance: [{ sourceKind: "custom", sourceRef: options.sourceRef, confidence: 0.5 }],
    });
  }
  if (explicit.entities.length === 0) {
    explicit.unresolved.push({
      id: semanticId("unresolved", `${systemName}:entities`),
      question: "Quais Entidades aparecem nesse domínio?",
      reason: "No explicit Entity declaration was found; noun guessing is intentionally disabled",
      provenance: [{ sourceKind: "custom", sourceRef: options.sourceRef, confidence: 0.5 }],
    });
  }
  return explicit;
}
