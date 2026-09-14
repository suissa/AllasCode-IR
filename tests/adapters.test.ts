import { describe, expect, it } from "vitest";
import { fromJson, fromOpenSpec, fromSpecKit, fromYaml } from "../src/adapters/index.js";
import { semanticEquivalent } from "../src/canonical.js";
import { materializeIR } from "../src/materialize.js";

const object = {
  name: "Inventory",
  problem: "track stock",
  objective: "keep stock consistent",
  entities: [{ name: "Product", properties: [{ name: "id", type: "uuid", required: true }] }],
  behaviors: [{ name: "AdjustStock", entity: "Product", given: ["product exists"], when: ["adjustment arrives"], then: ["stock is updated"], mustNot: ["stock becomes inconsistent"] }],
  intents: [{ name: "AdjustStock", entities: ["Product"], behaviors: ["AdjustStock"], expectedResult: "stock is updated" }],
  flows: [{ name: "Adjustment", steps: ["validate", "apply", "emit"] }],
  invariants: [{ name: "ConsistentStock", scope: "Product", expression: "stock must be consistent" }],
  constraints: [{ name: "Latency", expression: "p99 < 100ms" }],
  policies: [{ name: "Authorized", expression: "caller must be authorized" }]
};

describe("input adapters", () => {
  it("normalizes JSON and YAML to semantically equivalent IR", () => {
    const json = fromJson(JSON.stringify(object));
    const yaml = fromYaml(`
name: Inventory
problem: track stock
objective: keep stock consistent
entities:
  - name: Product
    properties:
      - name: id
        type: uuid
        required: true
behaviors:
  - name: AdjustStock
    entity: Product
    given: [product exists]
    when: [adjustment arrives]
    then: [stock is updated]
    mustNot: [stock becomes inconsistent]
intents:
  - name: AdjustStock
    entities: [Product]
    behaviors: [AdjustStock]
    expectedResult: stock is updated
flows:
  - name: Adjustment
    steps: [validate, apply, emit]
invariants:
  - name: ConsistentStock
    scope: Product
    expression: stock must be consistent
constraints:
  - name: Latency
    expression: p99 < 100ms
policies:
  - name: Authorized
    expression: caller must be authorized
`);
    expect(semanticEquivalent(json, yaml)).toBe(true);
  });

  it("uses the same canonical core for Spec Kit and OpenSpec adapters", () => {
    expect(semanticEquivalent(fromSpecKit(object), fromOpenSpec(object))).toBe(true);
  });

  it("materializes deterministic semantic artifact folders", () => {
    const files = materializeIR(fromSpecKit(object));
    expect(files.some((file) => file.path.startsWith("entities/"))).toBe(true);
    expect(files.some((file) => file.path.startsWith("intents/"))).toBe(true);
    expect(files.some((file) => file.path.startsWith("behaviors/"))).toBe(true);
    expect(files.some((file) => file.path.startsWith("tests/"))).toBe(true);
    expect(files.at(-1)?.path === "manifest.yml" || files.some((file) => file.path === "manifest.yml")).toBe(true);
  });
});
