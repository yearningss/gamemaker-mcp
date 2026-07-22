import fs from "node:fs";
import path from "node:path";

import { applyEdits, modify, type JSONPath } from "jsonc-parser";

import { parseGmJson, requireGmJson, stringifyGmJson } from "./gm-json.js";
import { ProjectSandbox } from "./security.js";
import type {
  ProjectResourceRef,
  ProjectSummary,
  ServerConfig,
  ValidationIssue,
} from "./types.js";

interface YypResourceEntry {
  id?: { name?: string; path?: string };
}

interface YypData {
  name?: string;
  resourceVersion?: string;
  MetaData?: { IDEVersion?: string };
  resources?: YypResourceEntry[];
  Folders?: Array<Record<string, unknown>>;
  RoomOrderNodes?: Array<{ roomId?: { name?: string; path?: string } }>;
}

interface ObjectEvent {
  eventType?: number;
  eventNum?: number;
  collisionObjectId?: unknown;
}

interface ObjectData {
  name?: string;
  eventList?: ObjectEvent[];
}

const EVENT_MAP = {
  create: { eventType: 0, eventNum: 0, file: "Create_0.gml" },
  destroy: { eventType: 1, eventNum: 0, file: "Destroy_0.gml" },
  step: { eventType: 3, eventNum: 0, file: "Step_0.gml" },
  begin_step: { eventType: 3, eventNum: 1, file: "Step_1.gml" },
  end_step: { eventType: 3, eventNum: 2, file: "Step_2.gml" },
  draw: { eventType: 8, eventNum: 0, file: "Draw_0.gml" },
  cleanup: { eventType: 12, eventNum: 0, file: "CleanUp_0.gml" },
  room_start: { eventType: 7, eventNum: 4, file: "Other_4.gml" },
  room_end: { eventType: 7, eventNum: 5, file: "Other_5.gml" },
} as const;

export type SupportedEventName = keyof typeof EVENT_MAP;

function inferKind(resourcePath: string): string {
  const first = resourcePath.replaceAll("\\", "/").split("/")[0]?.toLowerCase() ?? "unknown";
  const singular: Record<string, string> = {
    objects: "object",
    rooms: "room",
    scripts: "script",
    shaders: "shader",
    sprites: "sprite",
    sounds: "sound",
    fonts: "font",
    paths: "path",
    timelines: "timeline",
    sequences: "sequence",
    tilesets: "tileset",
    animcurves: "animcurve",
    extensions: "extension",
    notes: "note",
  };
  return singular[first] ?? first;
}

function walkFiles(root: string): string[] {
  const output: string[] = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop()!;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", ".gamemaker-mcp", ".build_cache", ".build_temp"].includes(entry.name)) {
        continue;
      }
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) output.push(full);
    }
  }
  return output;
}

function countLines(text: string): number {
  if (text.trim() === "") return 0;
  return text.trimEnd().split(/\r?\n/).length;
}

function safeResourceName(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Resource names must match ^[A-Za-z_][A-Za-z0-9_]*$");
  }
  return name;
}

function updateJsonPath(text: string, jsonPath: JSONPath, value: unknown): string {
  return applyEdits(
    text,
    modify(text, jsonPath, value, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: text.includes("\r\n") ? "\r\n" : "\n",
      },
    }),
  );
}

export class GameMakerProject {
  readonly config: ServerConfig;
  readonly sandbox: ProjectSandbox;
  readonly projectRelativePath: string;

  constructor(config: ServerConfig) {
    this.config = config;
    this.sandbox = new ProjectSandbox(config.projectRoot, config.mode, config.maxFileBytes);
    this.projectRelativePath = this.sandbox.relative(config.projectFile);
  }

  projectData(): YypData {
    return requireGmJson<YypData>(
      this.sandbox.readText(this.projectRelativePath, [".yyp"]),
      this.projectRelativePath,
    );
  }

  resources(): ProjectResourceRef[] {
    const yyp = this.projectData();
    return (yyp.resources ?? [])
      .map((entry) => {
        const name = entry.id?.name;
        const resourcePath = entry.id?.path;
        if (!name || !resourcePath) return undefined;
        return { name, path: resourcePath.replaceAll("\\", "/"), kind: inferKind(resourcePath) };
      })
      .filter((entry): entry is ProjectResourceRef => entry !== undefined);
  }

  summary(): ProjectSummary {
    const yyp = this.projectData();
    const resources = this.resources();
    const counts: Record<string, number> = {};
    for (const resource of resources) counts[resource.kind] = (counts[resource.kind] ?? 0) + 1;

    return {
      name: yyp.name ?? path.basename(this.config.projectFile, ".yyp"),
      projectFile: this.projectRelativePath,
      projectRoot: this.config.projectRoot,
      ...(yyp.MetaData?.IDEVersion ? { ideVersion: yyp.MetaData.IDEVersion } : {}),
      ...(yyp.resourceVersion ? { resourceVersion: yyp.resourceVersion } : {}),
      resourceCount: resources.length,
      counts,
      roomOrder: (yyp.RoomOrderNodes ?? [])
        .map((node) => node.roomId?.name)
        .filter((name): name is string => Boolean(name)),
      mode: this.config.mode,
    };
  }

  listAssets(options: { kind?: string | undefined; query?: string | undefined; limit?: number | undefined; offset?: number | undefined } = {}): {
    total: number;
    offset: number;
    limit: number;
    assets: ProjectResourceRef[];
  } {
    const query = options.query?.toLowerCase();
    const filtered = this.resources().filter((resource) => {
      if (options.kind && resource.kind !== options.kind.toLowerCase()) return false;
      if (query && !`${resource.name} ${resource.path}`.toLowerCase().includes(query)) return false;
      return true;
    });
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(500, Math.max(1, options.limit ?? 100));
    return { total: filtered.length, offset, limit, assets: filtered.slice(offset, offset + limit) };
  }

  findResource(name: string, kind?: string): ProjectResourceRef {
    const matches = this.resources().filter(
      (resource) => resource.name === name && (!kind || resource.kind === kind),
    );
    if (matches.length !== 1) {
      throw new Error(`Expected one resource named ${name}${kind ? ` of kind ${kind}` : ""}; found ${matches.length}`);
    }
    return matches[0]!;
  }

  readAsset(name: string, kind?: string): {
    resource: ProjectResourceRef;
    files: Array<{ path: string; sha256: string; content: string }>;
  } {
    const resource = this.findResource(name, kind);
    const yyPath = resource.path;
    const directory = path.dirname(this.sandbox.resolve(yyPath, { mustExist: true }));
    const allFiles = walkFiles(directory).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [".yy", ".gml", ".vsh", ".fsh", ".json", ".txt"].includes(ext);
    });

    const files = allFiles
      .map((file) => this.sandbox.relative(file))
      .sort()
      .map((relativePath) => ({
        path: relativePath,
        sha256: this.sandbox.sha256For(relativePath),
        content: this.sandbox.readText(relativePath),
      }));
    return { resource, files };
  }

  searchCode(options: {
    query: string;
    regex?: boolean | undefined;
    caseSensitive?: boolean | undefined;
    limit?: number | undefined;
  }): { total: number; truncated: boolean; matches: Array<{ file: string; line: number; text: string }> } {
    if (!options.query) throw new Error("query must not be empty");
    const flags = options.caseSensitive ? "" : "i";
    const matcher = options.regex
      ? new RegExp(options.query, flags)
      : new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
    const limit = Math.min(1000, Math.max(1, options.limit ?? 200));
    const matches: Array<{ file: string; line: number; text: string }> = [];

    for (const file of walkFiles(this.config.projectRoot).sort()) {
      if (![".gml", ".vsh", ".fsh"].includes(path.extname(file).toLowerCase())) continue;
      const relative = this.sandbox.relative(file);
      const lines = this.sandbox.readText(relative).split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        if (matcher.test(line)) {
          matches.push({ file: relative, line: index + 1, text: line });
          if (matches.length >= limit) return { total: matches.length, truncated: true, matches };
        }
        matcher.lastIndex = 0;
      }
    }
    return { total: matches.length, truncated: false, matches };
  }

  readFile(relativePath: string): { path: string; sha256: string; content: string } {
    return {
      path: relativePath.replaceAll("\\", "/"),
      sha256: this.sandbox.sha256For(relativePath),
      content: this.sandbox.readText(relativePath, [".gml", ".yy", ".yyp", ".vsh", ".fsh", ".json", ".md", ".txt"]),
    };
  }

  writeGml(options: {
    path: string;
    content: string;
    expectedSha256?: string | undefined;
    force?: boolean | undefined;
    backup?: boolean | undefined;
  }): Record<string, unknown> {
    if (!options.path.toLowerCase().endsWith(".gml")) throw new Error("writeGml only accepts .gml files");
    return this.sandbox.atomicWrite(options.path, options.content, {
      ...(options.expectedSha256 ? { expectedSha256: options.expectedSha256 } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(options.backup !== undefined ? { backup: options.backup } : {}),
    });
  }

  patchGml(options: {
    path: string;
    search: string;
    replacement: string;
    expectedSha256: string;
    expectedMatches?: number | undefined;
  }): Record<string, unknown> {
    const current = this.readFile(options.path);
    if (!options.path.toLowerCase().endsWith(".gml")) throw new Error("patchGml only accepts .gml files");
    if (!options.search) throw new Error("search must not be empty");
    const count = current.content.split(options.search).length - 1;
    const expectedMatches = options.expectedMatches ?? 1;
    if (count !== expectedMatches) {
      throw new Error(`Expected ${expectedMatches} exact matches, found ${count}`);
    }
    const content = current.content.split(options.search).join(options.replacement);
    return {
      ...this.sandbox.atomicWrite(options.path, content, {
        expectedSha256: options.expectedSha256,
        backup: true,
      }),
      replacements: count,
    };
  }

  createScript(nameInput: string, code: string, folderName = "Scripts"): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(nameInput);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    safeResourceName(folderName);

    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `scripts/${name}/${name}.yy`;
    const codePath = `scripts/${name}/${name}.gml`;
    this.ensureFolder(folderName, folderPath);

    const script = {
      $GMScript: "v1",
      "%Name": name,
      isCompatibility: false,
      isDnD: false,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMScript",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(script));
    this.sandbox.atomicWrite(codePath, code.endsWith("\n") ? code : `${code}\n`);
    this.appendProjectResource(name, yyPath);
    return { name, kind: "script", yyPath, codePath };
  }

  createShader(options: { name: string; vertex: string; fragment: string; folderName?: string | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Shaders");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `shaders/${name}/${name}.yy`;
    const vertexPath = `shaders/${name}/${name}.vsh`;
    const fragmentPath = `shaders/${name}/${name}.fsh`;
    this.ensureFolder(folderName, folderPath);

    const shader = {
      $GMShader: "",
      "%Name": name,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMShader",
      resourceVersion: "2.0",
      type: 1,
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(shader));
    this.sandbox.atomicWrite(vertexPath, options.vertex.endsWith("\n") ? options.vertex : `${options.vertex}\n`);
    this.sandbox.atomicWrite(fragmentPath, options.fragment.endsWith("\n") ? options.fragment : `${options.fragment}\n`);
    this.appendProjectResource(name, yyPath);
    return { name, kind: "shader", yyPath, vertexPath, fragmentPath };
  }

  createNote(options: { name: string; content: string; folderName?: string | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Notes");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `notes/${name}/${name}.yy`;
    const txtPath = `notes/${name}/${name}.txt`;
    this.ensureFolder(folderName, folderPath);

    const note = {
      $GMNotes: "",
      "%Name": name,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMNotes",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(note));
    const contentText = options.content.endsWith("\n") ? options.content : `${options.content}\n`;
    this.sandbox.atomicWrite(txtPath, contentText);
    this.appendProjectResource(name, yyPath);
    return { name, kind: "note", yyPath, txtPath };
  }

  inspectNote(name: string): Record<string, unknown> {
    const resource = this.findResource(name, "note");
    const directory = path.posix.dirname(resource.path);
    const txtPath = `${directory}/${name}.txt`;
    const content = this.sandbox.readText(txtPath, [".txt"]);
    return {
      name,
      metadataPath: resource.path,
      txtPath,
      sha256: this.sandbox.sha256For(txtPath),
      lines: countLines(content),
      content,
    };
  }

  createSprite(options: {
    name: string;
    width?: number | undefined;
    height?: number | undefined;
    originX?: number | undefined;
    originY?: number | undefined;
    folderName?: string | undefined;
    textureGroup?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Sprites");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `sprites/${name}/${name}.yy`;
    const w = options.width ?? 64;
    const h = options.height ?? 64;
    const ox = options.originX ?? Math.floor(w / 2);
    const oy = options.originY ?? Math.floor(h / 2);
    const textureGroup = options.textureGroup ?? "Default";
    this.ensureFolder(folderName, folderPath);

    const sprite = {
      $GMSprite: "",
      "%Name": name,
      bboxMode: 0,
      bbox_bottom: h - 1,
      bbox_left: 0,
      bbox_right: w - 1,
      bbox_top: 0,
      collisionKind: 1,
      collisionTolerance: 0,
      DynamicTexturePage: false,
      edgeFiltering: false,
      For3D: false,
      frames: [],
      gridX: 0,
      gridY: 0,
      height: h,
      HTile: false,
      layers: [],
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMSprite",
      resourceVersion: "2.0",
      sequence: {
        $GMSequence: "",
        "%Name": name,
        autoRecord: true,
        length: 1.0,
        name,
        playback: 1,
        playbackSpeed: 15.0,
        playbackSpeedType: 0,
        resourceType: "GMSequence",
        resourceVersion: "2.0",
        tracks: [],
        xorigin: ox,
        yorigin: oy,
      },
      textureGroupId: { name: textureGroup, path: `texturegroups/${textureGroup}` },
      width: w,
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(sprite));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "sprite", yyPath, width: w, height: h, origin: { x: ox, y: oy } };
  }

  createSound(options: {
    name: string;
    soundFile?: string | undefined;
    compression?: number | undefined;
    volume?: number | undefined;
    preload?: boolean | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Sounds");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `sounds/${name}/${name}.yy`;
    const soundFile = options.soundFile ?? `${name}.wav`;
    this.ensureFolder(folderName, folderPath);

    const sound = {
      $GMSound: "",
      "%Name": name,
      audioGroupId: { name: "audiogroup_default", path: "audiogroups/audiogroup_default" },
      bitDepth: 1,
      bitRate: 128,
      compression: options.compression ?? 0,
      conversionMode: 0,
      duration: 0.0,
      name,
      parent: { name: folderName, path: folderPath },
      preload: options.preload ?? false,
      resourceType: "GMSound",
      resourceVersion: "2.0",
      sampleRate: 44100,
      soundFile,
      type: 0,
      volume: options.volume ?? 1.0,
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(sound));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "sound", yyPath, soundFile };
  }

  generateStateMachine(options: {
    scriptName?: string | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.scriptName ?? "scr_state_machine");
    const code = `/// @function StateMachine(initial_state)
/// @description Lightweight struct-based finite state machine.
function StateMachine(initial_state) constructor {
    currentState = initial_state;
    states = {};

    static add = function(state_name, on_enter, on_step, on_leave) {
        states[$ state_name] = {
            enter: is_callable(on_enter) ? on_enter : undefined,
            step: is_callable(on_step) ? on_step : undefined,
            leave: is_callable(on_leave) ? on_leave : undefined
        };
        return self;
    };

    static change = function(new_state) {
        if (currentState != undefined && struct_exists(states, currentState)) {
            var curr = states[$ currentState];
            if (curr.leave != undefined) curr.leave();
        }
        currentState = new_state;
        if (struct_exists(states, currentState)) {
            var next = states[$ currentState];
            if (next.enter != undefined) next.enter();
        }
    };

    static update = function() {
        if (currentState != undefined && struct_exists(states, currentState)) {
            var curr = states[$ currentState];
            if (curr.step != undefined) curr.step();
        }
    };
}
`;
    return this.createScript(name, code, options.folderName ?? "Scripts");
  }

  autofixProject(): Record<string, unknown> {
    this.sandbox.assertWritable();
    const repairs: Array<{ type: string; details: string }> = [];
    const yypText = this.sandbox.readText(this.projectRelativePath, [".yyp"]);
    const yyp = requireGmJson<YypData>(yypText, this.projectRelativePath);
    let resources = [...(yyp.resources ?? [])];

    const validResources = resources.filter((entry) => {
      if (!entry.id?.path) return false;
      const fullPath = this.sandbox.resolve(entry.id.path, { mustExist: false });
      if (!fs.existsSync(fullPath)) {
        repairs.push({ type: "removed-dangling-resource", details: `Removed missing resource ${entry.id.name || entry.id.path}` });
        return false;
      }
      return true;
    });

    if (validResources.length !== resources.length) {
      resources = validResources;
      const next = updateJsonPath(yypText, ["resources"], resources);
      this.sandbox.atomicWrite(this.projectRelativePath, next, {
        expectedSha256: this.sandbox.sha256For(this.projectRelativePath),
        backup: true,
      });
    }

    for (const res of this.resources()) {
      if (res.kind === "shader") {
        const base = `${path.posix.dirname(res.path)}/${res.name}`;
        const vsh = `${base}.vsh`;
        const fsh = `${base}.fsh`;
        if (!fs.existsSync(this.sandbox.resolve(vsh, { mustExist: false }))) {
          this.sandbox.atomicWrite(vsh, "attribute vec3 in_Position;\nattribute vec4 in_Colour;\nattribute vec2 in_TextureCoord;\nvarying vec2 v_vTexcoord;\nvarying vec4 v_vColour;\nvoid main() {\n    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);\n    v_vColour = in_Colour;\n    v_vTexcoord = in_TextureCoord;\n}\n");
          repairs.push({ type: "created-missing-vsh", details: `Created missing vertex shader ${vsh}` });
        }
        if (!fs.existsSync(this.sandbox.resolve(fsh, { mustExist: false }))) {
          this.sandbox.atomicWrite(fsh, "varying vec2 v_vTexcoord;\nvarying vec4 v_vColour;\nvoid main() {\n    gl_FragColor = v_vColour * texture2D(gm_BaseTexture, v_vTexcoord);\n}\n");
          repairs.push({ type: "created-missing-fsh", details: `Created missing fragment shader ${fsh}` });
        }
      }
    }

    return { repaired: repairs.length > 0, count: repairs.length, repairs };
  }

  upsertObjectEvent(options: {
    objectName: string;
    event: SupportedEventName;
    code: string;
    expectedObjectSha256: string;
    replace?: boolean;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const resource = this.findResource(options.objectName, "object");
    const eventSpec = EVENT_MAP[options.event];
    const objectText = this.sandbox.readText(resource.path, [".yy"]);
    const objectData = requireGmJson<ObjectData>(objectText, resource.path);
    const events = [...(objectData.eventList ?? [])];
    const eventIndex = events.findIndex(
      (event) => event.eventType === eventSpec.eventType && event.eventNum === eventSpec.eventNum,
    );
    if (eventIndex >= 0 && !options.replace) {
      throw new Error(`Event ${options.event} already exists; set replace=true to replace its code`);
    }

    const codePath = `${path.posix.dirname(resource.path)}/${eventSpec.file}`;
    if (eventIndex < 0) {
      events.push({
        $GMEvent: "v1",
        "%Name": "",
        collisionObjectId: null,
        eventNum: eventSpec.eventNum,
        eventType: eventSpec.eventType,
        isDnD: false,
        name: "",
        resourceType: "GMEvent",
        resourceVersion: "2.0",
      } as ObjectEvent);
    }

    const nextObjectText = updateJsonPath(objectText, ["eventList"], events);
    const objectWrite = this.sandbox.atomicWrite(resource.path, nextObjectText, {
      expectedSha256: options.expectedObjectSha256,
      backup: true,
    });

    let codeWrite: Record<string, unknown>;
    if (fs.existsSync(this.sandbox.resolve(codePath, { mustExist: false }))) {
      codeWrite = this.sandbox.atomicWrite(codePath, options.code, { force: true, backup: true });
    } else {
      codeWrite = this.sandbox.atomicWrite(codePath, options.code);
    }
    return { object: resource.name, event: options.event, objectWrite, codeWrite };
  }

  validate(): { ok: boolean; errors: number; warnings: number; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    const resources = this.resources();
    const names = new Map<string, number>();
    const paths = new Map<string, number>();

    for (const resource of resources) {
      names.set(resource.name, (names.get(resource.name) ?? 0) + 1);
      paths.set(resource.path.toLowerCase(), (paths.get(resource.path.toLowerCase()) ?? 0) + 1);
      try {
        this.sandbox.resolve(resource.path, { mustExist: true });
      } catch (error) {
        issues.push({ severity: "error", code: "missing-resource", file: resource.path, message: String(error) });
      }
    }

    for (const [name, count] of names) {
      if (count > 1) issues.push({ severity: "error", code: "duplicate-name", file: this.projectRelativePath, message: `${name} appears ${count} times` });
    }
    for (const [resourcePath, count] of paths) {
      if (count > 1) issues.push({ severity: "error", code: "duplicate-path", file: this.projectRelativePath, message: `${resourcePath} appears ${count} times` });
    }

    for (const file of walkFiles(this.config.projectRoot)) {
      const ext = path.extname(file).toLowerCase();
      if (ext !== ".yy" && ext !== ".yyp") continue;
      const relative = this.sandbox.relative(file);
      const text = this.sandbox.readText(relative);
      const parsed = parseGmJson(text);
      for (const error of parsed.errors) {
        issues.push({
          severity: "error",
          code: "json-parse",
          file: relative,
          message: `${error.code} at byte ${error.offset}`,
        });
      }
    }

    for (const resource of resources) {
      if (resource.kind === "shader") {
        const base = `${path.posix.dirname(resource.path)}/${resource.name}`;
        for (const extension of [".vsh", ".fsh"]) {
          try {
            this.sandbox.resolve(`${base}${extension}`, { mustExist: true });
          } catch {
            issues.push({ severity: "error", code: "missing-shader-source", file: `${base}${extension}`, message: "Shader source is missing" });
          }
        }
      }

      if (resource.kind === "object") {
        try {
          const objectData = requireGmJson<ObjectData>(this.sandbox.readText(resource.path), resource.path);
          for (const event of objectData.eventList ?? []) {
            const known = Object.values(EVENT_MAP).find(
              (spec) => spec.eventType === event.eventType && spec.eventNum === event.eventNum,
            );
            if (!known) continue;
            const codePath = `${path.posix.dirname(resource.path)}/${known.file}`;
            try {
              this.sandbox.resolve(codePath, { mustExist: true });
            } catch {
              issues.push({ severity: "warning", code: "missing-event-code", file: codePath, message: `Object event ${event.eventType}/${event.eventNum} has no code file` });
            }
          }
        } catch (error) {
          issues.push({ severity: "error", code: "object-read", file: resource.path, message: String(error) });
        }
      }
    }

    const errors = issues.filter((issue) => issue.severity === "error").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    return { ok: errors === 0, errors, warnings, issues };
  }

  private ensureFolder(folderName: string, folderPath: string): void {
    const yypText = this.sandbox.readText(this.projectRelativePath, [".yyp"]);
    const yyp = requireGmJson<YypData>(yypText, this.projectRelativePath);
    const folders = [...(yyp.Folders ?? [])];
    if (folders.some((folder) => folder.folderPath === folderPath || folder.name === folderName)) return;

    const folder = {
      $GMFolder: "",
      "%Name": folderName,
      folderPath,
      name: folderName,
      resourceType: "GMFolder",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(folderPath, stringifyGmJson(folder));
    folders.push(folder);
    const next = updateJsonPath(yypText, ["Folders"], folders);
    this.sandbox.atomicWrite(this.projectRelativePath, next, {
      expectedSha256: this.sandbox.sha256For(this.projectRelativePath),
      backup: true,
    });
  }

  private appendProjectResource(name: string, resourcePath: string): void {
    const yypText = this.sandbox.readText(this.projectRelativePath, [".yyp"]);
    const yyp = requireGmJson<YypData>(yypText, this.projectRelativePath);
    const resources = [...(yyp.resources ?? [])];
    if (resources.some((entry) => entry.id?.name === name || entry.id?.path === resourcePath)) {
      throw new Error(`Project already references ${name} or ${resourcePath}`);
    }
    resources.push({ id: { name, path: resourcePath } });
    const next = updateJsonPath(yypText, ["resources"], resources);
    this.sandbox.atomicWrite(this.projectRelativePath, next, {
      expectedSha256: this.sandbox.sha256For(this.projectRelativePath),
      backup: true,
    });
  }

  inspectSprite(name: string): SpriteInspection {
    const resource = this.findResource(name, "sprite");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);

    const bboxModes: Record<number, string> = { 0: "automatic", 1: "full_image", 2: "manual", 3: "precise" };
    const colKinds: Record<number, string> = { 1: "precise", 2: "rectangle", 3: "ellipse", 4: "diamond", 5: "precise_per_frame" };
    const speedTypes: Record<number, string> = { 0: "frames_per_second", 1: "frames_per_game_frame" };

    const seq = (data["sequence"] as Record<string, unknown> | undefined) ?? {};
    const originX = seq["xorigin"] ?? data["xorig"] ?? 0;
    const originY = seq["yorigin"] ?? data["yorig"] ?? 0;

    return {
      name,
      path: resource.path,
      width: Number(data["width"] ?? 0),
      height: Number(data["height"] ?? 0),
      origin: { x: Number(originX), y: Number(originY) },
      bbox: {
        left: Number(data["bbox_left"] ?? 0),
        right: Number(data["bbox_right"] ?? 0),
        top: Number(data["bbox_top"] ?? 0),
        bottom: Number(data["bbox_bottom"] ?? 0),
        mode: bboxModes[Number(data["bboxMode"] ?? 0)] ?? "automatic",
      },
      collision: {
        kind: colKinds[Number(data["collisionKind"] ?? 1)] ?? "precise",
        tolerance: Number(data["collisionTolerance"] ?? 0),
      },
      framesCount: Array.isArray(data["frames"]) ? data["frames"].length : 0,
      playbackSpeed: Number(seq["playbackSpeed"] ?? 15),
      playbackSpeedType: speedTypes[Number(seq["playbackSpeedType"] ?? 0)] ?? "frames_per_second",
      textureGroup: String((data["textureGroupId"] as { name?: string } | undefined)?.name ?? "Default"),
      is3D: Boolean(data["For3D"] ?? false),
    };
  }

  inspectSound(name: string): SoundInspection {
    const resource = this.findResource(name, "sound");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);

    const types: Record<number, string> = {
      0: "uncompressed",
      1: "compressed_into_memory",
      2: "decompress_on_load",
      3: "streamed",
    };

    return {
      name,
      path: resource.path,
      soundFile: String(data["soundFile"] ?? ""),
      audioGroup: String((data["audioGroupId"] as { name?: string } | undefined)?.name ?? "default"),
      type: types[Number(data["type"] ?? data["compression"] ?? 0)] ?? "uncompressed",
      sampleRate: Number(data["sampleRate"] ?? 44100),
      bitDepth: Number(data["bitDepth"] ?? 16),
      bitRate: Number(data["bitRate"] ?? 128),
      duration: Number(data["duration"] ?? 0),
      volume: Number(data["volume"] ?? 1),
      preload: Boolean(data["preload"] ?? true),
    };
  }

  inspectSequence(name: string): SequenceInspection {
    const resource = this.findResource(name, "sequence");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);

    const tracks = (data["tracks"] as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      name,
      path: resource.path,
      length: Number(data["length"] ?? 60),
      playbackSpeed: Number(data["playbackSpeed"] ?? 60),
      tracksCount: tracks.length,
      tracks: tracks.map((t) => String(t["name"] ?? "unnamed_track")),
    };
  }

  createFont(options: {
    name: string;
    fontName?: string | undefined;
    size?: number | undefined;
    bold?: boolean | undefined;
    italic?: boolean | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Fonts");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `fonts/${name}/${name}.yy`;
    this.ensureFolder(folderName, folderPath);

    const font = {
      $GMFont: "",
      "%Name": name,
      fontName: options.fontName ?? "Arial",
      size: options.size ?? 12,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMFont",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(font));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "font", yyPath };
  }

  inspectFont(name: string): FontInspection {
    const resource = this.findResource(name, "font");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);
    return {
      name,
      path: resource.path,
      fontName: String(data["fontName"] ?? "Arial"),
      size: Number(data["size"] ?? 12),
      bold: Boolean(data["bold"] ?? false),
      italic: Boolean(data["italic"] ?? false),
    };
  }

  createTileset(options: {
    name: string;
    spriteName: string;
    tileSize?: number | undefined;
    tileBorder?: number | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "TileSets");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `tilesets/${name}/${name}.yy`;
    this.ensureFolder(folderName, folderPath);

    const tileset = {
      $GMTileSet: "",
      "%Name": name,
      spriteId: { name: options.spriteName, path: `sprites/${options.spriteName}/${options.spriteName}.yy` },
      tileWidth: options.tileSize ?? 16,
      tileHeight: options.tileSize ?? 16,
      tilexoff: 0,
      tileyoff: 0,
      tilehsep: options.tileBorder ?? 0,
      tilevsep: options.tileBorder ?? 0,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMTileSet",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(tileset));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "tileset", yyPath };
  }

  inspectTileset(name: string): TilesetInspection {
    const resource = this.findResource(name, "tileset");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);
    return {
      name,
      path: resource.path,
      spriteName: String((data["spriteId"] as { name?: string } | undefined)?.name ?? ""),
      tileSize: Number(data["tileWidth"] ?? 16),
      tileBorder: Number(data["tilehsep"] ?? 0),
    };
  }

  createAnimCurve(options: {
    name: string;
    channels?: string[] | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "AnimationCurves");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `animcurves/${name}/${name}.yy`;
    this.ensureFolder(folderName, folderPath);

    const channels = (options.channels ?? ["y"]).map((cName) => ({
      $GMAnimCurveChannel: "",
      name: cName,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      resourceType: "GMAnimCurveChannel",
      resourceVersion: "2.0",
    }));

    const animcurve = {
      $GMAnimCurve: "",
      "%Name": name,
      channels,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMAnimCurve",
      resourceVersion: "2.0",
    };
    this.sandbox.atomicWrite(yyPath, stringifyGmJson(animcurve));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "animcurve", yyPath };
  }

  inspectAnimCurve(name: string): AnimCurveInspection {
    const resource = this.findResource(name, "animcurve");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);
    const channels = (data["channels"] as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      name,
      path: resource.path,
      channels: channels.map((c) => String(c["name"] ?? "y")),
    };
  }

  generateParticleSystem(options: {
    scriptName?: string | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.scriptName ?? "scr_particle_system");
    const code = `/// @function ParticleSystem() constructor
/// @description Professional lightweight GML particle system helper.
function ParticleSystem() constructor {
    system = part_system_create();
    emitters = {};

    static addEmitter = function(name, xmin, xmax, ymin, ymax, shape, distribution) {
        var emit = part_emitter_create(system);
        part_emitter_region(system, emit, xmin, xmax, ymin, ymax, shape, distribution);
        emitters[$ name] = emit;
        return self;
    };

    static addType = function(name, sprite, speed_min, speed_max, speed_incr, speed_wiggle) {
        var pt = part_type_create();
        if (sprite_exists(sprite)) {
            part_type_sprite(pt, sprite, true, true, false);
        }
        part_type_speed(pt, speed_min, speed_max, speed_incr, speed_wiggle);
        part_type_direction(pt, 0, 360, 0, 0);
        part_type_life(pt, 20, 60);
        return pt;
    };

    static destroy = function() {
        part_system_destroy(system);
    };
}
`;
    return this.createScript(name, code, options.folderName ?? "Scripts");
  }

  generateGuiLayout(options: {
    scriptName?: string | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.scriptName ?? "scr_gui_layout");
    const code = `/// @function GuiLayout() constructor
/// @description Responsive layout utility for screen coordinates positioning.
function GuiLayout() constructor {
    static getWidth = function() {
        return display_get_gui_width();
    };

    static getHeight = function() {
        return display_get_gui_height();
    };

    static center = function(width, height) {
        return {
            x: (display_get_gui_width() - width) / 2,
            y: (display_get_gui_height() - height) / 2
        };
    };

    static drawButton = function(x, y, width, height, text, hover) {
        draw_set_color(hover ? c_white : c_gray);
        draw_rectangle(x, y, x + width, y + height, false);
        draw_set_color(c_black);
        draw_text(x + 10, y + 10, text);
    };
}
`;
    return this.createScript(name, code, options.folderName ?? "Scripts");
  }

  generateInventorySystem(options: {
    scriptName?: string | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.scriptName ?? "scr_inventory");
    const code = `/// @function Inventory(max_slots) constructor
/// @description Struct-based flexible inventory database system.
function Inventory(max_slots) constructor {
    slots = array_create(max_slots, undefined);
    capacity = max_slots;

    static addItem = function(item_id, quantity) {
        for (var i = 0; i < capacity; i++) {
            if (slots[i] == undefined) {
                slots[i] = { id: item_id, count: quantity };
                return true;
            } else if (slots[i].id == item_id) {
                slots[i].count += quantity;
                return true;
            }
        }
        return false;
    };

    static removeItem = function(item_id, quantity) {
        for (var i = 0; i < capacity; i++) {
            if (slots[i] != undefined && slots[i].id == item_id) {
                slots[i].count -= quantity;
                if (slots[i].count <= 0) {
                    slots[i] = undefined;
                }
                return true;
            }
        }
        return false;
    };
}
`;
    return this.createScript(name, code, options.folderName ?? "Scripts");
  }

  createTimeline(options: {
    name: string;
    moments?: Record<string, string> | undefined;
    folderName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    if (this.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    const folderName = safeResourceName(options.folderName ?? "Timelines");
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `timelines/${name}/${name}.yy`;
    this.ensureFolder(folderName, folderPath);

    const moments = Object.entries(options.moments ?? {}).map(([momentStr, code]) => {
      const moment = parseInt(momentStr, 10);
      const momentPath = `timelines/${name}/moment_${moment}.gml`;
      this.sandbox.atomicWrite(momentPath, code);
      return {
        $GMTimelineMoment: "",
        moment,
        evnt: {
          $GMEvent: "",
          "%Name": "",
          collisionObjectId: null,
          eventNum: moment,
          eventType: 0,
          isDnD: false,
          name: "",
          resourceType: "GMEvent",
          resourceVersion: "2.0",
        },
        name: "",
        resourceType: "GMTimelineMoment",
        resourceVersion: "2.0",
      };
    });

    const timeline = {
      $GMTimeline: "",
      "%Name": name,
      isDnD: false,
      name,
      parent: { name: folderName, path: folderPath },
      resourceType: "GMTimeline",
      resourceVersion: "2.0",
      moments,
    };

    this.sandbox.atomicWrite(yyPath, stringifyGmJson(timeline));
    this.appendProjectResource(name, yyPath);
    return { name, kind: "timeline", yyPath, momentsCount: moments.length };
  }

  inspectTimeline(name: string): TimelineInspection {
    const resource = this.findResource(name, "timeline");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, resource.path);
    const moments = (data["moments"] as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      name,
      path: resource.path,
      momentsCount: moments.length,
      moments: moments.map((m) => {
        const momentNum = Number(m["moment"] ?? 0);
        return {
          moment: momentNum,
          path: `timelines/${name}/moment_${momentNum}.gml`,
        };
      }),
    };
  }

  listMacros(): MacroInfo[] {
    const macros: MacroInfo[] = [];
    const files = this.resources()
      .filter((r) => r.kind === "script" || r.kind === "object")
      .flatMap((r) => {
        const asset = this.readAsset(r.name, r.kind);
        return asset.files.filter((f) => f.path.endsWith(".gml"));
      });

    const macroRegex = /^\s*#macro\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/gm;

    for (const file of files) {
      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        let match: RegExpExecArray | null;
        macroRegex.lastIndex = 0;
        if ((match = macroRegex.exec(line)) !== null) {
          const name = match[1] ?? "";
          const value = (match[2] ?? "").trim();
          macros.push({
            name,
            value,
            file: file.path,
            line: i + 1,
          });
        }
      }
    }
    return macros;
  }

  visualizeStateMachine(filePath: string): StateMachineVisualization {
    const resolvedPath = this.sandbox.resolve(filePath, { mustExist: true });
    const content = fs.readFileSync(resolvedPath, "utf8");
    const lines = content.split(/\r?\n/);

    const statesSet = new Set<string>();
    const transitions: Array<{ from: string; to: string; trigger?: string }> = [];

    const enumRegex = /enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([^}]*)\}/gs;
    let match: RegExpExecArray | null;
    while ((match = enumRegex.exec(content)) !== null) {
      const values = (match[2] ?? "").split(",").map((s) => s.trim().split("=")[0]?.trim()).filter(Boolean);
      for (const val of values) if (val) statesSet.add(val);
    }

    const caseRegex = /case\s+([A-Za-z0-9_.]+)\s*:/g;
    while ((match = caseRegex.exec(content)) !== null) {
      const caseName = (match[1] ?? "").split(".").pop();
      if (caseName) statesSet.add(caseName);
    }

    let currentStateContext = "START";
    const transitionRegex = /\bstate\s*=\s*([A-Za-z0-9_.]+)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const caseMatch = /case\s+([A-Za-z0-9_.]+)\s*:/i.exec(line);
      if (caseMatch) {
        currentStateContext = (caseMatch[1] ?? "").split(".").pop() ?? "START";
      }

      let transMatch: RegExpExecArray | null;
      transitionRegex.lastIndex = 0;
      while ((transMatch = transitionRegex.exec(line)) !== null) {
        const destState = (transMatch[1] ?? "").split(".").pop() ?? "";
        if (destState && destState !== currentStateContext) {
          statesSet.add(destState);
          if (currentStateContext !== "START") {
            transitions.push({
              from: currentStateContext,
              to: destState,
              trigger: `Line ${i + 1}`,
            });
          }
        }
      }
    }

    const states = [...statesSet];
    const mermaidLines = ["stateDiagram-v2"];
    for (const state of states) {
      mermaidLines.push(`    state ${state}`);
    }
    for (const trans of transitions) {
      mermaidLines.push(`    ${trans.from} --> ${trans.to} : "${trans.trigger}"`);
    }
    const mermaid = mermaidLines.join("\n");

    return {
      states,
      transitions,
      mermaid,
    };
  }

  getObjectEventChain(options: {
    objectName: string;
    eventName: SupportedEventName;
  }): EventChain {
    const startName = safeResourceName(options.objectName);
    const eventSpec = EVENT_MAP[options.eventName];
    if (!eventSpec) {
      throw new Error(`Unsupported event name: ${options.eventName}`);
    }

    const chain: EventChainLink[] = [];
    let currentName: string | undefined = startName;

    while (currentName) {
      const resource = this.resources().find((r) => r.name === currentName && r.kind === "object");
      if (!resource) {
        chain.push({
          objectName: currentName,
          implementsEvent: false,
        });
        break;
      }

      const text = this.sandbox.readText(resource.path, [".yy"]);
      const data = requireGmJson<Record<string, unknown>>(text, resource.path);
      const events = (data["eventList"] as ObjectEvent[] | undefined) ?? [];
      const parentId = (data["parentObjectId"] as { name?: string } | undefined)?.name;

      const implementsEvent = events.some(
        (e) => e.eventType === eventSpec.eventType && e.eventNum === eventSpec.eventNum
      );

      let eventPath: string | undefined;
      let lineCount: number | undefined;

      if (implementsEvent) {
        eventPath = `objects/${currentName}/${eventSpec.file}`;
        try {
          const content = this.sandbox.readText(eventPath, [".gml"]);
          lineCount = content.split(/\r?\n/).length;
        } catch {}
      }

      chain.push({
        objectName: currentName,
        implementsEvent,
        eventPath,
        lineCount,
      });

      currentName = parentId;
    }

    return {
      objectName: startName,
      eventName: options.eventName,
      chain,
    };
  }

  detectDeadCode(): Array<{ file: string; line: number; functionName: string }> {
    const functionDeclarations: Array<{ file: string; line: number; functionName: string }> = [];
    const functionReferences = new Map<string, number>();

    const gmlFiles: Array<{ file: string; content: string }> = [];
    for (const r of this.resources()) {
      if (r.kind === "script" || r.kind === "object") {
        try {
          const asset = this.readAsset(r.name, r.kind);
          for (const f of asset.files) {
            if (f.path.endsWith(".gml")) {
              gmlFiles.push({ file: f.path, content: f.content });
            }
          }
        } catch {}
      }
    }

    const funcDeclRegex = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

    for (const f of gmlFiles) {
      const lines = f.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        let match: RegExpExecArray | null;
        funcDeclRegex.lastIndex = 0;
        while ((match = funcDeclRegex.exec(line)) !== null) {
          const functionName = match[1];
          if (functionName) {
            functionDeclarations.push({
              file: f.file,
              line: i + 1,
              functionName,
            });
            functionReferences.set(functionName, 0);
          }
        }
      }
    }

    for (const f of gmlFiles) {
      for (const decl of functionDeclarations) {
        const refRegex = new RegExp(`\\b${decl.functionName}\\b`, "g");
        const lines = f.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          if (f.file === decl.file && i + 1 === decl.line) {
            continue;
          }
          
          let match: RegExpExecArray | null;
          refRegex.lastIndex = 0;
          while ((match = refRegex.exec(line)) !== null) {
            const isDecl = new RegExp(`\\bfunction\\s+${decl.functionName}\\b`).test(line);
            if (!isDecl) {
              const currentCount = functionReferences.get(decl.functionName) ?? 0;
              functionReferences.set(decl.functionName, currentCount + 1);
            }
          }
        }
      }
    }

    return functionDeclarations.filter((d) => (functionReferences.get(d.functionName) ?? 0) === 0);
  }
}

export interface SpriteInspection {
  name: string;
  path: string;
  width: number;
  height: number;
  origin: { x: number; y: number };
  bbox: { left: number; right: number; top: number; bottom: number; mode: string };
  collision: { kind: string; tolerance: number };
  framesCount: number;
  playbackSpeed: number;
  playbackSpeedType: string;
  textureGroup: string;
  is3D: boolean;
}

export interface SoundInspection {
  name: string;
  path: string;
  soundFile: string;
  audioGroup: string;
  type: string;
  sampleRate: number;
  bitDepth: number;
  bitRate: number;
  duration: number;
  volume: number;
  preload: boolean;
}

export interface SequenceInspection {
  name: string;
  path: string;
  length: number;
  playbackSpeed: number;
  tracksCount: number;
  tracks: string[];
}

export interface FontInspection {
  name: string;
  path: string;
  fontName: string;
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface TilesetInspection {
  name: string;
  path: string;
  spriteName: string;
  tileSize: number;
  tileBorder: number;
}

export interface AnimCurveInspection {
  name: string;
  path: string;
  channels: string[];
}

export interface TimelineInspection {
  name: string;
  path: string;
  momentsCount: number;
  moments: Array<{ moment: number; path: string }>;
}

export interface MacroInfo {
  name: string;
  value: string;
  file: string;
  line: number;
}

export interface StateMachineVisualization {
  states: string[];
  transitions: Array<{ from: string; to: string; trigger?: string }>;
  mermaid: string;
}

export interface EventChainLink {
  objectName: string;
  implementsEvent: boolean;
  eventPath?: string | undefined;
  lineCount?: number | undefined;
}

export interface EventChain {
  objectName: string;
  eventName: string;
  chain: EventChainLink[];
}

export const supportedEventNames = Object.keys(EVENT_MAP) as SupportedEventName[];
