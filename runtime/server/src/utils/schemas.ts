import { z } from "zod";

/**
 * Accepts a numeric instance ID or a GML ref string like "@ref instance(100004)".
 * GML serializes instance refs as strings in JSON, so this allows both forms.
 */
export const instanceIdSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const match = val.match(/@ref instance\((\d+)\)/);
    if (match) return parseInt(match[1], 10);
    const n = parseInt(val, 10);
    if (!isNaN(n)) return n;
  }
  return val;
}, z.number());
