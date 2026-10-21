# Installation Guide

## Prerequisites

- **GameMaker 2024.2+** (required for `variable_instance_get_names()` and modern networking)
- **Node.js 20+**
- **An MCP-compatible AI client** (Claude Code, Cursor, VS Code with Copilot, etc.)

## Step 1: Build the MCP Server

From the repository root:

```bash
npm ci
npm run build
```

The runtime entry point is `runtime/server/build/index.js`.
All extension paths below are relative to the `runtime/` directory.

## Step 2: Add GML Extension to Your GameMaker Project

### Option A: Manual Copy (Recommended)

1. **Copy Scripts** — Copy all `.gml` files from `extension/gamemaker_mcp/scripts/` into your GameMaker project as Script assets:
   - `mcp_server` (contains server init, networking, JSON-RPC)
   - `mcp_router` (command routing)
   - `mcp_commands_project`
   - `mcp_commands_instance`
   - `mcp_commands_room`
   - `mcp_commands_variable`
   - `mcp_commands_debug`
   - `mcp_commands_input`
   - `mcp_commands_screenshot`
   - `mcp_commands_audio`
   - `mcp_commands_layer`
   - `mcp_commands_tilemap`
   - `mcp_commands_camera`
   - `mcp_commands_particle`
   - `mcp_commands_physics`
   - `mcp_commands_ds`
   - `mcp_commands_game`
   - `mcp_commands_alarm`
   - `mcp_commands_animation`
   - `mcp_commands_collision`
   - `mcp_commands_profiling`
   - `mcp_commands_random`
   - `mcp_commands_filesystem`
   - `mcp_commands_path`
   - `mcp_commands_state_debug`
   - `mcp_commands_shader`
   - `mcp_commands_font`
   - `mcp_commands_audio_extended`
   - `mcp_commands_timeline`
   - `mcp_commands_drawing`
   - `mcp_commands_buffer`
   - `mcp_commands_test`
   - `mcp_commands_gc_memory`
   - `mcp_commands_room_settings`
   - `mcp_commands_analytics`
   - `mcp_commands_variable_history`
   - `mcp_commands_skeleton`
   - `mcp_commands_surface`
   - `mcp_utils`

2. **Create Object** — Create an object called `obj_mcp_server` with these events:
   - **Create Event** — paste content from `objects/obj_mcp_server/Create_0.gml`
   - **Step Event** — paste content from `objects/obj_mcp_server/Step_0.gml`
   - **Begin Step Event** — paste content from `objects/obj_mcp_server/Begin_Step.gml`
   - **Async - Networking Event** — paste content from `objects/obj_mcp_server/Async_Networking.gml`
   - **Draw GUI End Event** — paste content from `objects/obj_mcp_server/Draw_GUI_End.gml`
   - **Clean Up Event** — paste content from `objects/obj_mcp_server/Clean_Up.gml`

3. **Place in Room** — Place `obj_mcp_server` in your **first room**. It sets itself as `persistent`, so it will survive room changes.

### Option B: GameMaker Extension Import

Import `extension/gamemaker_mcp/gamemaker_mcp.yy` as a Local Package if your GameMaker version supports it.

## Step 3: Configure Build Configurations

The extension uses GameMaker's Configuration macros to auto-disable in release builds:

```gml
#macro MCP_ENABLED false
#macro :Debug MCP_ENABLED true
```

Make sure you have a **Debug** configuration in your project. The MCP server only starts when running under the Debug config.

## Step 4: Configure Your AI Client

### Claude Code / Claude Desktop

Add to `~/.claude/claude_desktop_config.json` (or your project's `.mcp.json`):

```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "node",
      "args": ["/FULL/PATH/TO/gamemaker-mcp/runtime/server/build/index.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "gamemaker": {
      "command": "node",
      "args": ["/FULL/PATH/TO/gamemaker-mcp/runtime/server/build/index.js"]
    }
  }
}
```

### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "gamemaker": {
      "command": "node",
      "args": ["/FULL/PATH/TO/gamemaker-mcp/runtime/server/build/index.js"]
    }
  }
}
```

## Step 5: Custom Port (Optional)

Default port is **6705**. To change:

**Environment variable:**
```json
{
  "env": {
    "GAMEMAKER_MCP_PORT": "6710"
  }
}
```

**In GML** (before `mcp_server_init()`):
The server reads `GAMEMAKER_MCP_PORT` environment variable, or you can modify the `MCP_PORT` macro.

## Step 6: Verify Connection

1. Run your game in **Debug** configuration
2. You should see in the GameMaker output: `[MCP] Server started on port 6705`
3. Start your AI client — it will auto-connect
4. Try a command: ask your AI to "get the current FPS" or "list all instances"

## Troubleshooting

### "Connection refused" error
- Make sure your game is running with the Debug configuration
- Check that port 6705 is not blocked by firewall
- Verify `obj_mcp_server` exists in your first room

### "MCP_ENABLED not defined" error
- Make sure you've imported all scripts, especially `mcp_server.gml` which defines the macro

### Extension does nothing in Release build
- This is intentional! The `MCP_ENABLED` macro is `false` in non-Debug configs.

### Port conflict
- Change the port via `GAMEMAKER_MCP_PORT` environment variable
- Default ports: GameMaker MCP = 6705, Godot MCP = 6505, Unity MCP = 6605
