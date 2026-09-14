import { describe, expect, it } from "vitest";
import { inferCustomRequirements } from "../src/custom-requirements.js";

describe("custom requirements inference", () => {
  it("extracts explicit markers as inferred semantics", () => {
    const ir = inferCustomRequirements(`
System: Orders
Problem: Customers need to place orders
Objective: One valid order is created
Entity: Customer
Entity: Order
Intent: PlaceOrder
Invariant: PositiveTotal = total must be non-negative
Constraint: Latency = p99 must stay bounded
Policy: Authorized = caller must be authorized
`, { sourceRef: "requirements.txt" });

    expect(ir.entities).toHaveLength(2);
    expect(ir.entities.every((entity) => entity.state === "inferred")).toBe(true);
    expect(ir.entities[0].provenance[0].sourceRef).toBe("requirements.txt");
    expect(ir.invariants).toHaveLength(1);
  });

  it("does not guess nouns into Entities when requirements are ambiguous", () => {
    const ir = inferCustomRequirements("We need a better way to manage appointments.");
    expect(ir.entities).toHaveLength(0);
    expect(ir.unresolved.some((item) => item.question.includes("Entidades"))).toBe(true);
  });
});
