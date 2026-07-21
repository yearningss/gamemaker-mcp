import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SnapshotService } from "./snapshots.js";
import type { ServerConfig } from "./types.js";

const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const SNAPSHOT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const PROJECT_RESTORE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

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

/** Register safe project snapshot tools on an existing GameMaker MCP server. */
export function registerSnapshotTools(server: McpServer, config: ServerConfig): void {
  const snapshots = new SnapshotService(config);

  server.registerTool(
    "gm_snapshot_create",
    {
      title: "Create GameMaker project snapshot",
      description:
        "Atomically capture all supported GameMaker text files under .gamemaker-mcp/snapshots with a SHA-256 manifest. Binary files and MCP metadata are excluded.",
      inputSchema: {
        label: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional human-readable reason or checkpoint name."),
      },
      annotations: SNAPSHOT_WRITE,
    },
    async ({ label }) =>
      run(() => snapshots.create({ ...(label !== undefined ? { label } : {}) })),
  );

  server.registerTool(
    "gm_snapshot_list",
    {
      title: "List GameMaker project snapshots",
      description:
        "List available project snapshots newest first, including creation time, label, file count, and byte count.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => run(() => snapshots.list()),
  );

  server.registerTool(
    "gm_snapshot_inspect",
    {
      title: "Inspect GameMaker project snapshot",
      description:
        "Read a snapshot manifest and verify every captured payload file against its recorded size and SHA-256 hash.",
      inputSchema: {
        snapshotId: z
          .string()
          .regex(SNAPSHOT_ID)
          .describe("Exact snapshot id returned by gm_snapshot_create or gm_snapshot_list."),
      },
      annotations: READ_ONLY,
    },
    async ({ snapshotId }) => run(() => snapshots.inspect(snapshotId)),
  );

  server.registerTool(
    "gm_snapshot_restore",
    {
      title: "Restore GameMaker project snapshot",
      description:
        "Verify and restore one explicitly named snapshot. Requires workspace-write mode; changed files are atomically replaced with backups, and unrelated files are not deleted.",
      inputSchema: {
        snapshotId: z
          .string()
          .regex(SNAPSHOT_ID)
          .describe("Exact snapshot id to restore; there is intentionally no implicit latest snapshot."),
      },
      annotations: PROJECT_RESTORE,
    },
    async ({ snapshotId }) => run(() => snapshots.restore(snapshotId)),
  );
}
