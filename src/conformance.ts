import { canonicalizeIR, semanticEquivalent } from "./canonical.js";
import type { AllasCodeIR } from "./types.js";

export interface ConformanceInput {
  source: string;
  ir: AllasCodeIR;
}

export interface ConformanceResult {
  source: string;
  equivalentToBaseline: boolean;
  entityCount: number;
  intentCount: number;
  behaviorCount: number;
  flowCount: number;
  ruleCount: number;
  testCount: number;
  unresolvedCount: number;
  errorCount: number;
}

export interface ConformanceReport {
  baseline: string;
  allEquivalent: boolean;
  generatedAt: string;
  results: ConformanceResult[];
}

export function createConformanceReport(inputs: ConformanceInput[], generatedAt = new Date(0).toISOString()): ConformanceReport {
  if (inputs.length === 0) throw new Error("At least one conformance input is required");
  const baseline = inputs[0];
  const baselineIR = canonicalizeIR(baseline.ir);

  const results = inputs.map(({ source, ir }) => {
    const normalized = canonicalizeIR(ir);
    return {
      source,
      equivalentToBaseline: semanticEquivalent(baselineIR, normalized),
      entityCount: normalized.entities.length,
      intentCount: normalized.intents.length,
      behaviorCount: normalized.behaviors.length,
      flowCount: normalized.flows.length,
      ruleCount: normalized.invariants.length + normalized.constraints.length + normalized.policies.length,
      testCount: normalized.tests.length,
      unresolvedCount: normalized.unresolved.length,
      errorCount: normalized.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    };
  });

  return {
    baseline: baseline.source,
    allEquivalent: results.every((result) => result.equivalentToBaseline),
    generatedAt,
    results,
  };
}
