import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerWorkflowPrompts(server: McpServer): void {
  server.registerPrompt(
    "audit-gamemaker-project",
    {
      title: "Audit GameMaker project",
      description: "Run a read-only structural, GML, shader, dependency, and statistics audit.",
      argsSchema: { focus: z.string().optional() },
    },
    async ({ focus }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Audit the configured GameMaker project without editing it. Call gm_project_info, " +
              "gm_project_validate, gm_project_statistics, gm_gml_analyze, gm_shader_analyze, " +
              "and gm_dependency_graph. Rank concrete findings by severity and cite project-relative files." +
              (focus ? ` Focus especially on: ${focus}.` : ""),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "debug-gamemaker-build",
    {
      title: "Debug GameMaker build",
      description: "Use the persistent background job workflow to diagnose a trusted project's build.",
      argsSchema: { symptom: z.string().optional() },
    },
    async ({ symptom }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Debug the configured trusted GameMaker project build. First call gm_runtime_detect and " +
              "gm_project_validate, then start a compile with gm_job_start, wait for it, and inspect gm_job_log. " +
              "Explain the first actionable root cause; do not edit project files unless explicitly requested." +
              (symptom ? ` Reported symptom: ${symptom}.` : ""),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "safe-gamemaker-refactor",
    {
      title: "Safely refactor GameMaker code",
      description: "Snapshot, inspect references, preview patches, edit with hashes, validate, and compile.",
      argsSchema: {
        symbol: z.string().min(1),
        goal: z.string().min(1),
      },
    },
    async ({ symbol, goal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Refactor ${symbol}: ${goal}. Create a labeled snapshot first, call gm_symbol_references, ` +
              "read every affected source and retain its SHA-256, preview exact patches, make the smallest edits, " +
              "then run gm_project_validate and a compile job. Stop if any hash is stale.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "implement-gamemaker-shader-effect",
    {
      title: "Implement GameMaker shader effect",
      description: "Inspect and update a shader with cross-stage validation and a build check.",
      argsSchema: {
        shader: z.string().min(1),
        effect: z.string().min(1),
      },
    },
    async ({ shader, effect }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Implement this effect in ${shader}: ${effect}. Call gm_shader_inspect and gm_shader_analyze first, ` +
              "use the returned per-stage hashes with gm_shader_update, analyze again, validate the project, and compile.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "restore-gamemaker-snapshot",
    {
      title: "Restore GameMaker snapshot",
      description: "Inspect a snapshot and request explicit confirmation before destructive restoration.",
      argsSchema: { snapshotId: z.string().min(1) },
    },
    async ({ snapshotId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Inspect snapshot ${snapshotId} with gm_snapshot_inspect, summarize exactly which current files differ, ` +
              "and ask for explicit confirmation before calling gm_snapshot_restore. Validate the project after restoration.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "create-state-machine",
    {
      title: "Create GameMaker state machine",
      description: "Generate a structured GML enum-based state machine for a GameMaker object.",
      argsSchema: {
        objectName: z.string().min(1),
        states: z.string().min(1),
      },
    },
    async ({ objectName, states }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Create a clean GML state machine for object ${objectName} with states: ${states}. ` +
              "First inspect object events with gm_asset_read, define an enum for states, implement Create, Step, and End Step logic, " +
              "use optimistic SHA-256 hashes with gm_event_write, and validate with gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "optimize-draw-events",
    {
      title: "Optimize GameMaker Draw events",
      description: "Audit and optimize Draw events for batching, texture page swaps, and state resets.",
      argsSchema: { objectName: z.string().optional() },
    },
    async ({ objectName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Audit Draw events ${objectName ? `for ${objectName}` : "across the project"}. ` +
              "Look for draw_set_color/alpha without resetting, frequent surface or shader toggles, and unbatched primitive drawing. " +
              "Recommend exact optimizations and generate Feather JSDoc headers using gm_gml_docgen where applicable.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "refactor-gml-script",
    {
      title: "Refactor legacy GML script to GML 2024+",
      description: "Convert legacy argument0/script_execute code to modern functions and generate Feather JSDoc.",
      argsSchema: { scriptName: z.string().min(1) },
    },
    async ({ scriptName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Refactor legacy script ${scriptName} to modern GML 2024+ syntax. ` +
              "Call gm_asset_read first, replace argument0..15 with named parameters, add gm_gml_docgen Feather headers, " +
              "preview changes, write with SHA-256 validation, and run gm_project_validate.",
          },
        },
      ],
    }),
  );
}
