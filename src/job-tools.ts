import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { GameMakerJobService, JOB_KINDS } from "./jobs.js";
import type { ServerConfig } from "./types.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const JOB_START = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const JOB_CANCEL = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

const jobId = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9-]{27,40}$/i)
  .describe("Job id returned by gm_job_start.");

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

/**
 * Register persistent, non-blocking Igor build tools and return their shared
 * service instance. Call this once per MCP server.
 */
export function registerJobTools(
  server: McpServer,
  config: ServerConfig,
): GameMakerJobService {
  const jobs = new GameMakerJobService(config);

  server.registerTool(
    "gm_job_start",
    {
      title: "Start GameMaker build job",
      description:
        "Start an allowlisted Igor Windows VM Compile or PackageZip operation in the background. " +
        "Only compile trusted projects: GameMaker extensions and build hooks may execute arbitrary code. " +
        "Only one build job may run at a time; arbitrary Igor commands and arguments are never accepted.",
      inputSchema: {
        kind: z.enum(JOB_KINDS).describe("compile creates a .win; package-zip creates a .zip."),
        timeoutMs: z.number().int().min(5_000).max(600_000).optional(),
        ignoreCache: z.boolean().optional(),
      },
      annotations: JOB_START,
    },
    async (args) => run(() => jobs.start(args)),
  );

  server.registerTool(
    "gm_job_list",
    {
      title: "List GameMaker build jobs",
      description:
        "List newest persistent build jobs from .gamemaker-mcp/jobs, including final state and artifact paths.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => jobs.list(args)),
  );

  server.registerTool(
    "gm_job_status",
    {
      title: "Get GameMaker build job status",
      description:
        "Return live or persisted status, timing, exit code, diagnostics, and artifact information for one job.",
      inputSchema: { jobId },
      annotations: READ_ONLY,
    },
    async ({ jobId }) => run(() => jobs.status(jobId)),
  );

  server.registerTool(
    "gm_job_log",
    {
      title: "Read GameMaker build job log",
      description:
        "Read a bounded tail of a job's combined Igor stdout/stderr log. Logs are capped on disk.",
      inputSchema: {
        jobId,
        tailBytes: z.number().int().min(1).max(8 * 1024 * 1024).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ jobId, tailBytes }) => run(() => jobs.readLog(jobId, { tailBytes })),
  );

  server.registerTool(
    "gm_job_cancel",
    {
      title: "Cancel GameMaker build job",
      description:
        "Force-stop the active Igor process tree. This discards the in-progress build and is destructive; " +
        "completed cancellation is visible through status or wait.",
      inputSchema: { jobId },
      annotations: JOB_CANCEL,
    },
    async ({ jobId }) => run(() => jobs.cancel(jobId)),
  );

  server.registerTool(
    "gm_job_wait",
    {
      title: "Wait for GameMaker build job",
      description:
        "Wait for the active job to reach a terminal state, or return an already persisted terminal state.",
      inputSchema: {
        jobId,
        timeoutMs: z.number().int().min(1).max(600_000).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ jobId, timeoutMs }) => run(() => jobs.wait(jobId, timeoutMs)),
  );

  return jobs;
}
