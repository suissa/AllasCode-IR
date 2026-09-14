import { materializeIR, type MaterializedArtifact } from "./materialize.js";
import type { AllasCodeIR } from "./types.js";

export interface MaterializationPlan {
  create: MaterializedArtifact[];
  update: MaterializedArtifact[];
  unchanged: string[];
  delete: string[];
}

export function planMaterialization(ir: AllasCodeIR, existing: Record<string, string>): MaterializationPlan {
  const desired = materializeIR(ir);
  const desiredMap = new Map(desired.map((artifact) => [artifact.path, artifact.content]));
  const create: MaterializedArtifact[] = [];
  const update: MaterializedArtifact[] = [];
  const unchanged: string[] = [];

  for (const artifact of desired) {
    if (!(artifact.path in existing)) create.push(artifact);
    else if (existing[artifact.path] !== artifact.content) update.push(artifact);
    else unchanged.push(artifact.path);
  }

  const remove = Object.keys(existing).filter((path) => !desiredMap.has(path)).sort();
  return {
    create: create.sort((a, b) => a.path.localeCompare(b.path)),
    update: update.sort((a, b) => a.path.localeCompare(b.path)),
    unchanged: unchanged.sort(),
    delete: remove,
  };
}
