import { describe, expect, it } from "vitest";
import {
  fromChatInterview,
  fromCustomRequirements,
  fromJson,
  fromMarkdown,
  fromOpenSpec,
  fromSpecKit,
  fromYaml,
} from "../src/adapters/index.js";
import { parseAllasDSL } from "../src/allasdsl/parser.js";
import { createConformanceReport } from "../src/conformance.js";

const allas = `
system Example
problem = "solve a domain problem"
objective = "produce the expected result"
entity Thing
  property id: uuid required
end
behavior Resolve for Thing
  given "thing exists"
  when "resolution is requested"
  then "expected result exists"
  must_not "duplicate result"
end
flow Primary
  step "validate"
  step "resolve"
end
intent Resolve
  uses Thing
  behavior Resolve
  flow Primary
  expects "expected result exists"
end
invariant UniqueResult = "result is unique"
constraint BoundedLatency = "latency is bounded"
policy Authorized = "caller is authorized"
`;

const structured = {
  name: "Example",
  problem: "solve a domain problem",
  objective: "produce the expected result",
  entities: [{ name: "Thing", properties: [{ name: "id", type: "uuid", required: true }] }],
  behaviors: [{ name: "Resolve", entity: "Thing", given: ["thing exists"], when: ["resolution is requested"], then: ["expected result exists"], mustNot: ["duplicate result"] }],
  flows: [{ name: "Primary", steps: ["validate", "resolve"] }],
  intents: [{ name: "Resolve", entities: ["Thing"], behaviors: ["Resolve"], flow: "Primary", expectedResult: "expected result exists" }],
  invariants: [{ name: "UniqueResult", expression: "result is unique" }],
  constraints: [{ name: "BoundedLatency", expression: "latency is bounded" }],
  policies: [{ name: "Authorized", expression: "caller is authorized" }],
};

describe("cross-adapter conformance", () => {
  it("normalizes all supported adapters to equivalent semantic IR", () => {
    const markdown = `# Example\n\n\`\`\`allasdsl\n${allas}\n\`\`\``;
    const report = createConformanceReport([
      { source: "AllasDSL", ir: parseAllasDSL(allas) },
      { source: "Spec Kit", ir: fromSpecKit(structured) },
      { source: "OpenSpec", ir: fromOpenSpec(structured) },
      { source: "JSON", ir: fromJson(JSON.stringify(structured)) },
      { source: "YAML", ir: fromYaml(`name: Example\nproblem: solve a domain problem\nobjective: produce the expected result\nentities:\n  - name: Thing\n    properties:\n      - { name: id, type: uuid, required: true }\nbehaviors:\n  - name: Resolve\n    entity: Thing\n    given: [thing exists]\n    when: [resolution is requested]\n    then: [expected result exists]\n    mustNot: [duplicate result]\nflows:\n  - name: Primary\n    steps: [validate, resolve]\nintents:\n  - name: Resolve\n    entities: [Thing]\n    behaviors: [Resolve]\n    flow: Primary\n    expectedResult: expected result exists\ninvariants:\n  - { name: UniqueResult, expression: result is unique }\nconstraints:\n  - { name: BoundedLatency, expression: latency is bounded }\npolicies:\n  - { name: Authorized, expression: caller is authorized }\n`) },
      { source: "Markdown", ir: fromMarkdown(markdown) },
      { source: "Custom", ir: fromCustomRequirements(markdown) },
      { source: "Chat", ir: fromChatInterview({
        system: "Example",
        problem: "solve a domain problem",
        solution: "produce the expected result",
        primaryFlow: "validate -> resolve",
        entities: structured.entities,
        behaviors: structured.behaviors,
        intents: structured.intents,
        invariants: structured.invariants,
        constraints: structured.constraints,
        policies: structured.policies,
      }) },
    ]);

    expect(report.allEquivalent).toBe(true);
    expect(report.results).toHaveLength(8);
    expect(report.results.every((result) => result.errorCount === 0)).toBe(true);
  });
});
