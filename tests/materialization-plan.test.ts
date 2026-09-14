import { describe, expect, it } from "vitest";
import { parseAllasDSL } from "../src/allasdsl/parser.js";
import { materializeIR } from "../src/materialize.js";
import { planMaterialization } from "../src/materialization-plan.js";

describe("incremental materialization", () => {
  it("keeps unchanged artifacts untouched", () => {
    const ir = parseAllasDSL(`
system M
entity A
  property id: uuid required
end
entity B
  property id: uuid required
end
`);
    const first = materializeIR(ir);
    const existing = Object.fromEntries(first.map((artifact) => [artifact.path, artifact.content]));
    const plan = planMaterialization(ir, existing);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.delete).toEqual([]);
    expect(plan.unchanged).toHaveLength(first.length);
  });
});
