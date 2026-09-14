import { describe, expect, it } from "vitest";
import {
  createInterviewSession,
  nextInterviewQuestions,
  resumeInterviewSession,
  serializeInterviewSession,
  updateInterviewSession,
} from "../src/interview.js";

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
});
