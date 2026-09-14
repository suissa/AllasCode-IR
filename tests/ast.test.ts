import { describe, expect, it } from "vitest";
import { compileAllasAST, parseAllasDSLToAST } from "../src/allasdsl/ast.js";

const source = `system ASTExample
problem = "model semantics"
entity Thing
  property id: uuid required
end
behavior Act for Thing
  when "requested"
  then "done"
end
`;

describe("AllasDSL AST", () => {
  it("creates a stable structural AST and compiles it to IR", () => {
    const ast = parseAllasDSLToAST(source);
    expect(ast.nodes.map(({ kind, name, startLine, endLine }) => ({ kind, name, startLine, endLine }))).toMatchInlineSnapshot(`
      [
        {
          "endLine": 1,
          "kind": "system",
          "name": "ASTExample",
          "startLine": 1,
        },
        {
          "endLine": 2,
          "kind": "metadata",
          "name": "problem",
          "startLine": 2,
        },
        {
          "endLine": 5,
          "kind": "entity",
          "name": "Thing",
          "startLine": 3,
        },
        {
          "endLine": 9,
          "kind": "behavior",
          "name": "Act",
          "startLine": 6,
        },
      ]
    `);
    const ir = compileAllasAST(ast);
    expect(ir.entities[0].name).toBe("Thing");
    expect(ir.behaviors[0].then).toEqual(["done"]);
  });
});
