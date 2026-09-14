import { stringify as toYaml } from "yaml";
import { canonicalizeIR, slug } from "./canonical.js";
import type { AllasCodeIR, SemanticNode } from "./types.js";

export interface MaterializedArtifact {
  path: string;
  content: string;
}

function artifactPath(folder: string, node: SemanticNode): string {
  return `${folder}/${slug(node.canonicalLabel)}.yml`;
}

function yamlArtifact(kind: string, node: unknown): string {
  return toYaml({ kind, apiVersion: "allascode.io/ir/v0.1", spec: node }, { sortMapEntries: true, lineWidth: 120 });
}

export function materializeIR(ir: AllasCodeIR): MaterializedArtifact[] {
  const canonical = canonicalizeIR(ir);
  const out: MaterializedArtifact[] = [];

  const pushMany = (folder: string, kind: string, nodes: SemanticNode[]) => {
    for (const node of nodes) out.push({ path: artifactPath(folder, node), content: yamlArtifact(kind, node) });
  };

  pushMany("entities", "Entity", canonical.entities);
  pushMany("intents", "Intent", canonical.intents);
  pushMany("behaviors", "Behavior", canonical.behaviors);
  pushMany("flows", "Flow", canonical.flows);
  pushMany("policies", "Policy", canonical.policies);
  pushMany("invariants", "Invariant", canonical.invariants);
  pushMany("constraints", "Constraint", canonical.constraints);
  pushMany("schemas", "Schema", canonical.schemas);
  pushMany("tests", "TestContract", canonical.tests);

  out.push({
    path: "manifest.yml",
    content: toYaml(
      {
        apiVersion: "allascode.io/ir/v0.1",
        kind: "SemanticManifest",
        system: canonical.system,
        irVersion: canonical.irVersion,
        counts: {
          entities: canonical.entities.length,
          intents: canonical.intents.length,
          behaviors: canonical.behaviors.length,
          flows: canonical.flows.length,
          policies: canonical.policies.length,
          invariants: canonical.invariants.length,
          constraints: canonical.constraints.length,
          schemas: canonical.schemas.length,
          tests: canonical.tests.length,
          unresolved: canonical.unresolved.length,
        },
        unresolved: canonical.unresolved,
      },
      { sortMapEntries: true, lineWidth: 120 },
    ),
  });

  return out.sort((a, b) => a.path.localeCompare(b.path));
}
