import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { ErrorObject } from "ajv";
import type { AllasCodeIR } from "./types.js";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default as new (options?: Record<string, unknown>) => {
  compile(schema: unknown): {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateIRSchema(ir: AllasCodeIR, schemaPath = "schema/allascode-ir.schema.json"): ValidationResult {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = Boolean(validate(ir));
  return {
    valid,
    errors: (validate.errors ?? []).map((error: ErrorObject) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`),
  };
}
