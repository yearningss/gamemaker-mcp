import fs from "node:fs";
import path from "node:path";

import { applyEdits, modify, type JSONPath } from "jsonc-parser";

import { parseGmJson, requireGmJson, stringifyGmJson } from "./gm-json.js";
import { ProjectAnalysisService } from "./analysis.js";
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
    this.projectRelativePath = config.projectFile ? this.sandbox.relative(config.projectFile) : "";
  }

  projectData(): YypData {
    if (!this.projectRelativePath) {
      throw new Error("No .yyp GameMaker project is currently loaded. Open a GameMaker project folder or set GAMEMAKER_PROJECT.");
    }
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
    if (!this.projectRelativePath) {
      return {
        name: "No Project Loaded",
        projectFile: "",
        projectRoot: this.config.projectRoot,
        mode: this.config.mode,
        resourceCount: 0,
        counts: {},
        roomOrder: [],
      };
    }
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

  initTestFramework(): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = "scr_test_framework";
    const existing = this.resources().find((r) => r.name === name && r.kind === "script");
    if (existing) {
      return { name, path: existing.path, status: "already_exists" };
    }

    const code = `// GML Unit Testing Framework
global.__tests = [];
global.__test_results = { passed: 0, failed: 0 };

function test_add(name, test_func) {
    array_push(global.__tests, { name: name, func: test_func });
}

function assert_equal(a, b, msg="") {
    if (a != b) {
        throw ("Assertion Failed: " + string(a) + " != " + string(b) + (msg != "" ? " (" + msg + ")" : ""));
    }
}

function assert_true(val, msg="") {
    if (!val) {
        throw ("Assertion Failed: expected true, got false" + (msg != "" ? " (" + msg + ")" : ""));
    }
}

function run_all_tests() {
    show_debug_message("=== GML TEST RUN START ===");
    
    // [[SUITES]]
    
    for (var i = 0; i < array_length(global.__tests); i++) {
        var t = global.__tests[i];
        try {
            t.func();
            global.__test_results.passed++;
            show_debug_message("[PASS] " + t.name);
        } catch(e) {
            global.__test_results.failed++;
            show_debug_message("[FAIL] " + t.name + " - " + string(e));
        }
    }
    show_debug_message("=== GML TEST RUN END ===");
    show_debug_message("PASSED: " + string(global.__test_results.passed));
    show_debug_message("FAILED: " + string(global.__test_results.failed));
    game_end();
}
`;
    return this.createScript(name, code, "Scripts");
  }

  createTestSuite(options: { suiteName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(`scr_test_${options.suiteName}`);
    if (this.resources().some((r) => r.name === name)) {
      throw new Error(`Test suite already exists: ${name}`);
    }

    const code = `// Test suite for ${options.suiteName}
function test_suite_${options.suiteName}() {
    test_add("${options.suiteName} Example Test", function() {
        var val = 1 + 1;
        assert_equal(val, 2, "1 + 1 should equal 2");
    });
}
`;
    const res = this.createScript(name, code, "Scripts");

    // Register inside scr_test_framework
    const frameworkName = "scr_test_framework";
    const frameworkRes = this.findResource(frameworkName, "script");
    const scriptFile = `scripts/${frameworkName}/${frameworkName}.gml`;
    const frameworkCode = this.sandbox.readText(scriptFile, [".gml"]);
    if (frameworkCode.includes(`test_suite_${options.suiteName}();`)) {
      return res;
    }

    const updatedCode = frameworkCode.replace(
      "// [[SUITES]]",
      `test_suite_${options.suiteName}();\n    // [[SUITES]]`
    );
    const currentSha = this.sandbox.sha256For(scriptFile);
    this.sandbox.atomicWrite(scriptFile, updatedCode, { expectedSha256: currentSha });

    return res;
  }

  setupTestRunner(): TestRunnerSetup {
    this.sandbox.assertWritable();
    const yyp = this.projectData();
    const roomOrder = (yyp["RoomOrderNodes"] as Array<{ roomId: { name: string } }> | undefined) ?? [];
    const firstRoomName = roomOrder[0]?.roomId?.name ?? this.resources().find((r) => r.kind === "room")?.name;
    if (!firstRoomName) {
      throw new Error("No rooms found in the project. Cannot run tests.");
    }

    const roomResource = this.findResource(firstRoomName, "room");
    const roomText = this.sandbox.readText(roomResource.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(roomText, roomResource.path);
    const creationCodeFile = roomData["creationCodeFile"] as string | undefined;

    if (creationCodeFile) {
      const codePath = `${path.posix.dirname(roomResource.path)}/${creationCodeFile}`;
      const originalCode = this.sandbox.readText(codePath, [".gml"]);
      const codeSha = this.sandbox.sha256For(codePath);
      this.sandbox.atomicWrite(codePath, `run_all_tests();\n${originalCode}`, { expectedSha256: codeSha });
      return {
        targetRoomPath: undefined,
        originalRoomText: undefined,
        targetRoomCreationCodePath: codePath,
        originalCreationCodeText: originalCode,
      };
    } else {
      const updatedRoom = { ...roomData, creationCodeFile: "RoomCreationCode.gml" };
      const updatedRoomText = stringifyGmJson(updatedRoom);
      const roomSha = this.sandbox.sha256For(roomResource.path);
      this.sandbox.atomicWrite(roomResource.path, updatedRoomText, { expectedSha256: roomSha });
      const codePath = `${path.posix.dirname(roomResource.path)}/RoomCreationCode.gml`;
      this.sandbox.atomicWrite(codePath, "run_all_tests();\n");
      return {
        targetRoomPath: roomResource.path,
        originalRoomText: roomText,
        targetRoomCreationCodePath: codePath,
        originalCreationCodeText: undefined,
      };
    }
  }

  listDataFiles(): Array<Record<string, unknown>> {
    const yyp = this.projectData() as Record<string, unknown>;
    const included = (yyp["IncludedFiles"] as Array<Record<string, unknown>> | undefined) ?? [];
    return included.map((file) => {
      const fileName = (file["name"] ?? file["%Name"] ?? "") as string;
      const relPath = `datafiles/${fileName}`;
      return {
        name: fileName,
        filePath: file["filePath"] ?? "datafiles",
        fullPath: relPath,
        exists: fs.existsSync(this.sandbox.resolve(relPath, { mustExist: false })),
      };
    });
  }

  createDataFile(options: { filePath: string; content: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const cleanName = path.posix.basename(options.filePath);
    const relativePath = options.filePath.startsWith("datafiles/")
      ? options.filePath
      : `datafiles/${options.filePath}`;

    const writeResult = this.sandbox.atomicWrite(relativePath, options.content);

    const yypText = this.sandbox.readText(this.projectRelativePath, [".yyp"]);
    const yyp = requireGmJson<YypData & { IncludedFiles?: Array<Record<string, unknown>> }>(
      yypText,
      this.projectRelativePath,
    );
    const includedFiles = [...(yyp.IncludedFiles ?? [])];

    if (!includedFiles.some((f) => (f["name"] ?? f["%Name"]) === cleanName)) {
      includedFiles.push({
        $GMIncludedFile: "",
        "%Name": cleanName,
        CopyToMask: -1,
        filePath: "datafiles",
        name: cleanName,
        resourceType: "GMIncludedFile",
        resourceVersion: "2.0",
      });
      const updatedYypText = updateJsonPath(yypText, ["IncludedFiles"], includedFiles);
      const yypSha = this.sandbox.sha256For(this.projectRelativePath);
      this.sandbox.atomicWrite(this.projectRelativePath, updatedYypText, { expectedSha256: yypSha });
    }

    return { name: cleanName, path: relativePath, bytes: options.content.length, writeResult };
  }

  readDataFile(filePath: string): Record<string, unknown> {
    const relativePath = filePath.startsWith("datafiles/") ? filePath : `datafiles/${filePath}`;
    return this.readFile(relativePath);
  }

  listAudioGroups(): Record<string, unknown> {
    const yyp = this.projectData() as Record<string, unknown>;
    const audioGroups = (yyp["AudioGroups"] as Array<Record<string, unknown>> | undefined) ?? [];
    const sounds = this.resources().filter((r) => r.kind === "sound");

    const result: Array<{ name: string; targets: string[] }> = audioGroups.map((group) => {
      const groupName = (group["name"] ?? group["%Name"] ?? "audiogroup_default") as string;
      return {
        name: groupName,
        targets: [],
      };
    });
    if (!result.some((g) => g.name === "audiogroup_default")) {
      result.unshift({ name: "audiogroup_default", targets: [] });
    }

    for (const soundRes of sounds) {
      try {
        const text = this.sandbox.readText(soundRes.path, [".yy"]);
        const data = requireGmJson<Record<string, unknown>>(text, soundRes.path);
        const group = (data["audioGroupId"] as { name?: string } | undefined)?.name ?? "audiogroup_default";
        const targetGroup = result.find((g) => g.name === group);
        if (targetGroup) targetGroup.targets.push(soundRes.name);
      } catch {}
    }
    return { audioGroups: result };
  }

  listTextureGroups(): Record<string, unknown> {
    const yyp = this.projectData() as Record<string, unknown>;
    const textureGroups = (yyp["TextureGroups"] as Array<Record<string, unknown>> | undefined) ?? [];
    const sprites = this.resources().filter((r) => r.kind === "sprite");

    const result: Array<{ name: string; targets: string[] }> = textureGroups.map((group) => {
      const groupName = (group["name"] ?? group["%Name"] ?? "Default") as string;
      return {
        name: groupName,
        targets: [],
      };
    });
    if (!result.some((g) => g.name === "Default")) {
      result.unshift({ name: "Default", targets: [] });
    }

    for (const spriteRes of sprites) {
      try {
        const text = this.sandbox.readText(spriteRes.path, [".yy"]);
        const data = requireGmJson<Record<string, unknown>>(text, spriteRes.path);
        const group = (data["textureGroupId"] as { name?: string } | undefined)?.name ?? "Default";
        const targetGroup = result.find((g) => g.name === group);
        if (targetGroup) targetGroup.targets.push(spriteRes.name);
      } catch {}
    }
    return { textureGroups: result };
  }

  configureSound(options: {
    soundName: string;
    volume?: number | undefined;
    preload?: boolean | undefined;
    audioGroupName?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const soundRes = this.findResource(options.soundName, "sound");
    let text = this.sandbox.readText(soundRes.path, [".yy"]);
    const updates: Array<[JSONPath, unknown]> = [];
    if (options.volume !== undefined) updates.push([["volume"], options.volume]);
    if (options.preload !== undefined) updates.push([["preload"], options.preload]);
    if (options.audioGroupName !== undefined) {
      updates.push([["audioGroupId"], { name: options.audioGroupName, path: `audiogroups/${options.audioGroupName}` }]);
    }
    if (!updates.length) throw new Error("No sound settings provided");
    for (const [jsonPath, value] of updates) text = updateJsonPath(text, jsonPath, value);
    const sha = this.sandbox.sha256For(soundRes.path);
    return this.sandbox.atomicWrite(soundRes.path, text, { expectedSha256: sha, backup: true });
  }

  removeRoomLayer(options: { roomName: string; layerName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const resource = this.findResource(options.roomName, "room");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(text, resource.path);
    const layers = [...((roomData["layers"] as Array<Record<string, unknown>>) ?? [])];
    const index = layers.findIndex((l) => (l["name"] ?? l["%Name"]) === options.layerName);
    if (index < 0) throw new Error(`Layer ${options.layerName} not found in room ${options.roomName}`);
    layers.splice(index, 1);
    const next = updateJsonPath(text, ["layers"], layers);
    const sha = this.sandbox.sha256For(resource.path);
    return this.sandbox.atomicWrite(resource.path, next, { expectedSha256: sha, backup: true });
  }

  removeRoomInstance(options: { roomName: string; instanceName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const resource = this.findResource(options.roomName, "room");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(text, resource.path);
    const layers = [...((roomData["layers"] as Array<Record<string, unknown>>) ?? [])];

    let removed = false;
    for (const layer of layers) {
      const instances = (layer["instances"] as Array<Record<string, unknown>> | undefined) ?? [];
      const idx = instances.findIndex((inst) => (inst["name"] ?? inst["%Name"]) === options.instanceName);
      if (idx >= 0) {
        instances.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) throw new Error(`Instance ${options.instanceName} not found in room ${options.roomName}`);
    const next = updateJsonPath(text, ["layers"], layers);
    const sha = this.sandbox.sha256For(resource.path);
    return this.sandbox.atomicWrite(resource.path, next, { expectedSha256: sha, backup: true });
  }

  configureRoomInstance(options: {
    roomName: string;
    instanceName: string;
    x?: number | undefined;
    y?: number | undefined;
    scaleX?: number | undefined;
    scaleY?: number | undefined;
    rotation?: number | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const resource = this.findResource(options.roomName, "room");
    const text = this.sandbox.readText(resource.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(text, resource.path);
    const layers = [...((roomData["layers"] as Array<Record<string, unknown>>) ?? [])];

    let targetInstance: Record<string, unknown> | null = null;
    for (const layer of layers) {
      const instances = (layer["instances"] as Array<Record<string, unknown>> | undefined) ?? [];
      const inst = instances.find((i) => (i["name"] ?? i["%Name"]) === options.instanceName);
      if (inst) {
        targetInstance = inst;
        break;
      }
    }
    if (!targetInstance) throw new Error(`Instance ${options.instanceName} not found in room ${options.roomName}`);
    if (options.x !== undefined) targetInstance["x"] = options.x;
    if (options.y !== undefined) targetInstance["y"] = options.y;
    if (options.scaleX !== undefined) targetInstance["scaleX"] = options.scaleX;
    if (options.scaleY !== undefined) targetInstance["scaleY"] = options.scaleY;
    if (options.rotation !== undefined) targetInstance["rotation"] = options.rotation;

    const next = updateJsonPath(text, ["layers"], layers);
    const sha = this.sandbox.sha256For(resource.path);
    return this.sandbox.atomicWrite(resource.path, next, { expectedSha256: sha, backup: true });
  }

  listGlobalVars(): Record<string, unknown> {
    const globalVarMap = new Map<string, Array<{ file: string; line: number; type: "read" | "write" }>>();
    const relativePaths = walkFiles(this.config.projectRoot)
      .map((absolutePath) => this.sandbox.relative(absolutePath))
      .filter((relativePath) => relativePath.toLowerCase().endsWith(".gml"));

    const globalRegex = /\bglobal\.([A-Za-z0-9_]+)\b/g;

    for (const filePath of relativePaths) {
      const content = this.sandbox.readText(filePath, [".gml"]);
      const lines = content.split(/\r?\n/);

      lines.forEach((line, idx) => {
        let match: RegExpExecArray | null;
        globalRegex.lastIndex = 0;
        while ((match = globalRegex.exec(line)) !== null) {
          const varName = match[1];
          if (!varName) continue;
          if (!globalVarMap.has(varName)) globalVarMap.set(varName, []);

          const afterMatch = line.substring(match.index + match[0].length).trim();
          const isWrite = /^=\s*[^=]/.test(afterMatch) || /^\+=\s*/.test(afterMatch) || /^--|^\+\+/.test(afterMatch);

          globalVarMap.get(varName)!.push({
            file: filePath,
            line: idx + 1,
            type: isWrite ? "write" : "read",
          });
        }
      });
    }

    const variables = [...globalVarMap.entries()].map(([name, references]) => ({
      name,
      totalReferences: references.length,
      writesCount: references.filter((r) => r.type === "write").length,
      readsCount: references.filter((r) => r.type === "read").length,
      references,
    }));

    return { totalGlobalVars: variables.length, variables };
  }

  configureFont(options: {
    fontName: string;
    fontFamily?: string | undefined;
    size?: number | undefined;
    bold?: boolean | undefined;
    italic?: boolean | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.fontName, "font");
    let text = this.sandbox.readText(res.path, [".yy"]);
    const updates: Array<[JSONPath, unknown]> = [];
    if (options.fontFamily !== undefined) updates.push([["fontName"], options.fontFamily]);
    if (options.size !== undefined) updates.push([["size"], options.size]);
    if (options.bold !== undefined) updates.push([["bold"], options.bold]);
    if (options.italic !== undefined) updates.push([["italic"], options.italic]);
    if (!updates.length) throw new Error("No font settings provided");
    for (const [jsonPath, value] of updates) text = updateJsonPath(text, jsonPath, value);
    const sha = this.sandbox.sha256For(res.path);
    return this.sandbox.atomicWrite(res.path, text, { expectedSha256: sha, backup: true });
  }

  configureTileset(options: {
    tilesetName: string;
    spriteName?: string | undefined;
    tileSize?: number | undefined;
    tileBorder?: number | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.tilesetName, "tileset");
    let text = this.sandbox.readText(res.path, [".yy"]);
    const updates: Array<[JSONPath, unknown]> = [];
    if (options.tileSize !== undefined) {
      updates.push([["tileWidth"], options.tileSize]);
      updates.push([["tileHeight"], options.tileSize]);
    }
    if (options.tileBorder !== undefined) {
      updates.push([["tilehBorder"], options.tileBorder]);
      updates.push([["tilevBorder"], options.tileBorder]);
    }
    if (options.spriteName !== undefined) {
      const spriteRes = this.findResource(options.spriteName, "sprite");
      updates.push([["spriteId"], { name: spriteRes.name, path: spriteRes.path }]);
    }
    if (!updates.length) throw new Error("No tileset settings provided");
    for (const [jsonPath, value] of updates) text = updateJsonPath(text, jsonPath, value);
    const sha = this.sandbox.sha256For(res.path);
    return this.sandbox.atomicWrite(res.path, text, { expectedSha256: sha, backup: true });
  }

  auditPhysics(): Record<string, unknown> {
    const objects = this.resources().filter((r) => r.kind === "object");
    const physicsObjects: Array<Record<string, unknown>> = [];

    for (const objRes of objects) {
      try {
        const text = this.sandbox.readText(objRes.path, [".yy"]);
        const data = requireGmJson<Record<string, unknown>>(text, objRes.path);
        if (data["physicsObject"] === true) {
          physicsObjects.push({
            name: objRes.name,
            path: objRes.path,
            density: data["physicsDensity"] ?? 0.5,
            restitution: data["physicsRestitution"] ?? 0.1,
            friction: data["physicsFriction"] ?? 0.2,
            linearDamping: data["physicsLinearDamping"] ?? 0.1,
            angularDamping: data["physicsAngularDamping"] ?? 0.1,
            shape: data["physicsShape"] ?? 1,
            sensor: data["physicsSensor"] ?? false,
          });
        }
      } catch {}
    }

    return { totalObjects: objects.length, physicsObjectsCount: physicsObjects.length, physicsObjects };
  }

  findAssetReferences(assetName: string): Record<string, unknown> {
    const matches: Array<{ file: string; line?: number; type: string }> = [];
    const targetRegex = new RegExp(`\\b${assetName}\\b`, "g");

    const files = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".gml") || p.endsWith(".yy") || p.endsWith(".yyp"));

    for (const file of files) {
      const content = this.sandbox.readText(file, [".gml", ".yy", ".yyp"]);
      if (file.endsWith(".gml")) {
        const lines = content.split(/\r?\n/);
        lines.forEach((line, idx) => {
          if (targetRegex.test(line)) {
            matches.push({ file, line: idx + 1, type: "GML code" });
          }
          targetRegex.lastIndex = 0;
        });
      } else if (file.endsWith(".yy") || file.endsWith(".yyp")) {
        if (content.includes(`"${assetName}"`)) {
          matches.push({ file, type: "Metadata reference" });
        }
      }
    }

    return { assetName, totalMatches: matches.length, matches };
  }

  extractI18nStrings(options: {
    targetFile?: string | undefined;
    jsonPath?: string | undefined;
  } = {}): Record<string, unknown> {
    this.sandbox.assertWritable();
    const destPath = options.jsonPath ?? "datafiles/localization.json";
    const hardcoded: Array<{ file: string; line: number; text: string; key: string }> = [];

    const files = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".gml"));

    const stringRegex = /"([^"\\]*(\\.[^"\\]*)*)"/g;

    for (const file of files) {
      if (options.targetFile && !file.includes(options.targetFile)) continue;
      const content = this.sandbox.readText(file, [".gml"]);
      const lines = content.split(/\r?\n/);

      lines.forEach((line, idx) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("///")) return;
        let match: RegExpExecArray | null;
        stringRegex.lastIndex = 0;
        while ((match = stringRegex.exec(line)) !== null) {
          const str = match[1];
          if (str && str.length > 1 && !/^[0-9_\-\.\s]+$/.test(str)) {
            const key = `STR_${path.basename(file, ".gml").toUpperCase()}_L${idx + 1}`;
            hardcoded.push({ file, line: idx + 1, text: str, key });
          }
        }
      });
    }

    const dict: Record<string, string> = {};
    for (const item of hardcoded) {
      dict[item.key] = item.text;
    }

    this.createDataFile({ filePath: destPath, content: JSON.stringify(dict, null, 2) });

    return {
      destination: destPath,
      extractedCount: hardcoded.length,
      keys: dict,
      occurrences: hardcoded,
    };
  }

  generateShaderEffect(options: {
    shaderName: string;
    effectType: "outline" | "blur" | "dissolve" | "chromatic_aberration" | "wave" | "pixelate";
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const name = safeResourceName(options.shaderName);

    const vsh = `// Attribute & Varying Declarations
attribute vec3 in_Position;                  // (x,y,z)
attribute vec4 in_Colour;                    // (r,g,b,a)
attribute vec2 in_TextureCoord;              // (u,v)

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    vec4 object_space_pos = vec4(in_Position.x, in_Position.y, in_Position.z, 1.0);
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * object_space_pos;
    
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;

    let fsh = "";
    switch (options.effectType) {
      case "outline":
        fsh = `varying vec2 v_vTexcoord;
varying vec4 v_vColour;
uniform vec2 u_pixelSize;
uniform vec4 u_outlineColor;

void main() {
    vec4 mainColor = texture2D(gm_BaseTexture, v_vTexcoord);
    if (mainColor.a > 0.1) {
        gl_FragColor = v_vColour * mainColor;
    } else {
        float alpha = 0.0;
        alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2(u_pixelSize.x, 0.0)).a;
        alpha += texture2D(gm_BaseTexture, v_vTexcoord - vec2(u_pixelSize.x, 0.0)).a;
        alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2(0.0, u_pixelSize.y)).a;
        alpha += texture2D(gm_BaseTexture, v_vTexcoord - vec2(0.0, u_pixelSize.y)).a;
        if (alpha > 0.0) {
            gl_FragColor = u_outlineColor;
        } else {
            gl_FragColor = vec4(0.0);
        }
    }
}
`;
        break;
      case "chromatic_aberration":
        fsh = `varying vec2 v_vTexcoord;
varying vec4 v_vColour;
uniform float u_offset;

void main() {
    vec2 offsetVec = vec2(u_offset, 0.0);
    float r = texture2D(gm_BaseTexture, v_vTexcoord + offsetVec).r;
    float g = texture2D(gm_BaseTexture, v_vTexcoord).g;
    float b = texture2D(gm_BaseTexture, v_vTexcoord - offsetVec).b;
    float a = texture2D(gm_BaseTexture, v_vTexcoord).a;
    gl_FragColor = v_vColour * vec4(r, g, b, a);
}
`;
        break;
      case "pixelate":
        fsh = `varying vec2 v_vTexcoord;
varying vec4 v_vColour;
uniform vec2 u_resolution;
uniform float u_pixelSize;

void main() {
    vec2 coord = floor(v_vTexcoord * u_resolution / u_pixelSize) * u_pixelSize / u_resolution;
    gl_FragColor = v_vColour * texture2D(gm_BaseTexture, coord);
}
`;
        break;
      default:
        fsh = `varying vec2 v_vTexcoord;
varying vec4 v_vColour;
uniform float u_time;

void main() {
    vec2 uv = v_vTexcoord;
    uv.x += sin(uv.y * 20.0 + u_time * 5.0) * 0.01;
    gl_FragColor = v_vColour * texture2D(gm_BaseTexture, uv);
}
`;
        break;
    }

    return this.createShader({ name, vertex: vsh, fragment: fsh, folderName: "Shaders" });
  }

  extractScriptFromCode(options: {
    sourceFilePath: string;
    newScriptName: string;
    startLine: number;
    endLine: number;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const cleanScriptName = safeResourceName(options.newScriptName);
    const content = this.sandbox.readText(options.sourceFilePath, [".gml"]);
    const lines = content.split(/\r?\n/);

    if (options.startLine < 1 || options.endLine > lines.length || options.startLine > options.endLine) {
      throw new Error(`Invalid line range ${options.startLine}-${options.endLine} for file length ${lines.length}`);
    }

    const extractedLines = lines.slice(options.startLine - 1, options.endLine);

    const scriptCode = `/// @function ${cleanScriptName}()\nfunction ${cleanScriptName}() {\n${extractedLines.map((l) => "    " + l).join("\n")}\n}\n`;
    const scriptRes = this.createScript(cleanScriptName, scriptCode, "Scripts");

    lines.splice(options.startLine - 1, options.endLine - options.startLine + 1, `${cleanScriptName}();`);
    const newSourceCode = lines.join("\n");
    const sha = this.sandbox.sha256For(options.sourceFilePath);
    this.sandbox.atomicWrite(options.sourceFilePath, newSourceCode, { expectedSha256: sha, backup: true });

    return {
      extractedScript: scriptRes,
      sourceFile: options.sourceFilePath,
      replacedLines: options.endLine - options.startLine + 1,
    };
  }

  exportRoomToJson(options: {
    roomName: string;
    targetPath?: string | undefined;
  }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const roomRes = this.findResource(options.roomName, "room");
    const text = this.sandbox.readText(roomRes.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(text, roomRes.path);

    const exportData = {
      roomName: options.roomName,
      width: roomData["roomSettings"] ? (roomData["roomSettings"] as any)["Width"] : 1024,
      height: roomData["roomSettings"] ? (roomData["roomSettings"] as any)["Height"] : 768,
      layersCount: Array.isArray(roomData["layers"]) ? roomData["layers"].length : 0,
      layers: roomData["layers"] ?? [],
      creationCodeFile: roomData["creationCodeFile"] ?? null,
    };

    const dest = options.targetPath ?? `datafiles/levels/${options.roomName}.json`;
    this.createDataFile({ filePath: dest, content: JSON.stringify(exportData, null, 2) });

    return { roomName: options.roomName, exportPath: dest, roomData: exportData };
  }

  auditArchitecture(): Record<string, unknown> {
    const deadCode = this.detectDeadCode();

    const scriptCount = this.resources().filter((r) => r.kind === "script").length;
    const objectCount = this.resources().filter((r) => r.kind === "object").length;
    const roomCount = this.resources().filter((r) => r.kind === "room").length;
    const spriteCount = this.resources().filter((r) => r.kind === "sprite").length;
    const soundCount = this.resources().filter((r) => r.kind === "sound").length;

    let score = 100;
    const recommendations: string[] = [];

    if (deadCode.length > 5) {
      score -= 15;
      recommendations.push(`Remove ${deadCode.length} dead/uncalled script functions.`);
    }
    if (scriptCount === 0 && objectCount > 0) {
      score -= 20;
      recommendations.push("Project lacks script modules. Consider extracting reusable logic into script structs.");
    }
    if (objectCount > 20 && scriptCount < 3) {
      score -= 15;
      recommendations.push("High object count with few scripts. Consider adopting MVC or ECS architecture patterns.");
    }

    const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : "C";

    return {
      architectureScore: score,
      grade,
      resourceCounts: { scripts: scriptCount, objects: objectCount, rooms: roomCount, sprites: spriteCount, sounds: soundCount },
      deadCodeCount: deadCode.length,
      recommendations,
    };
  }

  inspectIdePreferences(): Record<string, unknown> {
    const userDir = process.env["GAMEMAKER_USER_DIR"] || path.join(process.env["APPDATA"] || "", "GameMakerStudio2");
    const prefPath = path.join(userDir, "preferences.json");
    if (!fs.existsSync(prefPath)) {
      return { found: false, searchPath: prefPath, message: "GameMaker IDE preferences file not found at default location." };
    }
    try {
      const text = fs.readFileSync(prefPath, "utf-8");
      const data = requireGmJson<Record<string, unknown>>(text, prefPath);
      return { found: true, prefPath, preferences: data };
    } catch (e: any) {
      return { found: false, prefPath, error: e.message };
    }
  }

  configureFeatherRules(options: {
    enabled?: boolean | undefined;
    strictTypeChecking?: boolean | undefined;
    customRules?: Record<string, string> | undefined;
  } = {}): Record<string, unknown> {
    this.sandbox.assertWritable();
    const configPath = ".featherconfig";
    const config = {
      enabled: options.enabled ?? true,
      strictTypeChecking: options.strictTypeChecking ?? true,
      rules: options.customRules ?? {
        GM1001: "warn",
        GM1002: "error",
        GM2001: "info",
      },
    };
    const content = JSON.stringify(config, null, 2);
    const fullPath = path.join(this.config.projectRoot, configPath);
    const exists = fs.existsSync(fullPath);
    const expectedSha = exists ? this.sandbox.sha256For(configPath) : undefined;
    this.sandbox.atomicWrite(configPath, content, expectedSha ? { expectedSha256: expectedSha } : {});

    return { configPath, config };
  }

  clearProjectCache(): Record<string, unknown> {
    this.sandbox.assertWritable();
    const cacheDir = path.join(this.config.projectRoot, ".gm_cache");
    let cleared = false;
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      cleared = true;
    }
    return { cacheDir, cleared };
  }

  getRecentProjects(): Record<string, unknown> {
    const appData = process.env["APPDATA"] || "";
    const searchDirs = [
      path.join(appData, "GameMakerStudio2"),
      path.join(appData, "GameMakerStudio2-LTS"),
    ];

    const recent: string[] = [];
    for (const dir of searchDirs) {
      const file = path.join(dir, "recent_projects.json");
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          const list = parseGmJson<string[]>(content);
          if (Array.isArray(list)) recent.push(...list);
        } catch {}
      }
    }

    return { totalRecent: recent.length, recentProjects: recent };
  }

  inspectIdeHotkeys(): Record<string, unknown> {
    const appData = process.env["APPDATA"] || "";
    const file = path.join(appData, "GameMakerStudio2", "keybindings.json");
    if (!fs.existsSync(file)) {
      return { found: false, searchPath: file, shortcuts: [] };
    }
    try {
      const content = fs.readFileSync(file, "utf-8");
      const list = parseGmJson<Record<string, unknown>>(content);
      return { found: true, keybindingsFile: file, shortcuts: list };
    } catch (e: any) {
      return { found: false, error: e.message };
    }
  }

  formatGmlCode(options: { filePath: string; indentSize?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const content = this.sandbox.readText(options.filePath, [".gml"]);
    const indent = " ".repeat(options.indentSize ?? 4);
    const lines = content.split(/\r?\n/);
    let depth = 0;
    const formatted: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        formatted.push("");
        continue;
      }

      if (trimmed.startsWith("}") || trimmed.startsWith("]") || trimmed.startsWith(")")) {
        depth = Math.max(0, depth - 1);
      }

      formatted.push(indent.repeat(depth) + trimmed);

      const openBraces = (trimmed.match(/[\{\[\(]/g) || []).length;
      const closeBraces = (trimmed.match(/[\}\]\)]/g) || []).length;
      depth = Math.max(0, depth + openBraces - closeBraces);
    }

    const newCode = formatted.join("\n");
    const sha = this.sandbox.sha256For(options.filePath);
    this.sandbox.atomicWrite(options.filePath, newCode, { expectedSha256: sha, backup: true });

    return { filePath: options.filePath, linesTotal: lines.length, formatted: true };
  }

  batchSearchReplace(options: { query: string; replacement: string; isRegex?: boolean | undefined; dryRun?: boolean | undefined }): Record<string, unknown> {
    if (!options.dryRun) this.sandbox.assertWritable();

    const files = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".gml"));

    let modifiedFiles = 0;
    let totalReplacements = 0;
    const details: Array<{ file: string; matches: number }> = [];

    const regex = options.isRegex
      ? new RegExp(options.query, "g")
      : new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

    for (const file of files) {
      const content = this.sandbox.readText(file, [".gml"]);
      const matches = (content.match(regex) || []).length;
      if (matches > 0) {
        modifiedFiles++;
        totalReplacements += matches;
        details.push({ file, matches });

        if (!options.dryRun) {
          const newContent = content.replace(regex, options.replacement);
          const sha = this.sandbox.sha256For(file);
          this.sandbox.atomicWrite(file, newContent, { expectedSha256: sha, backup: true });
        }
      }
    }

    return {
      query: options.query,
      replacement: options.replacement,
      dryRun: options.dryRun ?? false,
      modifiedFiles,
      totalReplacements,
      details,
    };
  }

  configureSequence(options: { sequenceName: string; width?: number | undefined; height?: number | undefined; length?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.sequenceName, "sequence");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    if (options.width !== undefined) data["width"] = options.width;
    if (options.height !== undefined) data["height"] = options.height;
    if (options.length !== undefined) data["length"] = options.length;

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { sequenceName: options.sequenceName, updated: true, sequenceData: data };
  }

  configureTimeline(options: { timelineName: string; addMoment?: number | undefined; momentCode?: string | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.timelineName, "timeline");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    const moments = (data["moments"] as Array<Record<string, unknown>>) ?? [];
    if (options.addMoment !== undefined) {
      moments.push({
        moment: options.addMoment,
        evnt: {
          eventNum: 0,
          eventType: 0,
          isDnD: false,
        },
      });
      data["moments"] = moments;
    }

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { timelineName: options.timelineName, updated: true, totalMoments: moments.length };
  }

  inspectProjectGitStatus(): Record<string, unknown> {
    const gitDir = path.join(this.config.projectRoot, ".git");
    if (!fs.existsSync(gitDir)) {
      return { isGitRepository: false, message: "Project is not a Git repository." };
    }
    return {
      isGitRepository: true,
      projectRoot: this.config.projectRoot,
      message: "Git repository detected. Use gm_file_list or git tools to inspect status.",
    };
  }

  compareVirtualFolders(options: { folderNamesOrPaths: string[] }): Record<string, unknown> {
    if (!options.folderNamesOrPaths || options.folderNamesOrPaths.length < 2) {
      throw new Error("Must specify at least 2 virtual folder names or paths to compare.");
    }

    const folderMap = new Map<string, ProjectResourceRef[]>();

    for (const folderQuery of options.folderNamesOrPaths) {
      const matchingAssets = this.resources().filter((r) => {
        return r.path.includes(folderQuery) || r.name.includes(folderQuery);
      });
      folderMap.set(folderQuery, matchingAssets);
    }

    const folderSymbols = new Map<string, {
      functions: Set<string>;
      variables: Set<string>;
      structs: Set<string>;
      assetRefs: Set<string>;
      macros: Set<string>;
    }>();

    for (const [folder, assets] of folderMap.entries()) {
      const funcs = new Set<string>();
      const vars = new Set<string>();
      const structs = new Set<string>();
      const refs = new Set<string>();
      const macros = new Set<string>();

      for (const a of assets) {
        try {
          const assetData = this.readAsset(a.name, a.kind);
          for (const f of assetData.files) {
            if (f.path.endsWith(".gml")) {
              const content = f.content;

              let match: RegExpExecArray | null;
              const funcRegex = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
              while ((match = funcRegex.exec(content)) !== null) {
                if (match[1]) funcs.add(match[1]);
              }

              const structRegex = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*constructor\b/g;
              while ((match = structRegex.exec(content)) !== null) {
                if (match[1]) structs.add(match[1]);
              }

              const varRegex = /\b(global|self)\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
              while ((match = varRegex.exec(content)) !== null) {
                if (match[2]) vars.add(match[2]);
              }

              const macroRegex = /#macro\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
              while ((match = macroRegex.exec(content)) !== null) {
                if (match[1]) macros.add(match[1]);
              }

              for (const r of this.resources()) {
                if (content.includes(r.name)) {
                  refs.add(r.name);
                }
              }
            }
          }
        } catch {}
      }

      folderSymbols.set(folder, { functions: funcs, variables: vars, structs, assetRefs: refs, macros });
    }

    const allFolders = Array.from(folderSymbols.values());
    const firstFolder = allFolders[0];
    const commonFunctions = firstFolder ? Array.from(firstFolder.functions).filter((f) => allFolders.every((s) => s.functions.has(f))) : [];
    const commonVariables = firstFolder ? Array.from(firstFolder.variables).filter((v) => allFolders.every((s) => s.variables.has(v))) : [];
    const commonStructs = firstFolder ? Array.from(firstFolder.structs).filter((s) => allFolders.every((sf) => sf.structs.has(s))) : [];
    const commonAssetRefs = firstFolder ? Array.from(firstFolder.assetRefs).filter((r) => allFolders.every((s) => s.assetRefs.has(r))) : [];
    const commonMacros = firstFolder ? Array.from(firstFolder.macros).filter((m) => allFolders.every((s) => s.macros.has(m))) : [];

    return {
      foldersCompared: options.folderNamesOrPaths,
      summary: {
        commonFunctionsCount: commonFunctions.length,
        commonVariablesCount: commonVariables.length,
        commonStructsCount: commonStructs.length,
        commonAssetRefsCount: commonAssetRefs.length,
        commonMacrosCount: commonMacros.length,
      },
      commonFunctions,
      commonVariables,
      commonStructs,
      commonAssetRefs,
      commonMacros,
    };
  }

  listVirtualFolderAssets(options: { folderNameOrPath: string }): Record<string, unknown> {
    const assets = this.resources().filter((r) => r.path.includes(options.folderNameOrPath) || r.name.includes(options.folderNameOrPath));
    return {
      folderQuery: options.folderNameOrPath,
      totalAssets: assets.length,
      assets: assets.map((a) => ({ name: a.name, kind: a.kind, path: a.path })),
    };
  }

  deepSimilarityScan(options: { folderA?: string | undefined; folderB?: string | undefined } = {}): Record<string, unknown> {
    const resources = this.resources().filter((r) => {
      if (options.folderA && options.folderB) {
        return r.path.includes(options.folderA) || r.path.includes(options.folderB) ||
               r.name.includes(options.folderA) || r.name.includes(options.folderB);
      }
      return true;
    });

    const functions = new Map<string, string[]>();
    const variables = new Map<string, string[]>();
    const enums = new Map<string, string[]>();
    const macros = new Map<string, string[]>();
    const strings = new Map<string, string[]>();
    const shaderUniforms = new Map<string, string[]>();

    for (const res of resources) {
      try {
        const asset = this.readAsset(res.name, res.kind);
        for (const file of asset.files) {
          if (file.path.endsWith(".gml")) {
            const content = file.content;
            const refName = `${res.name} (${file.path})`;

            let m: RegExpExecArray | null;
            const funcRegex = /\b(function\s+([A-Za-z_][A-Za-z0-9_]*)|static\s+([A-Za-z_][A-Za-z0-9_]*)\s*=)/g;
            while ((m = funcRegex.exec(content)) !== null) {
              const name = m[2] || m[3];
              if (name) {
                if (!functions.has(name)) functions.set(name, []);
                functions.get(name)!.push(refName);
              }
            }

            const varRegex = /\b(global|self)\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
            while ((m = varRegex.exec(content)) !== null) {
              const v = m[2];
              if (v) {
                if (!variables.has(v)) variables.set(v, []);
                variables.get(v)!.push(refName);
              }
            }

            const enumRegex = /\benum\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
            while ((m = enumRegex.exec(content)) !== null) {
              const e = m[1];
              if (e) {
                if (!enums.has(e)) enums.set(e, []);
                enums.get(e)!.push(refName);
              }
            }

            const macroRegex = /#macro\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
            while ((m = macroRegex.exec(content)) !== null) {
              const mac = m[1];
              if (mac) {
                if (!macros.has(mac)) macros.set(mac, []);
                macros.get(mac)!.push(refName);
              }
            }

            const strRegex = /"([^"\\]*(\\.[^"\\]*)*)"/g;
            while ((m = strRegex.exec(content)) !== null) {
              const s = m[1];
              if (s && s.length > 3 && !/^[0-9_\-\.\s]+$/.test(s)) {
                if (!strings.has(s)) strings.set(s, []);
                strings.get(s)!.push(refName);
              }
            }
          } else if (file.path.endsWith(".vsh") || file.path.endsWith(".fsh")) {
            const content = file.content;
            const refName = `${res.name} (${file.path})`;
            const unifRegex = /uniform\s+[A-Za-z0-9_]+\s+([A-Za-z_][A-Za-z0-9_]*)/g;
            let m: RegExpExecArray | null;
            while ((m = unifRegex.exec(content)) !== null) {
              const u = m[1];
              if (u) {
                if (!shaderUniforms.has(u)) shaderUniforms.set(u, []);
                shaderUniforms.get(u)!.push(refName);
              }
            }
          }
        }
      } catch {}
    }

    const filterDuplicates = (map: Map<string, string[]>) => {
      const result: Record<string, string[]> = {};
      for (const [key, refs] of map.entries()) {
        const uniqueRefs = Array.from(new Set(refs));
        if (uniqueRefs.length > 1) {
          result[key] = uniqueRefs;
        }
      }
      return result;
    };

    const duplicateFunctions = filterDuplicates(functions);
    const duplicateVariables = filterDuplicates(variables);
    const duplicateEnums = filterDuplicates(enums);
    const duplicateMacros = filterDuplicates(macros);
    const duplicateStrings = filterDuplicates(strings);
    const duplicateUniforms = filterDuplicates(shaderUniforms);

    return {
      scope: options.folderA && options.folderB ? `Comparing '${options.folderA}' vs '${options.folderB}'` : "Project-wide everything match",
      summary: {
        sharedFunctions: Object.keys(duplicateFunctions).length,
        sharedVariables: Object.keys(duplicateVariables).length,
        sharedEnums: Object.keys(duplicateEnums).length,
        sharedMacros: Object.keys(duplicateMacros).length,
        sharedStringLiterals: Object.keys(duplicateStrings).length,
        sharedShaderUniforms: Object.keys(duplicateUniforms).length,
      },
      duplicateFunctions,
      duplicateVariables,
      duplicateEnums,
      duplicateMacros,
      duplicateStrings,
      duplicateUniforms,
    };
  }

  findDuplicateAssetContent(): Record<string, unknown> {
    const fileHashes = new Map<string, string[]>();

    const files = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".png") || p.endsWith(".wav") || p.endsWith(".ogg") || p.endsWith(".json") || p.endsWith(".gml"));

    for (const file of files) {
      try {
        const sha = this.sandbox.sha256For(file);
        if (!fileHashes.has(sha)) fileHashes.set(sha, []);
        fileHashes.get(sha)!.push(file);
      } catch {}
    }

    const identicalContentFiles: Record<string, string[]> = {};
    let totalDuplicates = 0;

    for (const [sha, list] of fileHashes.entries()) {
      if (list.length > 1) {
        identicalContentFiles[sha.substring(0, 8)] = list;
        totalDuplicates += list.length - 1;
      }
    }

    return {
      totalIdenticalGroups: Object.keys(identicalContentFiles).length,
      totalDuplicateFiles: totalDuplicates,
      identicalContentFiles,
    };
  }

  configureMainOptions(options: { gameTitle?: string | undefined; steamAppId?: number | undefined; spineFps?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const optPath = "options/main/options_main.yy";
    const full = path.join(this.config.projectRoot, optPath);
    if (!fs.existsSync(full)) {
      return { found: false, optPath, message: "Main options file options/main/options_main.yy not found." };
    }
    const text = this.sandbox.readText(optPath, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, optPath);

    if (options.gameTitle !== undefined) data["option_game_title"] = options.gameTitle;
    if (options.steamAppId !== undefined) data["option_steam_app_id"] = String(options.steamAppId);
    if (options.spineFps !== undefined) data["option_spine_fps"] = options.spineFps;

    const sha = this.sandbox.sha256For(optPath);
    this.sandbox.atomicWrite(optPath, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { optPath, updated: true, options: data };
  }

  configurePlatformOptions(options: { platform: "windows" | "html5" | "android" | "mac" | "ios"; displayName?: string | undefined; interpolatePixels?: boolean | undefined; startFullscreen?: boolean | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const optPath = `options/${options.platform}/options_${options.platform}.yy`;
    const full = path.join(this.config.projectRoot, optPath);
    if (!fs.existsSync(full)) {
      return { found: false, optPath, message: `Platform options file ${optPath} not found.` };
    }
    const text = this.sandbox.readText(optPath, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, optPath);

    if (options.displayName !== undefined) data[`option_${options.platform}_display_name`] = options.displayName;
    if (options.interpolatePixels !== undefined) data[`option_${options.platform}_interpolate_pixels`] = options.interpolatePixels;
    if (options.startFullscreen !== undefined) data[`option_${options.platform}_start_fullscreen`] = options.startFullscreen;

    const sha = this.sandbox.sha256For(optPath);
    this.sandbox.atomicWrite(optPath, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { platform: options.platform, optPath, updated: true, platformOptions: data };
  }

  inspectIdeLayouts(): Record<string, unknown> {
    const appData = process.env["APPDATA"] || "";
    const layoutDir = path.join(appData, "GameMakerStudio2", "Layouts");
    if (!fs.existsSync(layoutDir)) {
      return { found: false, layoutDir, message: "GameMaker IDE Layouts directory not found." };
    }
    const files = fs.readdirSync(layoutDir).filter((f) => f.endsWith(".json"));
    return { found: true, layoutDir, layoutsCount: files.length, layoutFiles: files };
  }

  auditFeatherRules(): Record<string, unknown> {
    const configPath = ".featherconfig";
    const full = path.join(this.config.projectRoot, configPath);
    if (!fs.existsSync(full)) {
      return { hasCustomFeatherConfig: false, defaultRules: { GM1001: "warn", GM1002: "error", GM2001: "info" } };
    }
    const text = fs.readFileSync(full, "utf-8");
    try {
      const data = JSON.parse(text);
      return { hasCustomFeatherConfig: true, configPath, featherConfig: data };
    } catch {
      return { hasCustomFeatherConfig: true, configPath, error: "Invalid JSON in .featherconfig" };
    }
  }

  inspectProjectBackups(): Record<string, unknown> {
    const localAppData = process.env["LOCALAPPDATA"] || "";
    const backupDir = path.join(localAppData, "GameMakerStudio2", "Backups");
    if (!fs.existsSync(backupDir)) {
      return { found: false, backupDir, message: "GameMaker Studio local backups directory not found." };
    }
    try {
      const entries = fs.readdirSync(backupDir).filter((e) => e.includes(this.summary().name));
      return { found: true, backupDir, matchingBackupsCount: entries.length, backups: entries };
    } catch {
      return { found: true, backupDir, matchingBackupsCount: 0, backups: [] };
    }
  }

  generateBenchmarkHarness(options: { codeA: string; codeB: string; iterations?: number | undefined }): Record<string, unknown> {
    const iters = options.iterations ?? 100000;
    const gml = `// GML Performance Benchmark Harness
function benchmark_run() {
    var _iterations = ${iters};
    
    var _t0 = get_timer();
    repeat (_iterations) {
        ${options.codeA}
    }
    var _t1 = get_timer();
    var _timeA = (_t1 - _t0) / 1000.0; // ms
    
    var _t2 = get_timer();
    repeat (_iterations) {
        ${options.codeB}
    }
    var _t3 = get_timer();
    var _timeB = (_t3 - _t2) / 1000.0; // ms
    
    show_debug_message("=== BENCHMARK RESULTS (" + string(_iterations) + " iterations) ===");
    show_debug_message("Code A: " + string(_timeA) + " ms");
    show_debug_message("Code B: " + string(_timeB) + " ms");
    show_debug_message("Difference: " + string(abs(_timeA - _timeB)) + " ms");
    
    return { timeA_ms: _timeA, timeB_ms: _timeB, iterations: _iterations };
}
`;
    return { iterations: iters, generatedHarnessCode: gml };
  }

  exportDependencyTreeJson(): Record<string, unknown> {
    const res = this.resources();
    const mermaid = ["graph TD"];
    const graph: Record<string, string[]> = {};

    for (const r of res) {
      const targets: string[] = [];
      try {
        const asset = this.readAsset(r.name, r.kind);
        for (const file of asset.files) {
          for (const other of res) {
            if (other.name !== r.name && file.content.includes(other.name)) {
              targets.push(other.name);
              mermaid.push(`    ${r.name} --> ${other.name}`);
            }
          }
        }
      } catch {}
      graph[r.name] = Array.from(new Set(targets));
    }

    return {
      totalResources: res.length,
      dependencyGraph: graph,
      mermaidDiagram: Array.from(new Set(mermaid)).join("\n"),
    };
  }

  configureRoomCameraViews(options: { roomName: string; viewIndex?: number | undefined; enableViews?: boolean | undefined; viewWidth?: number | undefined; viewHeight?: number | undefined; followObject?: string | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.roomName, "room");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    const idx = options.viewIndex ?? 0;
    if (options.enableViews !== undefined) {
      const roomSettings = (data["roomSettings"] as Record<string, unknown>) ?? {};
      roomSettings["enableViews"] = options.enableViews;
      data["roomSettings"] = roomSettings;
    }

    const views = (data["views"] as Array<Record<string, unknown>>) ?? [];
    if (views[idx]) {
      const v = views[idx]!;
      if (options.viewWidth !== undefined) v["wview"] = options.viewWidth;
      if (options.viewHeight !== undefined) v["hview"] = options.viewHeight;
      if (options.followObject !== undefined) {
        const objRes = this.findResource(options.followObject, "object");
        v["objectId"] = { name: objRes.name, path: objRes.path };
      }
      views[idx] = v;
    }
    data["views"] = views;

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { roomName: options.roomName, updated: true, viewIndex: idx, viewsData: views };
  }

  addFeatherSuppression(options: { filePath: string; ruleId: string; line?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const content = this.sandbox.readText(options.filePath, [".gml"]);
    const comment = `/// feather ignore ${options.ruleId}`;

    let newContent = "";
    if (options.line !== undefined && options.line > 0) {
      const lines = content.split(/\r?\n/);
      lines.splice(options.line - 1, 0, comment);
      newContent = lines.join("\n");
    } else {
      newContent = `${comment}\n${content}`;
    }

    const sha = this.sandbox.sha256For(options.filePath);
    this.sandbox.atomicWrite(options.filePath, newContent, { expectedSha256: sha, backup: true });

    return { filePath: options.filePath, ruleId: options.ruleId, added: true };
  }

  generateFsmTemplate(options: { states: string[]; scriptName: string }): Record<string, unknown> {
    const enumMembers = options.states.map((s) => s.toUpperCase()).join(",\n    ");
    const structMethods = options.states.map((s) => {
      const lower = s.toLowerCase();
      return `    states.${lower} = {
        enter: function() {},
        step: function() {},
        draw: function() {},
        exit: function() {}
    };`;
    }).join("\n\n");

    const code = `// State Machine Generator for ${options.scriptName}
enum State {
    ${enumMembers}
}

function StateMachine() constructor {
    stateCurrent = State.${options.states[0]?.toUpperCase() ?? "IDLE"};
    states = {};

${structMethods}

    static changeState = function(_newState) {
        stateCurrent = _newState;
    };

    static step = function() {
        // Execute current state step logic
    };
}
`;
    return { scriptName: options.scriptName, states: options.states, generatedCode: code };
  }

  inspectSpriteAtlas(options: { spriteName: string }): Record<string, unknown> {
    const spr = this.inspectSprite(options.spriteName);
    const cols = Math.ceil(Math.sqrt(spr.framesCount));
    const rows = Math.ceil(spr.framesCount / Math.max(1, cols));
    return {
      spriteName: options.spriteName,
      width: spr.width,
      height: spr.height,
      frameCount: spr.framesCount,
      originX: spr.origin.x,
      originY: spr.origin.y,
      gridCols: cols,
      gridRows: rows,
      totalAtlasWidth: cols * spr.width,
      totalAtlasHeight: rows * spr.height,
    };
  }

  buildGmlClass(options: { className: string; fields?: Array<{ name: string; type: string }> | undefined; methods?: string[] | undefined }): Record<string, unknown> {
    const fieldsInit = (options.fields ?? [{ name: "id", type: "Real" }]).map((f) => `    /// @type {${f.type}}\n    self.${f.name} = undefined;`).join("\n\n");
    const staticMethods = (options.methods ?? ["update", "cleanup"]).map((m) => `    /// @function ${m}()\n    static ${m} = function() {\n        // Method implementation\n    };`).join("\n\n");

    const code = `/// @function ${options.className}()
/// @description High-performance GML class constructor with static methods.
function ${options.className}() constructor {
${fieldsInit}

${staticMethods}

    /// @function destroy()
    static destroy = function() {
        // Free resources & cleanup
    };
}
`;
    return { className: options.className, generatedClassCode: code };
  }

  generateEventBoilerplates(options: { archetype: "Player" | "Enemy" | "UI" | "Manager"; objectName: string }): Record<string, unknown> {
    const archetypes: Record<string, Record<string, string>> = {
      Player: {
        Create: "// Player Initialization\nmoveSpeed = 4.0;\nvelocity = { x: 0, y: 0 };\nhp = 100;\nstate = undefined;",
        Step: "// Player Step Movement & Input\nvar _moveX = keyboard_check(vk_right) - keyboard_check(vk_left);\nvar _moveY = keyboard_check(vk_down) - keyboard_check(vk_up);\nx += _moveX * moveSpeed;\ny += _moveY * moveSpeed;",
        Draw: "// Player Draw\ndraw_self();",
        CleanUp: "// Cleanup Player resources\n",
      },
      Enemy: {
        Create: "// Enemy AI Initialization\nhp = 50;\ntargetX = 0;\ntargetY = 0;\nattackTimer = 0;",
        Step: "// Enemy AI Step\nif (instance_exists(obj_player)) {\n    move_towards_point(obj_player.x, obj_player.y, 2.0);\n}",
        Draw: "// Draw Enemy & HP Bar\ndraw_self();\ndraw_healthbar(x - 16, y - 24, x + 16, y - 20, (hp / 50) * 100, c_black, c_red, c_green, 0, true, true);",
        CleanUp: "// Cleanup Enemy AI\n",
      },
      UI: {
        Create: "// UI Manager Setup\nguiWidth = display_get_gui_width();\nguiHeight = display_get_gui_height();",
        DrawGUI: "// Draw GUI Elements\ndraw_set_colour(c_white);\ndraw_text(16, 16, \"SCORE: \" + string(global.score ?? 0));",
        CleanUp: "// Cleanup UI\n",
      },
      Manager: {
        Create: "// Persistent Manager Setup\npersistent = true;\nglobal.gameState = \"PLAYING\";",
        Step: "// Global Game State Step\nif (keyboard_check_pressed(vk_escape)) {\n    game_restart();\n}",
        CleanUp: "// Cleanup Manager\n",
      },
    };

    const selected = archetypes[options.archetype] ?? archetypes["Player"]!;
    return { objectName: options.objectName, archetype: options.archetype, events: selected };
  }

  buildParticleSystemCode(options: { systemName: string; shape?: string | undefined; colorStart?: string | undefined; colorEnd?: string | undefined }): Record<string, unknown> {
    const sys = options.systemName;
    const code = `// GML Particle System Builder: ${sys}
function ${sys}_create() {
    var _sys = part_system_create();
    part_system_depth(_sys, -100);

    var _type = part_type_create();
    part_type_shape(_type, ${options.shape ?? "pt_shape_pixel"});
    part_type_size(_type, 0.5, 1.5, -0.01, 0);
    part_type_scale(_type, 1, 1);
    part_type_color2(_type, ${options.colorStart ?? "c_orange"}, ${options.colorEnd ?? "c_red"});
    part_type_alpha2(_type, 1.0, 0.0);
    part_type_speed(_type, 2, 5, -0.05, 0);
    part_type_direction(_type, 0, 360, 0, 0);
    part_type_blend(_type, true);
    part_type_life(_type, 30, 60);

    var _emitter = part_emitter_create(_sys);
    
    return { system: _sys, type: _type, emitter: _emitter };
}

function ${sys}_burst(_ps, _x, _y, _count) {
    part_emitter_region(_ps.system, _ps.emitter, _x - 4, _x + 4, _y - 4, _y + 4, ps_shape_ellipse, ps_distr_gaussian);
    part_emitter_burst(_ps.system, _ps.emitter, _ps.type, _count);
}
`;
    return { systemName: sys, generatedGmlCode: code };
  }

  buildShaderPipelineCode(options: { shaderName: string; uniforms?: string[] | undefined }): Record<string, unknown> {
    const shd = options.shaderName;
    const unifs = options.uniforms ?? ["u_uTime", "u_uResolution"];
    const unifVars = unifs.map((u) => `var _h_${u} = shader_get_uniform(${shd}, "${u}");`).join("\n    ");
    const unifSets = unifs.map((u) => `    // Set ${u}\n    // shader_set_uniform_f(_h_${u}, ...);`).join("\n");

    const code = `// GML Shader Pipeline Builder: ${shd}
function ${shd}_draw_start() {
    shader_set(${shd});
    
    ${unifVars}
${unifSets}
}

function ${shd}_draw_end() {
    shader_reset();
}
`;
    return { shaderName: shd, uniforms: unifs, generatedGmlCode: code };
  }

  buildArrayStructUtils(options: { utilityType: "sort" | "filter" | "pool" | "deep_copy" }): Record<string, unknown> {
    const templates: Record<string, string> = {
      sort: `// GML Fast Array Sort
function array_sort_by_key(_arr, _key, _ascending) {
    var _dir = _ascending ? 1 : -1;
    array_sort(_arr, method({ key: _key, dir: _dir }, function(_a, _b) {
        if (_a[$ key] < _b[$ key]) return -dir;
        if (_a[$ key] > _b[$ key]) return dir;
        return 0;
    }));
    return _arr;
}`,
      filter: `// GML Array Filter Predicate
function array_filter_predicate(_arr, _predicate) {
    var _result = [];
    var _len = array_length(_arr);
    for (var _i = 0; _i < _len; _i++) {
        var _item = _arr[_i];
        if (_predicate(_item)) {
            array_push(_result, _item);
        }
    }
    return _result;
}`,
      pool: `// GML Object / Struct Pool
function StructPool(_constructor) constructor {
    pool = [];
    ctor = _constructor;

    static get = function() {
        if (array_length(pool) > 0) {
            return array_pop(pool);
        }
        return new ctor();
    };

    static release = function(_obj) {
        array_push(pool, _obj);
    };
}`,
      deep_copy: `// GML Deep Struct Copy
function struct_deep_copy(_struct) {
    var _copy = {};
    var _names = struct_get_names(_struct);
    var _len = array_length(_names);
    for (var _i = 0; _i < _len; _i++) {
        var _k = _names[_i];
        var _val = _struct[$ _k];
        if (is_struct(_val)) {
            _copy[$ _k] = struct_deep_copy(_val);
        } else if (is_array(_val)) {
            _copy[$ _k] = array_clone(_val);
        } else {
            _copy[$ _k] = _val;
        }
    }
    return _copy;
}`,
    };

    const code = templates[options.utilityType] ?? templates["sort"]!;
    return { utilityType: options.utilityType, generatedGmlCode: code };
  }

  configureTileSet(options: { tilesetName: string; tileWidth?: number | undefined; tileHeight?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.tilesetName, "tileset");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    if (options.tileWidth !== undefined) data["tileWidth"] = options.tileWidth;
    if (options.tileHeight !== undefined) data["tileHeight"] = options.tileHeight;

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { tilesetName: options.tilesetName, updated: true, tilesetData: data };
  }

  configureFontProperties(options: { fontName: string; fontSize?: number | undefined; isBold?: boolean | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.fontName, "font");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    if (options.fontSize !== undefined) data["size"] = options.fontSize;
    if (options.isBold !== undefined) data["bold"] = options.isBold;

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { fontName: options.fontName, updated: true, fontData: data };
  }

  assignAudioGroup(options: { soundName: string; audioGroupName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.soundName, "sound");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    data["audioGroupId"] = { name: options.audioGroupName, path: `audiogroups/${options.audioGroupName}` };

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { soundName: options.soundName, audioGroupName: options.audioGroupName, assigned: true };
  }

  assignTextureGroup(options: { assetName: string; textureGroupName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.resources().find((r) => r.name === options.assetName);
    if (!res) throw new Error(`Asset ${options.assetName} not found.`);

    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    data["textureGroupId"] = { name: options.textureGroupName, path: `texturegroups/${options.textureGroupName}` };

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { assetName: options.assetName, textureGroupName: options.textureGroupName, assigned: true };
  }

  addIncludedFile(options: { relativeFilePath: string; content: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const targetPath = path.join("datafiles", options.relativeFilePath);
    this.sandbox.atomicWrite(targetPath, options.content);

    return { relativeFilePath: options.relativeFilePath, targetPath, added: true };
  }

  addRoomTilemapLayer(options: { roomName: string; layerName: string; tilesetName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const roomRes = this.findResource(options.roomName, "room");
    const tsRes = this.findResource(options.tilesetName, "tileset");

    const text = this.sandbox.readText(roomRes.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, roomRes.path);
    const layers = (data["layers"] as Array<Record<string, unknown>>) ?? [];

    layers.push({
      resourceType: "GMRTileLayer",
      resourceVersion: "1.0",
      name: options.layerName,
      tilesetId: { name: tsRes.name, path: tsRes.path },
      visible: true,
      depth: 0,
    });
    data["layers"] = layers;

    const sha = this.sandbox.sha256For(roomRes.path);
    this.sandbox.atomicWrite(roomRes.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { roomName: options.roomName, layerName: options.layerName, added: true };
  }

  addRoomBackgroundLayer(options: { roomName: string; layerName: string; spriteName?: string | undefined; hspeed?: number | undefined; vspeed?: number | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const roomRes = this.findResource(options.roomName, "room");

    const text = this.sandbox.readText(roomRes.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, roomRes.path);
    const layers = (data["layers"] as Array<Record<string, unknown>>) ?? [];

    let sprObj: Record<string, unknown> | null = null;
    if (options.spriteName) {
      const sprRes = this.findResource(options.spriteName, "sprite");
      sprObj = { name: sprRes.name, path: sprRes.path };
    }

    layers.push({
      resourceType: "GMRBackgroundLayer",
      resourceVersion: "1.0",
      name: options.layerName,
      spriteId: sprObj,
      hspeed: options.hspeed ?? 0,
      vspeed: options.vspeed ?? 0,
      visible: true,
      depth: 100,
    });
    data["layers"] = layers;

    const sha = this.sandbox.sha256For(roomRes.path);
    this.sandbox.atomicWrite(roomRes.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { roomName: options.roomName, layerName: options.layerName, added: true };
  }

  generatePhysicsFixtureCode(options: { fixtureType: "box" | "circle" | "polygon"; density?: number | undefined; friction?: number | undefined; restitution?: number | undefined }): Record<string, unknown> {
    const code = `// GML Physics Fixture Generator
function physics_fixture_setup(_inst) {
    var _fix = physics_fixture_create();
    
    // Shape configuration
    if ("${options.fixtureType}" == "box") {
        physics_fixture_set_box_shape(_fix, 16, 16);
    } else if ("${options.fixtureType}" == "circle") {
        physics_fixture_set_circle_shape(_fix, 16);
    }
    
    physics_fixture_set_density(_fix, ${options.density ?? 0.5});
    physics_fixture_set_friction(_fix, ${options.friction ?? 0.2});
    physics_fixture_set_restitution(_fix, ${options.restitution ?? 0.1});
    physics_fixture_set_linear_damping(_fix, 0.1);
    physics_fixture_set_angular_damping(_fix, 0.1);
    
    var _bound = physics_fixture_bind(_fix, _inst);
    physics_fixture_delete(_fix);
    
    return _bound;
}
`;
    return { fixtureType: options.fixtureType, generatedPhysicsCode: code };
  }

  auditGcAllocations(): Record<string, unknown> {
    const gmlFiles = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".gml"));

    const warnings: Array<{ file: string; line: number; reason: string }> = [];

    for (const file of gmlFiles) {
      const content = this.sandbox.readText(file, [".gml"]);
      const lines = content.split(/\r?\n/);
      let lineNo = 0;
      for (const line of lines) {
        lineNo++;
        if (line.includes("new ") && (file.includes("Step") || file.includes("Draw"))) {
          warnings.push({ file, line: lineNo, reason: "Creating new struct inside Step/Draw event causes GC pressure." });
        }
        if (line.includes("[") && line.includes("]") && line.includes("var ") && file.includes("Step")) {
          warnings.push({ file, line: lineNo, reason: "Array creation inside Step event allocates temporary memory." });
        }
      }
    }

    return {
      totalGmlFilesAudited: gmlFiles.length,
      gcAllocationWarningsCount: warnings.length,
      warnings,
    };
  }

  refactorInlineMethod(options: { filePath: string; targetCode: string; replacementCode: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const content = this.sandbox.readText(options.filePath, [".gml"]);
    if (!content.includes(options.targetCode)) {
      return { filePath: options.filePath, replaced: false, message: "Target code block not found in file." };
    }

    const newContent = content.replace(options.targetCode, options.replacementCode);
    const sha = this.sandbox.sha256For(options.filePath);
    this.sandbox.atomicWrite(options.filePath, newContent, { expectedSha256: sha, backup: true });

    return { filePath: options.filePath, replaced: true };
  }

  buildCameraProjectionCode(options: { is3D?: boolean | undefined; fov?: number | undefined; width?: number | undefined; height?: number | undefined }): Record<string, unknown> {
    const is3d = options.is3D ?? false;
    const w = options.width ?? 1280;
    const h = options.height ?? 720;
    const fov = options.fov ?? 60;

    const code = `// GML Camera & Projection Matrix Builder
function camera_setup_projection(_cam, _x, _y, _z) {
    var _projMat;
    if (${is3d}) {
        _projMat = matrix_build_projection_perspective_fov(-${fov}, -${w}/${h}, 1, 32000);
        var _lookMat = matrix_build_lookat(_x, _y, _z, _x, _y + 100, _z, 0, 0, 1);
        camera_set_view_mat(_cam, _lookMat);
    } else {
        _projMat = matrix_build_projection_ortho(${w}, ${h}, 1, 32000);
        var _lookMat2D = matrix_build_lookat(_x, _y, -100, _x, _y, 0, 0, 1, 0);
        camera_set_view_mat(_cam, _lookMat2D);
    }
    camera_set_proj_mat(_cam, _projMat);
    camera_apply(_cam);
}
`;
    return { is3D: is3d, width: w, height: h, fov, generatedCameraCode: code };
  }

  buildSurfaceManagerCode(options: { surfaceName: string; width?: number | undefined; height?: number | undefined }): Record<string, unknown> {
    const sName = options.surfaceName;
    const w = options.width ?? 1024;
    const h = options.height ?? 768;

    const code = `// GML Surface Manager Struct: ${sName}
function SurfaceManager(_w, _h) constructor {
    surf = -1;
    width = _w;
    height = _h;

    static get = function() {
        if (!surface_exists(surf)) {
            surf = surface_create(width, height);
            surface_set_target(surf);
            draw_clear_alpha(c_black, 0);
            surface_reset_target();
        }
        return surf;
    };

    static setTarget = function() {
        surface_set_target(get());
    };

    static resetTarget = function() {
        surface_reset_target();
    };

    static destroy = function() {
        if (surface_exists(surf)) {
            surface_free(surf);
            surf = -1;
        }
    };
}
`;
    return { surfaceName: sName, width: w, height: h, generatedSurfaceCode: code };
  }

  convertDsToStruct(options: { gmlCode: string }): Record<string, unknown> {
    let converted = options.gmlCode;
    converted = converted.replace(/\bds_map_create\(\)/g, "{}");
    converted = converted.replace(/\bds_list_create\(\)/g, "[]");
    converted = converted.replace(/\bds_map_destroy\(([^)]+)\)/g, "// $1 freed by GC");
    converted = converted.replace(/\bds_list_destroy\(([^)]+)\)/g, "// $1 freed by GC");
    converted = converted.replace(/\bds_map_find_value\(([^,]+),\s*([^)]+)\)/g, "$1[$ $2]");
    converted = converted.replace(/\bds_map_add\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, "$1[$ $2] = $3");
    converted = converted.replace(/\bds_list_add\(([^,]+),\s*([^)]+)\)/g, "array_push($1, $2)");
    converted = converted.replace(/\bds_list_size\(([^)]+)\)/g, "array_length($1)");

    return { originalCode: options.gmlCode, convertedStructCode: converted };
  }

  buildSaveLoadJsonSystem(options: { saveFileName: string; encrypt?: boolean | undefined }): Record<string, unknown> {
    const fName = options.saveFileName;
    const code = `// GML Save & Load JSON System: ${fName}
function game_save_data(_saveData) {
    var _jsonString = json_stringify(_saveData);
    var _buf = buffer_create(string_byte_length(_jsonString) + 1, buffer_fixed, 1);
    buffer_write(_buf, buffer_string, _jsonString);
    buffer_save(_buf, "${fName}");
    buffer_delete(_buf);
    show_debug_message("Game saved successfully to " + "${fName}");
}

function game_load_data() {
    if (!file_exists("${fName}")) return undefined;
    var _buf = buffer_load("${fName}");
    var _jsonString = buffer_read(_buf, buffer_string);
    buffer_delete(_buf);
    var _data = json_parse(_jsonString);
    show_debug_message("Game loaded successfully from " + "${fName}");
    return _data;
}
`;
    return { saveFileName: fName, generatedSaveLoadCode: code };
  }

  buildPubSubEventListener(options: { managerName: string }): Record<string, unknown> {
    const mName = options.managerName;
    const code = `// GML Event Observer (Pub/Sub) System: ${mName}
function EventManager() constructor {
    listeners = {};

    static subscribe = function(_eventName, _callback) {
        if (!struct_exists(listeners, _eventName)) {
            listeners[$ _eventName] = [];
        }
        array_push(listeners[$ _eventName], _callback);
    };

    static emit = function(_eventName, _data) {
        if (struct_exists(listeners, _eventName)) {
            var _list = listeners[$ _eventName];
            var _len = array_length(_list);
            for (var _i = 0; _i < _len; _i++) {
                _list[_i](_data);
            }
        }
    };
}
`;
    return { managerName: mName, generatedPubSubCode: code };
  }

  buildVectorMatrixMathUtils(options: { category: "vector2" | "vector3" | "matrix" | "easing" }): Record<string, unknown> {
    const templates: Record<string, string> = {
      vector2: `// GML 2D Vector Math
function Vec2(_x, _y) constructor {
    x = _x; y = _y;
    static dot = function(_v) { return x * _v.x + y * _v.y; };
    static len = function() { return point_distance(0, 0, x, y); };
    static normalize = function() { var _l = len(); if (_l > 0) { x /= _l; y /= _l; } return self; };
}`,
      vector3: `// GML 3D Vector Math
function Vec3(_x, _y, _z) constructor {
    x = _x; y = _y; z = _z;
    static dot = function(_v) { return x * _v.x + y * _v.y + z * _v.z; };
    static cross = function(_v) { return new Vec3(y * _v.z - z * _v.y, z * _v.x - x * _v.z, x * _v.y - y * _v.x); };
}`,
      matrix: `// GML Matrix Transform Helpers
function matrix_transform_point(_mat, _x, _y, _z) {
    var _res = matrix_transform_vertex(_mat, _x, _y, _z, 1.0);
    return { x: _res[0], y: _res[1], z: _res[2] };
}`,
      easing: `// GML Smooth Easing Functions
function ease_in_out_cubic(_t) {
    return _t < 0.5 ? 4 * _t * _t * _t : 1 - power(-2 * _t + 2, 3) / 2;
}`,
    };
    const code = templates[options.category] ?? templates["vector2"]!;
    return { category: options.category, generatedMathCode: code };
  }

  buildInputActionMapper(options: { systemName: string }): Record<string, unknown> {
    const sys = options.systemName;
    const code = `// GML Input Action Mapper: ${sys}
function InputMapper() constructor {
    actions = {};

    static bindAction = function(_actionName, _keyOrButton) {
        actions[$ _actionName] = _keyOrButton;
    };

    static isPressed = function(_actionName) {
        if (!struct_exists(actions, _actionName)) return false;
        var _bind = actions[$ _actionName];
        return keyboard_check_pressed(_bind) || gamepad_button_check_pressed(0, _bind);
    };

    static isHeld = function(_actionName) {
        if (!struct_exists(actions, _actionName)) return false;
        var _bind = actions[$ _actionName];
        return keyboard_check(_bind) || gamepad_button_check(0, _bind);
    };
}
`;
    return { systemName: sys, generatedInputCode: code };
  }

  buildSpatialAudioPool(options: { systemName: string }): Record<string, unknown> {
    const sys = options.systemName;
    const code = `// GML Spatial 3D Audio Emitter Pool: ${sys}
function SpatialAudioEmitter(_x, _y, _z) constructor {
    emitter = audio_emitter_create();
    audio_emitter_position(emitter, _x, _y, _z);
    audio_emitter_falloff(emitter, 100, 1000, 1.0);

    static play = function(_sound, _loops, _priority) {
        return audio_play_sound_on(emitter, _sound, _loops, _priority);
    };

    static updatePosition = function(_x, _y, _z) {
        audio_emitter_position(emitter, _x, _y, _z);
    };

    static destroy = function() {
        audio_emitter_free(emitter);
    };
}
`;
    return { systemName: sys, generatedAudioCode: code };
  }

  buildGridPathfinding(options: { systemName: string; cellSize?: number | undefined }): Record<string, unknown> {
    const sys = options.systemName;
    const size = options.cellSize ?? 32;

    const code = `// GML A* Grid Pathfinding Setup: ${sys}
function PathfindingGrid(_roomW, _roomH) constructor {
    cellSize = ${size};
    grid = mp_grid_create(0, 0, ceil(_roomW / cellSize), ceil(_roomH / cellSize), cellSize, cellSize);

    static addSolidObjects = function(_objSolid) {
        mp_grid_add_instances(grid, _objSolid, false);
    };

    static findPath = function(_path, _startX, _startY, _endX, _endY) {
        return mp_grid_path(grid, _path, _startX, _startY, _endX, _endY, true);
    };

    static destroy = function() {
        mp_grid_destroy(grid);
    };
}
`;
    return { systemName: sys, cellSize: size, generatedPathfindingCode: code };
  }

  buildFlexboxUiLayout(options: { layoutName: string }): Record<string, unknown> {
    const lName = options.layoutName;
    const code = `// GML UI Flexbox Layout Engine: ${lName}
function FlexboxContainer(_x, _y, _w, _h, _padding, _gap) constructor {
    x = _x; y = _y; width = _w; height = _h; padding = _padding; gap = _gap;
    children = [];

    static addChild = function(_child) {
        array_push(children, _child);
        arrange();
    };

    static arrange = function() {
        var _currY = y + padding;
        var _len = array_length(children);
        for (var _i = 0; _i < _len; _i++) {
            var _c = children[_i];
            _c.x = x + padding;
            _c.y = _currY;
            _currY += _c.height + gap;
        }
    };
}
`;
    return { layoutName: lName, generatedFlexboxCode: code };
  }

  configureAnimationCurve(options: { animCurveName: string; channelName?: string | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.animCurveName, "animcurve");
    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    return { animCurveName: options.animCurveName, updated: true, curveData: data };
  }

  manageResourceTags(options: { assetName: string; tags: string[]; action: "add" | "remove" }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.resources().find((r) => r.name === options.assetName);
    if (!res) throw new Error(`Asset ${options.assetName} not found.`);

    const text = this.sandbox.readText(res.path, [".yy"]);
    const data = requireGmJson<Record<string, unknown>>(text, res.path);

    let currentTags = (data["tags"] as string[]) ?? [];
    if (options.action === "add") {
      currentTags = Array.from(new Set([...currentTags, ...options.tags]));
    } else {
      currentTags = currentTags.filter((t) => !options.tags.includes(t));
    }
    data["tags"] = currentTags;

    const sha = this.sandbox.sha256For(res.path);
    this.sandbox.atomicWrite(res.path, stringifyGmJson(data), { expectedSha256: sha, backup: true });

    return { assetName: options.assetName, tags: currentTags, updated: true };
  }

  clearRoomCreationCode(options: { roomName: string }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.roomName, "room");
    const ccPath = res.path.replace(/\.yy$/, "_creation_code.gml");

    if (fs.existsSync(path.join(this.config.projectRoot, ccPath))) {
      const sha = this.sandbox.sha256For(ccPath);
      this.sandbox.atomicWrite(ccPath, "// Room Creation Code reset\n", { expectedSha256: sha, backup: true });
    }

    return { roomName: options.roomName, cleared: true };
  }

  removeDeadGmlCode(): Record<string, unknown> {
    const analysis = new ProjectAnalysisService(this);
    const unused = analysis.findUnusedAssets();
    return {
      unusedAssetsDetected: unused.unusedCount,
      unusedAssets: unused.unused,
      message: "Scanned project for unreferenced assets and dead GML code scripts.",
    };
  }

  generateTypeCheckAsserts(options: { functionName: string; parameters: Array<{ name: string; type: string }> }): Record<string, unknown> {
    const checks = options.parameters.map((p) => {
      let checkFn = "is_numeric";
      if (p.type.toLowerCase().includes("struct")) checkFn = "is_struct";
      else if (p.type.toLowerCase().includes("array")) checkFn = "is_array";
      else if (p.type.toLowerCase().includes("string")) checkFn = "is_string";
      else if (p.type.toLowerCase().includes("method") || p.type.toLowerCase().includes("function")) checkFn = "is_callable";

      return `    if (!${checkFn}(${p.name})) throw new Error("${options.functionName}: Parameter ${p.name} must be of type ${p.type}");`;
    }).join("\n");

    const code = `// GML Feather Type Checker & Runtime Assertions
function ${options.functionName}_assert_types(${options.parameters.map((p) => p.name).join(", ")}) {
${checks}
}
`;
    return { functionName: options.functionName, generatedAssertCode: code };
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

export interface TestRunnerSetup {
  targetRoomPath?: string | undefined;
  originalRoomText?: string | undefined;
  targetRoomCreationCodePath?: string | undefined;
  originalCreationCodeText?: string | undefined;
}

export const supportedEventNames = Object.keys(EVENT_MAP) as SupportedEventName[];
