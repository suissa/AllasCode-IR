import { describe, expect, it } from "vitest";
import { parseAllasDSL } from "../src/allasdsl/parser.js";
import { migrateIR } from "../src/migrate.js";

const source = `
system IdentityExample
problem = "preserve semantics"
objective = "keep stable ids"
entity Item
  property id: uuid required
end
behavior Keep for Item
  given "item exists"
  when "migration runs"
  then "item meaning is unchanged"
end
flow Primary
  step "migrate"
end
intent Keep
  uses Item
  behavior Keep
  flow Primary
  expects "same semantics"
end
`;

describe("IR migration", () => {
  it("preserves semantic ids for representation-only v0.1 migration", () => {
    const input = parseAllasDSL(source);
    const result = migrateIR(input);
    expect(result.report.semanticIdsPreserved).toBe(true);
    expect(result.report.unresolvedSemanticChanges).toEqual([]);
    expect(result.ir.entities[0].id).toBe(input.entities[0].id);
  });
});
