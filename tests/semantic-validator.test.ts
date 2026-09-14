import { describe, expect, it } from "vitest";
import { parseAllasDSL } from "../src/allasdsl/parser.js";
import { validateSemanticIR } from "../src/semantic-validator.js";

describe("semantic validator", () => {
  it("accepts a coherent semantic model", () => {
    const ir = parseAllasDSL(`
system Valid
entity A
  property id: uuid required
end
behavior Do for A
  when "requested"
  then "done"
end
flow Primary
  step "do"
end
intent Do
  uses A
  behavior Do
  flow Primary
  expects "done"
end
`);
    expect(validateSemanticIR(ir)).toEqual([]);
  });

  it("detects duplicate semantics and empty flows", () => {
    const ir = parseAllasDSL(`system Broken\nentity A\nend\nflow Empty\nend`);
    ir.entities.push(structuredClone(ir.entities[0]));
    const diagnostics = validateSemanticIR(ir);
    expect(diagnostics.some((item) => item.code === "IR_DUPLICATE_LABEL")).toBe(true);
    expect(diagnostics.some((item) => item.code === "IR_DUPLICATE_ID")).toBe(true);
    expect(diagnostics.some((item) => item.code === "FLOW_EMPTY")).toBe(true);
  });
});
