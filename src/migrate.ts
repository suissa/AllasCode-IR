import { canonicalizeIR } from "./canonical.js";
import type { AllasCodeIR } from "./types.js";

export interface MigrationReport {
  sourceVersion: string;
  targetVersion: string;
  transformedFields: string[];
  warnings: string[];
  unresolvedSemanticChanges: string[];
  semanticIdsPreserved: boolean;
}

export interface MigrationResult {
  ir: AllasCodeIR;
  report: MigrationReport;
}

export function migrateIR(input: AllasCodeIR, targetVersion: "0.1" = "0.1"): MigrationResult {
  const sourceVersion = input.irVersion;
  if (targetVersion !== "0.1") throw new Error(`Unsupported target IR version: ${targetVersion}`);
  if (sourceVersion !== "0.1") throw new Error(`No deterministic migration is registered from IR ${sourceVersion} to ${targetVersion}`);

  const beforeIds = collectIds(input);
  const ir = canonicalizeIR(structuredClone(input));
  const afterIds = collectIds(ir);

  return {
    ir,
    report: {
      sourceVersion,
      targetVersion,
      transformedFields: [],
      warnings: [],
      unresolvedSemanticChanges: [],
      semanticIdsPreserved: beforeIds.length === afterIds.length && beforeIds.every((id, index) => id === afterIds[index]),
    },
  };
}

function collectIds(ir: AllasCodeIR): string[] {
  return [
    ...ir.entities,
    ...ir.intents,
    ...ir.behaviors,
    ...ir.flows,
    ...ir.policies,
    ...ir.invariants,
    ...ir.constraints,
    ...ir.schemas,
    ...ir.tests,
  ].map((node) => node.id).sort();
}
