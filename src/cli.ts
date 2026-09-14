#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { Command } from "commander";
import { stringify as toYaml, parse as parseYaml } from "yaml";
import { parseAllasDSL, toCanonicalReferences } from "./allasdsl/parser.js";
import { canonicalizeIR } from "./canonical.js";
import { evaluateCompleteness } from "./completeness.js";
import { inferCustomRequirements } from "./custom-requirements.js";
import { validateSemanticIR } from "./semantic-validator.js";
import {
  fromChatInterview,
  fromJson,
  fromMarkdown,
  fromOpenSpec,
  fromSpecKit,
  fromYaml,
  type ChatInterviewInput,
} from "./adapters/index.js";
import { materializeIR } from "./materialize.js";
import { validateIRSchema } from "./validator.js";
import type { AllasCodeIR } from "./types.js";

const program = new Command();
program.name("allas-ir").description("Compile semantic specifications into canonical AllasCode IR").version("0.1.0");

type Format = "allasdsl" | "json" | "yaml" | "markdown" | "spec-kit" | "openspec" | "custom" | "chat";

function inferFormat(path: string): Format {
  const ext = extname(path).toLowerCase();
  if (ext === ".allas") return "allasdsl";
  if (ext === ".json") return "json";
  if (ext === ".yaml" || ext === ".yml") return "yaml";
  if (ext === ".md") return "markdown";
  throw new Error(`Cannot infer input format from ${path}; pass --format`);
}

function parseInput(path: string, format?: string): AllasCodeIR {
  const source = readFileSync(path, "utf8");
  const selected = (format ?? inferFormat(path)) as Format;
  switch (selected) {
    case "allasdsl": return parseAllasDSL(source, path);
    case "json": return fromJson(source, path);
    case "yaml": return fromYaml(source, path);
    case "markdown": return fromMarkdown(source, path);
    case "custom": return inferCustomRequirements(source, { sourceRef: path });
    case "spec-kit": return fromSpecKit(extname(path) === ".json" ? JSON.parse(source) : parseYaml(source), path);
    case "openspec": return fromOpenSpec(extname(path) === ".json" ? JSON.parse(source) : parseYaml(source), path);
    case "chat": return fromChatInterview((extname(path) === ".json" ? JSON.parse(source) : parseYaml(source)) as ChatInterviewInput, path);
    default: throw new Error(`Unsupported format: ${selected satisfies never}`);
  }
}

function canonicalInput(path: string, format?: string): AllasCodeIR {
  return canonicalizeIR(toCanonicalReferences(parseInput(path, format)));
}

function emit(ir: AllasCodeIR, output?: string, yaml = false): void {
  const canonical = canonicalizeIR(toCanonicalReferences(ir));
  const content = yaml ? toYaml(canonical, { sortMapEntries: true, lineWidth: 120 }) : `${JSON.stringify(canonical, null, 2)}\n`;
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, content);
  } else process.stdout.write(content);
}

program
  .command("compile")
  .argument("<input>")
  .option("-f, --format <format>", "allasdsl|json|yaml|markdown|spec-kit|openspec|custom|chat")
  .option("-o, --output <path>")
  .option("--yaml", "emit YAML instead of JSON")
  .action((input, options) => emit(parseInput(input, options.format), options.output, options.yaml));

program
  .command("validate")
  .argument("<input>")
  .option("-f, --format <format>")
  .action((input, options) => {
    const ir = canonicalInput(input, options.format);
    const schema = validateIRSchema(ir);
    const semanticDiagnostics = validateSemanticIR(ir);
    const completeness = evaluateCompleteness(ir);
    const diagnostics = [...ir.diagnostics, ...semanticDiagnostics];
    process.stdout.write(`${JSON.stringify({ schema, completeness, diagnostics, unresolved: ir.unresolved }, null, 2)}\n`);
    if (!schema.valid || diagnostics.some((diagnostic) => diagnostic.severity === "error")) process.exitCode = 1;
  });

program
  .command("materialize")
  .argument("<input>")
  .requiredOption("-o, --output <directory>")
  .option("-f, --format <format>")
  .action((input, options) => {
    const ir = canonicalInput(input, options.format);
    const artifacts = materializeIR(ir);
    for (const artifact of artifacts) {
      const path = join(options.output, artifact.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, artifact.content);
    }
    process.stdout.write(`Materialized ${artifacts.length} artifacts into ${options.output}\n`);
  });

program
  .command("completeness")
  .argument("<input>")
  .option("-f, --format <format>")
  .action((input, options) => {
    process.stdout.write(`${JSON.stringify(evaluateCompleteness(canonicalInput(input, options.format)), null, 2)}\n`);
  });

await program.parseAsync();
