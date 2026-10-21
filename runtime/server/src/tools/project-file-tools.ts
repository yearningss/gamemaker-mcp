import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { formatError } from "../utils/errors.js";

// Event type number to human-readable name mapping
const EVENT_TYPE_NAMES: Record<number, string> = {
  0: "Create",
  1: "Destroy",
  2: "Alarm",
  3: "Step",
  4: "Collision",
  5: "Keyboard",
  6: "Mouse",
  7: "Other",
  8: "Draw",
  9: "KeyPress",
  10: "KeyRelease",
  11: "Trigger",
  12: "CleanUp",
  13: "Gesture",
  14: "PreCreate",
};

// Get project path from parameter or env variable
// Accepts either a .yyp file path or a project directory (auto-finds .yyp)
async function getProjectPath(paramPath?: string): Promise<string> {
  const resolved = paramPath || process.env.GAMEMAKER_PROJECT_PATH || "";
  if (!resolved) {
    throw new Error(
      "No project path provided. Pass project_path or set GAMEMAKER_PROJECT_PATH environment variable."
    );
  }
  // If it's a directory, find the .yyp file inside
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) {
    const files = await fs.readdir(resolved);
    const yyp = files.find((f) => f.endsWith(".yyp"));
    if (!yyp) {
      throw new Error(`No .yyp file found in directory: ${resolved}`);
    }
    return path.join(resolved, yyp);
  }
  return resolved;
}

// Get the project directory (dirname of the .yyp file)
function getProjectDir(yypPath: string): string {
  return path.dirname(yypPath);
}

// Parse a .yyp or .yy JSON file
// GameMaker uses "trailing comma JSON" which is not valid standard JSON,
// so we strip trailing commas before parsing.
async function parseJsonFile(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, "utf-8");
  // Remove trailing commas before } or ] (GameMaker's .yyp/.yy format)
  const cleaned = content.replace(/,\s*([\]}])/g, "$1");
  return JSON.parse(cleaned);
}

// Extract the asset type from a resource path like "sprites/spr_player/spr_player.yy"
function extractAssetType(resourcePath: string): string {
  const firstSegment = resourcePath.split("/")[0];
  return firstSegment || "unknown";
}

// Extract the asset name from a resource path
function extractAssetName(resourcePath: string): string {
  const segments = resourcePath.split("/");
  // Typically "type/name/name.yy" - the name is the second segment
  return segments.length >= 2 ? segments[1] : segments[0];
}

export function registerProjectFileTools(server: McpServer): void {
  // ─────────────────────────────────────────────
  // 1. parse_yyp_project
  // ─────────────────────────────────────────────
  server.tool(
    "parse_yyp_project",
    "Parse a GameMaker .yyp project file and return its structure",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
    },
    async ({ project_path }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const data = await parseJsonFile(yypPath);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // 2. get_all_project_assets
  // ─────────────────────────────────────────────
  server.tool(
    "get_all_project_assets",
    "Get all assets listed in a GameMaker project file",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
      type_filter: z
        .string()
        .optional()
        .describe(
          "Filter by type: sprites, objects, rooms, scripts, sounds, etc."
        ),
    },
    async ({ project_path, type_filter }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const data = await parseJsonFile(yypPath);

        // GameMaker .yyp files store resources in a "resources" array
        const resources: any[] = data.resources || [];

        let assets = resources.map((r: any) => {
          const resPath: string = r.id?.path || r.path || "";
          return {
            name: extractAssetName(resPath),
            path: resPath,
            type: extractAssetType(resPath),
          };
        });

        // Apply type filter if provided
        if (type_filter) {
          const filter = type_filter.toLowerCase();
          assets = assets.filter(
            (a) => a.type.toLowerCase() === filter
          );
        }

        const result = {
          assets,
          count: assets.length,
          project: path.basename(yypPath),
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // 3. get_asset_metadata
  // ─────────────────────────────────────────────
  server.tool(
    "get_asset_metadata",
    "Read metadata from an individual .yy asset file",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
      asset_path: z
        .string()
        .describe("Relative path to the .yy asset file within the project"),
    },
    async ({ project_path, asset_path }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const projectDir = getProjectDir(yypPath);
        const fullPath = path.resolve(projectDir, asset_path);

        const data = await parseJsonFile(fullPath);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Asset file not found: "${asset_path}". Ensure the path is relative to the project directory.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // 4. get_sprite_metadata
  // ─────────────────────────────────────────────
  server.tool(
    "get_sprite_metadata",
    "Get sprite metadata (dimensions, origin, bbox, frames)",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
      sprite_name: z.string().describe("Name of the sprite asset"),
    },
    async ({ project_path, sprite_name }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const projectDir = getProjectDir(yypPath);
        const spritePath = path.resolve(
          projectDir,
          "sprites",
          sprite_name,
          `${sprite_name}.yy`
        );

        const data = await parseJsonFile(spritePath);

        const metadata = {
          name: data.name || sprite_name,
          width: data.width,
          height: data.height,
          origin: {
            x: data.xorig ?? data.sequence?.xorigin,
            y: data.yorig ?? data.sequence?.yorigin,
          },
          bbox: {
            left: data.bbox_left,
            top: data.bbox_top,
            right: data.bbox_right,
            bottom: data.bbox_bottom,
          },
          bboxMode: data.bboxMode,
          collisionKind: data.collisionKind,
          frames: (data.frames || []).map((f: any) => ({
            name: f.name,
            compositeImage: f.compositeImage?.FrameId?.name,
          })),
          frameCount: (data.frames || []).length,
          playbackSpeed: data.sequence?.playbackSpeed,
          playbackSpeedType: data.sequence?.playbackSpeedType,
          textureGroupId: data.textureGroupId?.name,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(metadata, null, 2),
            },
          ],
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Sprite not found: "${sprite_name}". Expected file at sprites/${sprite_name}/${sprite_name}.yy`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // 5. get_object_events
  // ─────────────────────────────────────────────
  server.tool(
    "get_object_events",
    "Get the list of events defined on a GameMaker object. Returns each event with a ready-to-use `gml_path` field — pass that value directly to read_gml_script. Always call this before read_gml_script for object events; never guess event file paths.",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
      object_name: z.string().describe("Name of the object asset"),
    },
    async ({ project_path, object_name }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const projectDir = getProjectDir(yypPath);
        const objectPath = path.resolve(
          projectDir,
          "objects",
          object_name,
          `${object_name}.yy`
        );

        const data = await parseJsonFile(objectPath);
        const eventList: any[] = data.eventList || [];

        const events = eventList.map((e: any) => {
          const eventType = e.eventtype ?? e.eventType ?? 0;
          const eventNum = e.enumb ?? e.eventNum ?? 0;
          const typeName = EVENT_TYPE_NAMES[eventType] || `Unknown(${eventType})`;
          return {
            type: eventType,
            type_name: typeName,
            num: eventNum,
            gml_path: `objects/${object_name}/${typeName}_${eventNum}.gml`,
          };
        });

        const result = {
          object_name: data.name || object_name,
          parent: data.parentObjectId?.name || null,
          sprite: data.spriteId?.name || null,
          visible: data.visible,
          persistent: data.persistent,
          events,
          event_count: events.length,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Object not found: "${object_name}". Expected file at objects/${object_name}/${object_name}.yy`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─────────────────────────────────────────────
  // 6. read_gml_script
  // ─────────────────────────────────────────────
  server.tool(
    "read_gml_script",
    "Read the GML source code of a script or object event. Path formats: scripts use 'scripts/{Name}/{Name}.gml'; object events use 'objects/{ObjName}/{EventTypeName}_{num}.gml' (e.g. 'objects/obj_player/Step_0.gml'). IMPORTANT: For object events, never guess the path — call get_object_events first and use the returned gml_path field.",
    {
      project_path: z
        .string()
        .optional()
        .describe("Path to .yyp file, or uses GAMEMAKER_PROJECT_PATH env"),
      script_path: z
        .string()
        .describe(
          "Relative path to the .gml file. For object events use the gml_path from get_object_events. For scripts: 'scripts/{Name}/{Name}.gml'."
        ),
    },
    async ({ project_path, script_path }) => {
      try {
        const yypPath = await getProjectPath(project_path);
        const projectDir = getProjectDir(yypPath);
        const fullPath = path.resolve(projectDir, script_path);

        const content = await fs.readFile(fullPath, "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: content,
            },
          ],
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: `GML file not found: "${script_path}". Ensure the path is relative to the project directory.`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );
}
