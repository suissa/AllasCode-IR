import { parse as parseYaml } from "yaml";
import { fromMarkdown } from "./adapters/index.js";
import { nodeBase } from "./canonical.js";
import type { AllasCodeIR, Provenance } from "./types.js";

interface Frontmatter {
  name?: string;
  problem?: string;
  context?: string;
  objective?: string;
  [key: string]: unknown;
}

export function fromMarkdownSpec(source: string, sourceRef?: string): AllasCodeIR {
  const { frontmatter, body, bodyStartLine } = splitFrontmatter(source);
  const ir = fromMarkdown(body, sourceRef, "markdown");

  applyFrontmatter(ir, frontmatter);
  if (!ir.system.description && body.trim()) ir.system.description = body.trim();

  remapLineProvenance(ir, source, sourceRef, bodyStartLine);
  addAcceptanceContracts(ir, body, sourceRef, bodyStartLine);
  return ir;
}

function applyFrontmatter(ir: AllasCodeIR, frontmatter: Frontmatter): void {
  const apply = (key: "name" | "problem" | "context" | "objective", value: unknown) => {
    if (value == null) return;
    const next = String(value);
    const previous = ir.system[key];
    if (previous && previous !== next) {
      ir.diagnostics.push({
        severity: "warning",
        code: "MARKDOWN_FRONTMATTER_CONFLICT",
        message: `Frontmatter ${key} overrides a different body declaration`,
        path: `frontmatter.${key}`,
      });
    }
    ir.system[key] = next;
  };
  apply("name", frontmatter.name);
  apply("problem", frontmatter.problem);
  apply("context", frontmatter.context);
  apply("objective", frontmatter.objective);
}

function splitFrontmatter(source: string): { frontmatter: Frontmatter; body: string; bodyStartLine: number } {
  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    return { frontmatter: {}, body: source, bodyStartLine: 1 };
  }
  const lines = source.split(/\r?\n/);
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return { frontmatter: {}, body: source, bodyStartLine: 1 };
  const raw = lines.slice(1, end).join("\n");
  const parsed = parseYaml(raw);
  const frontmatter = parsed && typeof parsed === "object" ? parsed as Frontmatter : {};
  return { frontmatter, body: lines.slice(end + 1).join("\n"), bodyStartLine: end + 2 };
}

function remapLineProvenance(ir: AllasCodeIR, source: string, sourceRef: string | undefined, bodyStartLine: number): void {
  const lines = source.split(/\r?\n/);
  const nodes = [
    ...ir.entities,
    ...ir.intents,
    ...ir.behaviors,
    ...ir.flows,
    ...ir.invariants,
    ...ir.constraints,
    ...ir.policies,
    ...ir.schemas,
    ...ir.tests,
  ];

  for (const node of nodes) {
    const needle = node.name.toLowerCase();
    const index = lines.findIndex((line, lineIndex) => lineIndex + 1 >= bodyStartLine && line.toLowerCase().includes(needle));
    const p: Provenance = {
      sourceKind: "markdown",
      sourceRef,
      locator: index >= 0 ? `line:${index + 1}` : `line:${bodyStartLine}`,
      excerpt: index >= 0 ? lines[index].trim() : undefined,
      confidence: 1,
    };
    node.provenance = [p];
  }
}

function addAcceptanceContracts(ir: AllasCodeIR, body: string, sourceRef: string | undefined, bodyStartLine: number): void {
  const lines = body.split(/\r?\n/);
  let inAcceptance = false;
  let sequence = 0;
  lines.forEach((line, index) => {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const name = heading[1].trim().toLowerCase();
      inAcceptance = name.includes("acceptance") || name === "tests" || name.includes("acceptance criteria");
      return;
    }
    if (!inAcceptance) return;
    const item = line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim();
    if (!item) return;
    sequence += 1;
    const p: Provenance = {
      sourceKind: "markdown",
      sourceRef,
      locator: `line:${bodyStartLine + index}`,
      excerpt: item,
      confidence: 1,
    };
    const base = nodeBase(ir.system.name, "test", `Acceptance${sequence}`, p);
    ir.tests.push({ ...base, kind: "acceptance", given: [], when: [], then: [item], mustNot: [] });
  });
}
