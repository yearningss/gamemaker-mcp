import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { registerAnalysisTools } from "./analysis-tools.js";
import { defaultConfigExample } from "./config.js";
import { registerExtendedTools } from "./extended-tools.js";
import { IgorService } from "./igor.js";
import { registerJobTools } from "./job-tools.js";
import { GameMakerProject, supportedEventNames } from "./project.js";
import { registerSnapshotTools } from "./snapshot-tools.js";
import type { ServerConfig } from "./types.js";
import { registerWorkflowPrompts } from "./workflow-prompts.js";

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

async function run<T>(operation: () => T | Promise<T>) {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const PROJECT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export function createServer(config: ServerConfig): McpServer {
  const project = new GameMakerProject(config);
  const igor = new IgorService(config);
  const server = new McpServer(
    { name: "gamemaker-mcp", version: "1.0.0" },
    {
      instructions:
        "Inspect before editing. Read files to obtain SHA-256 hashes and create a snapshot before multi-file changes. " +
        "When writing GML code: use modern GML 2024+ syntax ('function name(_arg) {}'), ALWAYS declare local variables with 'var', " +
        "use strict equality '==', check 'instance_exists()' before variable access, add Feather JSDoc headers, and preflight code snippets with gm_gml_validate_snippet. " +
        "Use patch previews, stop on stale hashes, validate metadata changes, and compile meaningful code/shader changes. " +
        "Only build trusted projects because GameMaker hooks and extensions may execute. " +
        "All file paths are relative to the configured GameMaker project and cannot escape it.",
    },
  );

  server.registerTool(
    "gm_project_info",
    {
      title: "GameMaker project info",
      description: "Return project identity, IDE version, asset counts, room order, and access mode.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => project.summary()),
  );

  server.registerTool(
    "gm_runtime_detect",
    {
      title: "Detect GameMaker runtimes",
      description: "Find installed GameMaker runtimes and the selected Igor command-line compiler.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => igor.inventory()),
  );

  server.registerTool(
    "gm_asset_list",
    {
      title: "List GameMaker assets",
      description: "List project assets with optional kind/query filters and pagination.",
      inputSchema: {
        kind: z.string().optional().describe("object, room, script, shader, sprite, sound, etc."),
        query: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => project.listAssets(args)),
  );

  server.registerTool(
    "gm_asset_read",
    {
      title: "Read a GameMaker asset",
      description: "Read an asset's .yy metadata and all related GML/shader text files with hashes.",
      inputSchema: {
        name: z.string().min(1),
        kind: z.string().optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ name, kind }) => run(() => project.readAsset(name, kind)),
  );

  server.registerTool(
    "gm_file_read",
    {
      title: "Read a project text file",
      description: "Read an allowed project-relative file and return its sha256 for optimistic edits.",
      inputSchema: { path: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ path }) => run(() => project.readFile(path)),
  );

  server.registerTool(
    "gm_code_search",
    {
      title: "Search GameMaker code",
      description: "Search GML and shader sources by literal text or regular expression.",
      inputSchema: {
        query: z.string().min(1),
        regex: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => project.searchCode(args)),
  );

  server.registerTool(
    "gm_project_validate",
    {
      title: "Validate GameMaker project",
      description: "Validate YY/YPP syntax, references, duplicate resources, object event files, and shaders.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => project.validate()),
  );

  server.registerTool(
    "gm_build",
    {
      title: "Compile GameMaker project",
      description: "Compile a trusted configured project with the official local Igor Windows VM toolchain. Project build hooks may execute.",
      inputSchema: {
        timeoutMs: z.number().int().min(5_000).max(600_000).optional(),
        ignoreCache: z.boolean().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => run(() => igor.compile(args)),
  );

  server.registerTool(
    "gm_gml_write",
    {
      title: "Write GML safely",
      description:
        "Atomically write a .gml file. Existing files require the sha256 returned by gm_file_read unless force=true.",
      inputSchema: {
        path: z.string().min(1),
        content: z.string(),
        expectedSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
        force: z.boolean().optional(),
        backup: z.boolean().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.writeGml(args)),
  );

  server.registerTool(
    "gm_gml_patch",
    {
      title: "Patch GML exactly",
      description:
        "Replace an exact string in a GML file with optimistic concurrency, match-count checking, and backup.",
      inputSchema: {
        path: z.string().min(1),
        search: z.string().min(1),
        replacement: z.string(),
        expectedSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        expectedMatches: z.number().int().min(1).max(1000).optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.patchGml(args)),
  );

  server.registerTool(
    "gm_script_create",
    {
      title: "Create GameMaker script",
      description: "Create a modern GMScript resource, its GML file, folder metadata, and YYP reference.",
      inputSchema: {
        name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        code: z.string(),
        folderName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async ({ name, code, folderName }) => run(() => project.createScript(name, code, folderName)),
  );

  server.registerTool(
    "gm_shader_create",
    {
      title: "Create GameMaker shader",
      description: "Create shader metadata, vertex/fragment sources, folder metadata, and YYP reference.",
      inputSchema: {
        name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        vertex: z.string().min(1),
        fragment: z.string().min(1),
        folderName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.createShader(args)),
  );

  server.registerTool(
    "gm_object_event_upsert",
    {
      title: "Add or replace an object event",
      description:
        "Add a common object event and its GML code, or replace existing code. Requires the object's .yy sha256.",
      inputSchema: {
        objectName: z.string().min(1),
        event: z.enum(supportedEventNames as [string, ...string[]]),
        code: z.string(),
        expectedObjectSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
        replace: z.boolean().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) =>
      run(() =>
        project.upsertObjectEvent({
          objectName: args.objectName,
          event: args.event as (typeof supportedEventNames)[number],
          code: args.code,
          expectedObjectSha256: args.expectedObjectSha256,
          ...(args.replace !== undefined ? { replace: args.replace } : {}),
        }),
      ),
  );

  server.registerTool(
    "gm_connection_config",
    {
      title: "Generate MCP connection config",
      description: "Return a ready-to-copy stdio MCP client configuration for this built server.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => defaultConfigExample(config.projectFile)),
  );

  registerExtendedTools(server, project);
  registerAnalysisTools(server, project);
  registerSnapshotTools(server, config);
  registerJobTools(server, config);
  registerWorkflowPrompts(server);

  server.registerResource(
    "project-summary",
    "gamemaker://project/summary",
    {
      title: "GameMaker project summary",
      description: "Current project identity, asset counts, room order, and access mode.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(project.summary(), null, 2) }],
    }),
  );

  server.registerResource(
    "project-assets",
    "gamemaker://project/assets",
    {
      title: "GameMaker asset index",
      description: "All resources referenced by the current YYP.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(project.resources(), null, 2) }],
    }),
  );

  const assetTemplate = new ResourceTemplate("gamemaker://asset/{name}", {
    list: async () => ({
      resources: project.resources().map((asset) => ({
        name: asset.name,
        uri: `gamemaker://asset/${encodeURIComponent(asset.name)}`,
        mimeType: "application/json",
        description: `${asset.kind}: ${asset.path}`,
      })),
    }),
  });
  server.registerResource(
    "asset",
    assetTemplate,
    { title: "GameMaker asset", description: "Metadata and text sources for one project asset." },
    async (uri, variables) => {
      const raw = variables.name;
      const name = decodeURIComponent(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(project.readAsset(name), null, 2),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "review-gml",
    {
      title: "Review GML",
      description: "Review a project GML file for correctness, performance, and GameMaker compatibility.",
      argsSchema: { path: z.string().min(1) },
    },
    async ({ path }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Review ${path} in the configured GameMaker project. ` +
              "First call gm_file_read, then report concrete issues with line numbers. Do not edit unless asked.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "implement-gamemaker-feature",
    {
      title: "Implement GameMaker feature",
      description: "A safe inspect-edit-validate-build workflow for a GameMaker feature.",
      argsSchema: { feature: z.string().min(1) },
    },
    async ({ feature }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Implement this GameMaker feature: ${feature}. ` +
              "Inspect relevant assets, make the smallest safe changes using hashes, validate metadata, then compile with gm_build.",
          },
        },
      ],
    }),
  );

  return server;
}
