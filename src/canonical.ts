import { createHash } from "node:crypto";
import type { AllasCodeIR, Provenance, SemanticNode } from "./types.js";

export function slug(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function semanticId(kind: string, canonicalLabel: string): string {
  const normalized = `${kind}:${canonicalLabel.trim().toLowerCase()}`;
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `${slug(kind)}_${hash}`;
}

export function canonicalLabel(system: string, kind: string, name: string): string {
  return `${system}.${kind}.${name}`.replace(/\s+/g, "");
}

export function nodeBase(
  system: string,
  kind: string,
  name: string,
  provenance: Provenance,
  state: SemanticNode["state"] = "confirmed",
): SemanticNode {
  const label = canonicalLabel(system, kind, name);
  return {
    id: semanticId(kind, label),
    canonicalLabel: label,
    name,
    state,
    provenance: [provenance],
  };
}

function sorted<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export function canonicalizeIR(ir: AllasCodeIR): AllasCodeIR {
  return {
    ...ir,
    entities: sorted(ir.entities).map((x) => ({
      ...x,
      properties: [...x.properties].sort((a, b) => a.name.localeCompare(b.name)),
      relations: [...x.relations].sort((a, b) => a.name.localeCompare(b.name)),
    })),
    intents: sorted(ir.intents).map((x) => ({
      ...x,
      entities: [...x.entities].sort(),
      behaviors: [...x.behaviors].sort(),
    })),
    behaviors: sorted(ir.behaviors),
    flows: sorted(ir.flows).map((x) => ({
      ...x,
      steps: [...x.steps].sort((a, b) => a.id.localeCompare(b.id)),
    })),
    policies: sorted(ir.policies),
    invariants: sorted(ir.invariants),
    constraints: sorted(ir.constraints),
    schemas: sorted(ir.schemas),
    tests: sorted(ir.tests),
    unresolved: [...ir.unresolved].sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics: [...ir.diagnostics].sort((a, b) =>
      `${a.severity}:${a.code}:${a.path ?? ""}`.localeCompare(`${b.severity}:${b.code}:${b.path ?? ""}`),
    ),
  };
}

export function semanticEquivalent(a: AllasCodeIR, b: AllasCodeIR): boolean {
  const stripProvenance = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripProvenance);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([key]) => key !== "provenance" && key !== "diagnostics")
          .map(([key, val]) => [key, stripProvenance(val)]),
      );
    }
    return value;
  };
  return JSON.stringify(stripProvenance(canonicalizeIR(a))) === JSON.stringify(stripProvenance(canonicalizeIR(b)));
}
