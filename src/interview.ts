import { fromChatInterview, type ChatInterviewInput } from "./adapters/index.js";
import { evaluateCompleteness } from "./completeness.js";
import type { AllasCodeIR } from "./types.js";

export interface InterviewMessage {
  role: "developer" | "forger";
  text: string;
  at: string;
}

export interface SuggestionDecision {
  suggestionId: string;
  state: "confirmed" | "rejected";
  at: string;
  note?: string;
}

export interface InterviewSession {
  version: "0.1";
  id: string;
  createdAt: string;
  updatedAt: string;
  input: ChatInterviewInput;
  ir: AllasCodeIR;
  transcript: InterviewMessage[];
  decisions: SuggestionDecision[];
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
    decisions: [],
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

export function decideSuggestion(
  session: InterviewSession,
  suggestionId: string,
  state: SuggestionDecision["state"],
  note?: string,
  now = new Date().toISOString(),
): InterviewSession {
  const exists = evaluateCompleteness(session.ir).suggestions.some((suggestion) => suggestion.id === suggestionId);
  if (!exists) throw new Error(`Unknown semantic suggestion: ${suggestionId}`);
  const prior = session.decisions.filter((decision) => decision.suggestionId !== suggestionId);
  return {
    ...session,
    updatedAt: now,
    decisions: [...prior, { suggestionId, state, note, at: now }],
  };
}

export function nextInterviewQuestions(session: InterviewSession, limit = 3): string[] {
  const decided = new Set(session.decisions.map((decision) => decision.suggestionId));
  return evaluateCompleteness(session.ir).suggestions
    .filter((suggestion) => !decided.has(suggestion.id))
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
  value.decisions ??= [];
  value.transcript ??= [];
  return value;
}
