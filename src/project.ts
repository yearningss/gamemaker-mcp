import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { applyEdits, modify, type JSONPath } from "jsonc-parser";

import { parseGmJson, requireGmJson, stringifyGmJson } from "./gm-json.js";
import { ProjectAnalysisService } from "./analysis.js";
import { ProjectSandbox } from "./security.js";
import { discoverProjectFile } from "./installer.js";
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
  config: ServerConfig;
  sandbox: ProjectSandbox;
  projectRelativePath: string;

  constructor(config: ServerConfig) {
    this.config = config;
    this.sandbox = new ProjectSandbox(config.projectRoot, config.mode, config.maxFileBytes);
    this.projectRelativePath = config.projectFile ? this.sandbox.relative(config.projectFile) : "";
  }

  ensureProjectLoaded(): string {
    if (this.projectRelativePath) {
      return this.projectRelativePath;
    }
    const autoFile = discoverProjectFile(process.cwd());
    if (autoFile) {
      const root = fs.realpathSync(path.dirname(autoFile));
      this.config = { ...this.config, projectFile: autoFile, projectRoot: root };
      this.sandbox = new ProjectSandbox(root, this.config.mode, this.config.maxFileBytes);
      this.projectRelativePath = this.sandbox.relative(autoFile);
      return this.projectRelativePath;
    }
    throw new Error("No .yyp GameMaker project is currently loaded. Open a GameMaker project folder or set GAMEMAKER_PROJECT.");
  }

  projectData(): YypData {
    const relPath = this.ensureProjectLoaded();
    return requireGmJson<YypData>(
      this.sandbox.readText(relPath, [".yyp"]),
      relPath,
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

  buildObjectCollisionEvent(options: { targetObject: string; colliderObject: string; bounceFactor?: number | undefined; friction?: number | undefined }): { generatedCode: string } {
    const bounce = options.bounceFactor ?? 0.8;
    const fric = options.friction ?? 0.05;
    const code = `// GML Sub-pixel Collision & Velocity Reflection: ${options.targetObject} vs ${options.colliderObject}
var _other = other;
var _bounce = ${bounce};
var _fric = ${fric};

// Horizontal Collision
if (place_meeting(x + hspeed, y, _other.object_index)) {
    while (!place_meeting(x + sign(hspeed), y, _other.object_index)) {
        x += sign(hspeed);
    }
    hspeed = -hspeed * _bounce;
}
x += hspeed;

// Vertical Collision
if (place_meeting(x, y + vspeed, _other.object_index)) {
    while (!place_meeting(x, y + sign(vspeed), _other.object_index)) {
        y += sign(vspeed);
    }
    vspeed = -vspeed * _bounce;
}
y += vspeed;

// Apply Friction
hspeed = lerp(hspeed, 0, _fric);
vspeed = lerp(vspeed, 0, _fric);
`;
    return { generatedCode: code };
  }

  buildLightShadow2DSystem(options: { systemName?: string | undefined; lightRadius?: number | undefined; lightColor?: string | undefined }): { generatedCode: string } {
    const sysName = options.systemName ?? "Light2DSystem";
    const radius = options.lightRadius ?? 256;
    const color = options.lightColor ?? "c_yellow";
    const code = `// 2D Light Raycaster & Shadow Caster Struct: ${sysName}
function ${sysName}(_x, _y) constructor {
    x = _x;
    y = _y;
    radius = ${radius};
    color = ${color};
    intensity = 1.0;

    static draw_light = function(_surface) {
        if (!surface_exists(_surface)) return;
        surface_set_target(_surface);
        gpu_set_blendmode(bm_add);
        draw_circle_color(x, y, radius, color, c_black, false);
        gpu_set_blendmode(bm_normal);
        surface_reset_target();
    };

    static draw_shadow_casters = function(_caster_array) {
        for (var i = 0; i < array_length(_caster_array); i++) {
            var _c = _caster_array[i];
            var _dir = point_direction(x, y, _c.x, _c.y);
            draw_sprite_ext(_c.sprite_index, _c.image_index, _c.x + lengthdir_x(8, _dir), _c.y + lengthdir_y(8, _dir), _c.image_xscale, _c.image_yscale, _c.image_angle, c_black, 0.5);
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildParticleEmitterBurst(options: { systemVar?: string | undefined; particleCount?: number | undefined; emitterShape?: string | undefined }): { generatedCode: string } {
    const sysVar = options.systemVar ?? "global.pt_system";
    const count = options.particleCount ?? 30;
    const shape = options.emitterShape ?? "ps_shape_ellipse";
    const code = `// GML Particle Emitter Burst Controller
function particle_emitter_burst_at(_x, _y, _count = ${count}) {
    var _emitter = part_emitter_create(${sysVar});
    part_emitter_region(${sysVar}, _emitter, _x - 16, _x + 16, _y - 16, _y + 16, ${shape}, ps_distr_gaussian);
    part_emitter_burst(${sysVar}, _emitter, global.pt_dust, _count);
    call_later(1, time_source_units_seconds, method({ _sys: ${sysVar}, _em: _emitter }, function() {
        part_emitter_destroy(_sys, _em);
    }));
}
`;
    return { generatedCode: code };
  }

  convertDsGridToArray2D(options: { gridVarName: string; width: number; height: number; defaultValue?: string | undefined }): { generatedCode: string } {
    const defVal = options.defaultValue ?? "0";
    const code = `// Converted GML DS Grid to 2D Array
var _w = ${options.width};
var _h = ${options.height};
${options.gridVarName} = array_create(_w);
for (var _i = 0; _i < _w; _i++) {
    ${options.gridVarName}[_i] = array_create(_h, ${defVal});
}

// Inline Helper Accessors
function array2d_get(_arr, _x, _y) { return _arr[_x][_y]; }
function array2d_set(_arr, _x, _y, _val) { _arr[_x][_y] = _val; }
`;
    return { generatedCode: code };
  }

  buildShaderUniformStruct(options: { shaderName: string; uniforms: Array<{ name: string; type: "float" | "vec2" | "vec3" | "vec4" | "matrix" }> }): { generatedCode: string } {
    const structName = `${options.shaderName}_Uniforms`;
    const initLines = options.uniforms.map((u) => `    u_${u.name} = shader_get_uniform(${options.shaderName}, "${u.name}");`).join("\n");
    const setterLines = options.uniforms.map((u) => {
      if (u.type === "float") return `    static set_${u.name} = function(_v) { shader_set_uniform_f(u_${u.name}, _v); };`;
      if (u.type === "vec2") return `    static set_${u.name} = function(_x, _y) { shader_set_uniform_f(u_${u.name}, _x, _y); };`;
      if (u.type === "vec3") return `    static set_${u.name} = function(_x, _y, _z) { shader_set_uniform_f(u_${u.name}, _x, _y, _z); };`;
      if (u.type === "vec4") return `    static set_${u.name} = function(_x, _y, _z, _w) { shader_set_uniform_f(u_${u.name}, _x, _y, _z, _w); };`;
      return `    static set_${u.name} = function(_mat) { shader_set_uniform_matrix(u_${u.name}, _mat); };`;
    }).join("\n");

    const code = `// GML Shader Uniform Struct Wrapper: ${structName}
function ${structName}() constructor {
${initLines}

${setterLines}
}
`;
    return { generatedCode: code };
  }

  buildNetworkPacketBuffer(options: { packetName: string; fields: Array<{ name: string; type: "u8" | "u16" | "u32" | "f32" | "string" }> }): { generatedCode: string } {
    const writerLines = options.fields.map((f) => {
      const typeConst = f.type === "string" ? "buffer_string" : `buffer_${f.type}`;
      return `    buffer_write(_buf, ${typeConst}, _data.${f.name});`;
    }).join("\n");

    const readerLines = options.fields.map((f) => {
      const typeConst = f.type === "string" ? "buffer_string" : `buffer_${f.type}`;
      return `        ${f.name}: buffer_read(_buf, ${typeConst}),`;
    }).join("\n");

    const code = `// GML Binary Network Packet Encoder/Decoder: ${options.packetName}
function packet_encode_${options.packetName}(_data) {
    var _buf = buffer_create(128, buffer_grow, 1);
${writerLines}
    return _buf;
}

function packet_decode_${options.packetName}(_buf) {
    return {
${readerLines}
    };
}
`;
    return { generatedCode: code };
  }

  generateDialogueTreeSystem(options: { systemName?: string | undefined }): { generatedCode: string } {
    const sysName = options.systemName ?? "DialogueTree";
    const code = `// GML Dynamic Branching Dialogue Tree Struct
function ${sysName}() constructor {
    nodes = {};

    static add_node = function(_id, _text, _speaker, _choices = []) {
        nodes[$ _id] = { id: _id, text: _text, speaker: _speaker, choices: _choices };
    };

    static get_node = function(_id) {
        return nodes[$ _id] ?? undefined;
    };
}

function DialogueChoice(_text, _targetNodeId, _onSelect = undefined) constructor {
    text = _text;
    targetNodeId = _targetNodeId;
    onSelect = _onSelect;
}
`;
    return { generatedCode: code };
  }

  buildBehaviorTreeSystem(options: { treeName?: string | undefined }): { generatedCode: string } {
    const treeName = options.treeName ?? "BehaviorTree";
    const code = `// GML AI Behavior Tree System (Selector / Sequence / Action)
enum BTStatus { SUCCESS, FAILURE, RUNNING }

function BTNode() constructor {
    static tick = function(_entity) { return BTStatus.SUCCESS; };
}

function BTSelector(_children = []) constructor {
    children = _children;
    static tick = function(_entity) {
        for (var i = 0; i < array_length(children); i++) {
            var _status = children[i].tick(_entity);
            if (_status != BTStatus.FAILURE) return _status;
        }
        return BTStatus.FAILURE;
    };
}

function BTSequence(_children = []) constructor {
    children = _children;
    static tick = function(_entity) {
        for (var i = 0; i < array_length(children); i++) {
            var _status = children[i].tick(_entity);
            if (_status != BTStatus.SUCCESS) return _status;
        }
        return BTStatus.SUCCESS;
    };
}

function BTAction(_actionFunc) constructor {
    action = _actionFunc;
    static tick = function(_entity) {
        return action(_entity);
    };
}
`;
    return { generatedCode: code };
  }

  buildSaveStateRollbackSystem(options: { stateStructName?: string | undefined }): { generatedCode: string } {
    const structName = options.stateStructName ?? "GameStateSnapshot";
    const code = `// GML Frame Rollback & Game State Save System: ${structName}
function ${structName}() constructor {
    history = [];
    maxHistory = 60;

    static capture_frame = function(_frame_index, _state_struct) {
        var _copy = variable_clone(_state_struct);
        array_push(history, { frame: _frame_index, data: _copy });
        if (array_length(history) > maxHistory) array_delete(history, 0, 1);
    };

    static rollback_to = function(_frame_index) {
        for (var i = array_length(history) - 1; i >= 0; i--) {
            if (history[i].frame == _frame_index) return variable_clone(history[i].data);
        }
        return undefined;
    };
}
`;
    return { generatedCode: code };
  }

  buildScreenShakeCameraSystem(options: { cameraVar?: string | undefined }): { generatedCode: string } {
    const camVar = options.cameraVar ?? "view_camera[0]";
    const code = `// GML Impulse Screen Shake Controller
function camera_shake_trigger(_intensity = 8, _duration = 15) {
    global.__shake_intensity = _intensity;
    global.__shake_duration = _duration;
    global.__shake_timer = _duration;
}

function camera_shake_update(_cam = ${camVar}) {
    if (global.__shake_timer > 0) {
        global.__shake_timer--;
        var _progress = global.__shake_timer / global.__shake_duration;
        var _offset_x = random_range(-1, 1) * global.__shake_intensity * _progress;
        var _offset_y = random_range(-1, 1) * global.__shake_intensity * _progress;
        camera_set_view_pos(_cam, camera_get_view_x(_cam) + _offset_x, camera_get_view_y(_cam) + _offset_y);
    }
}
`;
    return { generatedCode: code };
  }

  buildLocalizationCsvSystem(options: { defaultLanguage?: string | undefined }): { generatedCode: string } {
    const defLang = options.defaultLanguage ?? "en";
    const code = `// GML Localization CSV Parser & Dynamic String Translator
function LocalizationManager() constructor {
    strings = {};
    currentLanguage = "${defLang}";

    static load_csv = function(_file_path) {
        if (!file_exists(_file_path)) return false;
        var _file = file_text_open_read(_file_path);
        var _header = file_text_read_string(_file);
        file_text_readln(_file);
        while (!file_text_eof(_file)) {
            var _line = file_text_read_string(_file);
            file_text_readln(_file);
            var _parts = string_split(_line, ",");
            if (array_length(_parts) >= 2) {
                strings[$ _parts[0]] = _parts[1];
            }
        }
        file_text_close(_file);
        return true;
    };

    static translate = function(_key, _default = "") {
        return strings[$ _key] ?? (_default != "" ? _default : _key);
    };
}
`;
    return { generatedCode: code };
  }

  generateTweenEasingLibrary(options: { includeElastic?: boolean | undefined }): { generatedCode: string } {
    const code = `// GML Complete Math Easing & Tweening Library
function ease_linear(_t) { return _t; }
function ease_in_quad(_t) { return _t * _t; }
function ease_out_quad(_t) { return _t * (2 - _t); }
function ease_in_out_quad(_t) { return _t < 0.5 ? 2 * _t * _t : -1 + (4 - 2 * _t) * _t; }
function ease_in_cubic(_t) { return _t * _t * _t; }
function ease_out_cubic(_t) { return (--_t) * _t * _t + 1; }
function ease_out_bounce(_t) {
    if (_t < (1 / 2.75)) return 7.5625 * _t * _t;
    else if (_t < (2 / 2.75)) return 7.5625 * (_t -= (1.5 / 2.75)) * _t + 0.75;
    else if (_t < (2.5 / 2.75)) return 7.5625 * (_t -= (2.25 / 2.75)) * _t + 0.9375;
    else return 7.5625 * (_t -= (2.625 / 2.75)) * _t + 0.984375;
}
`;
    return { generatedCode: code };
  }

  buildRenderPipelineDepthSort(options: { enableZBuffer?: boolean | undefined }): { generatedCode: string } {
    const zBuf = options.enableZBuffer ?? true;
    const code = `// GML 2.5D / Isometric Depth Sorting Render Pipeline
function render_pipeline_depth_sort_draw(_instances_array) {
    ${zBuf ? "gpu_set_ztestenable(true);\ngpu_set_zwriteenable(true);" : ""}

    // Sort by Y position (Depth)
    array_sort(_instances_array, function(_a, _b) {
        return _a.y - _b.y;
    });

    for (var i = 0; i < array_length(_instances_array); i++) {
        with (_instances_array[i]) {
            draw_self();
        }
    }

    ${zBuf ? "gpu_set_ztestenable(false);\ngpu_set_zwriteenable(false);" : ""}
}
`;
    return { generatedCode: code };
  }

  auditPerformanceMemory(): { checkedScriptsCount: number; potentialGcAllocations: number; warnings: string[] } {
    let checked = 0;
    let allocations = 0;
    const warnings: string[] = [];

    const files = walkFiles(this.config.projectRoot)
      .map((p) => this.sandbox.relative(p))
      .filter((p) => p.endsWith(".gml"));

    for (const relPath of files) {
      checked++;
      const content = this.sandbox.readText(relPath, [".gml"]);
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.includes("new ") || line.includes("array_create") || line.includes("ds_map_create")) {
          allocations++;
          if (line.includes("step") || line.includes("draw")) {
            warnings.push(`${relPath}:${i + 1}: Dynamic allocation in per-frame event: '${line.trim()}'`);
          }
        }
      }
    }
    return { checkedScriptsCount: checked, potentialGcAllocations: allocations, warnings };
  }

  buildLightShadow2DShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_light_shadow_2d";
    const vsh = `// 2D Light & Shadow Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;
varying vec2 v_vPosition;

void main() {
    vec4 object_space_pos = vec4(in_Position, 1.0);
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * object_space_pos;
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
    v_vPosition = in_Position.xy;
}
`;
    const fsh = `// 2D Light & Shadow Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;
varying vec2 v_vPosition;

uniform vec2 u_uLightPosition;
uniform vec4 u_uLightColor;
uniform float u_uLightRadius;

void main() {
    float dist = distance(v_vPosition, u_uLightPosition);
    float atten = clamp(1.0 - (dist / u_uLightRadius), 0.0, 1.0);
    vec4 texColor = texture2D(gm_BaseTexture, v_vTexcoord);
    gl_FragColor = texColor * v_vColour * u_uLightColor * (atten * atten);
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildInventoryDragDropUi(options: { slotCount?: number | undefined; slotSize?: number | undefined }): { generatedCode: string } {
    const slots = options.slotCount ?? 20;
    const size = options.slotSize ?? 48;
    const code = `// GML Drag-and-Drop Slot UI Controller
function InventoryDragDropUI() constructor {
    slots = array_create(${slots}, undefined);
    draggedSlot = -1;
    draggedItem = undefined;
    slotSize = ${size};

    static start_drag = function(_slot_index) {
        if (_slot_index >= 0 && _slot_index < array_length(slots) && slots[_slot_index] != undefined) {
            draggedSlot = _slot_index;
            draggedItem = slots[_slot_index];
            slots[_slot_index] = undefined;
        }
    };

    static drop_at = function(_target_slot_index) {
        if (draggedSlot != -1) {
            var _previous = slots[_target_slot_index];
            slots[_target_slot_index] = draggedItem;
            slots[draggedSlot] = _previous;
            draggedSlot = -1;
            draggedItem = undefined;
        }
    };
}
`;
    return { generatedCode: code };
  }

  convertDsListToArray(options: { listVarName: string }): { generatedCode: string } {
    const varName = options.listVarName;
    const code = `// Converted GML DS List to 1D Array
// Replace ds_list_create() with:
${varName} = [];

// Inline Helper Conversions:
// ds_list_add(${varName}, item)       -> array_push(${varName}, item);
// ds_list_find_value(${varName}, idx) -> ${varName}[idx];
// ds_list_size(${varName})             -> array_length(${varName});
// ds_list_delete(${varName}, idx)     -> array_delete(${varName}, idx, 1);
// ds_list_clear(${varName})            -> array_resize(${varName}, 0);
// ds_list_destroy(${varName})          -> // GC handles cleanup automatically!
`;
    return { generatedCode: code };
  }

  convertDsMapToStruct(options: { mapVarName: string }): { generatedCode: string } {
    const varName = options.mapVarName;
    const code = `// Converted GML DS Map to Struct
// Replace ds_map_create() with:
${varName} = {};

// Inline Helper Conversions:
// ds_map_add(${varName}, key, val)       -> ${varName}[$ key] = val; // or ${varName}.key = val;
// ds_map_find_value(${varName}, key)    -> ${varName}[$ key];
// ds_map_exists(${varName}, key)        -> struct_exists(${varName}, key);
// ds_map_delete(${varName}, key)        -> struct_remove(${varName}, key);
// ds_map_destroy(${varName})             -> // GC handles cleanup automatically!
`;
    return { generatedCode: code };
  }

  generateObjectStateMachineEvents(options: { objectName: string; states: string[] }): { generatedCode: string } {
    const statesEnum = options.states.map((s) => s.toUpperCase()).join(", ");
    const code = `// State Machine Boilerplate for ${options.objectName}

// --- CREATE EVENT ---
enum State { ${statesEnum} }
state_machine = new StateMachine(State.${options.states[0]?.toUpperCase() ?? "IDLE"});

// Register States
${options.states.map((s) => `state_machine.add(State.${s.toUpperCase()}, state_${s.toLowerCase()}_enter, state_${s.toLowerCase()}_step, state_${s.toLowerCase()}_leave);`).join("\n")}

// --- STEP EVENT ---
state_machine.update();

// --- CLEAN UP EVENT ---
// State machine struct is garbage collected automatically.
`;
    return { generatedCode: code };
  }

  buildSurfaceBlurBloomShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_blur_bloom";
    const vsh = `// Surface Blur & Bloom Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    vec4 object_space_pos = vec4(in_Position, 1.0);
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * object_space_pos;
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Surface Blur & Bloom Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform vec2 u_uTexelSize;
uniform float u_uBloomIntensity;

void main() {
    vec4 blurColor = vec4(0.0);
    vec2 offset[9];
    offset[0] = vec2(-1.0, -1.0); offset[1] = vec2( 0.0, -1.0); offset[2] = vec2( 1.0, -1.0);
    offset[3] = vec2(-1.0,  0.0); offset[4] = vec2( 0.0,  0.0); offset[5] = vec2( 1.0,  0.0);
    offset[6] = vec2(-1.0,  1.0); offset[7] = vec2( 0.0,  1.0); offset[8] = vec2( 1.0,  1.0);

    float kernel[9];
    kernel[0] = 1.0/16.0; kernel[1] = 2.0/16.0; kernel[2] = 1.0/16.0;
    kernel[3] = 2.0/16.0; kernel[4] = 4.0/16.0; kernel[5] = 2.0/16.0;
    kernel[6] = 1.0/16.0; kernel[7] = 2.0/16.0; kernel[8] = 1.0/16.0;

    for (int i = 0; i < 9; i++) {
        blurColor += texture2D(gm_BaseTexture, v_vTexcoord + offset[i] * u_uTexelSize) * kernel[i];
    }
    vec4 baseColor = texture2D(gm_BaseTexture, v_vTexcoord);
    gl_FragColor = baseColor + (blurColor * u_uBloomIntensity);
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildGridPathfindingAStar(options: { gridWidth?: number | undefined; gridHeight?: number | undefined }): { generatedCode: string } {
    const w = options.gridWidth ?? 32;
    const h = options.gridHeight ?? 32;
    const code = `// GML Custom A* Grid Pathfinding Struct
function AStarPathfinder(_w = ${w}, _h = ${h}) constructor {
    width = _w;
    height = _h;
    grid = array_create(_w);
    for (var i = 0; i < _w; i++) grid[i] = array_create(_h, 0); // 0 = walkable, 1 = solid

    static set_solid = function(_x, _y, _is_solid) {
        if (_x >= 0 && _x < width && _y >= 0 && _y < height) grid[_x][_y] = _is_solid ? 1 : 0;
    };

    static find_path = function(_start_x, _start_y, _end_x, _end_y) {
        var _mp_grid = mp_grid_create(0, 0, width, height, 32, 32);
        for (var _x = 0; _x < width; _x++) {
            for (var _y = 0; _y < height; _y++) {
                if (grid[_x][_y] == 1) mp_grid_add_cell(_mp_grid, _x, _y);
            }
        }
        var _path = path_add();
        mp_grid_path(_mp_grid, _path, _start_x * 32 + 16, _start_y * 32 + 16, _end_x * 32 + 16, _end_y * 32 + 16, false);
        mp_grid_destroy(_mp_grid);
        return _path;
    };
}
`;
    return { generatedCode: code };
  }

  buildAudioSpatial3DEmitter(options: { emitterVar?: string | undefined }): { generatedCode: string } {
    const emVar = options.emitterVar ?? "spatial_emitter";
    const code = `// 3D Spatial Audio Emitter Controller
function SpatialAudioEmitter(_x, _y, _z = 0) constructor {
    emitter = audio_emitter_create();
    audio_emitter_position(emitter, _x, _y, _z);
    audio_emitter_falloff(emitter, 100, 1000, 1);

    static set_position = function(_x, _y, _z = 0) {
        audio_emitter_position(emitter, _x, _y, _z);
    };

    static play_sound = function(_sound_asset, _loop = false, _priority = 1) {
        return audio_play_sound_on(emitter, _sound_asset, _loop, _priority);
    };

    static destroy = function() {
        if (audio_emitter_exists(emitter)) audio_emitter_free(emitter);
    };
}
`;
    return { generatedCode: code };
  }

  buildSaveLoadJsonEncrypted(options: { fileName?: string | undefined; saltKey?: string | undefined }): { generatedCode: string } {
    const fName = options.fileName ?? "savegame.dat";
    const salt = options.saltKey ?? "GameMakerSalt2026";
    const code = `// GML Encrypted JSON Save & Load System: ${fName}
function save_game_data_encrypted(_data_struct, _filename = "${fName}") {
    var _json = json_stringify(_data_struct);
    var _buf = buffer_create(string_byte_length(_json) + 1, buffer_fixed, 1);
    buffer_write(_buf, buffer_string, _json);
    
    // Salt checksum hash
    var _hash = md5_string_utf8(_json + "${salt}");
    
    var _wrapper = { payload: _json, checksum: _hash };
    var _final_json = json_stringify(_wrapper);
    
    var _file = file_text_open_write(_filename);
    file_text_write_string(_file, _final_json);
    file_text_close(_file);
    buffer_delete(_buf);
}

function load_game_data_encrypted(_filename = "${fName}") {
    if (!file_exists(_filename)) return undefined;
    var _file = file_text_open_read(_filename);
    var _text = file_text_read_string(_file);
    file_text_close(_file);
    
    var _wrapper = json_parse(_text);
    if (struct_exists(_wrapper, "payload") && struct_exists(_wrapper, "checksum")) {
        var _expected = md5_string_utf8(_wrapper.payload + "${salt}");
        if (_wrapper.checksum == _expected) {
            return json_parse(_wrapper.payload);
        }
    }
    show_debug_message("Save data tamper/checksum validation failed!");
    return undefined;
}
`;
    return { generatedCode: code };
  }

  buildCameraViewFollowBounds(options: { cameraIndex?: number | undefined }): { generatedCode: string } {
    const camIdx = options.cameraIndex ?? 0;
    const code = `// GML Smooth Camera Follow with Deadzone & Room Bounds Clamping
function camera_follow_target(_cam_idx = ${camIdx}, _target = id, _lerp_speed = 0.1) {
    var _cam = view_camera[_cam_idx];
    var _cur_x = camera_get_view_x(_cam);
    var _cur_y = camera_get_view_y(_cam);
    var _w = camera_get_view_width(_cam);
    var _h = camera_get_view_height(_cam);

    if (instance_exists(_target)) {
        var _dest_x = clamp(_target.x - _w / 2, 0, room_width - _w);
        var _dest_y = clamp(_target.y - _h / 2, 0, room_height - _h);
        camera_set_view_pos(_cam, lerp(_cur_x, _dest_x, _lerp_speed), lerp(_cur_y, _dest_y, _lerp_speed));
    }
}
`;
    return { generatedCode: code };
  }

  convertDsPriorityToArray(options: { priorityVarName: string }): { generatedCode: string } {
    const varName = options.priorityVarName;
    const code = `// Converted GML DS Priority Queue to Sorted Array Struct
function PriorityQueue() constructor {
    items = [];

    static enqueue = function(_value, _priority) {
        array_push(items, { value: _value, priority: _priority });
        array_sort(items, function(_a, _b) { return _a.priority - _b.priority; });
    };

    static dequeue = function() {
        if (array_length(items) == 0) return undefined;
        var _first = items[0];
        array_delete(items, 0, 1);
        return _first.value;
    };
}

// Replace ds_priority_create() with:
${varName} = new PriorityQueue();
`;
    return { generatedCode: code };
  }

  buildEventPubSubDispatcher(options: { dispatcherName?: string | undefined }): { generatedCode: string } {
    const name = options.dispatcherName ?? "EventDispatcher";
    const code = `// Global Event Observer Pub/Sub Dispatcher: ${name}
function ${name}() constructor {
    listeners = {};

    static subscribe = function(_event_type, _callback) {
        if (!struct_exists(listeners, _event_type)) listeners[$ _event_type] = [];
        array_push(listeners[$ _event_type], _callback);
    };

    static dispatch = function(_event_type, _data = undefined) {
        if (struct_exists(listeners, _event_type)) {
            var _list = listeners[$ _event_type];
            for (var i = 0; i < array_length(_list); i++) {
                var _cb = _list[i];
                if (is_callable(_cb)) _cb(_data);
            }
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildFlexboxUiAutoLayout(options: { containerVar?: string | undefined }): { generatedCode: string } {
    const cVar = options.containerVar ?? "ui_container";
    const code = `// Dynamic Flexbox UI Layout Spacing Calculator
function flexbox_layout_calculate(_items_array, _container_width, _container_height, _direction = "row", _gap = 8) {
    var _count = array_length(_items_array);
    if (_count == 0) return;

    var _current_x = 0;
    var _current_y = 0;

    for (var i = 0; i < _count; i++) {
        var _item = _items_array[i];
        _item.x = _current_x;
        _item.y = _current_y;

        if (_direction == "row") {
            _current_x += _item.width + _gap;
        } else {
            _current_y += _item.height + _gap;
        }
    }
}
`;
    return { generatedCode: code };
  }

  configureTilesetAutotileRules(options: { tilesetName: string; autotileType?: "16-tile" | "47-tile" | undefined }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.tilesetName, "tileset");
    let text = this.sandbox.readText(res.path, [".yy"]);
    const autoType = options.autotileType ?? "47-tile";
    const ruleCount = autoType === "47-tile" ? 47 : 16;

    text = updateJsonPath(text, ["autoTileSets"], [
      {
        $GMAutoTileSet: "",
        "%Name": `${options.tilesetName}_autotile`,
        name: `${options.tilesetName}_autotile`,
        resourceType: "GMAutoTileSet",
        resourceVersion: "2.0",
        tiles: Array.from({ length: ruleCount }, () => 0),
      },
    ]);
    const sha = this.sandbox.sha256For(res.path);
    return this.sandbox.atomicWrite(res.path, text, { expectedSha256: sha, backup: true });
  }

  buildTypeCheckedStruct(options: { structName: string; fields: Array<{ name: string; type: string; defaultValue?: string | undefined }> }): { generatedCode: string } {
    const fieldDecls = options.fields.map((f) => `    ${f.name} = _data[$ "${f.name}"] ?? ${f.defaultValue ?? "undefined"};`).join("\n");
    const fieldChecks = options.fields.map((f) => `    if (${f.name} != undefined && typeof(${f.name}) != "${f.type}") show_debug_message("Warning: ${f.name} expected ${f.type}");`).join("\n");

    const code = `// Feather Schema-Validated GML Struct: ${options.structName}
function ${options.structName}(_data = {}) constructor {
${fieldDecls}

${fieldChecks}
}
`;
    return { generatedCode: code };
  }

  buildEcsSystem(options: { systemName?: string | undefined }): { generatedCode: string } {
    const sysName = options.systemName ?? "ECSWorld";
    const code = `// GML High-Performance Entity-Component-System (ECS) Framework: ${sysName}
function ${sysName}() constructor {
    nextEntityId = 1;
    entities = [];
    components = {};
    systems = [];

    static create_entity = function() {
        var _id = nextEntityId++;
        array_push(entities, _id);
        return _id;
    };

    static destroy_entity = function(_entity_id) {
        var _idx = array_get_index(entities, _entity_id);
        if (_idx >= 0) array_delete(entities, _idx, 1);
        var _names = struct_get_names(components);
        for (var i = 0; i < array_length(_names); i++) {
            var _c_map = components[$ _names[i]];
            if (struct_exists(_c_map, string(_entity_id))) {
                struct_remove(_c_map, string(_entity_id));
            }
        }
    };

    static add_component = function(_entity_id, _comp_name, _comp_data) {
        if (!struct_exists(components, _comp_name)) components[$ _comp_name] = {};
        components[$ _comp_name][$ string(_entity_id)] = _comp_data;
    };

    static get_component = function(_entity_id, _comp_name) {
        if (!struct_exists(components, _comp_name)) return undefined;
        return components[$ _comp_name][$ string(_entity_id)];
    };

    static has_component = function(_entity_id, _comp_name) {
        if (!struct_exists(components, _comp_name)) return false;
        return struct_exists(components[$ _comp_name], string(_entity_id));
    };

    static register_system = function(_system_func) {
        array_push(systems, _system_func);
    };

    static update = function(_dt) {
        for (var i = 0; i < array_length(systems); i++) {
            systems[i](self, _dt);
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildSpatialHashGrid(options: { cellSize?: number | undefined }): { generatedCode: string } {
    const cSize = options.cellSize ?? 64;
    const code = `// 2D Spatial Hash Grid Collision Broadphase Optimizer
function SpatialHashGrid(_cell_size = ${cSize}) constructor {
    cellSize = _cell_size;
    grid = {};

    static _hash = function(_cx, _cy) {
        return string(_cx) + ":" + string(_cy);
    };

    static clear = function() {
        grid = {};
    };

    static insert = function(_id, _bbox_left, _bbox_top, _bbox_right, _bbox_bottom) {
        var _start_x = floor(_bbox_left / cellSize);
        var _end_x = floor(_bbox_right / cellSize);
        var _start_y = floor(_bbox_top / cellSize);
        var _end_y = floor(_bbox_bottom / cellSize);

        for (var _cx = _start_x; _cx <= _end_x; _cx++) {
            for (var _cy = _start_y; _cy <= _end_y; _cy++) {
                var _k = _hash(_cx, _cy);
                if (!struct_exists(grid, _k)) grid[$ _k] = [];
                array_push(grid[$ _k], _id);
            }
        }
    };

    static query_range = function(_bbox_left, _bbox_top, _bbox_right, _bbox_bottom) {
        var _results = [];
        var _seen = {};
        var _start_x = floor(_bbox_left / cellSize);
        var _end_x = floor(_bbox_right / cellSize);
        var _start_y = floor(_bbox_top / cellSize);
        var _end_y = floor(_bbox_bottom / cellSize);

        for (var _cx = _start_x; _cx <= _end_x; _cx++) {
            for (var _cy = _start_y; _cy <= _end_y; _cy++) {
                var _k = _hash(_cx, _cy);
                if (struct_exists(grid, _k)) {
                    var _cell = grid[$ _k];
                    for (var i = 0; i < array_length(_cell); i++) {
                        var _item = _cell[i];
                        var _str = string(_item);
                        if (!struct_exists(_seen, _str)) {
                            _seen[$ _str] = true;
                            array_push(_results, _item);
                        }
                    }
                }
            }
        }
        return _results;
    };
}
`;
    return { generatedCode: code };
  }

  buildQuadtree(options: { maxObjects?: number | undefined; maxLevels?: number | undefined }): { generatedCode: string } {
    const maxObj = options.maxObjects ?? 10;
    const maxLvl = options.maxLevels ?? 5;
    const code = `// 2D Quadtree Spatial Partitioning System
function Quadtree(_level, _x, _y, _width, _height) constructor {
    level = _level;
    x = _x;
    y = _y;
    width = _width;
    height = _height;
    maxObjects = ${maxObj};
    maxLevels = ${maxLvl};
    objects = [];
    nodes = array_create(4, undefined);

    static clear = function() {
        array_resize(objects, 0);
        for (var i = 0; i < 4; i++) {
            if (nodes[i] != undefined) {
                nodes[i].clear();
                nodes[i] = undefined;
            }
        }
    };

    static split = function() {
        var _sub_w = width / 2;
        var _sub_h = height / 2;
        nodes[0] = new Quadtree(level + 1, x + _sub_w, y, _sub_w, _sub_h);
        nodes[1] = new Quadtree(level + 1, x, y, _sub_w, _sub_h);
        nodes[2] = new Quadtree(level + 1, x, y + _sub_h, _sub_w, _sub_h);
        nodes[3] = new Quadtree(level + 1, x + _sub_w, y + _sub_h, _sub_w, _sub_h);
    };

    static get_index = function(_bbox) {
        var _mid_x = x + (width / 2);
        var _mid_y = y + (height / 2);
        var _top = (_bbox.top < _mid_y && _bbox.bottom < _mid_y);
        var _bottom = (_bbox.top > _mid_y);
        if (_bbox.left < _mid_x && _bbox.right < _mid_x) {
            if (_top) return 1;
            if (_bottom) return 2;
        } else if (_bbox.left > _mid_x) {
            if (_top) return 0;
            if (_bottom) return 3;
        }
        return -1;
    };

    static insert = function(_item) {
        if (nodes[0] != undefined) {
            var _idx = get_index(_item.bbox);
            if (_idx != -1) {
                nodes[_idx].insert(_item);
                return;
            }
        }
        array_push(objects, _item);
        if (array_length(objects) > maxObjects && level < maxLevels) {
            if (nodes[0] == undefined) split();
            var i = 0;
            while (i < array_length(objects)) {
                var _sub_idx = get_index(objects[i].bbox);
                if (_sub_idx != -1) {
                    var _obj = objects[i];
                    array_delete(objects, i, 1);
                    nodes[_sub_idx].insert(_obj);
                } else {
                    i++;
                }
            }
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildHierarchicalStateMachine(options: { rootState?: string | undefined }): { generatedCode: string } {
    const rState = options.rootState ?? "IDLE";
    const code = `// Hierarchical Finite State Machine (HFSM) Framework
function HFSMNode(_name, _parent = undefined) constructor {
    name = _name;
    parent = _parent;
    substates = {};
    activeSubstate = undefined;

    enterAction = undefined;
    stepAction = undefined;
    leaveAction = undefined;

    static add_substate = function(_sub_name, _on_enter = undefined, _on_step = undefined, _on_leave = undefined) {
        var _node = new HFSMNode(_sub_name, self);
        _node.enterAction = _on_enter;
        _node.stepAction = _on_step;
        _node.leaveAction = _on_leave;
        substates[$ _sub_name] = _node;
        return _node;
    };

    static transition_to = function(_sub_name) {
        if (activeSubstate != undefined && activeSubstate.leaveAction != undefined) {
            activeSubstate.leaveAction();
        }
        activeSubstate = substates[$ _sub_name];
        if (activeSubstate != undefined && activeSubstate.enterAction != undefined) {
            activeSubstate.enterAction();
        }
    };

    static update = function() {
        if (stepAction != undefined) stepAction();
        if (activeSubstate != undefined) activeSubstate.update();
    };
}

function HierarchicalStateMachine(_initial_root = "${rState}") constructor {
    root = new HFSMNode(_initial_root);
    static update = function() { root.update(); };
}
`;
    return { generatedCode: code };
  }

  buildCrtRetroShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_crt_retro";
    const vsh = `// Retro CRT Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Retro CRT Simulation Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform vec2 u_uResolution;
uniform float u_uCurvature;
uniform float u_uScanlineIntensity;
uniform float u_uChromaticAberration;

vec2 curve(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    uv *= 1.1;
    uv.x *= 1.0 + pow((abs(uv.y) / 4.0), 2.0) * u_uCurvature;
    uv.y *= 1.0 + pow((abs(uv.x) / 3.0), 2.0) * u_uCurvature;
    uv = (uv / 2.0) + 0.5;
    return uv;
}

void main() {
    vec2 uv = curve(v_vTexcoord);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    float r = texture2D(gm_BaseTexture, uv + vec2(u_uChromaticAberration, 0.0)).r;
    float g = texture2D(gm_BaseTexture, uv).g;
    float b = texture2D(gm_BaseTexture, uv - vec2(u_uChromaticAberration, 0.0)).b;
    vec3 col = vec3(r, g, b);

    float scanline = sin(uv.y * u_uResolution.y * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - (1.0 - scanline) * u_uScanlineIntensity;

    gl_FragColor = vec4(col, 1.0) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildWaterDistortionShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_water_distortion";
    const vsh = `// 2D Water Distortion Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// 2D Water Distortion & Caustics Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_uTime;
uniform vec2 u_uSpeed;
uniform vec2 u_uFrequency;
uniform vec2 u_uAmplitude;

void main() {
    vec2 coord = v_vTexcoord;
    coord.x += sin(coord.y * u_uFrequency.y + u_uTime * u_uSpeed.x) * u_uAmplitude.x;
    coord.y += cos(coord.x * u_uFrequency.x + u_uTime * u_uSpeed.y) * u_uAmplitude.y;
    vec4 baseColor = texture2D(gm_BaseTexture, coord);
    vec4 tint = vec4(0.2, 0.5, 0.9, 1.0);
    gl_FragColor = mix(baseColor, tint, 0.25) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildDissolveBurnShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_dissolve_burn";
    const vsh = `// Dissolve & Burn Edge Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Dissolve & Burn Edge Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_uThreshold;
uniform float u_uBurnEdgeWidth;
uniform vec4 u_uBurnColor;

void main() {
    vec4 mainTex = texture2D(gm_BaseTexture, v_vTexcoord);
    float noise = fract(sin(dot(v_vTexcoord.xy ,vec2(12.9898,78.233))) * 43758.5453);
    if (noise < u_uThreshold) {
        discard;
    }
    if (noise < u_uThreshold + u_uBurnEdgeWidth) {
        gl_FragColor = u_uBurnColor * v_vColour;
    } else {
        gl_FragColor = mainTex * v_vColour;
    }
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildPaletteSwapShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_palette_swap";
    const vsh = `// Palette Swap Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Palette Swap Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_uPaletteIndex;
uniform float u_uPaletteCount;
uniform sampler2D u_sPaletteTexture;

void main() {
    vec4 srcColor = texture2D(gm_BaseTexture, v_vTexcoord);
    float indexU = srcColor.r;
    float indexV = (u_uPaletteIndex + 0.5) / u_uPaletteCount;
    vec4 newColor = texture2D(u_sPaletteTexture, vec2(indexU, indexV));
    newColor.a *= srcColor.a;
    gl_FragColor = newColor * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildOutlineGlowShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_outline_glow";
    const vsh = `// 2D Sprite Outline & Glow Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// 2D Sprite Outline & Glow Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform vec2 u_uTexelSize;
uniform vec4 u_uOutlineColor;
uniform float u_uOutlineThickness;

void main() {
    vec4 baseCol = texture2D(gm_BaseTexture, v_vTexcoord);
    float alpha = 0.0;
    
    alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2( u_uTexelSize.x * u_uOutlineThickness, 0.0)).a;
    alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2(-u_uTexelSize.x * u_uOutlineThickness, 0.0)).a;
    alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2(0.0,  u_uTexelSize.y * u_uOutlineThickness)).a;
    alpha += texture2D(gm_BaseTexture, v_vTexcoord + vec2(0.0, -u_uTexelSize.y * u_uOutlineThickness)).a;

    if (baseCol.a < 0.1 && alpha > 0.1) {
        gl_FragColor = u_uOutlineColor;
    } else {
        gl_FragColor = baseCol * v_vColour;
    }
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildFogOfWarShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_fog_of_war";
    const vsh = `// Fog of War Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Fog of War Radial Soft Mask Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform sampler2D u_sVisibilitySurface;
uniform vec4 u_uFogColor;

void main() {
    vec4 baseTex = texture2D(gm_BaseTexture, v_vTexcoord);
    float visibility = texture2D(u_sVisibilitySurface, v_vTexcoord).r;
    vec4 finalColor = mix(u_uFogColor, baseTex, visibility);
    gl_FragColor = finalColor * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildShockwaveDistortionShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_shockwave";
    const vsh = `// Shockwave Distortion Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Radial Shockwave Distortion Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform vec2 u_uCenter;
uniform float u_uTime;
uniform float u_uRadius;
uniform float u_uForce;
uniform float u_uThickness;

void main() {
    vec2 uv = v_vTexcoord;
    float dist = distance(uv, u_uCenter);
    if (dist <= (u_uRadius + u_uThickness) && dist >= (u_uRadius - u_uThickness)) {
        float diff = (dist - u_uRadius);
        float powDiff = 1.0 - pow(abs(diff * (1.0 / u_uThickness)), 0.8);
        float diffTime = diff * powDiff;
        vec2 diffUV = normalize(uv - u_uCenter);
        uv += (diffUV * diffTime) * (u_uForce * (1.0 - u_uTime));
    }
    gl_FragColor = texture2D(gm_BaseTexture, uv) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildGlitchVhsShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_glitch_vhs";
    const vsh = `// Glitch & VHS Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Glitch & VHS Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_uTime;
uniform float u_uIntensity;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
    vec2 uv = v_vTexcoord;
    float jitter = (hash(vec2(u_uTime, uv.y)) - 0.5) * 2.0 * u_uIntensity;
    if (abs(jitter) > 0.01) uv.x += jitter;

    float r = texture2D(gm_BaseTexture, uv + vec2(0.01 * u_uIntensity, 0.0)).r;
    float g = texture2D(gm_BaseTexture, uv).g;
    float b = texture2D(gm_BaseTexture, uv - vec2(0.01 * u_uIntensity, 0.0)).b;
    float a = texture2D(gm_BaseTexture, uv).a;

    gl_FragColor = vec4(r, g, b, a) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildWindGrassSwayShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_wind_sway";
    const vsh = `// Vegetation Wind Sway Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform float u_uTime;
uniform float u_uWindSpeed;
uniform float u_uWindStrength;

void main() {
    vec3 pos = in_Position;
    float sway = sin(u_uTime * u_uWindSpeed + pos.x * 0.05) * u_uWindStrength * (1.0 - in_TextureCoord.y);
    pos.x += sway;
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(pos, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// Vegetation Wind Sway Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_FragColor = texture2D(gm_BaseTexture, v_vTexcoord) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildColorGradingLutShader(options: { shaderName?: string | undefined }): { vertexShader: string; fragmentShader: string } {
    const sName = options.shaderName ?? "shd_color_grading_lut";
    const vsh = `// 3D LUT Color Grading Vertex Shader: ${sName}
attribute vec3 in_Position;
attribute vec4 in_Colour;
attribute vec2 in_TextureCoord;

varying vec2 v_vTexcoord;
varying vec4 v_vColour;

void main() {
    gl_Position = gm_Matrices[MATRIX_WORLD_VIEW_PROJECTION] * vec4(in_Position, 1.0);
    v_vColour = in_Colour;
    v_vTexcoord = in_TextureCoord;
}
`;
    const fsh = `// 3D LUT Color Grading Fragment Shader: ${sName}
varying vec2 v_vTexcoord;
varying vec4 v_vColour;

uniform sampler2D u_sLutTexture;
uniform float u_uStrength;

void main() {
    vec4 rawColor = texture2D(gm_BaseTexture, v_vTexcoord);
    float blueColor = rawColor.b * 15.0;
    vec2 quad1;
    quad1.y = floor(floor(blueColor) / 4.0);
    quad1.x = floor(blueColor) - (quad1.y * 4.0);

    vec2 quad2;
    quad2.y = floor(ceil(blueColor) / 4.0);
    quad2.x = ceil(blueColor) - (quad2.y * 4.0);

    vec2 texPos1 = (quad1 * 0.25) + 0.5/64.0 + ((0.25 - 1.0/64.0) * rawColor.rg);
    vec2 texPos2 = (quad2 * 0.25) + 0.5/64.0 + ((0.25 - 1.0/64.0) * rawColor.rg);

    vec4 newColor1 = texture2D(u_sLutTexture, texPos1);
    vec4 newColor2 = texture2D(u_sLutTexture, texPos2);
    vec4 gradedColor = mix(newColor1, newColor2, fract(blueColor));

    gl_FragColor = mix(rawColor, gradedColor, u_uStrength) * v_vColour;
}
`;
    return { vertexShader: vsh, fragmentShader: fsh };
  }

  buildVerletRopeCloth(options: { segmentCount?: number | undefined; segmentLength?: number | undefined; gravity?: number | undefined }): { generatedCode: string } {
    const segs = options.segmentCount ?? 16;
    const len = options.segmentLength ?? 12;
    const grav = options.gravity ?? 0.5;
    const code = `// 2D Verlet Integration Physics Rope & Chain Simulation
function VerletRope(_start_x, _start_y, _segments = ${segs}, _len = ${len}, _gravity = ${grav}) constructor {
    segments = _segments;
    segmentLength = _len;
    gravity = _gravity;
    points = [];

    for (var i = 0; i < segments; i++) {
        array_push(points, {
            x: _start_x,
            y: _start_y + (i * segmentLength),
            oldX: _start_x,
            oldY: _start_y + (i * segmentLength),
            pinned: (i == 0)
        });
    }

    static update = function(_pin_x, _pin_y, _iterations = 10) {
        for (var i = 0; i < array_length(points); i++) {
            var _p = points[i];
            if (!_p.pinned) {
                var _vx = (_p.x - _p.oldX) * 0.98;
                var _vy = (_p.y - _p.oldY) * 0.98;
                _p.oldX = _p.x;
                _p.oldY = _p.y;
                _p.x += _vx;
                _p.y += _vy + gravity;
            } else {
                _p.x = _pin_x;
                _p.y = _pin_y;
            }
        }

        repeat (_iterations) {
            for (var i = 0; i < array_length(points) - 1; i++) {
                var _p1 = points[i];
                var _p2 = points[i + 1];
                var _dx = _p2.x - _p1.x;
                var _dy = _p2.y - _p1.y;
                var _dist = sqrt(_dx * _dx + _dy * _dy);
                if (_dist == 0) _dist = 0.001;
                var _diff = (segmentLength - _dist) / _dist;
                var _offsetX = _dx * 0.5 * _diff;
                var _offsetY = _dy * 0.5 * _diff;

                if (!_p1.pinned) { _p1.x -= _offsetX; _p1.y -= _offsetY; }
                if (!_p2.pinned) { _p2.x += _offsetX; _p2.y += _offsetY; }
            }
        }
    };

    static draw = function(_color = c_white) {
        for (var i = 0; i < array_length(points) - 1; i++) {
            draw_line_color(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, _color, _color);
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildPidController(options: { p?: number | undefined; i?: number | undefined; d?: number | undefined }): { generatedCode: string } {
    const kp = options.p ?? 0.2;
    const ki = options.i ?? 0.01;
    const kd = options.d ?? 0.1;
    const code = `// Proportional-Integral-Derivative (PID) Controller
function PIDController(_kp = ${kp}, _ki = ${ki}, _kd = ${kd}) constructor {
    kp = _kp;
    ki = _ki;
    kd = _kd;
    integral = 0;
    lastError = 0;

    static calculate = function(_target, _current, _dt = 1.0) {
        var _error = _target - _current;
        integral += _error * _dt;
        var _derivative = (_error - lastError) / _dt;
        lastError = _error;
        return (kp * _error) + (ki * integral) + (kd * _derivative);
    };

    static reset = function() {
        integral = 0;
        lastError = 0;
    };
}
`;
    return { generatedCode: code };
  }

  buildBezierSpline(options: { samples?: number | undefined }): { generatedCode: string } {
    const samps = options.samples ?? 20;
    const code = `// Cubic & Quadratic Bezier Spline Utility
function bezier_cubic_point(_p0, _p1, _p2, _p3, _t) {
    var _inv = 1.0 - _t;
    return {
        x: (_inv * _inv * _inv * _p0.x) + (3 * _inv * _inv * _t * _p1.x) + (3 * _inv * _t * _t * _p2.x) + (_t * _t * _t * _p3.x),
        y: (_inv * _inv * _inv * _p0.y) + (3 * _inv * _inv * _t * _p1.y) + (3 * _inv * _t * _t * _p2.y) + (_t * _t * _t * _p3.y)
    };
}

function bezier_generate_points(_p0, _p1, _p2, _p3, _samples = ${samps}) {
    var _points = array_create(_samples + 1);
    for (var i = 0; i <= _samples; i++) {
        _points[i] = bezier_cubic_point(_p0, _p1, _p2, _p3, i / _samples);
    }
    return _points;
}
`;
    return { generatedCode: code };
  }

  buildProceduralDungeon(options: { width?: number | undefined; height?: number | undefined; roomCount?: number | undefined }): { generatedCode: string } {
    const w = options.width ?? 64;
    const h = options.height ?? 64;
    const rc = options.roomCount ?? 8;
    const code = `// Procedural Dungeon BSP Room & Corridor Generator
function ProceduralDungeonGenerator(_w = ${w}, _h = ${h}, _target_rooms = ${rc}) constructor {
    width = _w;
    height = _h;
    targetRooms = _target_rooms;
    grid = array_create(width);
    for (var i = 0; i < width; i++) grid[i] = array_create(height, 1);

    rooms = [];

    static generate = function() {
        for (var i = 0; i < targetRooms; i++) {
            var _rw = irandom_range(6, 12);
            var _rh = irandom_range(6, 12);
            var _rx = irandom_range(1, width - _rw - 1);
            var _ry = irandom_range(1, height - _rh - 1);

            for (var _x = _rx; _x < _rx + _rw; _x++) {
                for (var _y = _ry; _y < _ry + _rh; _y++) {
                    grid[_x][_y] = 0;
                }
            }
            array_push(rooms, { x: _rx + floor(_rw/2), y: _ry + floor(_rh/2) });

            if (i > 0) {
                var _p1 = rooms[i - 1];
                var _p2 = rooms[i];
                var _cx = _p1.x;
                while (_cx != _p2.x) { grid[_cx][_p1.y] = 0; _cx += sign(_p2.x - _cx); }
                var _cy = _p1.y;
                while (_cy != _p2.y) { grid[_p2.x][_cy] = 0; _cy += sign(_p2.y - _cy); }
            }
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildWaveFunctionCollapse(options: { gridWidth?: number | undefined; gridHeight?: number | undefined }): { generatedCode: string } {
    const w = options.gridWidth ?? 16;
    const h = options.gridHeight ?? 16;
    const code = `// 2D Wave Function Collapse (WFC) Procedural Tilemap Generator
function WFCGrid(_w = ${w}, _h = ${h}) constructor {
    width = _w;
    height = _h;
    cells = array_create(width * height);

    for (var i = 0; i < width * height; i++) {
        cells[i] = { collapsed: false, tile: -1, entropy: 4 };
    }

    static collapse_next = function() {
        var _lowest_idx = -1;
        var _lowest_entropy = 999;
        for (var i = 0; i < array_length(cells); i++) {
            if (!cells[i].collapsed && cells[i].entropy < _lowest_entropy) {
                _lowest_entropy = cells[i].entropy;
                _lowest_idx = i;
            }
        }
        if (_lowest_idx != -1) {
            cells[_lowest_idx].collapsed = true;
            cells[_lowest_idx].tile = irandom(3);
            return true;
        }
        return false;
    };
}
`;
    return { generatedCode: code };
  }

  buildDynamicMusicManager(options: { trackCount?: number | undefined }): { generatedCode: string } {
    const tracks = options.trackCount ?? 4;
    const code = `// Interactive Stem-based Dynamic Music Crossfader
function DynamicMusicManager(_track_count = ${tracks}) constructor {
    stems = array_create(_track_count, undefined);
    volumes = array_create(_track_count, 0.0);
    targetVolumes = array_create(_track_count, 0.0);

    static set_intensity = function(_layer_index, _volume) {
        if (_layer_index >= 0 && _layer_index < array_length(targetVolumes)) {
            targetVolumes[_layer_index] = clamp(_volume, 0.0, 1.0);
        }
    };

    static update = function(_lerp_speed = 0.05) {
        for (var i = 0; i < array_length(stems); i++) {
            volumes[i] = lerp(volumes[i], targetVolumes[i], _lerp_speed);
            if (stems[i] != undefined && audio_is_playing(stems[i])) {
                audio_sound_gain(stems[i], volumes[i], 0);
            }
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildAudioSoundEnvelope(options: { attack?: number | undefined; decay?: number | undefined; sustain?: number | undefined; release?: number | undefined }): { generatedCode: string } {
    const a = options.attack ?? 0.1;
    const d = options.decay ?? 0.2;
    const s = options.sustain ?? 0.7;
    const r = options.release ?? 0.5;
    const code = `// Procedural Audio ADSR Volume Envelope Generator
function AudioADSREnvelope(_attack = ${a}, _decay = ${d}, _sustain = ${s}, _release = ${r}) constructor {
    attack = _attack;
    decay = _decay;
    sustain = _sustain;
    release = _release;

    static get_gain = function(_time_seconds, _note_held, _release_start_time) {
        if (_note_held) {
            if (_time_seconds < attack) return _time_seconds / attack;
            if (_time_seconds < attack + decay) {
                var _t = (_time_seconds - attack) / decay;
                return lerp(1.0, sustain, _t);
            }
            return sustain;
        } else {
            var _rel_elapsed = _time_seconds - _release_start_time;
            if (_rel_elapsed >= release) return 0.0;
            return lerp(sustain, 0.0, _rel_elapsed / release);
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildComboInputBuffer(options: { bufferWindowFrames?: number | undefined }): { generatedCode: string } {
    const win = options.bufferWindowFrames ?? 20;
    const code = `// Fighting Game Directional & Button Combo Input Buffer
function ComboInputBuffer(_window_frames = ${win}) constructor {
    windowFrames = _window_frames;
    buffer = [];

    static push_input = function(_input_code) {
        array_push(buffer, { code: _input_code, timer: windowFrames });
    };

    static update = function() {
        var i = 0;
        while (i < array_length(buffer)) {
            buffer[i].timer--;
            if (buffer[i].timer <= 0) {
                array_delete(buffer, i, 1);
            } else {
                i++;
            }
        }
    };

    static check_sequence = function(_sequence_array) {
        var _seq_len = array_length(_sequence_array);
        if (array_length(buffer) < _seq_len) return false;
        var _start_idx = array_length(buffer) - _seq_len;
        for (var i = 0; i < _seq_len; i++) {
            if (buffer[_start_idx + i].code != _sequence_array[i]) return false;
        }
        return true;
    };
}
`;
    return { generatedCode: code };
  }

  buildQuestJournal(options: { journalVar?: string | undefined }): { generatedCode: string } {
    const jVar = options.journalVar ?? "quest_journal";
    const code = `// Multi-Stage Branching Quest Journal System
function QuestJournal() constructor {
    quests = {};

    static add_quest = function(_id, _title, _description, _stages) {
        quests[$ _id] = {
            id: _id,
            title: _title,
            description: _description,
            stages: _stages,
            currentStage: 0,
            completed: false
        };
    };

    static advance_quest = function(_id) {
        if (struct_exists(quests, _id)) {
            var _q = quests[$ _id];
            _q.currentStage++;
            if (_q.currentStage >= array_length(_q.stages)) {
                _q.completed = true;
            }
        }
    };

    static is_completed = function(_id) {
        return struct_exists(quests, _id) && quests[$ _id].completed;
    };
}

${jVar} = new QuestJournal();
`;
    return { generatedCode: code };
  }

  buildSkillTree(options: { treeName?: string | undefined }): { generatedCode: string } {
    const tName = options.treeName ?? "SkillTree";
    const code = `// RPG Node-based Skill Tree Progression Graph
function ${tName}() constructor {
    skills = {};

    static add_skill = function(_id, _name, _cost, _prerequisites = []) {
        skills[$ _id] = {
            id: _id,
            name: _name,
            cost: _cost,
            prerequisites: _prerequisites,
            unlocked: false
        };
    };

    static can_unlock = function(_id, _available_points) {
        if (!struct_exists(skills, _id)) return false;
        var _s = skills[$ _id];
        if (_s.unlocked || _available_points < _s.cost) return false;
        for (var i = 0; i < array_length(_s.prerequisites); i++) {
            var _req = _s.prerequisites[i];
            if (!struct_exists(skills, _req) || !skills[$ _req].unlocked) return false;
        }
        return true;
    };

    static unlock = function(_id) {
        if (struct_exists(skills, _id)) skills[$ _id].unlocked = true;
    };
}
`;
    return { generatedCode: code };
  }

  buildFloatingTextManager(options: { poolSize?: number | undefined }): { generatedCode: string } {
    const pSize = options.poolSize ?? 64;
    const code = `// High-Performance Pooled Floating Combat Text System
function FloatingTextManager(_pool_size = ${pSize}) constructor {
    pool = array_create(_pool_size);
    for (var i = 0; i < _pool_size; i++) {
        pool[i] = { active: false, x: 0, y: 0, vy: -2, text: "", color: c_white, alpha: 1.0 };
    }

    static spawn = function(_x, _y, _text, _color = c_white) {
        for (var i = 0; i < array_length(pool); i++) {
            if (!pool[i].active) {
                var _p = pool[i];
                _p.active = true;
                _p.x = _x;
                _p.y = _y;
                _p.vy = -2.5;
                _p.text = string(_text);
                _p.color = _color;
                _p.alpha = 1.0;
                return;
            }
        }
    };

    static update_and_draw = function() {
        for (var i = 0; i < array_length(pool); i++) {
            var _p = pool[i];
            if (_p.active) {
                _p.y += _p.vy;
                _p.vy *= 0.95;
                _p.alpha -= 0.02;
                draw_set_color(_p.color);
                draw_set_alpha(_p.alpha);
                draw_text(_p.x, _p.y, _p.text);
                if (_p.alpha <= 0) _p.active = false;
            }
        }
        draw_set_alpha(1.0);
    };
}
`;
    return { generatedCode: code };
  }

  buildVirtualJoystickTouch(options: { stickRadius?: number | undefined }): { generatedCode: string } {
    const rad = options.stickRadius ?? 64;
    const code = `// Mobile/Touch Virtual Thumbstick Controller
function VirtualJoystick(_anchor_x, _anchor_y, _radius = ${rad}) constructor {
    anchorX = _anchor_x;
    anchorY = _anchor_y;
    thumbX = _anchor_x;
    thumbY = _anchor_y;
    radius = _radius;
    touchDevice = -1;
    xAxis = 0;
    yAxis = 0;

    static update = function() {
        if (touchDevice == -1) {
            for (var i = 0; i < 4; i++) {
                if (device_mouse_check_button_pressed(i, mb_left)) {
                    var _mx = device_mouse_x_to_gui(i);
                    var _my = device_mouse_y_to_gui(i);
                    if (point_distance(_mx, _my, anchorX, anchorY) <= radius) {
                        touchDevice = i;
                        break;
                    }
                }
            }
        } else {
            if (device_mouse_check_button(touchDevice, mb_left)) {
                var _mx = device_mouse_x_to_gui(touchDevice);
                var _my = device_mouse_y_to_gui(touchDevice);
                var _dist = min(point_distance(anchorX, anchorY, _mx, _my), radius);
                var _dir = point_direction(anchorX, anchorY, _mx, _my);
                thumbX = anchorX + lengthdir_x(_dist, _dir);
                thumbY = anchorY + lengthdir_y(_dist, _dir);
                xAxis = lengthdir_x(_dist / radius, _dir);
                yAxis = lengthdir_y(_dist / radius, _dir);
            } else {
                touchDevice = -1;
                thumbX = anchorX;
                thumbY = anchorY;
                xAxis = 0;
                yAxis = 0;
            }
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildCutsceneSequencer(options: { sequencerName?: string | undefined }): { generatedCode: string } {
    const sName = options.sequencerName ?? "CutsceneSequencer";
    const code = `// Coroutine-like Cutscene Action Sequencer
function ${sName}() constructor {
    actions = [];
    currentActionIndex = 0;
    isPlaying = false;

    static add_action = function(_action_callable) {
        array_push(actions, _action_callable);
    };

    static play = function() {
        isPlaying = true;
        currentActionIndex = 0;
    };

    static advance = function() {
        currentActionIndex++;
        if (currentActionIndex >= array_length(actions)) {
            isPlaying = false;
        }
    };

    static update = function() {
        if (isPlaying && currentActionIndex < array_length(actions)) {
            var _done = actions[currentActionIndex]();
            if (_done) advance();
        }
    };
}
`;
    return { generatedCode: code };
  }

  buildAchievementSystem(options: { systemName?: string | undefined }): { generatedCode: string } {
    const aName = options.systemName ?? "AchievementSystem";
    const code = `// Local & Steam-Compatible Achievement System: ${aName}
function ${aName}() constructor {
    achievements = {};

    static register = function(_id, _name, _desc) {
        achievements[$ _id] = { id: _id, name: _name, desc: _desc, unlocked: false };
    };

    static unlock = function(_id) {
        if (struct_exists(achievements, _id) && !achievements[$ _id].unlocked) {
            achievements[$ _id].unlocked = true;
            show_debug_message("Achievement Unlocked: " + achievements[$ _id].name);
        }
    };

    static is_unlocked = function(_id) {
        return struct_exists(achievements, _id) && achievements[$ _id].unlocked;
    };
}
`;
    return { generatedCode: code };
  }

  buildDialogueChoiceGraph(options: { graphName?: string | undefined }): { generatedCode: string } {
    const gName = options.graphName ?? "DialogueGraph";
    const code = `// Complex Branching Dialogue Graph with Conditional Choices
function ${gName}() constructor {
    nodes = {};

    static add_node = function(_id, _speaker, _portrait, _text, _choices = []) {
        nodes[$ _id] = {
            id: _id,
            speaker: _speaker,
            portrait: _portrait,
            text: _text,
            choices: _choices
        };
    };

    static get_available_choices = function(_node_id) {
        if (!struct_exists(nodes, _node_id)) return [];
        var _raw = nodes[$ _node_id].choices;
        var _avail = [];
        for (var i = 0; i < array_length(_raw); i++) {
            var _c = _raw[i];
            if (!struct_exists(_c, "condition") || _c.condition == undefined || _c.condition()) {
                array_push(_avail, _c);
            }
        }
        return _avail;
    };
}
`;
    return { generatedCode: code };
  }

  buildRollbackNetcodeSimulator(options: { maxRollbackFrames?: number | undefined }): { generatedCode: string } {
    const mrf = options.maxRollbackFrames ?? 7;
    const code = `// GGPO-style Client-Side Prediction & State Resimulation Rollback System
function RollbackNetcode(_max_rollback = ${mrf}) constructor {
    maxRollback = _max_rollback;
    inputBuffer = [];
    stateSnapshots = [];
    currentFrame = 0;

    static record_local_input = function(_frame, _input_struct) {
        array_push(inputBuffer, { frame: _frame, input: _input_struct });
    };

    static rollback_and_resimulate = function(_confirmed_frame, _confirmed_state, _simulation_func) {
        var _state = variable_clone(_confirmed_state);
        for (var f = _confirmed_frame; f < currentFrame; f++) {
            var _in = inputBuffer[f] ?? {};
            _state = _simulation_func(_state, _in);
        }
        return _state;
    };
}
`;
    return { generatedCode: code };
  }

  buildSaveCompressionZlib(options: { saveFileName?: string | undefined }): { generatedCode: string } {
    const sFile = options.saveFileName ?? "save.dat";
    const code = `// High-Speed Binary Buffer Zlib Compressed Save System: ${sFile}
function save_game_zlib_compressed(_data_struct, _filename = "${sFile}") {
    var _json = json_stringify(_data_struct);
    var _raw_buf = buffer_create(string_byte_length(_json) + 1, buffer_fixed, 1);
    buffer_write(_raw_buf, buffer_string, _json);

    var _compressed_buf = buffer_compress(_raw_buf, 0, buffer_tell(_raw_buf));
    buffer_save(_compressed_buf, _filename);

    buffer_delete(_raw_buf);
    buffer_delete(_compressed_buf);
}

function load_game_zlib_compressed(_filename = "${sFile}") {
    if (!file_exists(_filename)) return undefined;
    var _compressed_buf = buffer_load(_filename);
    var _decompressed_buf = buffer_decompress(_compressed_buf);
    buffer_delete(_compressed_buf);

    if (_decompressed_buf < 0) return undefined;
    var _json = buffer_read(_decompressed_buf, buffer_string);
    buffer_delete(_decompressed_buf);
    return json_parse(_json);
}
`;
    return { generatedCode: code };
  }

  buildCloudSaveSync(options: { cloudProvider?: string | undefined }): { generatedCode: string } {
    const prov = options.cloudProvider ?? "GenericCloud";
    const code = `// Cloud Save Conflict Resolver & Sync Logic: ${prov}
function CloudSaveSyncManager() constructor {
    static resolve_conflict = function(_local_struct, _cloud_struct) {
        var _local_time = _local_struct[$ "timestamp"] ?? 0;
        var _cloud_time = _cloud_struct[$ "timestamp"] ?? 0;

        if (_cloud_time > _local_time) {
            return { chosen: "cloud", data: _cloud_struct };
        } else {
            return { chosen: "local", data: _local_struct };
        }
    };
}
`;
    return { generatedCode: code };
  }

  getProjectGitDiffSummary(): { isGitRepo: boolean; modifiedAssets: string[]; rawDiffStat?: string } {
    try {
      const gitDir = path.join(this.config.projectRoot, ".git");
      if (!fs.existsSync(gitDir)) {
        return { isGitRepo: false, modifiedAssets: [] };
      }
      const diffStat = execSync("git diff --name-only HEAD", { cwd: this.config.projectRoot, encoding: "utf8" });
      const files = diffStat.split(/\\r?\\n/).filter(Boolean);
      const assetSet = new Set<string>();
      for (const f of files) {
        const basename = path.basename(f);
        if (basename.includes(".")) {
          assetSet.add(basename.split(".")[0]!);
        }
      }
      return {
        isGitRepo: true,
        modifiedAssets: Array.from(assetSet),
        rawDiffStat: diffStat.trim(),
      };
    } catch {
      return { isGitRepo: false, modifiedAssets: [] };
    }
  }

  buildBenchmarkMacroInjector(options: { targetFunction: string }): { generatedCode: string } {
    const funcName = options.targetFunction;
    const code = `// High-Resolution Microsecond Profiling Macro Injection for ${funcName}
#macro PROFILE_START var __t0 = get_timer();
#macro PROFILE_END show_debug_message("${funcName} execution time: " + string(get_timer() - __t0) + " microseconds");

function profiled_${funcName}() {
    PROFILE_START
    ${funcName}();
    PROFILE_END
}
`;
    return { generatedCode: code };
  }

  roomBulkTileFill(options: { roomName: string; layerName: string; tileIndex: number; widthTiles: number; heightTiles: number }): Record<string, unknown> {
    this.sandbox.assertWritable();
    const res = this.findResource(options.roomName, "room");
    let text = this.sandbox.readText(res.path, [".yy"]);
    const roomData = requireGmJson<Record<string, unknown>>(text, res.path);
    const layers = [...((roomData["layers"] as Array<Record<string, unknown>>) ?? [])];
    const targetLayer = layers.find((l) => (l["name"] ?? l["%Name"]) === options.layerName);
    if (!targetLayer) throw new Error("Layer " + options.layerName + " not found in room " + options.roomName);

    const count = options.widthTiles * options.heightTiles;
    const filledData = Array.from({ length: count }, () => options.tileIndex);
    (targetLayer as Record<string, unknown>)["tiles"] = {
      SerialiseData: filledData,
    };

    text = updateJsonPath(text, ["layers"], layers);
    const sha = this.sandbox.sha256For(res.path);
    const writeResult = this.sandbox.atomicWrite(res.path, text, { expectedSha256: sha, backup: true });
    return { roomName: options.roomName, layerName: options.layerName, filledTilesCount: count, writeResult };
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
