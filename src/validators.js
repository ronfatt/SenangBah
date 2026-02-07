import Ajv from "ajv";
import { outputSchema } from "./schema.js";

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(outputSchema);

export function validateModelJson(data) {
  const ok = validate(data);
  if (!ok) {
    const errors = validate.errors || [];
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}
