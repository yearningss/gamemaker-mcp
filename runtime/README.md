# GameMaker MCP Runtime

**Runtime debugging, testing, and inspection for GameMaker** — 247 tools across 40 categories.

Connect MCP-compatible AI clients to a running GameMaker game to inspect state,
capture screenshots, control supported game systems, and run testing workflows.

## Architecture

```text
AI client
  | stdio / MCP
Node.js MCP server (TypeScript)
  | TCP / JSON-RPC 2.0
GML extension inside the running game
```

Uses GameMaker's built-in networking functions; no DLL is required.
This runtime server is configured separately from the project inspection and editing server.

## Features

- Inspect instances, variables, rooms, layers, tilemaps, and cameras.
- Capture game, GUI, and surface screenshots.
- Provide keyboard, mouse, and gamepad input simulation through the extension.
- Read and modify supported instance and global variables.
- Inspect FPS, frame timing, and available performance information.
- Control game speed, pause state, rooms, animation, audio, particles, and physics.
- Use testing, state tracking, analytics, documentation, and accessibility tools.

Memory measurements are limited to the available GC statistics and surface estimates.
Use GameMaker's profiler for detailed engine counters.

## Quick start

See [INSTALL.md](INSTALL.md) for object events, script setup, and client examples.

### 1. Build

From the repository root:

```bash
npm ci
npm run build
```

### 2. Add the extension

Create Script assets from the files in `runtime/extension/gamemaker_mcp/scripts/`.
Create `obj_mcp_server` with the provided object event code, then place it in the
first room. Follow the installation guide when assigning event files.

### 3. Configure an MCP client

Use an absolute path to the built runtime entry point:

```json
{
  "mcpServers": {
    "gamemaker-runtime": {
      "command": "node",
      "args": ["/absolute/path/gamemaker-mcp/runtime/server/build/index.js"],
      "env": {
        "GAMEMAKER_MCP_HOST": "127.0.0.1",
        "GAMEMAKER_MCP_PORT": "6705"
      }
    }
  }
}
```

### 4. Run and discover tools

Start the game using the `Debug` build configuration. Call `list_tool_categories`,
then `load_category` with the required category names. Initially only these two
discovery tools are advertised, keeping the initial tool catalog small.

## Build configuration

```gml
#macro MCP_ENABLED false
#macro :Debug MCP_ENABLED true
```

The default configuration disables the extension. In configurations other than
`Debug`, the server object destroys itself before networking initialization.
The runtime server controls the game independently of the project server's
read-only mode and project filesystem sandbox.

## Tool categories

247 category tools, plus 2 discovery tools. See [the tool reference](docs/tools.md)
for individual tool inputs and behavior.

| Category | Tools | Description |
| --- | ---: | --- |
| `project` | 6 | Project info, asset metadata, resource tree and counts |
| `instance` | 10 | Query, create, destroy, move instances and get instance info |
| `room` | 7 | Room navigation, room info, room list and room order |
| `variable` | 6 | Get/set instance and global variables |
| `debug` | 4 | FPS, frame timing, debug overlay and error logs |
| `input` | 7 | Simulate keyboard, mouse, and gamepad input |
| `screenshot` | 6 | Capture game, GUI, and surface screenshots, compare screenshots |
| `audio` | 6 | Play/stop sounds, get audio info and playing sounds |
| `layer` | 6 | Layer info, visibility, depth, elements and instances |
| `tilemap` | 6 | Tilemap data, tileset info, set/clear/fill tiles |
| `camera` | 6 | Camera position, size, shake, views and follow |
| `game_control` | 6 | Pause, resume, restart, game speed, step frame |
| `animation` | 6 | Sprite index, image properties, animation state and speed |
| `alarm` | 4 | Get, set, cancel alarms on instances |
| `surface` | 5 | Create, free, capture, list surfaces and memory info |
| `particle` | 6 | Particle systems, types, emission and clearing |
| `physics` | 6 | Physics properties, fixtures, forces, impulses and room physics |
| `ds` | 6 | Inspect ds_list, ds_map, ds_grid, ds_stack and memory estimates |
| `collision` | 5 | Point, line, rectangle collision checks, find collisions and raycast |
| `profiling` | 4 | Start/stop profiling, frame statistics and reports |
| `documentation` | 8 | GML function lookup, search, constants, concepts, reserved words and suggestions |
| `random` | 4 | Random seed get/set, randomize, and range testing |
| `filesystem` | 6 | Read/write text files, read JSON, list files and check existence |
| `path` | 8 | Create paths, add points, get info, list and convert to points |
| `state_debug` | 6 | State machines, FSM state get/set, history and logging |
| `shader` | 7 | Shader info, uniforms, set/reset shaders and compilation check |
| `font` | 5 | Font info, list, current font, text dimensions and readability |
| `project_file` | 6 | Read GML scripts, parse .yyp project files and search resources |
| `audio_extended` | 11 | Audio emitters, listeners, groups and emitter positioning |
| `timeline` | 7 | Timeline info, list, instance timelines, sequences and track position |
| `drawing` | 10 | Draw shapes, text, sprites, colors, alpha and blend modes |
| `buffer` | 10 | Create, read, write, copy, delete buffers and base64 conversion |
| `test_framework` | 6 | Run tests, assert values, check results and record/playback |
| `gc_memory` | 5 | Garbage collection statistics, surface estimates and snapshots |
| `room_settings` | 5 | Room size, speed, background color, viewports and batch instances |
| `code_quality` | 4 | Deprecated function detection, naming conventions and function categories |
| `analytics` | 6 | Event logging, play session stats, heatmap data and config info |
| `variable_history` | 6 | Track, watch, diff and inspect variable changes over time |
| `skeleton` | 6 | Spine skeleton info, animations, skins and slots |
| `accessibility` | 3 | Contrast ratio checks, color blindness simulation and text readability |

## Requirements

- GameMaker 2024.2+ for the GML extension.
- Node.js 20+.
- An MCP-compatible client supporting tool-list updates.

The TypeScript build and category registration have been verified. Running-game
behavior still needs end-to-end validation in GameMaker.
