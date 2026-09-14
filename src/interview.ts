import { fromChatInterview, type ChatInterviewInput } from "./adapters/index.js";
import { evaluateCompleteness } from "./completeness.js";
import type { AllasCodeIR } from "./types.js";

export interface InterviewMessage {
  role: "developer" | "forger";
  text: string;
  at: string;
}

export interface InterviewSession {
  version: "0.1";
  id: string;
  createdAt: string;
  updatedAt: string;
  input: ChatInterviewInput;
  ir: AllasCodeIR;
  transcript: InterviewMessage[];
}

function stableSessionId(input: ChatInterviewInput): string {
  const basis = `${input.system ?? "InterviewedSystem"}:${input.problem}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `interview-${basis || "session"}`;
}

export function createInterviewSession(input: ChatInterviewInput, now = new Date().toISOString()): InterviewSession {
  const transcript: InterviewMessage[] = (input.transcript ?? []).map((message) => ({ ...message, at: now }));
  return {
    version: "0.1",
    id: stableSessionId(input),
    createdAt: now,
    updatedAt: now,
    input,
    ir: fromChatInterview(input, `interview:${stableSessionId(input)}`),
    transcript,
  };
}

export function updateInterviewSession(session: InterviewSession, patch: Partial<ChatInterviewInput>, now = new Date().toISOString()): InterviewSession {
  const input: ChatInterviewInput = {
    ...session.input,
    ...patch,
    problem: patch.problem ?? session.input.problem,
  };
  return {
    ...session,
    updatedAt: now,
    input,
    ir: fromChatInterview(input, `interview:${session.id}`),
  };
}

export function appendInterviewMessage(session: InterviewSession, role: InterviewMessage["role"], text: string, now = new Date().toISOString()): InterviewSession {
  return {
    ...session,
    updatedAt: now,
    transcript: [...session.transcript, { role, text, at: now }],
  };
}

export function nextInterviewQuestions(session: InterviewSession, limit = 3): string[] {
  return evaluateCompleteness(session.ir).suggestions
    .map((suggestion) => suggestion.question)
    .filter((question, index, all) => all.indexOf(question) === index)
    .slice(0, limit);
}

export function serializeInterviewSession(session: InterviewSession): string {
  return `${JSON.stringify(session, null, 2)}\n`;
}

export function resumeInterviewSession(serialized: string): InterviewSession {
  const value = JSON.parse(serialized) as InterviewSession;
  if (value.version !== "0.1" || !value.id || !value.input?.problem || !value.ir) {
    throw new Error("Invalid or unsupported AllasCodeForger interview session");
  }
  return value;
}
