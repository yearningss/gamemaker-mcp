import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  GML_FUNCTIONS,
  GML_RESERVED_WORDS,
  GML_DEPRECATED_FUNCTIONS,
  GML_CATEGORIES,
  GML_CONSTANTS,
  GML_CONCEPTS,
  GML_CONCEPT_CATEGORIES,
  lookupFunction,
  searchFunctions,
  getFunctionsByCategory,
  isReservedWord,
  searchConcepts,
  lookupConcept,
} from "../data/gml-docs.js";

export function registerDocumentationTools(server: McpServer): void {

  // 1. lookup_gml_function
  server.tool(
    "lookup_gml_function",
    "Look up a GML function by name. Returns signature, parameters, description, usage info, examples, and related functions.",
    { function_name: z.string().describe("GML function name (e.g. 'instance_create_layer')") },
    async ({ function_name }) => {
      const fn = lookupFunction(function_name);
      if (!fn) {
        // Try fuzzy match using weighted search
        const suggestions = searchFunctions(function_name, undefined, 5)
          .map(f => f.name);
        const msg = suggestions.length > 0
          ? `Function "${function_name}" not found. Did you mean: ${suggestions.join(", ")}?`
          : `Function "${function_name}" not found in the documentation database.`;
        return { content: [{ type: "text", text: msg }] };
      }

      const lines: string[] = [
        `## ${fn.name}`,
        `**Signature:** \`${fn.signature}\``,
        `**Category:** ${fn.category}`,
        `**Returns:** ${fn.returns}`,
        "",
        fn.description,
      ];

      if (fn.params.length > 0) {
        lines.push("", "**Parameters:**");
        for (const param of fn.params) {
          const opt = param.optional ? " *(optional)*" : "";
          lines.push(`- \`${param.name}\` (${param.type})${opt}: ${param.description}`);
        }
      }

      if (fn.example) {
        lines.push("", "**Example:**", "```gml", fn.example, "```");
      }

      if (fn.related && fn.related.length > 0) {
        lines.push("", `**Related:** ${fn.related.map(r => `\`${r}\``).join(", ")}`);
      }

      if (fn.deprecated) {
        lines.push("", `⚠️ **DEPRECATED:** ${fn.deprecatedNote || "This function is deprecated."}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 2. search_gml_docs
  server.tool(
    "search_gml_docs",
    "Search GML documentation by keyword with weighted relevance scoring. Searches function names, descriptions, and categories.",
    {
      query: z.string().describe("Search keyword (e.g. 'audio', 'collision', 'array sort')"),
      category: z.string().optional().describe("Optional category filter"),
    },
    async ({ query, category }) => {
      const results = searchFunctions(query, category);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No functions found matching "${query}"${category ? ` in category "${category}"` : ""}.\n\nAvailable categories: ${GML_CATEGORIES.join(", ")}` }] };
      }

      const lines: string[] = [`Found ${results.length} function(s) matching "${query}" (sorted by relevance):\n`];
      // Group by category, preserving score order within groups
      const grouped = new Map<string, typeof results>();
      for (const f of results) {
        const list = grouped.get(f.category) || [];
        list.push(f);
        grouped.set(f.category, list);
      }

      for (const [cat, fns] of grouped) {
        lines.push(`### ${cat}`);
        for (const f of fns) {
          const dep = f.deprecated ? " ⚠️DEPRECATED" : "";
          const scoreTag = `[${f.score.toFixed(1)}]`;
          lines.push(`- ${scoreTag} \`${f.signature}\` — ${f.description}${dep}`);
        }
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 3. get_gml_reserved_words
  server.tool(
    "get_gml_reserved_words",
    "Get the list of GML reserved words and built-in names that cannot be used as variable names.",
    {},
    async () => {
      const lines: string[] = [
        "# GML Reserved Words & Built-in Names",
        "",
        "These identifiers cannot be used as variable names in GML:",
        "",
        ...GML_RESERVED_WORDS.map(w => `- \`${w}\``),
        "",
        `Total: ${GML_RESERVED_WORDS.length} reserved identifiers`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 4. get_deprecated_functions
  server.tool(
    "get_deprecated_functions",
    "Get the list of deprecated/removed GML functions with their replacements.",
    {},
    async () => {
      const lines: string[] = [
        "# Deprecated / Removed GML Functions",
        "",
      ];
      for (const d of GML_DEPRECATED_FUNCTIONS) {
        lines.push(`### \`${d.name}\``);
        lines.push(`- **Replacement:** ${d.replacement}`);
        lines.push(`- **Note:** ${d.note}`);
        lines.push("");
      }
      lines.push(`Total: ${GML_DEPRECATED_FUNCTIONS.length} deprecated functions`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 5. validate_variable_name
  server.tool(
    "validate_variable_name",
    "Check if a variable name conflicts with GML reserved words or built-in function names.",
    { name: z.string().describe("Variable name to validate") },
    async ({ name }) => {
      const issues: string[] = [];

      if (isReservedWord(name)) {
        issues.push(`"${name}" is a GML reserved word / built-in identifier. It CANNOT be used as a variable name.`);
      }

      const asFunction = lookupFunction(name);
      if (asFunction) {
        issues.push(`"${name}" is a built-in GML function: \`${asFunction.signature}\`. Using it as a variable name will shadow the function.`);
      }

      if (issues.length === 0) {
        return { content: [{ type: "text", text: `✅ "${name}" is safe to use as a variable name in GML.` }] };
      }

      return {
        content: [{ type: "text", text: `⚠️ Variable name issues:\n\n${issues.join("\n\n")}` }],
      };
    }
  );

  // 6. get_function_category
  server.tool(
    "get_function_category",
    "Get all GML functions in a specific category.",
    { category: z.string().describe(`Category name. Available: ${GML_CATEGORIES.join(", ")}`) },
    async ({ category }) => {
      const fns = getFunctionsByCategory(category);
      if (fns.length === 0) {
        const available = GML_CATEGORIES.join(", ");
        return { content: [{ type: "text", text: `No functions found in category "${category}". Available categories: ${available}` }] };
      }

      const lines: string[] = [
        `# ${category} (${fns.length} functions)`,
        "",
      ];
      for (const f of fns) {
        const dep = f.deprecated ? " ⚠️DEPRECATED" : "";
        lines.push(`- \`${f.signature}\` — ${f.description}${dep}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 7. get_gml_concept
  server.tool(
    "get_gml_concept",
    "Look up GML language behavior and semantic concepts — scoping rules, event order, memory management, async patterns, etc. Use this BEFORE writing complex GML to avoid common mistakes.",
    {
      query: z.string().describe("Concept to look up (e.g. 'with scope', 'alarm', 'async http', 'persistent', 'surface memory', 'array reference')"),
      category: z.string().optional().describe(`Optional category filter. Available: ${GML_CONCEPT_CATEGORIES.join(", ")}`),
    },
    async ({ query, category }) => {
      // Try exact/partial name match first
      const exact = lookupConcept(query);
      const results = exact ? [exact] : searchConcepts(query, category);

      if (results.length === 0) {
        const allNames = GML_CONCEPTS.map(c => `"${c.name}"`).join(", ");
        return { content: [{ type: "text", text: `No concept found for "${query}".\n\nAvailable concepts: ${allNames}` }] };
      }

      const lines: string[] = [];
      for (const c of results.slice(0, 3)) {
        lines.push(`## ${c.name}`);
        lines.push(`**Category:** ${c.category}`);
        lines.push(`**Summary:** ${c.summary}`, "");
        lines.push("**Details:**");
        lines.push(c.details, "");

        if (c.pitfalls.length > 0) {
          lines.push("**⚠️ よくあるミス:**");
          for (const pit of c.pitfalls) {
            lines.push(`- ${pit}`);
          }
          lines.push("");
        }

        if (c.example) {
          lines.push("**Example:**", "```gml", c.example, "```", "");
        }

        if (c.related && c.related.length > 0) {
          lines.push(`**Related:** ${c.related.map(r => `\`${r}\``).join(", ")}`);
        }
        lines.push("", "---", "");
      }

      if (results.length > 3) {
        lines.push(`*(${results.length - 3} more results — refine your query for details)*`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // 8. get_gml_constants
  server.tool(
    "get_gml_constants",
    "Get common GML constants grouped by category (colours, keys, events, blend modes, etc.). Optionally filter by group name.",
    {
      group: z.string().optional().describe("Optional group name to filter (e.g. 'Colours', 'Virtual Keys', 'Events', 'Blend Modes')"),
    },
    async ({ group }) => {
      let groups = GML_CONSTANTS;
      if (group) {
        const gl = group.toLowerCase();
        groups = GML_CONSTANTS.filter(g => g.name.toLowerCase().includes(gl));
        if (groups.length === 0) {
          const available = GML_CONSTANTS.map(g => g.name).join(", ");
          return { content: [{ type: "text", text: `No constant group matching "${group}". Available groups: ${available}` }] };
        }
      }

      const lines: string[] = ["# GML Constants", ""];
      for (const g of groups) {
        lines.push(`## ${g.name}`);
        lines.push(`*${g.description}*`, "");
        for (const c of g.constants) {
          const val = c.value ? ` = \`${c.value}\`` : "";
          lines.push(`- \`${c.name}\`${val} — ${c.description}`);
        }
        lines.push("");
      }

      const totalConstants = groups.reduce((sum, g) => sum + g.constants.length, 0);
      lines.push(`Total: ${totalConstants} constants in ${groups.length} group(s)`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
