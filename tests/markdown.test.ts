import { describe, expect, it } from "vitest";
import { fromMarkdownSpec } from "../src/markdown.js";

describe("Markdown specification adapter", () => {
  it("applies frontmatter and preserves line-level provenance", () => {
    const ir = fromMarkdownSpec(`---
name: Orders
problem: Customers need to place orders
objective: One valid order is created
---
# Semantic Model

\`\`\`allasdsl
system Orders
entity Order
  property id: uuid required
end
behavior Create for Order
  when "requested"
  then "one order exists"
end
flow Primary
  step "create"
end
intent Create
  uses Order
  behavior Create
  flow Primary
  expects "one order exists"
end
\`\`\`

# Acceptance Criteria
- exactly one order is created
`, "orders.md");

    expect(ir.system.name).toBe("Orders");
    expect(ir.system.problem).toBe("Customers need to place orders");
    expect(ir.entities[0].provenance[0].sourceRef).toBe("orders.md");
    expect(ir.entities[0].provenance[0].locator).toMatch(/^line:/);
    expect(ir.tests.some((test) => test.kind === "acceptance" && test.then.includes("exactly one order is created"))).toBe(true);
  });
});
