import { describe, expect, it } from "vitest";
import {
  createInterviewSession,
  decideSuggestion,
  nextInterviewQuestions,
  resumeInterviewSession,
  serializeInterviewSession,
  updateInterviewSession,
} from "../src/interview.js";
import { evaluateCompleteness } from "../src/completeness.js";

describe("AllasCodeForger interview session", () => {
  it("can save and resume partial semantic elicitation", () => {
    const session = createInterviewSession({ problem: "schedule clinic appointments" }, "2026-09-14T00:00:00.000Z");
    expect(nextInterviewQuestions(session)).toContain("Qual resultado esperado provará que o problema foi resolvido?");

    const updated = updateInterviewSession(session, {
      solution: "one valid appointment is scheduled",
      entities: ["Patient", "Appointment"],
      primaryFlow: "validate patient -> check availability -> schedule appointment",
    }, "2026-09-14T00:01:00.000Z");

    const restored = resumeInterviewSession(serializeInterviewSession(updated));
    expect(restored.id).toBe(session.id);
    expect(restored.ir.entities).toHaveLength(2);
    expect(restored.ir.flows).toHaveLength(1);
    expect(restored.input.solution).toBe("one valid appointment is scheduled");
  });

  it("preserves confirmation/rejection decisions as interview provenance", () => {
    const session = createInterviewSession({ problem: "schedule clinic appointments" }, "2026-09-14T00:00:00.000Z");
    const suggestion = evaluateCompleteness(session.ir).suggestions[0];
    const decided = decideSuggestion(session, suggestion.id, "rejected", "not applicable", "2026-09-14T00:02:00.000Z");
    expect(decided.decisions).toEqual([{ suggestionId: suggestion.id, state: "rejected", note: "not applicable", at: "2026-09-14T00:02:00.000Z" }]);
    expect(resumeInterviewSession(serializeInterviewSession(decided)).decisions[0].state).toBe("rejected");
  });
});
