import { parseAllasDSL } from "./parser.js";
import type { AllasCodeIR } from "../types.js";

export type AllasASTKind = "system" | "metadata" | "entity" | "intent" | "behavior" | "flow" | "rule" | "unknown";

export interface AllasASTNode {
  kind: AllasASTKind;
  name?: string;
  keyword: string;
  startLine: number;
  endLine: number;
  header: string;
  body: string[];
}

export interface AllasAST {
  version: "0.1";
  source: string;
  nodes: AllasASTNode[];
}

export function parseAllasDSLToAST(source: string): AllasAST {
  const lines = source.split(/\r?\n/);
  const nodes: AllasASTNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const block = line.match(/^(entity|intent|behavior|flow)\s+(\S+)/i);
    if (block) {
      const body: string[] = [];
      let end = index;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        body.push(lines[cursor]);
        end = cursor;
        if (lines[cursor].trim().toLowerCase() === "end") break;
      }
      nodes.push({
        kind: block[1].toLowerCase() as AllasASTKind,
        name: block[2],
        keyword: block[1].toLowerCase(),
        startLine: index + 1,
        endLine: end + 1,
        header: raw,
        body,
      });
      index = end;
      continue;
    }

    const system = line.match(/^system\s+(.+)$/i);
    if (system) {
      nodes.push({ kind: "system", name: system[1].trim(), keyword: "system", startLine: index + 1, endLine: index + 1, header: raw, body: [] });
      continue;
    }

    const metadata = line.match(/^(problem|context|objective)\s*=/i);
    if (metadata) {
      nodes.push({ kind: "metadata", name: metadata[1].toLowerCase(), keyword: metadata[1].toLowerCase(), startLine: index + 1, endLine: index + 1, header: raw, body: [] });
      continue;
    }

    const rule = line.match(/^(invariant|constraint|policy)\s+(\S+)/i);
    if (rule) {
      nodes.push({ kind: "rule", name: rule[2], keyword: rule[1].toLowerCase(), startLine: index + 1, endLine: index + 1, header: raw, body: [] });
      continue;
    }

    nodes.push({ kind: "unknown", keyword: line.split(/\s+/)[0] ?? "", startLine: index + 1, endLine: index + 1, header: raw, body: [] });
  }

  return { version: "0.1", source, nodes };
}

export function compileAllasAST(ast: AllasAST, sourceRef?: string): AllasCodeIR {
  return parseAllasDSL(ast.source, sourceRef);
}
