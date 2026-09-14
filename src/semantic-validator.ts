import type { AllasCodeIR, Diagnostic, SemanticNode } from "./types.js";

export function validateSemanticIR(ir: AllasCodeIR): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const collections: Array<[string, SemanticNode[]]> = [
    ["Entity", ir.entities],
    ["Intent", ir.intents],
    ["Behavior", ir.behaviors],
    ["Flow", ir.flows],
    ["Policy", ir.policies],
    ["Invariant", ir.invariants],
    ["Constraint", ir.constraints],
    ["Schema", ir.schemas],
    ["Test", ir.tests],
  ];

  const globalIds = new Map<string, string>();
  for (const [kind, nodes] of collections) {
    const labels = new Set<string>();
    for (const node of nodes) {
      if (labels.has(node.canonicalLabel)) diagnostics.push(error("IR_DUPLICATE_LABEL", `Duplicate ${kind} canonical label ${node.canonicalLabel}`));
      labels.add(node.canonicalLabel);
      const previous = globalIds.get(node.id);
      if (previous) diagnostics.push(error("IR_DUPLICATE_ID", `Semantic ID ${node.id} is shared by ${previous} and ${kind}:${node.canonicalLabel}`));
      else globalIds.set(node.id, `${kind}:${node.canonicalLabel}`);
    }
  }

  const entityRefs = new Set(ir.entities.flatMap((entity) => [entity.name, entity.canonicalLabel]));
  const behaviorRefs = new Set(ir.behaviors.flatMap((behavior) => [behavior.name, behavior.canonicalLabel]));
  const flowRefs = new Set(ir.flows.flatMap((flow) => [flow.name, flow.canonicalLabel]));

  for (const entity of ir.entities) {
    const propertyNames = new Set<string>();
    for (const property of entity.properties) {
      if (propertyNames.has(property.name)) diagnostics.push(error("ENTITY_DUPLICATE_PROPERTY", `${entity.canonicalLabel} declares property '${property.name}' more than once`));
      propertyNames.add(property.name);
    }
    for (const relation of entity.relations) {
      if (!entityRefs.has(relation.target)) diagnostics.push(error("ENTITY_MISSING_RELATION_TARGET", `${entity.canonicalLabel}.${relation.name} targets missing Entity ${relation.target}`));
    }
  }

  for (const behavior of ir.behaviors) {
    if (behavior.entity && !entityRefs.has(behavior.entity)) diagnostics.push(error("BEHAVIOR_MISSING_ENTITY", `${behavior.canonicalLabel} references missing Entity ${behavior.entity}`));
    if (behavior.then.length === 0) diagnostics.push(error("BEHAVIOR_NO_OUTCOME", `${behavior.canonicalLabel} has no observable postcondition`));
  }

  for (const flow of ir.flows) {
    if (flow.steps.length === 0) diagnostics.push(error("FLOW_EMPTY", `${flow.canonicalLabel} has no steps`));
    const stepIds = new Set<string>();
    for (const step of flow.steps) {
      if (stepIds.has(step.id)) diagnostics.push(error("FLOW_DUPLICATE_STEP", `${flow.canonicalLabel} contains duplicate step id ${step.id}`));
      stepIds.add(step.id);
    }
  }

  for (const intent of ir.intents) {
    for (const entity of intent.entities) if (!entityRefs.has(entity)) diagnostics.push(error("INTENT_MISSING_ENTITY", `${intent.canonicalLabel} references missing Entity ${entity}`));
    for (const behavior of intent.behaviors) if (!behaviorRefs.has(behavior)) diagnostics.push(error("INTENT_MISSING_BEHAVIOR", `${intent.canonicalLabel} references missing Behavior ${behavior}`));
    if (intent.flow && !flowRefs.has(intent.flow)) diagnostics.push(error("INTENT_MISSING_FLOW", `${intent.canonicalLabel} references missing Flow ${intent.flow}`));
  }

  const ruleKeys = new Map<string, string>();
  for (const [kind, rules] of [["Invariant", ir.invariants], ["Constraint", ir.constraints], ["Policy", ir.policies]] as const) {
    for (const rule of rules) {
      const key = `${rule.scope ?? "*"}:${rule.name}`.toLowerCase();
      const prior = ruleKeys.get(key);
      if (prior && prior !== rule.expression) diagnostics.push(error("RULE_CONTRADICTION", `${kind} ${rule.name} has conflicting expressions in scope ${rule.scope ?? "*"}`));
      else ruleKeys.set(key, rule.expression);
    }
  }

  return diagnostics;
}

function error(code: string, message: string): Diagnostic {
  return { severity: "error", code, message };
}
