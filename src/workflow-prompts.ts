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

  server.registerPrompt(
    "write-clean-gml-script",
    {
      title: "Write clean production GML script",
      description: "Generate Feather-compliant, memory-optimized GML script with constructors, static methods, and JSDoc.",
      argsSchema: {
        scriptName: z.string().min(1),
        purpose: z.string().min(1),
      },
    },
    async ({ scriptName, purpose }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Create a production-grade, Feather-compliant GML script named '${scriptName}' for: ${purpose}. ` +
              "Follow strict GML 2024+ rules: use struct constructors, declare all methods as 'static' to avoid GC allocations, " +
              "add complete Feather JSDoc headers (/// @function, /// @param, /// @returns), preflight snippet with gm_gml_validate_snippet, " +
              "write script using gm_script_create, and validate project structure.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "write-gml-unit-test",
    {
      title: "Create GML unit test suite",
      description: "Generate unit tests for a system using the GML Unit Testing Framework and run them in background.",
      argsSchema: {
        systemName: z.string().min(1),
      },
    },
    async ({ systemName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Create a comprehensive unit test suite for system '${systemName}'. ` +
              "Call gm_test_framework_init first, then call gm_test_suite_create with suiteName='" + systemName + "', " +
              "add assertion checks (assert_equal, assert_true), run the tests using gm_test_runner_run, and report results.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "build-2d-lighting-system",
    {
      title: "Build 2D Lighting & Shadow System",
      description: "Generate a complete 2D light raycaster, shadow caster struct, and shader pair.",
      argsSchema: { systemName: z.string().optional() },
    },
    async ({ systemName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Build a 2D Additive Lighting and Dynamic Shadow system${systemName ? ` for ${systemName}` : ""}. ` +
              "Use gm_gml_light_shadow_2d_builder for GML struct rendering code, gm_gml_light_shadow_2d_shader_builder " +
              "for vertex and fragment shaders, write the shader with gm_shader_create, validate with gm_project_validate, and compile.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-inventory-system",
    {
      title: "Setup Inventory System with Drag & Drop UI",
      description: "Generate inventory database struct, slot UI controller, and save/load persistence.",
      argsSchema: { slotCount: z.string().optional() },
    },
    async ({ slotCount }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Build a full Inventory system with Drag-and-Drop UI${slotCount ? ` (${slotCount} slots)` : ""}. ` +
              "Call gm_inventory_system_generate for database logic, gm_gml_inventory_drag_drop_ui_builder for UI slot dragging, " +
              "write the GML script with gm_script_create, and validate with gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "convert-legacy-ds-structures",
    {
      title: "Convert legacy DS structures to modern GML 2024+",
      description: "Audit and convert legacy ds_list, ds_map, ds_grid, and ds_priority to GML 2D arrays & structs.",
      argsSchema: { focusVariable: z.string().optional() },
    },
    async ({ focusVariable }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Audit legacy Data Structures across the project. Use gm_gml_ds_to_struct_converter, gm_gml_ds_grid_to_array2d_converter, " +
              "gm_gml_ds_list_to_array_converter, gm_gml_ds_map_to_struct_converter, and gm_gml_ds_priority_to_array_converter " +
              `to replace manual memory management with automatic Garbage Collector arrays and structs.${focusVariable ? ` Focus on ${focusVariable}.` : ""}`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-ai-behavior-tree",
    {
      title: "Setup AI Behavior Tree System",
      description: "Build AI Selector, Sequence, and Action nodes for NPC/enemy decision making.",
      argsSchema: { treeName: z.string().optional() },
    },
    async ({ treeName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Build an AI Behavior Tree system${treeName ? ` named ${treeName}` : ""}. ` +
              "Call gm_gml_behavior_tree_builder to generate Selector, Sequence, and Action node structs, " +
              "write script with gm_script_create, preflight with gm_gml_validate_snippet, and run gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-localization-csv-i18n",
    {
      title: "Setup CSV Localization & i18n Translation",
      description: "Scan project for hardcoded UI text strings, generate localization.json / CSV string table, and build translator.",
      argsSchema: { defaultLanguage: z.string().optional() },
    },
    async ({ defaultLanguage }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Scan project for hardcoded UI strings using gm_i18n_extract_strings. " +
              `Call gm_gml_localization_csv_builder to generate CSV parser and translator struct code${defaultLanguage ? ` (default language: ${defaultLanguage})` : ""}, ` +
              "write translation file with gm_datafile_create, and validate with gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "audit-gc-memory-leaks",
    {
      title: "Audit Garbage Collector & Per-Frame Memory Leaks",
      description: "Scan GML scripts for per-frame dynamic array/struct/DS allocations in step and draw events.",
      argsSchema: { focusScript: z.string().optional() },
    },
    async ({ focusScript }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Audit Garbage Collector pressure and per-frame memory leaks${focusScript ? ` in ${focusScript}` : ""}. ` +
              "Call gm_gml_performance_memory_audit and gm_gml_gc_allocations_audit. " +
              "Identify allocations inside Step and Draw events, and refactor them to use static methods or instance variables.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-encrypted-save-system",
    {
      title: "Setup Encrypted JSON Save System",
      description: "Build encrypted JSON save/load state system with MD5/salt tamper checksums.",
      argsSchema: { fileName: z.string().optional() },
    },
    async ({ fileName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Setup an Encrypted JSON Save/Load system${fileName ? ` (${fileName})` : ""}. ` +
              "Call gm_gml_save_load_json_encrypted_builder to generate buffer string encoder, salted MD5 hash checksum validation, " +
              "and save state rollback support using gm_gml_save_state_rollback_builder.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-isometric-depth-sorting",
    {
      title: "Setup 2.5D Isometric Depth Sorting Pipeline",
      description: "Build 2.5D isometric depth sorting render pipeline code with Z-buffer toggles.",
      argsSchema: { enableZBuffer: z.string().optional() },
    },
    async ({ enableZBuffer }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Build a 2.5D Isometric Depth Sorting render pipeline. " +
              `Call gm_gml_render_pipeline_depth_sort_builder${enableZBuffer ? ` with enableZBuffer=${enableZBuffer}` : ""}, ` +
              "write render controller script with gm_script_create, and validate with gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-branching-dialogue-tree",
    {
      title: "Setup Node-Based Branching Dialogue Tree",
      description: "Generate node-based dialogue tree struct system with choice branching and callback triggers.",
      argsSchema: { systemName: z.string().optional() },
    },
    async ({ systemName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Generate a node-based Branching Dialogue Tree system${systemName ? ` (${systemName})` : ""}. ` +
              "Call gm_gml_dialogue_tree_generator, write dialogue manager script with gm_script_create, " +
              "validate snippet with gm_gml_validate_snippet, and test with gm_project_validate.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "setup-multiplayer-packet-buffers",
    {
      title: "Setup Binary Network Packet Buffer System",
      description: "Build binary GameMaker buffer encoder/decoder struct code for multiplayer network packets.",
      argsSchema: { packetName: z.string().min(1) },
    },
    async ({ packetName }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Build binary Network Packet Buffer encoder and decoder for packet '${packetName}'. ` +
              "Call gm_gml_network_packet_buffer_builder with fields array (u8, u16, u32, f32, string), " +
              "write packet script with gm_script_create, and validate project structure with gm_project_validate.",
          },
        },
      ],
    }),
  );
}
