import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { fromOpenSpec, fromSpecKit } from "../src/adapters/index.js";
import { semanticEquivalent } from "../src/canonical.js";

function fixture(name: string): unknown {
  return parseYaml(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

describe("source-specific adapters", () => {
  it("maps Spec Kit fixture with source provenance", () => {
    const ir = fromSpecKit(fixture("spec-kit.yaml"), "spec-kit.yaml");
    expect(ir.entities[0].provenance[0]).toMatchObject({ sourceKind: "spec-kit", sourceRef: "spec-kit.yaml" });
    expect(ir.intents[0].provenance[0].locator).toBe("intents[0]");
    expect(ir.tests).toHaveLength(1);
  });

  it("maps OpenSpec fixture and converges to the same semantics", () => {
    const specKit = fromSpecKit(fixture("spec-kit.yaml"), "spec-kit.yaml");
    const openSpec = fromOpenSpec(fixture("openspec.yaml"), "openspec.yaml");
    expect(openSpec.entities[0].provenance[0]).toMatchObject({ sourceKind: "openspec", sourceRef: "openspec.yaml" });
    expect(semanticEquivalent(specKit, openSpec)).toBe(true);
  });
});
