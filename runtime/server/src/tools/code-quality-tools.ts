import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError } from "../utils/errors.js";
import { GML_FUNCTIONS, GML_DEPRECATED_FUNCTIONS, searchFunctions } from "../data/gml-docs.js";

// ─── Helpers ───

interface SyntaxIssue {
  line: number;
  message: string;
}

interface NamingIssue {
  line: number;
  identifier: string;
  expected_convention: string;
  message: string;
}

interface DeprecatedUsage {
  function_name: string;
  line: number;
  replacement: string;
}

interface FunctionSuggestion {
  name: string;
  signature: string;
  description: string;
  score: number;
}

function validateBrackets(code: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const lines = code.split("\n");
  const stack: { char: string; line: number }[] = [];
  const matching: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const opening = new Set(["(", "[", "{"]);
  const closing = new Set([")", "]", "}"]);
  const nameFor: Record<string, string> = {
    "(": "parenthesis", ")": "parenthesis",
    "[": "bracket", "]": "bracket",
    "{": "brace", "}": "brace",
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = "";

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];

      // Handle line comments
      if (!inString && ch === "/" && j + 1 < line.length && line[j + 1] === "/") {
        break; // rest of line is comment
      }

      // Handle string toggling (GML uses " for strings)
      if (ch === '"' && (j === 0 || line[j - 1] !== "\\")) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (stringChar === ch) {
          inString = false;
        }
        continue;
      }

      if (inString) continue;

      if (opening.has(ch)) {
        stack.push({ char: ch, line: i + 1 });
      } else if (closing.has(ch)) {
        if (stack.length === 0) {
          issues.push({ line: i + 1, message: `Unexpected closing ${nameFor[ch]} '${ch}'` });
        } else {
          const top = stack[stack.length - 1];
          if (top.char !== matching[ch]) {
            issues.push({
              line: i + 1,
              message: `Mismatched ${nameFor[ch]} '${ch}' — expected closing for '${top.char}' opened on line ${top.line}`,
            });
            stack.pop();
          } else {
            stack.pop();
          }
        }
      }
    }

    // Check for unclosed string on this line (single-line string check)
    if (inString) {
      issues.push({ line: i + 1, message: "Unclosed string literal" });
    }
  }

  // Any remaining open brackets
  for (const open of stack) {
    issues.push({
      line: open.line,
      message: `Unclosed ${nameFor[open.char]} '${open.char}' — never closed`,
    });
  }

  return issues;
}

function checkSemicolons(code: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // Strip comments
    const commentIdx = raw.indexOf("//");
    const line = (commentIdx >= 0 ? raw.substring(0, commentIdx) : raw).trim();

    if (line.length === 0) continue;

    // Lines that don't need semicolons
    if (
      line.startsWith("#") ||                     // macros/regions
      line.startsWith("//") ||                    // pure comment
      line.startsWith("/*") ||                    // block comment start
      line.startsWith("*") ||                     // block comment continuation
      line.endsWith("{") || line.endsWith("}") || // brace lines
      line === "}" ||
      /^(if|else|while|for|repeat|switch|case|default|do|with|try|catch|finally)\b/.test(line) ||
      /^(function|enum|constructor)\b/.test(line) ||
      line.endsWith(",") ||                       // multiline array/struct
      line.endsWith("(") ||                       // multiline call
      line.endsWith("\\")                         // line continuation
    ) {
      continue;
    }

    // Statement-like lines that should end with semicolon
    if (
      /^(var|globalvar)\s+/.test(line) ||
      /^\w+\s*=/.test(line) ||
      /^\w+\s*\(/.test(line) ||
      /^return\b/.test(line) ||
      /^exit\b/.test(line) ||
      /^break\b/.test(line) ||
      /^continue\b/.test(line) ||
      /^throw\b/.test(line)
    ) {
      if (!line.endsWith(";") && !line.endsWith("{") && !line.endsWith("}")) {
        issues.push({ line: i + 1, message: "Statement may be missing a trailing semicolon" });
      }
    }
  }

  return issues;
}

// ─── Registration ───

export function registerCodeQualityTools(server: McpServer): void {

  // 1. validate_gml_snippet
  server.tool(
    "validate_gml_snippet",
    "Validate basic GML syntax (bracket balance, semicolons, common issues)",
    {
      code: z.string().describe("GML code snippet to validate"),
    },
    async ({ code }) => {
      try {
        const bracketIssues = validateBrackets(code);
        const semicolonIssues = checkSemicolons(code);
        const allIssues = [...bracketIssues, ...semicolonIssues].sort((a, b) => a.line - b.line);
        const lineCount = code.split("\n").length;

        const result = {
          valid: allIssues.length === 0,
          issues: allIssues,
          line_count: lineCount,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: formatError(error) }], isError: true };
      }
    }
  );

  // 2. check_naming_conventions
  server.tool(
    "check_naming_conventions",
    "Check GML code for naming convention compliance (snake_case variables, UPPER_CASE constants)",
    {
      code: z.string().describe("GML code to check naming conventions"),
    },
    async ({ code }) => {
      try {
        const issues: NamingIssue[] = [];
        const lines = code.split("\n");

        const isSnakeCase = (s: string) => /^[a-z_][a-z0-9_]*$/.test(s);
        const isUpperCase = (s: string) => /^[A-Z_][A-Z0-9_]*$/.test(s);
        const isLocalVar = (s: string) => /^_[a-z][a-z0-9_]*$/.test(s);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;
          const trimmed = line.trim();

          // Skip comments
          if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

          // Check #macro names — should be UPPER_CASE
          const macroMatch = trimmed.match(/^#macro\s+([A-Za-z_]\w*)/);
          if (macroMatch) {
            const name = macroMatch[1];
            if (!isUpperCase(name)) {
              issues.push({
                line: lineNum,
                identifier: name,
                expected_convention: "UPPER_CASE",
                message: `Macro "${name}" should use UPPER_CASE (e.g., "${name.toUpperCase()}")`,
              });
            }
            continue;
          }

          // Check var declarations — local variables should be _prefixed
          const varMatches = trimmed.matchAll(/\bvar\s+([A-Za-z_]\w*)/g);
          for (const m of varMatches) {
            const name = m[1];
            if (!isLocalVar(name) && !isSnakeCase(name)) {
              issues.push({
                line: lineNum,
                identifier: name,
                expected_convention: "_prefixed_snake_case for locals",
                message: `Local variable "${name}" should use _underscore prefix for locals (e.g., "_${name.toLowerCase()}")`,
              });
            }
          }

          // Check function declarations — should be snake_case
          const funcMatch = trimmed.match(/^function\s+([A-Za-z_]\w*)/);
          if (funcMatch) {
            const name = funcMatch[1];
            // Allow PascalCase for constructors
            if (trimmed.includes("constructor")) continue;
            if (!isSnakeCase(name)) {
              issues.push({
                line: lineNum,
                identifier: name,
                expected_convention: "snake_case",
                message: `Function "${name}" should use snake_case (e.g., "${name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")}")`,
              });
            }
          }
        }

        const result = {
          issues,
          total_issues: issues.length,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: formatError(error) }], isError: true };
      }
    }
  );

  // 3. find_deprecated_usage
  server.tool(
    "find_deprecated_usage",
    "Scan GML code for deprecated function usage",
    {
      code: z.string().describe("GML code to scan for deprecated function calls"),
    },
    async ({ code }) => {
      try {
        const deprecated: DeprecatedUsage[] = [];
        const lines = code.split("\n");

        for (const dep of GML_DEPRECATED_FUNCTIONS) {
          // Build a word-boundary regex for the deprecated function name
          const regex = new RegExp(`\\b${dep.name}\\b`, "g");

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip pure comments
            if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

            // Strip inline comments before matching
            const commentIdx = line.indexOf("//");
            const effective = commentIdx >= 0 ? line.substring(0, commentIdx) : line;

            if (regex.test(effective)) {
              deprecated.push({
                function_name: dep.name,
                line: i + 1,
                replacement: dep.replacement,
              });
            }
            // Reset regex lastIndex since we reuse it
            regex.lastIndex = 0;
          }
        }

        // Sort by line number
        deprecated.sort((a, b) => a.line - b.line);

        const result = {
          deprecated,
          count: deprecated.length,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: formatError(error) }], isError: true };
      }
    }
  );

  // 4. suggest_function
  server.tool(
    "suggest_function",
    "Find GML functions matching a description (fuzzy search)",
    {
      description: z.string().describe("Natural language description of what you want to do (e.g., 'play a sound effect')"),
      limit: z.number().optional().describe("Max suggestions, default 10"),
    },
    async ({ description, limit }) => {
      try {
        const maxResults = limit ?? 10;
        const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 2);

        if (keywords.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ suggestions: [], count: 0 }, null, 2) }] };
        }

        const scored: FunctionSuggestion[] = [];

        for (const fn of GML_FUNCTIONS) {
          if (fn.deprecated) continue; // Skip deprecated functions from suggestions

          const nameLC = fn.name.toLowerCase();
          const descLC = fn.description.toLowerCase();
          const catLC = fn.category.toLowerCase();
          let score = 0;

          for (const kw of keywords) {
            // Exact word in function name scores highest
            if (nameLC.includes(kw)) {
              score += 3;
              // Bonus if it starts with the keyword
              if (nameLC.startsWith(kw)) score += 1;
            }
            // Word in description
            if (descLC.includes(kw)) {
              score += 2;
            }
            // Word in category
            if (catLC.includes(kw)) {
              score += 1;
            }
          }

          if (score > 0) {
            scored.push({
              name: fn.name,
              signature: fn.signature,
              description: fn.description,
              score,
            });
          }
        }

        // Sort by score descending, then alphabetically
        scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

        const suggestions = scored.slice(0, maxResults);

        const result = {
          suggestions,
          count: suggestions.length,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: formatError(error) }], isError: true };
      }
    }
  );
}
