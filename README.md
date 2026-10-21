# GameMaker MCP Server

[![npm version](https://img.shields.io/npm/v/gamemaker-mcp.svg)](https://www.npmjs.com/package/gamemaker-mcp)
[![npm downloads](https://img.shields.io/npm/dm/gamemaker-mcp.svg)](https://www.npmjs.com/package/gamemaker-mcp)
[![license](https://img.shields.io/npm/l/gamemaker-mcp.svg)](https://github.com/yearningss/gamemaker-mcp/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/yearningss/gamemaker-mcp.svg)](https://github.com/yearningss/gamemaker-mcp)

A project-aware local MCP server for GameMaker Studio. It gives an MCP client structured access to a `.yyp` project: inspection, static analysis, guarded editing, object/room/shader operations, snapshots, validation, and official Igor builds.

The server uses the stable `@modelcontextprotocol/sdk` v1 line over `stdio`. It does not bind a network port. File operations stay inside one configured project, and existing text files use SHA-256 optimistic concurrency plus backups.

## Highlights

- 225 MCP tools, 25 reusable workflow prompts, and 6 project resources;
- zero-config workspace auto-detection (open any GameMaker project folder in your AI client);
- CLI installer & manager (`gamemaker-mcp install`, `doctor`, `connect`) supporting 20 AI clients & IDEs (Amp, Antigravity, Claude, Cline, Codex, Copilot, Cursor, Factory, Gemini CLI, Goose, Grok, Junie, Kiro, LM Studio, opencode, Qodo, Qwen, VS Code, Warp, Windsurf);
- tolerant parsing of GameMaker `.yyp`/`.yy` JSON-like files, including trailing commas;
- project, asset, room, object-event, object-inheritance, sprite, sound, sequence, font, tileset, animation curve, timeline, included data files, audio/texture groups, and shader inspection;
- GML symbol/complexity diagnostics, FPS profiler, i18n scanner, draw state auditor, health score (0-100%), object hierarchy tree, doc exporter, state machine visualizer, dead GML code detector, global variable scanner, physics auditor, asset cross-referencer, and duplicate code finder;
- preflight GML syntax validator (`gm_gml_validate_snippet`), Igor diagnostic compiler (`gm_project_compile_errors`), GML Unit Test suite runner (`gm_test_runner_run`), and Feather JSDoc generator (`gm_gml_docgen`);
- exact GML patch previews and guarded writes;
- GameMaker folder, object, script, shader, object-event, timeline, test suite, data file, font configuration, tileset configuration, room-setting, room layer, room instance transform, and room-creation-code operations;
- integrity-checked project snapshots and guarded restoration;
- GML Finite State Machine, Particle System, GUI layout, and Inventory system boilerplate generators, plus a GML Unit Testing Framework scaffold;
- synchronous compile/run plus persistent background Igor Compile/PackageZip jobs, status, wait, and cancellation;
- automatic GameMaker runtime and `Igor.exe` discovery;
- project-root path sandbox, symlink/junction checks, per-file limits, read-only mode, and build opt-in.

## Requirements

- Node.js 20 or newer;
- a GameMaker `.yyp` project;
- GameMaker Studio only for compile/package tools. Inspection and editing work without it.

## Installation & Setup Guide

### Method 1: Zero-Config Workspace Auto-Detect (Recommended)

Connect `gamemaker-mcp` once globally for all your AI clients:

```powershell
npx gamemaker-mcp@latest connect all
```

**How it works**:
Open any GameMaker project folder in any of the 20 supported AI clients (Claude Desktop, Google Antigravity, Cursor, VS Code, Windsurf, GitHub Copilot, Codex, Cline, etc.). The server automatically discovers and connects to your `.yyp` project file in the workspace directory dynamically at runtime without requiring a server restart!

---

### Method 2: Automatic One-Line Setup with Explicit Project Path

Run the automated installer via `npx`, passing the path to your GameMaker `.yyp` project file or directory:

```powershell
npx gamemaker-mcp@latest install "C:\Path\To\YourGame\YourGame.yyp"
```

What this command does automatically:
1. Verifies **Node.js** version (requires Node 20+).
2. Auto-detects installed **GameMaker Studio runtimes** & `Igor.exe`.
3. Validates your GameMaker `.yyp` project structure.
4. Generates a local `mcp-config.json` in your project directory.
5. Automatically configures and connects **all 20 supported AI clients and IDEs** (Amp, Antigravity, Claude, Cline, Codex, Copilot, Cursor, Factory, Gemini CLI, Goose, Grok, Junie, Kiro, LM Studio, opencode, Qodo, Qwen, VS Code, Warp, Windsurf).

---

### Method 3: Global CLI Installation

Install `gamemaker-mcp` globally using `npm`:

```powershell
npm install -g gamemaker-mcp
```

Then run commands from any terminal or PowerShell:

```powershell
# Full automatic setup for a project:
gamemaker-mcp install "C:\Projects\MyGame\MyGame.yyp"

# Verify environment, runtime, and connection status for all 20 clients:
gamemaker-mcp doctor "C:\Projects\MyGame\MyGame.yyp"

# Connect a specific AI client (claude | antigravity | cursor | codex | qwen | vscode | windsurf | copilot | all):
gamemaker-mcp connect antigravity
gamemaker-mcp connect claude
gamemaker-mcp connect vscode
gamemaker-mcp connect cursor
gamemaker-mcp connect all
```

---

### Method 4: Manual Client Configuration

If you prefer adding the MCP server to your AI client's configuration file manually:

#### 1. Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "npx",
      "args": ["-y", "gamemaker-mcp"],
      "env": {
        "GAMEMAKER_MCP_MODE": "workspace-write",
        "GAMEMAKER_MCP_ALLOW_BUILD": "1"
      }
    }
  }
}
```

#### 2. Google Antigravity (`~/.gemini/antigravity.json`)
```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "npx",
      "args": ["-y", "gamemaker-mcp"],
      "env": {
        "GAMEMAKER_MCP_MODE": "workspace-write",
        "GAMEMAKER_MCP_ALLOW_BUILD": "1"
      }
    }
  }
}
```

#### 3. Cursor (`%APPDATA%\Cursor\User\globalStorage\mcp.json`)
```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "npx",
      "args": ["-y", "gamemaker-mcp"],
      "env": {
        "GAMEMAKER_MCP_MODE": "workspace-write",
        "GAMEMAKER_MCP_ALLOW_BUILD": "1"
      }
    }
  }
}
```

#### 4. Qwen Code / CLI (`~/.qwen/mcp.json`)
```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "npx",
      "args": ["-y", "gamemaker-mcp"],
      "env": {
        "GAMEMAKER_MCP_MODE": "workspace-write",
        "GAMEMAKER_MCP_ALLOW_BUILD": "1"
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Meaning |
|---|---:|---|
| `GAMEMAKER_PROJECT` | auto-detect | Project directory or exact `.yyp` file (auto-detects from workspace if omitted) |
| `GAMEMAKER_MCP_MODE` | `read-only` | `read-only` or `workspace-write` |
| `GAMEMAKER_MCP_ALLOW_BUILD` | `0` | Enable Igor compile/package operations |
| `GAMEMAKER_MCP_MAX_FILE_BYTES` | `1048576` | Per-file text read/write limit |
| `GAMEMAKER_IGOR` | auto-detect | Exact path to `Igor.exe` |
| `GAMEMAKER_RUNTIME` | inferred | Runtime directory paired with Igor |
| `GAMEMAKER_USER_DIR` | auto-detect | GameMaker user/configuration directory |

## Complete Tool Catalog (225 Tools)

### IDE Integration & Preferences (6 Tools)

| Tool | Purpose |
|---|---|
| `gm_ide_preferences_inspect` | Read user preferences file (preferences.json) from GameMaker Studio user directory |
| `gm_ide_feather_config` | Create or update .featherconfig in project root to configure strict type checking and warnings |
| `gm_ide_cache_clear` | Safely remove project .gm_cache directory to fix stale asset compilation issues |
| `gm_ide_recent_projects` | Read recent_projects.json from GameMaker Studio user directory to list recently opened projects |
| `gm_ide_hotkeys_inspect` | Read keybindings.json configuration from GameMaker Studio user directory to display IDE hotkeys |

### Project & Navigation (10 Tools)

| Tool | Purpose |
|---|---|
| `gm_project_info` | Project identity, IDE/resource versions, asset counts, and room order |
| `gm_runtime_detect` | Installed runtimes and selected Igor toolchain |
| `gm_asset_list` | Filtered and paginated asset index |
| `gm_asset_read` | Asset metadata plus related GML/shader sources and hashes |
| `gm_file_list` | Filtered project file list with size/time and bounded hashing |
| `gm_file_read` | Allowed text content plus SHA-256 |
| `gm_code_search` | Literal or regex GML/GLSL search |
| `gm_project_validate` | Structural YYP/YY/resource/event/shader validation |
| `gm_project_statistics` | Resource, file, line, complexity, shader, and dependency statistics |
| `gm_project_autofix` | Scan and automatically repair missing YYP references, missing shader files, and corrupted metadata |

### Static Analysis & Quality Audit (21 Tools)

| Tool | Purpose |
|---|---|
| `gm_gml_analyze` | Functions, symbols, calls, complexity, delimiter errors, and risky patterns |
| `gm_shader_analyze` | Entry points, declarations, varying compatibility, and portability diagnostics |
| `gm_symbol_references` | Declarations, calls, writes, reads, and optional metadata references |
| `gm_dependency_graph` | Asset dependencies, evidence, isolated nodes, and cycles |
| `gm_unused_assets` | Scan project for unreferenced sprites, sounds, scripts, fonts, paths, and objects |
| `gm_gml_profile_check` | Scan Step/Draw events & loops for CPU/memory anti-patterns |
| `gm_i18n_scan` | Scan GML code for hardcoded string literals and suggest localization keys |
| `gm_draw_state_audit` | Audit Draw events for GPU state leaks (blendmodes, alpha, shader state) |
| `gm_gml_validate_snippet` | Preflight GML code for syntax delimiter balance and deprecated builtins |
| `gm_project_health_score` | Calculate 0-100% health score, grade (A+ to F), and recommendations |
| `gm_object_hierarchy` | Build object parent-child inheritance tree with inherited events |
| `gm_doc_export` | Generate structured Markdown documentation for all project assets |
| `gm_gml_duplicate_find` | Scan project GML files to detect identical contiguous code blocks across assets |
| `gm_macros_list` | Scan all scripts and objects to extract and list GML #macro definitions |
| `gm_state_machine_visualize` | Parse GML code to extract states and transitions, returning a Mermaid stateDiagram-v2 string |
| `gm_gml_dead_code_detect` | Scan GML scripts and objects to detect declared functions that are never called anywhere in the project |
| `gm_gml_globalvars_list` | Scan GML scripts and objects for global.variable usages, returning reads/writes breakdown |
| `gm_physics_audit` | Scan objects to inspect enabled physics mode, shape, density, friction, and restitution parameters |
| `gm_asset_find_references` | Scan project code files (.gml) and asset metadata (.yy/.yyp) for references to a given asset name |
| `gm_i18n_extract_strings` | Scan project GML files for hardcoded string literals and generate datafiles/localization.json dictionary |
| `gm_project_architecture_audit` | Comprehensive architecture audit reporting modularity score (0-100), grade (A+ to F), and design recommendations |

### GML, Assets & Resources (33 Tools)

| Tool | Purpose |
|---|---|
| `gm_gml_patch_preview` | Exact replacement count and changed-line preview without writing |
| `gm_gml_patch` | Exact guarded replacement with expected match count |
| `gm_gml_write` | Atomic guarded GML write |
| `gm_gml_docgen` | Generate Feather-compliant JSDoc headers (`/// @function`, `/// @param`, `/// @returns`) |
| `gm_sprite_inspect` | Inspect sprite origin (X/Y), collision mask mode, frames, speed, and texture group |
| `gm_sprite_create` | Create a new GameMaker Sprite asset (`.yy`) with configurable dimensions, origin, and texture group |
| `gm_sound_inspect` | Inspect sound audio group, compression type, sample rate, bit depth/rate, duration, and volume |
| `gm_sound_create` | Create a new GameMaker Sound asset (`.yy`) linking sound audio files with compression and volume |
| `gm_sound_configure` | Configure volume, preload flag, or audio group assignment of a sound asset |
| `gm_font_create` | Create a new GameMaker Font asset (`.yy` metadata) with font size, bold, and italic parameters |
| `gm_font_inspect` | Inspect a GameMaker Font asset and return font size, name, bold/italic options |
| `gm_font_configure` | Configure font family, size, bold, or italic parameters of a font asset |
| `gm_tileset_create` | Create a new GameMaker Tile Set asset (`.yy` metadata) linked to an existing Sprite |
| `gm_tileset_inspect` | Inspect a GameMaker Tile Set asset and return tile size, border, and linked sprite |
| `gm_tileset_configure` | Configure sprite assignment, tile size, or tile border/spacing of a tile set asset |
| `gm_folder_create` | Create or repair an asset-browser folder/YPP entry |
| `gm_script_create` | Create script metadata and GML source |
| `gm_state_machine_generate` | Generate a clean, struct-based GML Finite State Machine controller script (`scr_state_machine`) |
| `gm_particle_system_generate` | Generate a professional, struct-based GML Particle System manager boilerplate script |
| `gm_gui_layout_generate` | Generate a responsive GML GUI layout manager script and register it |
| `gm_inventory_system_generate` | Generate a struct-based GML Inventory system manager script and register it |
| `gm_asset_rename` | Safely rename any asset on disk, in YYP/YY metadata, and refactor all GML references project-wide |
| `gm_note_create` | Create a new GameMaker Note asset (`notes/NoteName/NoteName.txt`) with documentation text |
| `gm_note_inspect` | Read text documentation content, line count, file paths, and SHA-256 hash of a Note asset |
| `gm_note_update` | Guardedly update text content of a GameMaker Note asset with SHA-256 concurrency check |
| `gm_datafile_list` | List included data files registered in .yyp and stored in datafiles/ directory |
| `gm_datafile_create` | Create an included data file in datafiles/ and register its GMIncludedFile entry in .yyp |
| `gm_datafile_read` | Read text content of an included data file in datafiles/ |
| `gm_audio_group_list` | List configured audio groups and assigned sound assets in the project |
| `gm_texture_group_list` | List configured texture groups and assigned sprite assets in the project |
| `gm_shader_effect_generate` | Generate complete GLSL ES Vertex & Fragment shader assets for visual effects |
| `gm_refactor_extract_script` | Extract GML code block into a standalone script asset with Feather JSDoc headers |
| `gm_room_export_json` | Serialize room settings, layers, instances, and creation code into a portable JSON level format |

### Objects & Events (9 Tools)

| Tool | Purpose |
|---|---|
| `gm_object_create` | Create a modern GMObject and YYP reference |
| `gm_object_configure` | Set flags and sprite/mask/parent references |
| `gm_object_events` | List events with stable keys, paths, hashes, and line counts |
| `gm_object_event_read` | Read a common named event |
| `gm_object_event_read_raw` | Read any event by type/number/optional collision object |
| `gm_object_event_upsert` | Add or replace a common named event |
| `gm_object_event_remove` | Remove a common named event; code deletion is opt-in |
| `gm_object_event_remove_raw` | Precisely remove any numeric/collision event |
| `gm_object_event_chain` | Traverse parent hierarchy of an object and return implementing event files, line counts, and paths |

### Rooms, Shaders, Sequences, Timelines & Curves (16 Tools)

| Tool | Purpose |
|---|---|
| `gm_room_inspect` | Room settings, layers, instances, views, physics, and creation code |
| `gm_room_configure` | Guarded room size/persistence/view/volume update |
| `gm_room_creation_code_upsert` | Guarded room creation-code write/reference update |
| `gm_room_instance_add` | Place an object instance in a room at coordinates (X, Y) with scale, rotation, and layer selection |
| `gm_room_layer_add` | Add a new Instance, Background, Tilemap, or Asset layer to a room at specified depth and visibility |
| `gm_room_layer_remove` | Remove a named layer from a room |
| `gm_room_instance_remove` | Remove an instance from a room by name |
| `gm_room_instance_configure` | Configure position (X, Y), scale, or rotation of an instance in a room |
| `gm_shader_create` | Create shader metadata plus vertex/fragment stages |
| `gm_shader_inspect` | Stage hashes, uniforms, attributes, varyings, and interface issues |
| `gm_shader_update` | Guarded per-stage source update with preflight of both hashes |
| `gm_sequence_inspect` | Inspect Sequence tracks, length, playback speed, and keyframes |
| `gm_timeline_create` | Create a new GameMaker Timeline asset (.yy metadata) with a list of step moments and GML moment scripts |
| `gm_timeline_inspect` | Inspect a GameMaker Timeline asset and return the list of defined moment step indexes and GML paths |
| `gm_anim_curve_create` | Create a new Animation Curve asset with default linear channels |
| `gm_anim_curve_inspect` | Inspect an Animation Curve asset and return defined animation channel names |

### Snapshots & Integrity (4 Tools)

| Tool | Purpose |
|---|---|
| `gm_snapshot_create` | Create an integrity manifest and text payload snapshot |
| `gm_snapshot_list` | List saved snapshots |
| `gm_snapshot_inspect` | Verify and compare a snapshot |
| `gm_snapshot_restore` | Restore recorded files with integrity checks and backups |

### Builds & Igor Compiler Jobs (11 Tools)

| Tool | Purpose |
|---|---|
| `gm_compile_sync` | Synchronous Windows VM compile through Igor.exe |
| `gm_project_compile_errors` | Compile project with Igor and return parsed, structured file/line/message syntax errors |
| `gm_test_framework_init` | Initialize the GML Unit Testing Framework script (scr_test_framework) in the project |
| `gm_test_suite_create` | Create a new GML test suite script and register it in the Unit Testing Framework |
| `gm_test_runner_run` | Inject runner code, build & run project in background, capture and parse unit tests results |
| `gm_job_compile_start` | Start persistent background Igor `compile` job |
| `gm_job_package_zip_start` | Start persistent background Igor `package-zip` job |
| `gm_job_status` | Read live/persisted job state and artifact information |
| `gm_job_wait` | Wait for terminal job state |
| `gm_job_cancel` | Terminate an active build job |
| `gm_job_list` | List persistent build job history |

### Client Configuration (1 Tool)

| Tool | Purpose |
|---|---|
| `gm_connection_config` | Inspect and generate stdio client configuration |

### Architecture, Systems & Powerhouse Code Generators (65 Tools)

| Tool | Purpose |
|---|---|
| `gm_gml_object_collision_event_builder` | Build GML sub-pixel collision resolution event code with velocity reflection & friction |
| `gm_gml_light_shadow_2d_builder` | Build 2D additive light rendering and shadow caster GML struct code |
| `gm_gml_particle_emitter_burst_builder` | Build GML particle emitter burst code with region shape and auto-cleanup time source |
| `gm_gml_ds_grid_to_array2d_converter` | Convert legacy GameMaker ds_grid structures to modern 2D GML Arrays |
| `gm_gml_shader_uniform_struct_builder` | Build GML struct wrapper for binding and updating Shader Uniforms |
| `gm_gml_network_packet_buffer_builder` | Build binary GameMaker buffer encoder/decoder struct code for multiplayer network packets |
| `gm_gml_dialogue_tree_generator` | Generate GML node-based dialogue tree struct system with choice branching |
| `gm_gml_behavior_tree_builder` | Build AI Behavior Tree system code (Selector, Sequence, Action nodes) |
| `gm_gml_save_state_rollback_builder` | Build frame rollback save state history struct for local and multiplayer rewind |
| `gm_gml_screen_shake_camera_builder` | Build GML camera impulse screen shake decay and view pos update code |
| `gm_gml_localization_csv_builder` | Build GML CSV string table parser and dynamic i18n translation manager struct |
| `gm_gml_tween_easing_library_generator` | Generate GML Math Easing library (Linear, Quad, Cubic, Bounce) |
| `gm_gml_render_pipeline_depth_sort_builder` | Build 2.5D depth sorting render pipeline code with Z-buffer toggles |
| `gm_ide_room_instance_batch_add` | Batch insert multiple object instances into a GameMaker room layer |
| `gm_gml_performance_memory_audit` | Audit GML scripts for per-frame dynamic allocations and GC pressure |
| `gm_gml_light_shadow_2d_shader_builder` | Generate HLSL/GLSL ES 2D Light & Dynamic Shadow Shader pair (.vsh + .fsh) |
| `gm_gml_inventory_drag_drop_ui_builder` | Build Drag-and-Drop Inventory Slot UI system struct GML code |
| `gm_gml_ds_list_to_array_converter` | Convert legacy ds_list functions to modern GML 1D Array methods |
| `gm_gml_ds_map_to_struct_converter` | Convert legacy ds_map functions to modern GML Structs |
| `gm_gml_object_state_machine_events_generate` | Generate Object Event State Machine boilerplate scripts across Create, Step, Clean Up |
| `gm_gml_surface_blur_bloom_shader_builder` | Generate dual-pass Gaussian Blur & Bloom Shader pair (.vsh + .fsh) |
| `gm_gml_grid_pathfinding_a_star_builder` | Build custom A* Grid Pathfinding GML struct implementation |
| `gm_gml_audio_spatial_3d_emitter_builder` | Build 3D Spatial Audio Emitter controller struct code |
| `gm_gml_save_load_json_encrypted_builder` | Build Encrypted JSON Save/Load system struct GML code with MD5 checksums |
| `gm_gml_camera_view_follow_bounds_builder` | Build Smooth Camera Follow with Deadzone and Room Clamping code |
| `gm_gml_ds_priority_to_array_converter` | Convert legacy ds_priority queue to sorted GML Array struct |
| `gm_gml_event_pubsub_dispatcher_builder` | Build Global Observer Pub/Sub Event Dispatcher GML struct |
| `gm_gml_flexbox_ui_autolayout_builder` | Build Flexbox UI Layout spacing and alignment calculator GML code |
| `gm_ide_tileset_autotile_rules_configure` | Configure 47-piece or 16-piece autotiling rule metadata on a GameMaker TileSet |
| `gm_gml_type_checked_struct_builder` | Build schema-validated GML Struct constructor with type assertions |
| `gm_gml_ecs_system_builder` | Generate complete Entity-Component-System (ECS) framework in modern GML with entities and systems |
| `gm_gml_spatial_hash_grid_builder` | Build 2D Spatial Hashing Grid collision & broadphase query optimizer for 10,000+ entities |
| `gm_gml_quadtree_builder` | Build 2D Quadtree spatial partitioning system for fast dynamic range queries and frustum culling |
| `gm_gml_state_machine_hierarchical_builder` | Build Hierarchical Finite State Machine with nested sub-states, enter/exit cascades, and state stack |
| `gm_shader_crt_retro_builder` | Generate GLSL ES Retro CRT filter shaders with curvature, scanlines, and chromatic aberration |
| `gm_shader_water_distortion_builder` | Generate GLSL ES Screen-space water reflection, wave distortion, and caustics normal-map shader pair |
| `gm_shader_dissolve_burn_builder` | Generate GLSL ES Texture dissolve & burning ember edge shader pair with threshold controls |
| `gm_shader_palette_swap_builder` | Generate GLSL ES Dynamic 2D palette swap shader supporting real-time indexed texture lookup |
| `gm_shader_outline_glow_builder` | Generate GLSL ES Pixel-perfect outer outline and inner glow shader for 2D sprites |
| `gm_shader_fog_of_war_builder` | Generate GLSL ES Fog of war discovery and soft radial mask shader pair |
| `gm_shader_shockwave_distortion_builder` | Generate GLSL ES Expanding radial shockwave displacement shader pair |
| `gm_shader_glitch_vhs_builder` | Generate GLSL ES VHS tracking lines, RGB chromatic split, and analog glitch shader pair |
| `gm_shader_wind_grass_sway_builder` | Generate GLSL ES Vegetation vertex sway wind animation shader pair |
| `gm_shader_color_grading_lut_builder` | Generate GLSL ES 3D LUT color grading texture sampler shader pair |
| `gm_gml_verlet_rope_cloth_builder` | Build 2D Verlet Integration physics engine for ropes, chains, ragdolls, and cloth simulation |
| `gm_gml_pid_controller_builder` | Build PID controller for smooth procedural physics, steering, and camera dampening |
| `gm_gml_bezier_spline_builder` | Build Cubic & Quadratic Bezier curve spline generator with arc-length parameterization |
| `gm_gml_procedural_generation_dungeon_builder` | Build procedural dungeon generator with BSP rooms and connecting corridors |
| `gm_gml_wave_function_collapse_builder` | Build 2D Wave Function Collapse procedural map tile generator |
| `gm_gml_audio_dynamic_music_manager` | Build dynamic music crossfader with vertical layering (stems) based on game intensity |
| `gm_gml_audio_sound_envelope_builder` | Build ADSR volume envelope generator for procedural sounds and audio synthesizer effects |
| `gm_gml_combo_input_buffer_builder` | Build fighting game style directional + button input buffer with fuzzy timing windows |
| `gm_gml_quest_journal_builder` | Build branching Quest/Mission Journal system with objectives, stages, and completion tracking |
| `gm_gml_skill_tree_builder` | Build node-based RPG Skill Tree progression calculator with prerequisites, point costs, and modifiers |
| `gm_gml_floating_text_manager` | Build high-performance pooled floating combat damage numbers & combat text renderer |
| `gm_gml_virtual_joystick_touch_builder` | Build mobile/touch virtual thumbstick & action buttons controller struct |
| `gm_gml_cutscene_sequencer_builder` | Build coroutine-like step-by-step cutscene action sequencer (camera moves, dialogues, delays) |
| `gm_gml_achievement_system_builder` | Build local and Steam-compatible achievement tracker with progress notifications |
| `gm_gml_dialogue_choice_graph_builder` | Build branching dialogue graph with conditional choices, portraits, and speaker labels |
| `gm_gml_rollback_netcode_simulator` | Build GGPO-style client-side prediction, input ring buffer, and state resimulation loop |
| `gm_gml_save_compression_zlib_builder` | Build binary buffer zlib compression and decompression logic for save files |
| `gm_gml_cloud_save_sync_builder` | Build cloud save timestamp conflict resolution and synchronization logic |
| `gm_project_git_diff_summary` | Scan project changes relative to git, mapping modified files to GameMaker asset names |
| `gm_gml_benchmark_macro_injector` | Inject high-resolution timer profiling macros (get_timer()) around target GML functions |
| `gm_room_bulk_tile_filler` | Fill a room tilemap layer with a repeating grid of tiles procedurally |

## Resources and Prompts

### Resources (6)

- `gamemaker://project/info` — Live project summary and resource metadata.
- `gamemaker://project/statistics` — Live resource, line count, complexity, and dependency stats.
- `gamemaker://runtimes` — Detected GameMaker Studio runtimes and Igor.exe paths.
- `gamemaker://gml/rules` — Mandatory GML 2024+ strict syntax and coding rules for AI model context.
- `gamemaker://snapshots` — List of recorded project integrity snapshots.
- `gamemaker://jobs/history` — History of Igor build and package jobs.

### Workflow Prompts (25)

- `audit-gamemaker-project`: Run a read-only structural, GML, shader, dependency, and statistics audit.
- `debug-gamemaker-build`: Use the persistent background job workflow to diagnose project build errors.
- `safe-gamemaker-refactor`: Snapshot, inspect references, preview patches, edit with hashes, validate, and compile.
- `implement-gamemaker-shader-effect`: Inspect and update a shader with cross-stage validation and a build check.
- `restore-gamemaker-snapshot`: Inspect a snapshot and request explicit confirmation before destructive restoration.
- `create-state-machine`: Generate a robust, clean state machine pattern for GameMaker objects.
- `optimize-draw-events`: Audit and optimize Draw events for batching, texture swaps, and state resets.
- `refactor-gml-script`: Refactor legacy argument0..15 scripts to modern GML 2024+ syntax and Feather JSDoc.
- `write-clean-gml-script`: Generate Feather-compliant, memory-optimized GML script with constructors and static methods.
- `write-gml-unit-test`: Create GML unit test suite, add assertion checks, and run them using the test framework.
- `build-2d-lighting-system`: Generate a complete 2D light raycaster, shadow caster struct, and shader pair.
- `setup-inventory-system`: Generate inventory database struct, slot UI controller, and save/load persistence.
- `convert-legacy-ds-structures`: Audit and convert legacy ds_list, ds_map, ds_grid, and ds_priority to GML 2D arrays & structs.
- `setup-ai-behavior-tree`: Build AI Selector, Sequence, and Action nodes for NPC/enemy decision making.
- `setup-localization-csv-i18n`: Scan project for hardcoded UI text strings, generate localization dictionary, and build translator.
- `audit-gc-memory-leaks`: Scan GML scripts for per-frame dynamic array/struct/DS allocations in step and draw events.
- `setup-encrypted-save-system`: Build encrypted JSON save/load state system with MD5/salt tamper checksums.
- `setup-isometric-depth-sorting`: Build 2.5D isometric depth sorting render pipeline code with Z-buffer toggles.
- `setup-branching-dialogue-tree`: Generate node-based dialogue tree struct system with choice branching and callback triggers.
- `setup-multiplayer-packet-buffers`: Build binary GameMaker buffer encoder/decoder struct code for multiplayer network packets.
- `setup-ecs-architecture`: Setup complete Entity-Component-System (ECS) framework for high entity count performance.
- `setup-procedural-dungeon`: Build procedural dungeon generator with rooms, corridors, and tilemap binding.
- `setup-crt-retro-pipeline`: Generate full-screen GLSL ES CRT filter with scanlines, screen curvature, and chromatic aberration.
- `setup-rollback-netcode`: Scaffold GGPO-style input ring buffer, client-side prediction, and resimulation rollback loop.
- `setup-fighting-combo-buffer`: Build fighting game directional and button combo buffer with fuzzy timing windows.

## Recommended workflow

1. Inspect with `gm_project_info`, `gm_asset_list`, and the analysis tools.
2. Before a multi-file change, create a labeled snapshot.
3. Read every affected file and retain the returned SHA-256.
4. Preview exact GML patches where applicable.
5. Apply the smallest guarded edit. Stop and re-read if a hash is stale.
6. Run `gm_project_validate` after metadata changes.
7. Compile a trusted project with `gm_job_start`, then use `gm_job_wait` and `gm_job_log`.

Backups are stored under `.gamemaker-mcp/backups`; snapshots and job history live under `.gamemaker-mcp/snapshots` and `.gamemaker-mcp/jobs`.

## Test any project

The smoke command starts the built MCP server in read-only mode, lists its tools, and calls project info, validation, statistics, GML analysis, and shader analysis:

```powershell
npm run smoke -- "C:\path\to\Game.yyp"
```

## Security model

- tool file paths are project-relative; absolute paths, traversal, NUL bytes, and symlink/junction escapes are rejected;
- only an allowlist of text extensions can be written;
- writes and Igor operations are disabled by default;
- existing-file writes require a SHA-256 read by the caller unless an explicitly supported force path is used;
- metadata edits preserve unknown fields through `jsonc-parser` and create backups;
- Igor is launched from a fixed executable with allowlisted actions and `shell: false`;
- **only compile/package trusted GameMaker projects**: GameMaker itself can run project compiler batch files, extensions, and build hooks;
- stdout is reserved for MCP JSON-RPC; server diagnostics go to stderr.

The server intentionally does not expose arbitrary shell commands, arbitrary YY/YPP overwrite, bulk asset deletion, or GUI automation. Binary sprite/audio import remains outside the current safe text-focused scope.

## Compact tool discovery (default)

The project server initially advertises only `gm_tools_search` and `gm_tools_enable`.
Search using words from a tool name or description, then enable the returned names.
Disable finished tools with `enabled: false`. Pagination uses `offset` and `limit`.
Clients must refresh their tool list after MCP tool-list change notifications.
Set `GM_MCP_TOOL_MODE=full` for clients that require a static catalog or for legacy integrations.
Project path checks, write permissions, input validation and hash checks still run in the original handlers.

## Runtime tools

The runtime server provides 254 tools across 40 categories for inspecting and
controlling a running GameMaker game. It starts with two category discovery tools;
use `list_tool_categories` and `load_category` to enable what you need.

Run `npm ci` and `npm run build` in the repository root. Configure a second MCP
server using `node /absolute/path/gamemaker-mcp/runtime/server/build/index.js`.
For terminal use, run `npm run start:runtime`.

Install the GML extension using [the installation guide](runtime/INSTALL.md).
The default connection is `127.0.0.1:6705`; configure it with
`GAMEMAKER_MCP_HOST` and `GAMEMAKER_MCP_PORT`.

The runtime server controls the game independently of the project server's
read-only mode and filesystem sandbox. Use it in development builds.
See the [runtime tool reference](runtime/docs/tools.md).
