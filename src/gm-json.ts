import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

export interface GmJsonParseResult<T = unknown> {
  value?: T;
  errors: Array<{ code: string; offset: number; length: number }>;
}

export function parseGmJson<T = unknown>(text: string): GmJsonParseResult<T> {
  const parseErrors: ParseError[] = [];
  const value = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
    allowEmptyContent: false,
  }) as T | undefined;

  const errors = parseErrors.map((error) => ({
    code: printParseErrorCode(error.error),
    offset: error.offset,
    length: error.length,
  }));

  return {
    ...(value !== undefined ? { value } : {}),
    errors,
  };
}

export function requireGmJson<T = Record<string, unknown>>(text: string, label: string): T {
  const result = parseGmJson<T>(text);
  if (result.errors.length || result.value === undefined) {
    const details = result.errors
      .map((error) => `${error.code} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Cannot parse ${label}: ${details || "unknown JSON error"}`);
  }
  return result.value;
}

export function stringifyGmJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
