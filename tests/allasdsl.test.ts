import { describe, expect, it } from "vitest";
import { parseAllasDSL } from "../src/allasdsl/parser.js";
import { evaluateCompleteness } from "../src/completeness.js";

const source = `
system Shop
problem = "sell products"
objective = "create an order"

entity Customer
  property id: uuid required
end

entity Order
  property id: uuid required
  relation customer -> Customer one
  invariant PositiveTotal = "total must be >= 0"
end

behavior CreateOrder for Order
  given "customer exists"
  when "order is requested"
  then "one order exists"
  must_not "duplicate order"
end

flow Checkout
  step "validate customer"
  step "create order" invokes CreateOrder
end

intent Checkout
  uses Customer, Order
  behavior CreateOrder
  flow Checkout
  expects "one order is created"
end

constraint FastCheckout = "p99 < 500ms"
policy AuthorizedCheckout = "caller must be authorized"
`;

describe("AllasDSL", () => {
  it("parses the core semantic model", () => {
    const ir = parseAllasDSL(source, "test.allas");
    expect(ir.system.name).toBe("Shop");
    expect(ir.entities).toHaveLength(2);
    expect(ir.intents).toHaveLength(1);
    expect(ir.behaviors).toHaveLength(1);
    expect(ir.flows).toHaveLength(1);
    expect(ir.invariants).toHaveLength(1);
    expect(ir.constraints).toHaveLength(1);
    expect(ir.policies).toHaveLength(1);
    expect(ir.tests).toHaveLength(1);
    expect(ir.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("turns missing references into diagnostics/unresolved semantics", () => {
    const ir = parseAllasDSL(`system X\nentity A\nrelation b -> Missing one\nend`);
    expect(ir.unresolved).toHaveLength(1);
  });

  it("reports useful completeness", () => {
    const report = evaluateCompleteness(parseAllasDSL(source));
    expect(report.score).toBeGreaterThan(0.8);
    expect(report.readyForCompilation).toBe(true);
  });
});
