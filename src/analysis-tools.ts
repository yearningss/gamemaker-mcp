import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { ProjectAnalysisService, generateGmlDocstrings, validateGmlSnippet } from "./analysis.js";
import { GameMakerProject } from "./project.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function run<T>(operation: () => T | Promise<T>) {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

export function registerAnalysisTools(server: McpServer, project: GameMakerProject): void {
  const analysis = new ProjectAnalysisService(project);

  server.registerTool(
    "gm_gml_analyze",
    {
      title: "Analyze GML",
      description:
        "Statically analyze one GML file or the project for functions, symbols, complexity, delimiter errors, and risky patterns.",
      inputSchema: {
        path: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) =>
      run(() =>
        analysis.analyzeGml({
          ...(args.path !== undefined ? { path: args.path } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
      ),
  );

  server.registerTool(
    "gm_shader_analyze",
    {
      title: "Analyze shaders",
      description:
        "Analyze one or all shaders for syntax structure, declarations, stage interfaces, entry points, and portability warnings.",
      inputSchema: { name: z.string().min(1).optional() },
      annotations: READ_ONLY,
    },
    async ({ name }) => run(() => analysis.inspectShaders(name === undefined ? {} : { name })),
  );

  server.registerTool(
    "gm_symbol_references",
    {
      title: "Find symbol references",
      description: "Find declarations, calls, writes, reads, and optional YY/YPP metadata references for a symbol.",
      inputSchema: {
        symbol: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        includeMetadata: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) =>
      run(() =>
        analysis.findReferences({
          symbol: args.symbol,
          ...(args.includeMetadata !== undefined ? { includeMetadata: args.includeMetadata } : {}),
          ...(args.caseSensitive !== undefined ? { caseSensitive: args.caseSensitive } : {}),
          ...(args.limit !== undefined ? { limit: args.limit } : {}),
        }),
      ),
  );

  server.registerTool(
    "gm_dependency_graph",
    {
      title: "Build asset dependency graph",
      description: "Build a project resource dependency graph with evidence and cyclic dependency groups.",
      inputSchema: {
        includeMetadata: z.boolean().optional(),
        evidencePerEdge: z.number().int().min(1).max(20).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) =>
      run(() =>
        analysis.dependencyGraph({
          ...(args.includeMetadata !== undefined ? { includeMetadata: args.includeMetadata } : {}),
          ...(args.evidencePerEdge !== undefined ? { evidencePerEdge: args.evidencePerEdge } : {}),
        }),
      ),
  );

  server.registerTool(
    "gm_project_statistics",
    {
      title: "GameMaker project statistics",
      description: "Return resource, source-file, line, byte, code, event, layer, and instance statistics.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.statistics()),
  );

  server.registerTool(
    "gm_unused_assets",
    {
      title: "Find unused assets",
      description: "Scan the project for sprites, sounds, scripts, fonts, paths, and objects not referenced in code or rooms.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.findUnusedAssets()),
  );

  server.registerTool(
    "gm_gml_docgen",
    {
      title: "Generate GML Feather JSDoc",
      description: "Analyze GML code and generate Feather-compliant JSDoc headers (/// @function, /// @param, /// @returns).",
      inputSchema: {
        code: z.string().min(1),
        nameHint: z.string().optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ code, nameHint }) => run(() => generateGmlDocstrings(code, nameHint)),
  );

  server.registerTool(
    "gm_gml_validate_snippet",
    {
      title: "Validate GML code snippet",
      description: "Preflight GML code for syntax delimiter balance ({}, (), []), deprecated builtins, assignment in conditions, and legacy argument0..15 usage.",
      inputSchema: {
        code: z.string().min(1),
      },
      annotations: READ_ONLY,
    },
    async ({ code }) => run(() => validateGmlSnippet(code)),
  );

  server.registerTool(
    "gm_gml_profile_check",
    {
      title: "GML performance profiler & FPS audit",
      description: "Scan Step, Draw, and loops for CPU/memory anti-patterns (instance_find in loops, uncached layer/asset lookups, string concats in Draw).",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.profileCheck()),
  );

  server.registerTool(
    "gm_i18n_scan",
    {
      title: "Hardcoded string & i18n scanner",
      description: "Scan project GML code for hardcoded string literals and generate suggested localization dictionary keys.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.i18nScan()),
  );

  server.registerTool(
    "gm_draw_state_audit",
    {
      title: "Audit GPU & render state resets",
      description: "Audit Draw events to verify shader_set, draw_set_alpha, draw_set_color, and gpu_set_blendmode state resets.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.drawStateAudit()),
  );

  server.registerTool(
    "gm_project_health_score",
    {
      title: "Calculate project health score & grade",
      description: "Return a 0-100% health score, grade (A+ to F), and prioritized recommendations based on unused assets, performance, draw state resets, and code complexity.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.calculateHealthScore()),
  );

  server.registerTool(
    "gm_object_hierarchy",
    {
      title: "Inspect object inheritance tree",
      description: "Build object parent-child inheritance tree, list root objects, and check for cyclic parent dependencies.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.objectHierarchy()),
  );

  server.registerTool(
    "gm_doc_export",
    {
      title: "Generate project documentation Markdown",
      description: "Generate structured Markdown documentation for all objects, scripts, shaders, rooms, sprites, and sounds.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.exportProjectDocs()),
  );

  server.registerTool(
    "gm_gml_duplicate_find",
    {
      title: "Find duplicated GML code blocks",
      description: "Scan project GML files to detect identical contiguous code blocks (4+ lines) across objects and scripts.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => analysis.findCodeDuplicates()),
  );

  server.registerResource(
    "gml-rules",
    "gamemaker://gml/rules",
    {
      title: "GameMaker GML 2024+ Strict Syntax Rules",
      description: "Mandatory coding guidelines and anti-patterns for generating zero-error GML code.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text:
            "GameMaker GML 2024+ Strict Coding Rules:\n" +
            "1. ALWAYS declare local variables with 'var' keyword.\n" +
            "2. ALWAYS use named function parameters e.g. 'function scr_name(_a, _b) {}'. NEVER use 'argument0' or 'argument[0]'.\n" +
            "3. ALWAYS use strict equality '==' in conditionals (e.g. 'if (x == 5)'), NEVER single '=' inside 'if'.\n" +
            "4. ALWAYS check 'instance_exists(_inst)' or 'sprite_exists(_spr)' before referencing dynamically.\n" +
            "5. ALWAYS add Feather JSDoc headers ('/// @function', '/// @param', '/// @returns') to script files.\n" +
            "6. Use modern array functions ('array_push', 'array_length') and struct constructors ('function Person() constructor {}').\n" +
            "7. ALWAYS preflight snippets with 'gm_gml_validate_snippet' before editing files.",
        },
      ],
    }),
  );

  server.registerResource(
    "project-statistics",
    "gamemaker://project/statistics",
    {
      title: "GameMaker project statistics",
      description: "Live resource, source, complexity, shader, and dependency statistics.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(analysis.statistics(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "project-dependencies",
    "gamemaker://project/dependencies",
    {
      title: "GameMaker dependency graph",
      description: "Live project asset dependency graph and cycle groups.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(analysis.dependencyGraph({ includeMetadata: true }), null, 2),
        },
      ],
    }),
  );}
