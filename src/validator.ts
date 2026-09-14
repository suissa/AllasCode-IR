import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import type { AllasCodeIR } from "./types.js";

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
    errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`),
  };
}
