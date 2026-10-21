import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "./gamemaker-connection.js";

// Tool registrations
import { registerProjectTools } from "./tools/project-tools.js";
import { registerInstanceTools } from "./tools/instance-tools.js";
import { registerRoomTools } from "./tools/room-tools.js";
import { registerVariableTools } from "./tools/variable-tools.js";
import { registerDebugTools } from "./tools/debug-tools.js";
import { registerInputTools } from "./tools/input-tools.js";
import { registerScreenshotTools } from "./tools/screenshot-tools.js";
import { registerAudioTools } from "./tools/audio-tools.js";
import { registerLayerTools } from "./tools/layer-tools.js";
import { registerTilemapTools } from "./tools/tilemap-tools.js";
import { registerCameraTools } from "./tools/camera-tools.js";
import { registerGameControlTools } from "./tools/game-control-tools.js";
import { registerAnimationTools } from "./tools/animation-tools.js";
import { registerAlarmTools } from "./tools/alarm-tools.js";
import { registerSurfaceTools } from "./tools/surface-tools.js";
import { registerParticleTools } from "./tools/particle-tools.js";
import { registerPhysicsTools } from "./tools/physics-tools.js";
import { registerDsTools } from "./tools/ds-tools.js";
import { registerCollisionTools } from "./tools/collision-tools.js";
import { registerProfilingTools } from "./tools/profiling-tools.js";
import { registerDocumentationTools } from "./tools/documentation-tools.js";
import { registerRandomTools } from "./tools/random-tools.js";
import { registerFileSystemTools } from "./tools/filesystem-tools.js";
import { registerPathTools } from "./tools/path-tools.js";
import { registerStateDebugTools } from "./tools/state-debug-tools.js";
import { registerShaderTools } from "./tools/shader-tools.js";
import { registerFontTools } from "./tools/font-tools.js";
import { registerProjectFileTools } from "./tools/project-file-tools.js";
import { registerAudioExtendedTools } from "./tools/audio-extended-tools.js";
import { registerTimelineTools } from "./tools/timeline-tools.js";
import { registerDrawingTools } from "./tools/drawing-tools.js";
import { registerBufferTools } from "./tools/buffer-tools.js";
import { registerTestFrameworkTools } from "./tools/test-framework-tools.js";
import { registerGcMemoryTools } from "./tools/gc-memory-tools.js";
import { registerRoomSettingsTools } from "./tools/room-settings-tools.js";
import { registerCodeQualityTools } from "./tools/code-quality-tools.js";
import { registerAnalyticsTools } from "./tools/analytics-tools.js";
import { registerVariableHistoryTools } from "./tools/variable-history-tools.js";
import { registerSkeletonTools } from "./tools/skeleton-tools.js";
import { registerAccessibilityTools } from "./tools/accessibility-tools.js";

interface CategoryDef {
  name: string;
  displayName: string;
  description: string;
  toolCount: number;
  register: (server: McpServer, gm: GameMakerConnection) => void;
  needsGm: boolean;
}

// Wrapper for tools that don't need GameMakerConnection
function serverOnly(fn: (server: McpServer) => void): (server: McpServer, gm: GameMakerConnection) => void {
  return (server) => fn(server);
}

const CATEGORIES: CategoryDef[] = [
  { name: "project", displayName: "Project", description: "Project info, asset metadata, resource tree and counts", toolCount: 6, register: registerProjectTools, needsGm: true },
  { name: "instance", displayName: "Instance", description: "Query, create, destroy, move instances and get instance info", toolCount: 10, register: registerInstanceTools, needsGm: true },
  { name: "room", displayName: "Room", description: "Room navigation, room info, room list and room order", toolCount: 7, register: registerRoomTools, needsGm: true },
  { name: "variable", displayName: "Variable", description: "Get/set instance and global variables", toolCount: 8, register: registerVariableTools, needsGm: true },
  { name: "debug", displayName: "Debug", description: "Debug overlay, error logs, expression evaluation, GML execution", toolCount: 7, register: registerDebugTools, needsGm: true },
  { name: "input", displayName: "Input", description: "Simulate keyboard, mouse, and gamepad input", toolCount: 7, register: registerInputTools, needsGm: true },
  { name: "screenshot", displayName: "Screenshot", description: "Capture game, GUI, and surface screenshots, compare screenshots", toolCount: 6, register: registerScreenshotTools, needsGm: true },
  { name: "audio", displayName: "Audio", description: "Play/stop sounds, get audio info and playing sounds", toolCount: 6, register: registerAudioTools, needsGm: true },
  { name: "layer", displayName: "Layer", description: "Layer info, visibility, depth, elements and instances", toolCount: 6, register: registerLayerTools, needsGm: true },
  { name: "tilemap", displayName: "Tilemap", description: "Tilemap data, tileset info, set/clear/fill tiles", toolCount: 6, register: registerTilemapTools, needsGm: true },
  { name: "camera", displayName: "Camera", description: "Camera position, size, shake, views and follow", toolCount: 6, register: registerCameraTools, needsGm: true },
  { name: "game_control", displayName: "Game Control", description: "Pause, resume, restart, game speed, step frame", toolCount: 6, register: registerGameControlTools, needsGm: true },
  { name: "animation", displayName: "Animation", description: "Sprite index, image properties, animation state and speed", toolCount: 6, register: registerAnimationTools, needsGm: true },
  { name: "alarm", displayName: "Alarm", description: "Get, set, cancel alarms on instances", toolCount: 4, register: registerAlarmTools, needsGm: true },
  { name: "surface", displayName: "Surface", description: "Create, free, capture, list surfaces and memory info", toolCount: 5, register: registerSurfaceTools, needsGm: true },
  { name: "particle", displayName: "Particle", description: "Particle systems, types, emission and clearing", toolCount: 6, register: registerParticleTools, needsGm: true },
  { name: "physics", displayName: "Physics", description: "Physics properties, fixtures, forces, impulses and room physics", toolCount: 6, register: registerPhysicsTools, needsGm: true },
  { name: "ds", displayName: "Data Structures", description: "Inspect ds_list, ds_map, ds_grid, ds_stack and memory estimates", toolCount: 6, register: registerDsTools, needsGm: true },
  { name: "collision", displayName: "Collision", description: "Point, line, rectangle collision checks, find collisions and raycast", toolCount: 5, register: registerCollisionTools, needsGm: true },
  { name: "profiling", displayName: "Profiling", description: "Start/stop profiling, performance stats, step time and draw calls", toolCount: 5, register: registerProfilingTools, needsGm: true },
  { name: "documentation", displayName: "Documentation", description: "GML function lookup, search, constants, concepts, reserved words and suggestions", toolCount: 8, register: serverOnly(registerDocumentationTools), needsGm: false },
  { name: "random", displayName: "Random", description: "Random seed get/set, randomize, and range testing", toolCount: 4, register: registerRandomTools, needsGm: true },
  { name: "filesystem", displayName: "File System", description: "Read/write text files, read JSON, list files and check existence", toolCount: 6, register: registerFileSystemTools, needsGm: true },
  { name: "path", displayName: "Path", description: "Create paths, add points, get info, list and convert to points", toolCount: 8, register: registerPathTools, needsGm: true },
  { name: "state_debug", displayName: "State Debug", description: "State machines, FSM state get/set, history and logging", toolCount: 6, register: registerStateDebugTools, needsGm: true },
  { name: "shader", displayName: "Shader", description: "Shader info, uniforms, set/reset shaders and compilation check", toolCount: 7, register: registerShaderTools, needsGm: true },
  { name: "font", displayName: "Font", description: "Font info, list, current font, text dimensions and readability", toolCount: 5, register: registerFontTools, needsGm: true },
  { name: "project_file", displayName: "Project File", description: "Read GML scripts, parse .yyp project files and search resources", toolCount: 6, register: serverOnly(registerProjectFileTools), needsGm: false },
  { name: "audio_extended", displayName: "Audio Extended", description: "Audio emitters, listeners, groups and emitter positioning", toolCount: 11, register: registerAudioExtendedTools, needsGm: true },
  { name: "timeline", displayName: "Timeline", description: "Timeline info, list, instance timelines, sequences and track position", toolCount: 7, register: registerTimelineTools, needsGm: true },
  { name: "drawing", displayName: "Drawing", description: "Draw shapes, text, sprites, colors, alpha and blend modes", toolCount: 10, register: registerDrawingTools, needsGm: true },
  { name: "buffer", displayName: "Buffer", description: "Create, read, write, copy, delete buffers and base64 conversion", toolCount: 10, register: registerBufferTools, needsGm: true },
  { name: "test_framework", displayName: "Test Framework", description: "Run tests, assert values, check results and record/playback", toolCount: 6, register: registerTestFrameworkTools, needsGm: true },
  { name: "gc_memory", displayName: "GC & Memory", description: "Garbage collection, memory usage, snapshots and texture pages", toolCount: 6, register: registerGcMemoryTools, needsGm: true },
  { name: "room_settings", displayName: "Room Settings", description: "Room size, speed, background color, viewports and batch instances", toolCount: 5, register: registerRoomSettingsTools, needsGm: true },
  { name: "code_quality", displayName: "Code Quality", description: "Deprecated function detection, naming conventions and function categories", toolCount: 4, register: serverOnly(registerCodeQualityTools), needsGm: false },
  { name: "analytics", displayName: "Analytics", description: "Event logging, play session stats, heatmap data and config info", toolCount: 6, register: registerAnalyticsTools, needsGm: true },
  { name: "variable_history", displayName: "Variable History", description: "Track, watch, diff and inspect variable changes over time", toolCount: 6, register: registerVariableHistoryTools, needsGm: true },
  { name: "skeleton", displayName: "Skeleton", description: "Spine skeleton info, animations, skins and slots", toolCount: 6, register: registerSkeletonTools, needsGm: true },
  { name: "accessibility", displayName: "Accessibility", description: "Contrast ratio checks, color blindness simulation and text readability", toolCount: 3, register: serverOnly(registerAccessibilityTools), needsGm: false },
];

const CATEGORY_MAP = new Map<string, CategoryDef>(CATEGORIES.map(c => [c.name, c]));


export function registerMetaTools(server: McpServer, gm: GameMakerConnection): void {
  const loadedCategories = new Set<string>();
  const totalTools = CATEGORIES.reduce((sum, c) => sum + c.toolCount, 0);

  server.tool(
    "list_tool_categories",
    `List all ${CATEGORIES.length} tool categories (${totalTools} tools total). Use load_category to enable the tools you need.`,
    {},
    async () => {
      const list = CATEGORIES.map(c => ({
        category: c.name,
        displayName: c.displayName,
        description: c.description,
        toolCount: c.toolCount,
        loaded: loadedCategories.has(c.name),
        needsGameMaker: c.needsGm,
      }));
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(list, null, 2),
        }],
      };
    }
  );

  server.tool(
    "load_category",
    "Load one or more tool categories to make their tools available. Pass comma-separated category names.",
    { category: z.string().describe("Category name(s) to load, e.g. 'instance' or 'instance,room,variable'") },
    async ({ category }) => {
      const names = category.split(",").map(s => s.trim()).filter(Boolean);
      const results: string[] = [];

      for (const name of names) {
        if (loadedCategories.has(name)) {
          results.push(`${name}: already loaded`);
          continue;
        }
        const def = CATEGORY_MAP.get(name);
        if (!def) {
          results.push(`${name}: unknown category`);
          continue;
        }
        def.register(server, gm);
        loadedCategories.add(name);
        results.push(`${name}: loaded ${def.toolCount} tools`);
      }

      // Notify client that tool list has changed
      server.sendToolListChanged();

      return {
        content: [{
          type: "text" as const,
          text: results.join("\n"),
        }],
      };
    }
  );
}
