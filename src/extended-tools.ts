import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { GameMakerEditingService, extendedEventNames } from "./editing.js";
import { GameMakerProject } from "./project.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const PROJECT_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const PROJECT_DELETE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

async function run<T>(operation: () => T | Promise<T>) {
  try {
    return jsonResult(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

const sha256 = z.string().regex(/^[a-fA-F0-9]{64}$/);

export function registerExtendedTools(server: McpServer, project: GameMakerProject): void {
  const editing = new GameMakerEditingService(project);

  server.registerTool(
    "gm_file_list",
    {
      title: "List project files",
      description: "List project files with extension/query filters, size, modified time, and SHA-256.",
      inputSchema: {
        extensions: z.array(z.string().min(1)).max(20).optional(),
        query: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => editing.listFiles(args)),
  );

  server.registerTool(
    "gm_gml_patch_preview",
    {
      title: "Preview exact GML patch",
      description: "Preview changed lines and exact-match count without modifying the GML file.",
      inputSchema: {
        path: z.string().min(1),
        search: z.string().min(1),
        replacement: z.string(),
        expectedMatches: z.number().int().min(0).max(1000).optional(),
        contextLines: z.number().int().min(0).max(20).optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => editing.previewGmlPatch(args)),
  );

  server.registerTool(
    "gm_object_events",
    {
      title: "List object events",
      description: "List an object's events, event numbers, code paths, hashes, and line counts.",
      inputSchema: { objectName: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ objectName }) => run(() => editing.listObjectEvents(objectName)),
  );

  server.registerTool(
    "gm_object_event_read",
    {
      title: "Read object event",
      description: "Read a supported GameMaker object event and return object/code hashes.",
      inputSchema: {
        objectName: z.string().min(1),
        event: z.enum(extendedEventNames as [string, ...string[]]),
      },
      annotations: READ_ONLY,
    },
    async ({ objectName, event }) =>
      run(() => editing.readObjectEvent(objectName, event as (typeof extendedEventNames)[number])),
  );

  server.registerTool(
    "gm_object_event_remove",
    {
      title: "Remove object event",
      description:
        "Remove an event from object metadata. Event code is preserved unless deleteCode=true; deletion creates a backup.",
      inputSchema: {
        objectName: z.string().min(1),
        event: z.enum(extendedEventNames as [string, ...string[]]),
        expectedObjectSha256: sha256,
        deleteCode: z.boolean().optional(),
        expectedCodeSha256: sha256.optional(),
      },
      annotations: PROJECT_DELETE,
    },
    async (args) =>
      run(() =>
        editing.removeObjectEvent({
          objectName: args.objectName,
          event: args.event as (typeof extendedEventNames)[number],
          expectedObjectSha256: args.expectedObjectSha256,
          ...(args.deleteCode !== undefined ? { deleteCode: args.deleteCode } : {}),
          ...(args.expectedCodeSha256 ? { expectedCodeSha256: args.expectedCodeSha256 } : {}),
        }),
      ),
  );

  server.registerTool(
    "gm_object_event_read_raw",
    {
      title: "Read object event by numeric selector",
      description: "Read any object event by eventType/eventNum and optional collision object, including non-common events.",
      inputSchema: {
        objectName: z.string().min(1),
        eventType: z.number().int().min(0).max(14),
        eventNum: z.number().int().min(-2147483648).max(2147483647),
        collisionObjectName: z.string().optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => run(() => editing.readObjectEventRaw(args)),
  );

  server.registerTool(
    "gm_object_event_remove_raw",
    {
      title: "Remove object event by numeric selector",
      description:
        "Remove any event by eventType/eventNum and optional collision object. Code deletion is opt-in and backed up.",
      inputSchema: {
        objectName: z.string().min(1),
        eventType: z.number().int().min(0).max(14),
        eventNum: z.number().int().min(-2147483648).max(2147483647),
        collisionObjectName: z.string().optional(),
        expectedObjectSha256: sha256,
        deleteCode: z.boolean().optional(),
        expectedCodeSha256: sha256.optional(),
      },
      annotations: PROJECT_DELETE,
    },
    async (args) => run(() => editing.removeObjectEventRaw(args)),
  );
  server.registerTool(
    "gm_folder_create",
    {
      title: "Create asset folder",
      description: "Create a GameMaker asset-browser folder and add it to the YYP folder index.",
      inputSchema: { name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/) },
      annotations: PROJECT_WRITE,
    },
    async ({ name }) => run(() => editing.createFolder(name)),
  );

  server.registerTool(
    "gm_object_create",
    {
      title: "Create GameMaker object",
      description: "Create a modern GMObject resource, asset folder metadata, and YYP reference.",
      inputSchema: {
        name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        folderName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
        visible: z.boolean().optional(),
        solid: z.boolean().optional(),
        persistent: z.boolean().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.createObject(args)),
  );

  server.registerTool(
    "gm_object_configure",
    {
      title: "Configure GameMaker object",
      description: "Update object flags and sprite, mask, or parent references with optimistic concurrency.",
      inputSchema: {
        objectName: z.string().min(1),
        expectedObjectSha256: sha256,
        visible: z.boolean().optional(),
        solid: z.boolean().optional(),
        persistent: z.boolean().optional(),
        managed: z.boolean().optional(),
        spriteName: z.string().nullable().optional(),
        maskSpriteName: z.string().nullable().optional(),
        parentObjectName: z.string().nullable().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.configureObject(args)),
  );

  server.registerTool(
    "gm_room_inspect",
    {
      title: "Inspect GameMaker room",
      description: "Inspect room settings, layers, instances, physics, views, and room creation code.",
      inputSchema: { roomName: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ roomName }) => run(() => editing.inspectRoom(roomName)),
  );

  server.registerTool(
    "gm_room_configure",
    {
      title: "Configure GameMaker room",
      description: "Update room size, persistence, views, or volume with optimistic concurrency.",
      inputSchema: {
        roomName: z.string().min(1),
        expectedRoomSha256: sha256,
        width: z.number().int().min(1).max(16384).optional(),
        height: z.number().int().min(1).max(16384).optional(),
        persistent: z.boolean().optional(),
        enableViews: z.boolean().optional(),
        volume: z.number().min(0).max(1).optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.configureRoom(args)),
  );

  server.registerTool(
    "gm_room_creation_code_upsert",
    {
      title: "Add or replace room creation code",
      description: "Write room creation GML and update its room reference safely.",
      inputSchema: {
        roomName: z.string().min(1),
        code: z.string(),
        expectedRoomSha256: sha256,
        expectedCodeSha256: sha256.optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.upsertRoomCreationCode(args)),
  );

  server.registerTool(
    "gm_shader_inspect",
    {
      title: "Inspect GameMaker shader",
      description: "Inspect shader sources, entry points, uniforms, attributes, varyings, hashes, and interface mismatches.",
      inputSchema: { shaderName: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ shaderName }) => run(() => editing.inspectShader(shaderName)),
  );

  server.registerTool(
    "gm_shader_update",
    {
      title: "Update GameMaker shader",
      description: "Update vertex and/or fragment source with per-file optimistic hashes and automatic backups.",
      inputSchema: {
        shaderName: z.string().min(1),
        vertex: z.string().optional(),
        fragment: z.string().optional(),
        expectedVertexSha256: sha256.optional(),
        expectedFragmentSha256: sha256.optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.updateShaderSources(args)),
  );

  server.registerTool(
    "gm_sprite_inspect",
    {
      title: "Inspect GameMaker sprite",
      description: "Inspect sprite origin (X/Y), width/height, collision mask mode (bbox/kind), frame count, speed, and texture group.",
      inputSchema: { name: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ name }) => run(() => project.inspectSprite(name)),
  );

  server.registerTool(
    "gm_sound_inspect",
    {
      title: "Inspect GameMaker sound",
      description: "Inspect sound audio group, compression type, sample rate, bit depth/rate, duration, volume, and preload settings.",
      inputSchema: { name: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ name }) => run(() => project.inspectSound(name)),
  );

  server.registerTool(
    "gm_room_instance_add",
    {
      title: "Add object instance to room",
      description: "Place an object instance in a room at coordinates (X, Y) with optional rotation, scale, and layer.",
      inputSchema: {
        roomName: z.string().min(1),
        objectName: z.string().min(1),
        x: z.number(),
        y: z.number(),
        expectedRoomSha256: sha256,
        layerName: z.string().optional(),
        scaleX: z.number().optional(),
        scaleY: z.number().optional(),
        rotation: z.number().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.addRoomInstance(args)),
  );

  server.registerTool(
    "gm_sequence_inspect",
    {
      title: "Inspect GameMaker Sequence",
      description: "Inspect Sequence tracks, length, playback speed, and keyframes.",
      inputSchema: { name: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ name }) => run(() => project.inspectSequence(name)),
  );

  server.registerTool(
    "gm_note_create",
    {
      title: "Create GameMaker Note asset",
      description: "Create a new GameMaker Note asset (notes/NoteName/NoteName.txt) with documentation text and update the project YYP.",
      inputSchema: {
        name: z.string().min(1),
        content: z.string(),
        folderName: z.string().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.createNote(args)),
  );

  server.registerTool(
    "gm_note_inspect",
    {
      title: "Inspect GameMaker Note asset",
      description: "Read text documentation content, line count, file paths, and SHA-256 hash of a GameMaker Note asset.",
      inputSchema: { name: z.string().min(1) },
      annotations: READ_ONLY,
    },
    async ({ name }) => run(() => project.inspectNote(name)),
  );

  server.registerTool(
    "gm_note_update",
    {
      title: "Update GameMaker Note content",
      description: "Guardedly update text content of a GameMaker Note asset with SHA-256 concurrency check.",
      inputSchema: {
        noteName: z.string().min(1),
        content: z.string(),
        expectedSha256: sha256,
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.updateNoteContent(args)),
  );

  server.registerTool(
    "gm_sprite_create",
    {
      title: "Create GameMaker Sprite asset",
      description: "Create a new GameMaker Sprite asset (.yy metadata) with configurable dimensions, origin point, and texture group.",
      inputSchema: {
        name: z.string().min(1),
        width: z.number().int().min(1).max(8192).optional(),
        height: z.number().int().min(1).max(8192).optional(),
        originX: z.number().int().optional(),
        originY: z.number().int().optional(),
        folderName: z.string().optional(),
        textureGroup: z.string().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.createSprite(args)),
  );

  server.registerTool(
    "gm_sound_create",
    {
      title: "Create GameMaker Sound asset",
      description: "Create a new GameMaker Sound asset (.yy metadata) linking sound audio files with compression, audio group, and volume options.",
      inputSchema: {
        name: z.string().min(1),
        soundFile: z.string().optional(),
        compression: z.number().int().min(0).max(3).optional(),
        volume: z.number().min(0).max(1).optional(),
        preload: z.boolean().optional(),
        folderName: z.string().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.createSound(args)),
  );

  server.registerTool(
    "gm_state_machine_generate",
    {
      title: "Generate Finite State Machine boilerplate",
      description: "Generate a clean, struct-based GML Finite State Machine controller script (scr_state_machine) and register it in the project.",
      inputSchema: {
        scriptName: z.string().optional(),
        folderName: z.string().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => project.generateStateMachine(args)),
  );

  server.registerTool(
    "gm_room_layer_add",
    {
      title: "Add layer to room",
      description: "Add a new Instance, Background, Tilemap, or Asset layer to a GameMaker room at specified depth and visibility.",
      inputSchema: {
        roomName: z.string().min(1),
        layerName: z.string().min(1),
        expectedRoomSha256: sha256,
        layerType: z.enum(["instance", "background", "tilemap", "asset"]).optional(),
        depth: z.number().int().optional(),
        visible: z.boolean().optional(),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.addRoomLayer(args)),
  );

  server.registerTool(
    "gm_asset_rename",
    {
      title: "Rename asset and refactor references",
      description: "Safely rename any GameMaker asset (script, object, sprite, sound, room, shader, note) on disk, in YYP/YY metadata, and refactor all GML code references across the project.",
      inputSchema: {
        oldName: z.string().min(1),
        newName: z.string().min(1),
      },
      annotations: PROJECT_WRITE,
    },
    async (args) => run(() => editing.renameAsset(args)),
  );

  server.registerTool(
    "gm_project_autofix",
    {
      title: "Auto-repair project references & integrity",
      description: "Scan and automatically repair missing/dangling YYP resource references, missing shader .vsh/.fsh files, and corrupted project structures.",
      inputSchema: {},
      annotations: PROJECT_WRITE,
    },
    async () => run(() => project.autofixProject()),
  );
}
