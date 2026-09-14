import { semanticId } from "./canonical.js";
import type { AllasCodeIR, SemanticState } from "./types.js";

export interface SemanticSuggestion {
  id: string;
  kind: "property" | "relation" | "intent" | "behavior" | "flow" | "invariant" | "constraint" | "policy" | "question";
  relatedTo?: string;
  state: Extract<SemanticState, "suggested">;
  rationale: string;
  question: string;
  candidate?: unknown;
  confidence: number;
}

export interface CompletenessReport {
  score: number;
  readyForCompilation: boolean;
  dimensions: Record<string, { complete: boolean; score: number; reason: string }>;
  suggestions: SemanticSuggestion[];
}

export function evaluateCompleteness(ir: AllasCodeIR): CompletenessReport {
  const dimensions: CompletenessReport["dimensions"] = {};
  const suggestions: SemanticSuggestion[] = [];

  const set = (name: string, complete: boolean, score: number, reason: string) => {
    dimensions[name] = { complete, score, reason };
  };

  set("problem", Boolean(ir.system.problem?.trim()), ir.system.problem ? 1 : 0, ir.system.problem ? "Problem is defined" : "Problem is missing");
  set("objective", Boolean(ir.system.objective?.trim()), ir.system.objective ? 1 : 0, ir.system.objective ? "Objective is defined" : "Expected objective/result is missing");
  set("entities", ir.entities.length > 0, ir.entities.length > 0 ? 1 : 0, `${ir.entities.length} Entities defined`);
  set("intents", ir.intents.length > 0, ir.intents.length > 0 ? 1 : 0, `${ir.intents.length} Intents defined`);
  set("behaviors", ir.behaviors.length > 0, ir.behaviors.length > 0 ? 1 : 0, `${ir.behaviors.length} Behaviors defined`);
  set("flows", ir.flows.length > 0, ir.flows.length > 0 ? 1 : 0, `${ir.flows.length} Flows defined`);
  set("invariants", ir.invariants.length > 0, ir.invariants.length > 0 ? 1 : 0, `${ir.invariants.length} Invariants defined`);
  set("constraints", ir.constraints.length > 0, ir.constraints.length > 0 ? 1 : 0, `${ir.constraints.length} Constraints defined`);
  set("policies", ir.policies.length > 0, ir.policies.length > 0 ? 1 : 0, `${ir.policies.length} Policies defined`);
  set("acceptance", ir.tests.length > 0, ir.tests.length > 0 ? 1 : 0, `${ir.tests.length} executable behavior contracts defined`);
  set("resolved", ir.unresolved.length === 0, ir.unresolved.length === 0 ? 1 : 0, `${ir.unresolved.length} unresolved semantic gaps`);

  if (!ir.system.problem) {
    suggestions.push({ id: semanticId("suggestion", `${ir.system.name}:problem`), kind: "question", state: "suggested", rationale: "Problem-first elicitation anchors every downstream semantic decision.", question: "Qual problema você quer resolver?", confidence: 1 });
  }
  if (!ir.system.objective) {
    suggestions.push({ id: semanticId("suggestion", `${ir.system.name}:objective`), kind: "question", state: "suggested", rationale: "A system needs an observable definition of success.", question: "Qual resultado esperado provará que o problema foi resolvido?", confidence: 1 });
  }
  if (ir.flows.length === 0) {
    suggestions.push({ id: semanticId("suggestion", `${ir.system.name}:primary-flow`), kind: "flow", state: "suggested", rationale: "The primary flow connects the problem to the expected result.", question: "Qual é o fluxo principal que resolve esse problema?", confidence: 0.95 });
  }
  if (ir.entities.length === 0) {
    suggestions.push({ id: semanticId("suggestion", `${ir.system.name}:entities`), kind: "question", state: "suggested", rationale: "Entities identify the stable domain concepts manipulated by Intents and Behaviors.", question: "Quais são as Entidades necessárias para executar esse fluxo?", confidence: 0.95 });
  }

  for (const entity of ir.entities) {
    if (!entity.properties.some((property) => /^id$/i.test(property.name))) {
      suggestions.push({
        id: semanticId("suggestion", `${entity.canonicalLabel}:id`),
        kind: "property",
        relatedTo: entity.id,
        state: "suggested",
        rationale: "A stable semantic identity normally needs an explicit identifier or canonical characteristic.",
        question: `A Entidade ${entity.name} possui uma identidade estável?`,
        candidate: { name: "id", type: "uuid", required: true },
        confidence: 0.65,
      });
    }
  }

  for (const intent of ir.intents) {
    if (intent.entities.length === 0) suggestions.push({ id: semanticId("suggestion", `${intent.canonicalLabel}:entities`), kind: "question", relatedTo: intent.id, state: "suggested", rationale: "An Intent should identify which domain state it acts upon.", question: `Quais Entidades participam do Intent ${intent.name}?`, confidence: 0.9 });
    if (intent.behaviors.length === 0) suggestions.push({ id: semanticId("suggestion", `${intent.canonicalLabel}:behaviors`), kind: "behavior", relatedTo: intent.id, state: "suggested", rationale: "Intent execution requires explicit expected behavior.", question: `Qual comportamento deve emergir quando ${intent.name} for executado?`, confidence: 0.9 });
    if (!intent.expectedResult) suggestions.push({ id: semanticId("suggestion", `${intent.canonicalLabel}:result`), kind: "question", relatedTo: intent.id, state: "suggested", rationale: "Expected result allows acceptance to be evaluated without implementation knowledge.", question: `Como sabemos que o Intent ${intent.name} terminou corretamente?`, confidence: 0.9 });
  }

  for (const behavior of ir.behaviors) {
    if (behavior.then.length === 0) suggestions.push({ id: semanticId("suggestion", `${behavior.canonicalLabel}:then`), kind: "question", relatedTo: behavior.id, state: "suggested", rationale: "Behavior without an observable postcondition cannot be validated.", question: `Qual resultado observável o Behavior ${behavior.name} deve produzir?`, confidence: 1 });
    if (behavior.mustNot.length === 0) suggestions.push({ id: semanticId("suggestion", `${behavior.canonicalLabel}:must-not`), kind: "invariant", relatedTo: behavior.id, state: "suggested", rationale: "Forbidden outcomes reduce ambiguity and later become executable negative knowledge.", question: `O que nunca pode acontecer durante ${behavior.name}?`, confidence: 0.8 });
  }

  for (const unresolved of ir.unresolved) {
    suggestions.push({ id: semanticId("suggestion", unresolved.id), kind: "question", relatedTo: unresolved.relatedTo?.[0], state: "suggested", rationale: unresolved.reason, question: unresolved.question, confidence: 1 });
  }

  const values = Object.values(dimensions);
  const score = values.length === 0 ? 0 : values.reduce((total, item) => total + item.score, 0) / values.length;
  const readyForCompilation = score >= 0.8 && !ir.diagnostics.some((diagnostic) => diagnostic.severity === "error") && ir.unresolved.length === 0;
  return { score, readyForCompilation, dimensions, suggestions };
}
