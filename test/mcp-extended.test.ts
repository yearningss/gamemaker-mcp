import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { createFixtureProject } from "./helpers.js";

const EXPECTED_TOOLS = [
  "gm_project_info",
  "gm_runtime_detect",
  "gm_asset_list",
  "gm_asset_read",
  "gm_file_read",
  "gm_file_list",
  "gm_code_search",
  "gm_project_validate",
  "gm_project_statistics",
  "gm_gml_analyze",
  "gm_shader_analyze",
  "gm_symbol_references",
  "gm_dependency_graph",
  "gm_build",
  "gm_project_compile_errors",
  "gm_job_start",
  "gm_job_list",
  "gm_job_status",
  "gm_job_log",
  "gm_job_cancel",
  "gm_job_wait",
  "gm_gml_write",
  "gm_gml_patch",
  "gm_gml_patch_preview",
  "gm_script_create",
  "gm_shader_create",
  "gm_shader_inspect",
  "gm_shader_update",
  "gm_object_create",
  "gm_object_configure",
  "gm_object_events",
  "gm_object_event_read",
  "gm_object_event_read_raw",
  "gm_object_event_upsert",
  "gm_object_event_remove",
  "gm_object_event_remove_raw",
  "gm_folder_create",
  "gm_room_inspect",
  "gm_room_configure",
  "gm_room_creation_code_upsert",
  "gm_snapshot_create",
  "gm_snapshot_list",
  "gm_snapshot_inspect",
  "gm_snapshot_restore",
  "gm_connection_config",
  "gm_unused_assets",
  "gm_gml_docgen",
  "gm_sprite_inspect",
  "gm_sound_inspect",
  "gm_gml_validate_snippet",
  "gm_gml_profile_check",
  "gm_i18n_scan",
  "gm_draw_state_audit",
  "gm_room_instance_add",
  "gm_project_health_score",
  "gm_object_hierarchy",
  "gm_doc_export",
  "gm_gml_duplicate_find",
  "gm_sequence_inspect",
  "gm_note_create",
  "gm_note_inspect",
  "gm_note_update",
  "gm_sprite_create",
  "gm_sound_create",
  "gm_state_machine_generate",
  "gm_room_layer_add",
  "gm_asset_rename",
  "gm_project_autofix",
  "gm_font_create",
  "gm_font_inspect",
  "gm_tileset_create",
  "gm_tileset_inspect",
  "gm_anim_curve_create",
  "gm_anim_curve_inspect",
  "gm_particle_system_generate",
  "gm_gui_layout_generate",
  "gm_inventory_system_generate",
  "gm_timeline_create",
  "gm_timeline_inspect",
  "gm_macros_list",
  "gm_state_machine_visualize",
  "gm_object_event_chain",
  "gm_gml_dead_code_detect",
  "gm_test_framework_init",
  "gm_test_suite_create",
  "gm_test_runner_run",
  "gm_datafile_list",
  "gm_datafile_create",
  "gm_datafile_read",
  "gm_audio_group_list",
  "gm_texture_group_list",
  "gm_sound_configure",
  "gm_room_layer_remove",
  "gm_room_instance_remove",
  "gm_room_instance_configure",
  "gm_gml_globalvars_list",
  "gm_font_configure",
  "gm_tileset_configure",
  "gm_physics_audit",
  "gm_asset_find_references",
  "gm_i18n_extract_strings",
  "gm_shader_effect_generate",
  "gm_refactor_extract_script",
  "gm_room_export_json",
  "gm_project_architecture_audit",
  "gm_ide_preferences_inspect",
  "gm_ide_feather_config",
  "gm_ide_cache_clear",
  "gm_ide_recent_projects",
  "gm_ide_hotkeys_inspect",
  "gm_gml_format_code",
  "gm_project_search_replace",
  "gm_sequence_configure",
  "gm_timeline_configure",
  "gm_project_git_status",
  "gm_folder_compare_symbols",
  "gm_virtual_folder_assets_list",
  "gm_deep_similarity_scan",
  "gm_asset_duplicate_content_find",
  "gm_ide_options_configure",
  "gm_ide_platform_options_configure",
  "gm_ide_layouts_inspect",
  "gm_ide_feather_rules_audit",
  "gm_ide_project_backup_manager",
] as const;

test("stdio MCP exposes the complete extended GameMaker toolset", async () => {
  const fixture = createFixtureProject();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(currentDir, "../src/index.js");
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      GAMEMAKER_PROJECT: fixture.projectFile,
      GAMEMAKER_MCP_MODE: "read-only",
      GAMEMAKER_MCP_ALLOW_BUILD: "0",
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "gamemaker-mcp-extended-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = new Set(tools.tools.map((tool) => tool.name));
    assert.equal(names.size, EXPECTED_TOOLS.length);
    for (const name of EXPECTED_TOOLS) assert.ok(names.has(name), `missing MCP tool ${name}`);

    const startJob = tools.tools.find((tool) => tool.name === "gm_job_start");
    assert.match(startJob?.description ?? "", /trusted projects.*hooks.*arbitrary code/i);
    const cancelJob = tools.tools.find((tool) => tool.name === "gm_job_cancel");
    assert.equal(cancelJob?.annotations?.destructiveHint, true);

    const statistics = await client.callTool({ name: "gm_project_statistics", arguments: {} });
    assert.equal(statistics.isError, undefined);
    assert.match(JSON.stringify(statistics.content), /resources/);

    const files = await client.callTool({
      name: "gm_file_list",
      arguments: { extensions: ["yyp"], limit: 10 },
    });
    assert.equal(files.isError, undefined);
    assert.match(JSON.stringify(files.content), /Fixture\.yyp/);
  } finally {
    await client.close();
  }
});
