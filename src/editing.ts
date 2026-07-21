import fs from "node:fs";
import path from "node:path";

import { applyEdits, modify, type JSONPath } from "jsonc-parser";

import { requireGmJson, stringifyGmJson } from "./gm-json.js";
import { GameMakerProject } from "./project.js";

const EVENT_SPECS = {
  create: { eventType: 0, eventNum: 0, file: "Create_0.gml" },
  destroy: { eventType: 1, eventNum: 0, file: "Destroy_0.gml" },
  alarm0: { eventType: 2, eventNum: 0, file: "Alarm_0.gml" },
  step: { eventType: 3, eventNum: 0, file: "Step_0.gml" },
  begin_step: { eventType: 3, eventNum: 1, file: "Step_1.gml" },
  end_step: { eventType: 3, eventNum: 2, file: "Step_2.gml" },
  collision: { eventType: 4, eventNum: 0, file: "Collision_0.gml" },
  keyboard: { eventType: 5, eventNum: 0, file: "Keyboard_0.gml" },
  mouse: { eventType: 6, eventNum: 0, file: "Mouse_0.gml" },
  other: { eventType: 7, eventNum: 0, file: "Other_0.gml" },
  room_start: { eventType: 7, eventNum: 4, file: "Other_4.gml" },
  room_end: { eventType: 7, eventNum: 5, file: "Other_5.gml" },
  draw: { eventType: 8, eventNum: 0, file: "Draw_0.gml" },
  draw_gui: { eventType: 8, eventNum: 64, file: "Draw_64.gml" },
  key_press: { eventType: 9, eventNum: 0, file: "KeyPress_0.gml" },
  key_release: { eventType: 10, eventNum: 0, file: "KeyRelease_0.gml" },
  trigger: { eventType: 11, eventNum: 0, file: "Trigger_0.gml" },
  cleanup: { eventType: 12, eventNum: 0, file: "CleanUp_0.gml" },
  gesture: { eventType: 13, eventNum: 0, file: "Gesture_0.gml" },
  pre_create: { eventType: 14, eventNum: 0, file: "PreCreate_0.gml" },
} as const;

export const extendedEventNames = Object.keys(EVENT_SPECS) as ExtendedEventName[];
export type ExtendedEventName = keyof typeof EVENT_SPECS;

interface ObjectEvent {
  eventType?: number;
  eventNum?: number;
  collisionObjectId?: { name?: string; path?: string } | null;
  [key: string]: unknown;
}

interface ObjectData {
  eventList?: ObjectEvent[];
  [key: string]: unknown;
}

interface YypData {
  resources?: Array<{ id?: { name?: string; path?: string } }>;
  Folders?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

interface RoomLayer {
  name?: string;
  resourceType?: string;
  depth?: number;
  visible?: boolean | undefined;
  instances?: Array<Record<string, unknown>>;
  layers?: RoomLayer[];
  [key: string]: unknown;
}

interface RoomData {
  name?: string;
  creationCodeFile?: string;
  roomSettings?: Record<string, unknown>;
  viewSettings?: Record<string, unknown>;
  physicsSettings?: Record<string, unknown>;
  layers?: RoomLayer[];
  volume?: number | undefined;
  [key: string]: unknown;
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

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
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

function knownEventName(
  eventType: number | undefined,
  eventNum: number | undefined,
): ExtendedEventName | undefined {
  return extendedEventNames.find((name) => {
    const spec = EVENT_SPECS[name];
    return spec.eventType === eventType && spec.eventNum === eventNum;
  });
}

function selectObjectEvent(
  events: ObjectEvent[],
  selector: { eventType: number; eventNum: number; collisionObjectName?: string | undefined },
): ObjectEvent {
  const matches = events.filter((event) => {
    if (event.eventType !== selector.eventType || event.eventNum !== selector.eventNum) return false;
    if (selector.collisionObjectName !== undefined) {
      return event.collisionObjectId?.name === selector.collisionObjectName;
    }
    return true;
  });
  if (matches.length === 0) {
    throw new Error(
      `Event ${selector.eventType}:${selector.eventNum}` +
        (selector.collisionObjectName ? `:${selector.collisionObjectName}` : "") +
        " does not exist",
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Event selector ${selector.eventType}:${selector.eventNum} is ambiguous; provide collisionObjectName`,
    );
  }
  return matches[0]!;
}
function eventCodeFile(event: ObjectEvent): string | undefined {
  if (event.eventType === 4 && event.collisionObjectId?.name) {
    return `Collision_${event.collisionObjectId.name}.gml`;
  }
  const known = knownEventName(event.eventType, event.eventNum);
  if (known) return EVENT_SPECS[known].file;
  const num = event.eventNum ?? 0;
  const prefixes: Record<number, string> = {
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
  const prefix = event.eventType === undefined ? undefined : prefixes[event.eventType];
  return prefix ? `${prefix}_${num}.gml` : undefined;
}

function assetReferencedPath(directory: string, referencedPath: string): string {
  const normalizedReference = path.posix.normalize(referencedPath.replaceAll("\\", "/"));
  if (!normalizedReference || normalizedReference === "." || path.posix.isAbsolute(normalizedReference)) {
    throw new Error(`Invalid asset-referenced path: ${referencedPath}`);
  }
  const candidate = normalizedReference.includes("/")
    ? normalizedReference
    : `${directory}/${normalizedReference}`;
  const normalizedCandidate = path.posix.normalize(candidate);
  if (!normalizedCandidate.startsWith(`${directory}/`)) {
    throw new Error(`Referenced file must stay inside ${directory}: ${referencedPath}`);
  }
  return normalizedCandidate;
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split(/\r?\n/).length - (content.endsWith("\n") ? 1 : 0);
}

function variableNames(source: string, qualifier: string): string[] {
  const matcher = new RegExp(`\\b${qualifier}\\s+\\w+\\s+(\\w+)`, "g");
  return [...source.matchAll(matcher)].map((match) => match[1]!).filter(Boolean);
}

function summarizeLayer(layer: RoomLayer): Record<string, unknown> {
  return {
    name: layer.name ?? "",
    type: layer.resourceType ?? "",
    depth: layer.depth ?? 0,
    visible: layer.visible ?? true,
    instanceCount: layer.instances?.length ?? 0,
    childCount: layer.layers?.length ?? 0,
    ...(layer.layers?.length ? { children: layer.layers.map(summarizeLayer) } : {}),
  };
}

function collectInstances(layers: RoomLayer[], layerPath: string[] = []): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  for (const layer of layers) {
    const nextLayerPath = [...layerPath, layer.name ?? "<unnamed>"];
    for (const instance of layer.instances ?? []) {
      const objectId = instance.objectId as { name?: string; path?: string } | undefined;
      output.push({
        name: instance.name ?? "",
        object: objectId?.name ?? null,
        objectPath: objectId?.path ?? null,
        layer: nextLayerPath.join("/"),
        x: instance.x ?? 0,
        y: instance.y ?? 0,
        scaleX: instance.scaleX ?? 1,
        scaleY: instance.scaleY ?? 1,
        rotation: instance.rotation ?? 0,
        creationCodeFile: instance.creationCodeFile ?? "",
      });
    }
    output.push(...collectInstances(layer.layers ?? [], nextLayerPath));
  }
  return output;
}

export class GameMakerEditingService {
  readonly project: GameMakerProject;

  constructor(project: GameMakerProject) {
    this.project = project;
  }

  listFiles(options: {
    extensions?: string[] | undefined;
    query?: string | undefined;
    offset?: number | undefined;
    limit?: number | undefined;
  } = {}): { total: number; offset: number; limit: number; files: Array<Record<string, unknown>> } {
    const extensions = options.extensions?.map((value) => {
      const lower = value.toLowerCase();
      return lower.startsWith(".") ? lower : `.${lower}`;
    });
    const query = options.query?.toLowerCase();
    const relativePaths = walkFiles(this.project.config.projectRoot)
      .map((absolutePath) => this.project.sandbox.relative(absolutePath))
      .filter((relativePath) => !extensions?.length || extensions.includes(path.extname(relativePath).toLowerCase()))
      .filter((relativePath) => !query || relativePath.toLowerCase().includes(query))
      .sort();
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.min(1000, Math.max(1, options.limit ?? 200));
    const files = relativePaths.slice(offset, offset + limit).map((relativePath) => {
      const stat = fs.statSync(this.project.sandbox.resolve(relativePath));
      const canHash = stat.size <= this.project.config.maxFileBytes;
      return {
        path: relativePath,
        extension: path.extname(relativePath).toLowerCase(),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        sha256: canHash ? this.project.sandbox.sha256For(relativePath) : null,
        ...(canHash ? {} : { hashOmitted: `file exceeds ${this.project.config.maxFileBytes} byte limit` }),
      };
    });
    return { total: relativePaths.length, offset, limit, files };
  }
  previewGmlPatch(options: {
    path: string;
    search: string;
    replacement: string;
    expectedMatches?: number | undefined;
    contextLines?: number | undefined;
  }): Record<string, unknown> {
    if (!options.path.toLowerCase().endsWith(".gml")) throw new Error("Only .gml files are accepted");
    if (!options.search) throw new Error("search must not be empty");
    const current = this.project.readFile(options.path);
    const matches = current.content.split(options.search).length - 1;
    if (options.expectedMatches !== undefined && matches !== options.expectedMatches) {
      throw new Error(`Expected ${options.expectedMatches} exact matches, found ${matches}`);
    }
    const next = current.content.split(options.search).join(options.replacement);
    const before = current.content.split(/\r?\n/);
    const after = next.split(/\r?\n/);
    const changed = new Set<number>();
    const maxLength = Math.max(before.length, after.length);
    for (let index = 0; index < maxLength; index += 1) {
      if (before[index] !== after[index]) changed.add(index);
    }
    const context = Math.min(20, Math.max(0, options.contextLines ?? 2));
    const selected = new Set<number>();
    for (const index of changed) {
      for (let line = Math.max(0, index - context); line <= Math.min(maxLength - 1, index + context); line += 1) {
        selected.add(line);
      }
    }
    const preview = [...selected]
      .sort((a, b) => a - b)
      .slice(0, 300)
      .map((index) => ({ line: index + 1, before: before[index] ?? null, after: after[index] ?? null }));
    return {
      path: current.path,
      sha256: current.sha256,
      matches,
      changedLineCount: changed.size,
      previewTruncated: selected.size > preview.length,
      preview,
    };
  }

  listObjectEvents(objectName: string): Record<string, unknown> {
    const resource = this.project.findResource(objectName, "object");
    const objectText = this.project.sandbox.readText(resource.path, [".yy"]);
    const objectData = requireGmJson<ObjectData>(objectText, resource.path);
    const directory = path.posix.dirname(resource.path);
    const events = (objectData.eventList ?? []).map((event) => {
      const fileName = eventCodeFile(event);
      const codePath = fileName ? `${directory}/${fileName}` : undefined;
      const exists = Boolean(codePath && fs.existsSync(this.project.sandbox.resolve(codePath, { mustExist: false })));
      const content = exists && codePath ? this.project.sandbox.readText(codePath, [".gml"]) : "";
      return {
        name: knownEventName(event.eventType, event.eventNum) ?? null,
        eventType: event.eventType ?? null,
        eventNum: event.eventNum ?? null,
        collisionObject: event.collisionObjectId?.name ?? null,
        eventKey: `${event.eventType ?? -1}:${event.eventNum ?? -1}:${event.collisionObjectId?.name ?? ""}`,
        codePath: codePath ?? null,
        exists,
        lines: countLines(content),
        sha256: exists && codePath ? this.project.sandbox.sha256For(codePath) : null,
      };
    });
    return {
      object: objectName,
      path: resource.path,
      sha256: this.project.sandbox.sha256For(resource.path),
      total: events.length,
      events,
    };
  }

  readObjectEvent(objectName: string, eventName: ExtendedEventName): Record<string, unknown> {
    const spec = EVENT_SPECS[eventName];
    return {
      ...this.readObjectEventRaw({
        objectName,
        eventType: spec.eventType,
        eventNum: spec.eventNum,
      }),
      eventName,
    };
  }

  readObjectEventRaw(options: {
    objectName: string;
    eventType: number;
    eventNum: number;
    collisionObjectName?: string | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.objectName, "object");
    const objectData = requireGmJson<ObjectData>(
      this.project.sandbox.readText(resource.path, [".yy"]),
      resource.path,
    );
    const event = selectObjectEvent(objectData.eventList ?? [], options);
    const fileName = eventCodeFile(event);
    if (!fileName) {
      throw new Error(`Cannot determine code file for event ${options.eventType}:${options.eventNum}`);
    }
    const codePath = `${path.posix.dirname(resource.path)}/${fileName}`;
    return {
      object: options.objectName,
      event: {
        eventType: event.eventType,
        eventNum: event.eventNum,
        collisionObjectName: event.collisionObjectId?.name ?? null,
        eventKey: `${event.eventType ?? -1}:${event.eventNum ?? -1}:${event.collisionObjectId?.name ?? ""}`,
      },
      objectPath: resource.path,
      objectSha256: this.project.sandbox.sha256For(resource.path),
      ...this.project.readFile(codePath),
    };
  }
  removeObjectEvent(options: {
    objectName: string;
    event: ExtendedEventName;
    expectedObjectSha256: string;
    deleteCode?: boolean | undefined;
    expectedCodeSha256?: string | undefined;
  }): Record<string, unknown> {
    const spec = EVENT_SPECS[options.event];
    return {
      ...this.removeObjectEventRaw({
        objectName: options.objectName,
        eventType: spec.eventType,
        eventNum: spec.eventNum,
        expectedObjectSha256: options.expectedObjectSha256,
        ...(options.deleteCode !== undefined ? { deleteCode: options.deleteCode } : {}),
        ...(options.expectedCodeSha256 ? { expectedCodeSha256: options.expectedCodeSha256 } : {}),
      }),
      eventName: options.event,
    };
  }

  removeObjectEventRaw(options: {
    objectName: string;
    eventType: number;
    eventNum: number;
    collisionObjectName?: string | undefined;
    expectedObjectSha256: string;
    deleteCode?: boolean | undefined;
    expectedCodeSha256?: string | undefined;
  }): Record<string, unknown> {
    this.project.sandbox.assertWritable();
    const resource = this.project.findResource(options.objectName, "object");
    const text = this.project.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<ObjectData>(text, resource.path);
    const events = [...(data.eventList ?? [])];
    const eventRecord = selectObjectEvent(events, options);
    const index = events.indexOf(eventRecord);
    const fileName = eventCodeFile(eventRecord);
    if (!fileName) {
      throw new Error(`Cannot determine code file for event ${options.eventType}:${options.eventNum}`);
    }
    events.splice(index, 1);
    const codePath = `${path.posix.dirname(resource.path)}/${fileName}`;
    const codeExists = fs.existsSync(this.project.sandbox.resolve(codePath, { mustExist: false }));
    if (options.deleteCode && codeExists) {
      if (!options.expectedCodeSha256) {
        throw new Error("expectedCodeSha256 is required when deleteCode=true");
      }
      const currentCodeSha = this.project.sandbox.sha256For(codePath);
      if (currentCodeSha !== options.expectedCodeSha256.toLowerCase()) {
        throw new Error(`Event code changed since it was read: expected ${options.expectedCodeSha256}, current ${currentCodeSha}`);
      }
    }

    const objectWrite = this.project.sandbox.atomicWrite(
      resource.path,
      updateJsonPath(text, ["eventList"], events),
      { expectedSha256: options.expectedObjectSha256, backup: true },
    );

    let codeDeleted = false;
    let codeBackupPath: string | undefined;
    if (options.deleteCode && codeExists) {
      const content = this.project.sandbox.readText(codePath, [".gml"]);
      const backup = this.project.sandbox.atomicWrite(codePath, content, {
        expectedSha256: options.expectedCodeSha256!,
        backup: true,
      });
      fs.unlinkSync(this.project.sandbox.resolve(codePath));
      codeDeleted = true;
      codeBackupPath = backup.backupPath;
    }
    return {
      object: options.objectName,
      event: {
        eventType: eventRecord.eventType,
        eventNum: eventRecord.eventNum,
        collisionObjectName: eventRecord.collisionObjectId?.name ?? null,
      },
      objectWrite,
      codePath,
      codeDeleted,
      ...(codeBackupPath ? { codeBackupPath } : {}),
    };
  }
  createFolder(folderNameInput: string): Record<string, unknown> {
    this.project.sandbox.assertWritable();
    const folderName = safeResourceName(folderNameInput);
    const folderPath = `folders/${folderName}.yy`;
    const folderEntry = {
      $GMFolder: "",
      "%Name": folderName,
      folderPath,
      name: folderName,
      resourceType: "GMFolder",
      resourceVersion: "2.0",
    };

    const yypText = this.project.sandbox.readText(this.project.projectRelativePath, [".yyp"]);
    const yypSha256 = this.project.sandbox.sha256For(this.project.projectRelativePath);
    const yypData = requireGmJson<YypData>(yypText, this.project.projectRelativePath);
    const folders = [...(yypData.Folders ?? [])];
    const matchingFolder = folders.find(
      (folder) => folder.folderPath === folderPath || folder.name === folderName,
    );
    if (matchingFolder && matchingFolder.folderPath !== folderPath) {
      throw new Error(`Folder name ${folderName} is already mapped to ${String(matchingFolder.folderPath)}`);
    }

    const target = this.project.sandbox.resolve(folderPath, { mustExist: false });
    let fileWrite: Record<string, unknown> | null = null;
    if (!fs.existsSync(target)) {
      fileWrite = this.project.sandbox.atomicWrite(folderPath, stringifyGmJson(folderEntry));
    }

    let yypWrite: Record<string, unknown> | null = null;
    if (!matchingFolder) {
      folders.push(folderEntry);
      yypWrite = this.project.sandbox.atomicWrite(
        this.project.projectRelativePath,
        updateJsonPath(yypText, ["Folders"], folders),
        { expectedSha256: yypSha256, backup: true },
      );
    }
    return {
      name: folderName,
      path: folderPath,
      created: Boolean(fileWrite || yypWrite),
      fileCreated: Boolean(fileWrite),
      yypReferenceAdded: Boolean(yypWrite),
      fileWrite,
      yypWrite,
    };
  }
  createObject(options: {
    name: string;
    folderName?: string | undefined;
    visible?: boolean | undefined;
    solid?: boolean | undefined;
    persistent?: boolean | undefined;
  }): Record<string, unknown> {
    this.project.sandbox.assertWritable();
    const name = safeResourceName(options.name);
    const folderName = safeResourceName(options.folderName ?? "Objects");
    if (this.project.resources().some((resource) => resource.name === name)) {
      throw new Error(`Resource already exists: ${name}`);
    }
    this.createFolder(folderName);
    const folderPath = `folders/${folderName}.yy`;
    const yyPath = `objects/${name}/${name}.yy`;
    const object = {
      $GMObject: "",
      "%Name": name,
      eventList: [],
      managed: true,
      name,
      overriddenProperties: [],
      parent: { name: folderName, path: folderPath },
      parentObjectId: null,
      persistent: options.persistent ?? false,
      physicsAngularDamping: 0.1,
      physicsDensity: 0.5,
      physicsFriction: 0.2,
      physicsGroup: 1,
      physicsKinematic: false,
      physicsLinearDamping: 0.1,
      physicsObject: false,
      physicsRestitution: 0.1,
      physicsSensor: false,
      physicsShape: 1,
      physicsShapePoints: [],
      physicsStartAwake: true,
      properties: [],
      resourceType: "GMObject",
      resourceVersion: "2.0",
      solid: options.solid ?? false,
      spriteId: null,
      spriteMaskId: null,
      visible: options.visible ?? true,
    };
    const objectWrite = this.project.sandbox.atomicWrite(yyPath, stringifyGmJson(object));
    const yypText = this.project.sandbox.readText(this.project.projectRelativePath, [".yyp"]);
    const yypData = requireGmJson<YypData>(yypText, this.project.projectRelativePath);
    const resources = [...(yypData.resources ?? [])];
    resources.push({ id: { name, path: yyPath } });
    const yypWrite = this.project.sandbox.atomicWrite(
      this.project.projectRelativePath,
      updateJsonPath(yypText, ["resources"], resources),
      { expectedSha256: this.project.sandbox.sha256For(this.project.projectRelativePath), backup: true },
    );
    return { name, kind: "object", yyPath, objectWrite, yypWrite };
  }

  configureObject(options: {
    objectName: string;
    expectedObjectSha256: string;
    visible?: boolean | undefined;
    solid?: boolean | undefined;
    persistent?: boolean | undefined;
    managed?: boolean | undefined;
    spriteName?: string | null | undefined;
    maskSpriteName?: string | null | undefined;
    parentObjectName?: string | null | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.objectName, "object");
    let text = this.project.sandbox.readText(resource.path, [".yy"]);
    const updates: Array<[JSONPath, unknown]> = [];
    if (options.visible !== undefined) updates.push([["visible"], options.visible]);
    if (options.solid !== undefined) updates.push([["solid"], options.solid]);
    if (options.persistent !== undefined) updates.push([["persistent"], options.persistent]);
    if (options.managed !== undefined) updates.push([["managed"], options.managed]);
    const resourceRef = (name: string | null | undefined, kind: string) => {
      if (name === undefined) return undefined;
      if (name === null) return null;
      const target = this.project.findResource(name, kind);
      return { name: target.name, path: target.path };
    };
    const sprite = resourceRef(options.spriteName, "sprite");
    const mask = resourceRef(options.maskSpriteName, "sprite");
    const parentObject = resourceRef(options.parentObjectName, "object");
    if (sprite !== undefined) updates.push([["spriteId"], sprite]);
    if (mask !== undefined) updates.push([["spriteMaskId"], mask]);
    if (parentObject !== undefined) updates.push([["parentObjectId"], parentObject]);
    if (!updates.length) throw new Error("No object settings were provided");
    for (const [jsonPath, value] of updates) text = updateJsonPath(text, jsonPath, value);
    return this.project.sandbox.atomicWrite(resource.path, text, {
      expectedSha256: options.expectedObjectSha256,
      backup: true,
    });
  }

  inspectRoom(roomName: string): Record<string, unknown> {
    const resource = this.project.findResource(roomName, "room");
    const text = this.project.sandbox.readText(resource.path, [".yy"]);
    const data = requireGmJson<RoomData>(text, resource.path);
    const directory = path.posix.dirname(resource.path);
    const codePath = data.creationCodeFile ? assetReferencedPath(directory, data.creationCodeFile) : undefined;
    const codeExists = Boolean(codePath && fs.existsSync(this.project.sandbox.resolve(codePath, { mustExist: false })));
    return {
      name: roomName,
      path: resource.path,
      sha256: this.project.sandbox.sha256For(resource.path),
      roomSettings: data.roomSettings ?? {},
      viewSettings: data.viewSettings ?? {},
      physicsSettings: data.physicsSettings ?? {},
      volume: data.volume ?? 1,
      layers: (data.layers ?? []).map(summarizeLayer),
      instances: collectInstances(data.layers ?? []),
      creationCode: codePath
        ? {
            path: codePath,
            exists: codeExists,
            ...(codeExists
              ? {
                  sha256: this.project.sandbox.sha256For(codePath),
                  content: this.project.sandbox.readText(codePath, [".gml"]),
                }
              : {}),
          }
        : null,
    };
  }

  configureRoom(options: {
    roomName: string;
    expectedRoomSha256: string;
    width?: number | undefined;
    height?: number | undefined;
    persistent?: boolean | undefined;
    enableViews?: boolean | undefined;
    volume?: number | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.roomName, "room");
    let text = this.project.sandbox.readText(resource.path, [".yy"]);
    const updates: Array<[JSONPath, unknown]> = [];
    if (options.width !== undefined) {
      if (options.width < 1 || options.width > 16384) throw new Error("width must be between 1 and 16384");
      updates.push([["roomSettings", "Width"], Math.floor(options.width)]);
    }
    if (options.height !== undefined) {
      if (options.height < 1 || options.height > 16384) throw new Error("height must be between 1 and 16384");
      updates.push([["roomSettings", "Height"], Math.floor(options.height)]);
    }
    if (options.persistent !== undefined) updates.push([["roomSettings", "persistent"], options.persistent]);
    if (options.enableViews !== undefined) updates.push([["viewSettings", "enableViews"], options.enableViews]);
    if (options.volume !== undefined) {
      if (options.volume < 0 || options.volume > 1) throw new Error("volume must be between 0 and 1");
      updates.push([["volume"], options.volume]);
    }
    if (!updates.length) throw new Error("No room settings were provided");
    for (const [jsonPath, value] of updates) text = updateJsonPath(text, jsonPath, value);
    return this.project.sandbox.atomicWrite(resource.path, text, {
      expectedSha256: options.expectedRoomSha256,
      backup: true,
    });
  }

  addRoomInstance(options: {
    roomName: string;
    objectName: string;
    x: number;
    y: number;
    expectedRoomSha256: string;
    layerName?: string | undefined;
    scaleX?: number | undefined;
    scaleY?: number | undefined;
    rotation?: number | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.roomName, "room");
    const objectResource = this.project.findResource(options.objectName, "object");
    let text = this.project.sandbox.readText(resource.path, [".yy"]);
    const currentRoomSha = this.project.sandbox.sha256For(resource.path);
    if (currentRoomSha !== options.expectedRoomSha256.toLowerCase()) {
      throw new Error(`Room metadata changed since it was read: expected ${options.expectedRoomSha256}, current ${currentRoomSha}`);
    }

    const data = requireGmJson<Record<string, unknown>>(text, resource.path);
    const layers = (data["layers"] as Array<Record<string, unknown>> | undefined) ?? [];

    let instanceLayer: Record<string, unknown> | undefined;
    if (options.layerName) {
      instanceLayer = layers.find((l) => l["name"] === options.layerName);
    }
    if (!instanceLayer) {
      instanceLayer = layers.find((l) => l["resourceType"] === "GMRInstanceLayer");
    }
    if (!instanceLayer) {
      throw new Error(`No instance layer found in room ${options.roomName}`);
    }

    const instanceId = `inst_${Date.now().toString(16).padStart(8, "0")}`;
    const newInstance = {
      $GMRInstance: "",
      "%Name": instanceId,
      name: instanceId,
      objectId: { name: options.objectName, path: objectResource.path },
      properties: [],
      resourceType: "GMRInstance",
      resourceVersion: "2.0",
      rotation: options.rotation ?? 0,
      scaleX: options.scaleX ?? 1,
      scaleY: options.scaleY ?? 1,
      x: Math.round(options.x),
      y: Math.round(options.y),
    };

    const layerIndex = layers.indexOf(instanceLayer);
    const existingInstances = (instanceLayer["instances"] as Array<unknown> | undefined) ?? [];
    const updatedInstances = [...existingInstances, newInstance];

    text = updateJsonPath(text, ["layers", layerIndex, "instances"], updatedInstances);
    return this.project.sandbox.atomicWrite(resource.path, text, {
      expectedSha256: options.expectedRoomSha256,
      backup: true,
    });
  }

  upsertRoomCreationCode(options: {
    roomName: string;
    code: string;
    expectedRoomSha256: string;
    expectedCodeSha256?: string | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.roomName, "room");
    const text = this.project.sandbox.readText(resource.path, [".yy"]);
    const currentRoomSha = this.project.sandbox.sha256For(resource.path);
    if (currentRoomSha !== options.expectedRoomSha256.toLowerCase()) {
      throw new Error(`Room metadata changed since it was read: expected ${options.expectedRoomSha256}, current ${currentRoomSha}`);
    }
    const data = requireGmJson<RoomData>(text, resource.path);
    const directory = path.posix.dirname(resource.path);
    const metadataCodePath = data.creationCodeFile || `${directory}/RoomCreationCode.gml`;
    const codePath = assetReferencedPath(directory, metadataCodePath);
    const codeExists = fs.existsSync(this.project.sandbox.resolve(codePath, { mustExist: false }));
    if (codeExists) {
      if (!options.expectedCodeSha256) {
        throw new Error("expectedCodeSha256 is required to replace existing room creation code");
      }
      const currentCodeSha = this.project.sandbox.sha256For(codePath);
      if (currentCodeSha !== options.expectedCodeSha256.toLowerCase()) {
        throw new Error(`Room creation code changed since it was read: expected ${options.expectedCodeSha256}, current ${currentCodeSha}`);
      }
    }

    const codeWrite = this.project.sandbox.atomicWrite(codePath, ensureTrailingNewline(options.code), {
      ...(options.expectedCodeSha256 ? { expectedSha256: options.expectedCodeSha256 } : {}),
      backup: true,
    });
    let roomWrite: Record<string, unknown> | null = null;
    if (data.creationCodeFile !== metadataCodePath) {
      roomWrite = this.project.sandbox.atomicWrite(
        resource.path,
        updateJsonPath(text, ["creationCodeFile"], metadataCodePath),
        { expectedSha256: options.expectedRoomSha256, backup: true },
      );
    }
    return { room: options.roomName, codePath, codeWrite, roomWrite };
  }
  inspectShader(shaderName: string): Record<string, unknown> {
    const resource = this.project.findResource(shaderName, "shader");
    const directory = path.posix.dirname(resource.path);
    const vertexPath = `${directory}/${shaderName}.vsh`;
    const fragmentPath = `${directory}/${shaderName}.fsh`;
    const vertex = this.project.sandbox.readText(vertexPath, [".vsh"]);
    const fragment = this.project.sandbox.readText(fragmentPath, [".fsh"]);
    const vertexVaryings = variableNames(vertex, "varying");
    const fragmentVaryings = variableNames(fragment, "varying");
    const missingInFragment = vertexVaryings.filter((name) => !fragmentVaryings.includes(name));
    const missingInVertex = fragmentVaryings.filter((name) => !vertexVaryings.includes(name));
    return {
      name: shaderName,
      metadataPath: resource.path,
      vertex: {
        path: vertexPath,
        sha256: this.project.sandbox.sha256For(vertexPath),
        lines: countLines(vertex),
        attributes: variableNames(vertex, "attribute"),
        uniforms: variableNames(vertex, "uniform"),
        varyings: vertexVaryings,
        hasMain: /\bvoid\s+main\s*\(/.test(vertex),
      },
      fragment: {
        path: fragmentPath,
        sha256: this.project.sandbox.sha256For(fragmentPath),
        lines: countLines(fragment),
        uniforms: variableNames(fragment, "uniform"),
        varyings: fragmentVaryings,
        hasMain: /\bvoid\s+main\s*\(/.test(fragment),
      },
      interfaceIssues: { missingInFragment, missingInVertex },
    };
  }

  updateShaderSources(options: {
    shaderName: string;
    vertex?: string | undefined;
    fragment?: string | undefined;
    expectedVertexSha256?: string | undefined;
    expectedFragmentSha256?: string | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.shaderName, "shader");
    if (options.vertex === undefined && options.fragment === undefined) throw new Error("vertex or fragment is required");
    const directory = path.posix.dirname(resource.path);
    const vertexPath = `${directory}/${options.shaderName}.vsh`;
    const fragmentPath = `${directory}/${options.shaderName}.fsh`;

    if (options.vertex !== undefined) {
      if (!options.expectedVertexSha256) throw new Error("expectedVertexSha256 is required when writing vertex code");
      const currentVertexSha = this.project.sandbox.sha256For(vertexPath);
      if (currentVertexSha !== options.expectedVertexSha256.toLowerCase()) {
        throw new Error(`Vertex shader changed since it was read: expected ${options.expectedVertexSha256}, current ${currentVertexSha}`);
      }
    }
    if (options.fragment !== undefined) {
      if (!options.expectedFragmentSha256) throw new Error("expectedFragmentSha256 is required when writing fragment code");
      const currentFragmentSha = this.project.sandbox.sha256For(fragmentPath);
      if (currentFragmentSha !== options.expectedFragmentSha256.toLowerCase()) {
        throw new Error(`Fragment shader changed since it was read: expected ${options.expectedFragmentSha256}, current ${currentFragmentSha}`);
      }
    }

    const writes: Record<string, unknown> = {};
    if (options.vertex !== undefined) {
      writes.vertex = this.project.sandbox.atomicWrite(vertexPath, ensureTrailingNewline(options.vertex), {
        expectedSha256: options.expectedVertexSha256!,
        backup: true,
      });
    }
    if (options.fragment !== undefined) {
      writes.fragment = this.project.sandbox.atomicWrite(fragmentPath, ensureTrailingNewline(options.fragment), {
        expectedSha256: options.expectedFragmentSha256!,
        backup: true,
      });
    }
    return { name: options.shaderName, writes };
  }

  updateNoteContent(options: {
    noteName: string;
    content: string;
    expectedSha256: string;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.noteName, "note");
    const directory = path.posix.dirname(resource.path);
    const txtPath = `${directory}/${options.noteName}.txt`;
    const currentSha = this.project.sandbox.sha256For(txtPath);
    if (currentSha !== options.expectedSha256.toLowerCase()) {
      throw new Error(`Note text changed since it was read: expected ${options.expectedSha256}, current ${currentSha}`);
    }
    const write = this.project.sandbox.atomicWrite(txtPath, ensureTrailingNewline(options.content), {
      expectedSha256: options.expectedSha256,
      backup: true,
    });
    return { name: options.noteName, txtPath, write };
  }

  addRoomLayer(options: {
    roomName: string;
    layerName: string;
    expectedRoomSha256: string;
    layerType?: "instance" | "background" | "tilemap" | "asset" | undefined;
    depth?: number | undefined;
    visible?: boolean | undefined;
  }): Record<string, unknown> {
    const resource = this.project.findResource(options.roomName, "room");
    const text = this.project.sandbox.readText(resource.path, [".yy"]);
    const currentSha = this.project.sandbox.sha256For(resource.path);
    if (currentSha !== options.expectedRoomSha256.toLowerCase()) {
      throw new Error(`Room changed since it was read: expected ${options.expectedRoomSha256}, current ${currentSha}`);
    }
    const data = requireGmJson<RoomData>(text, resource.path);
    const layers = [...(data.layers ?? [])];
    const name = safeResourceName(options.layerName);

    if (layers.some((l) => l.name === name)) {
      throw new Error(`Layer ${name} already exists in room ${options.roomName}`);
    }

    const typeMap = {
      instance: "GMRInstanceLayer",
      background: "GMRBackgroundLayer",
      tilemap: "GMRTileLayer",
      asset: "GMRAssetLayer",
    };
    const resType = typeMap[options.layerType ?? "instance"];

    const newLayer: RoomLayer = {
      $GMRInstanceLayer: "",
      "%Name": name,
      depth: options.depth ?? 0,
      effectEnabled: true,
      effectType: null,
      gridX: 32,
      gridY: 32,
      hierarchyFrozen: false,
      instances: [],
      layers: [],
      name,
      properties: [],
      resourceType: resType,
      resourceVersion: "2.0",
      userdefinedDepth: false,
      visible: options.visible ?? true,
    };

    layers.push(newLayer);
    const nextText = updateJsonPath(text, ["layers"], layers);
    const write = this.project.sandbox.atomicWrite(resource.path, nextText, {
      expectedSha256: options.expectedRoomSha256,
      backup: true,
    });

    return { room: options.roomName, layerName: name, layerType: options.layerType ?? "instance", write };
  }

  renameAsset(options: {
    oldName: string;
    newName: string;
  }): Record<string, unknown> {
    const oldName = safeResourceName(options.oldName);
    const newName = safeResourceName(options.newName);
    if (oldName === newName) throw new Error("New name must be different from old name");

    const resource = this.project.resources().find((r) => r.name === oldName);
    if (!resource) throw new Error(`Asset not found: ${oldName}`);

    if (this.project.resources().some((r) => r.name === newName)) {
      throw new Error(`Asset with name ${newName} already exists`);
    }

    const dir = path.posix.dirname(resource.path);
    const parentDir = path.posix.dirname(dir);
    const newDir = `${parentDir}/${newName}`;
    const oldAbsDir = this.project.sandbox.resolve(dir, { mustExist: false });
    const newAbsDir = this.project.sandbox.resolve(newDir, { mustExist: false });

    if (fs.existsSync(oldAbsDir)) {
      fs.renameSync(oldAbsDir, newAbsDir);
    }

    if (fs.existsSync(newAbsDir)) {
      for (const file of fs.readdirSync(newAbsDir)) {
        if (file.startsWith(oldName)) {
          const oldFile = path.join(newAbsDir, file);
          const newFile = path.join(newAbsDir, file.replace(oldName, newName));
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    const yypText = this.project.sandbox.readText(this.project.projectRelativePath, [".yyp"]);
    const yyp = requireGmJson<YypData>(yypText, this.project.projectRelativePath);
    const newPath = `${parentDir}/${newName}/${newName}.yy`;
    const resources = (yyp.resources ?? []).map((entry) => {
      if (entry.id?.name === oldName || entry.id?.path === resource.path) {
        return { id: { name: newName, path: newPath } };
      }
      return entry;
    });
    this.project.sandbox.atomicWrite(
      this.project.projectRelativePath,
      updateJsonPath(yypText, ["resources"], resources),
      { expectedSha256: this.project.sandbox.sha256For(this.project.projectRelativePath), backup: true },
    );

    const regex = new RegExp(`\\b${oldName}\\b`, "g");
    let refactoredFiles = 0;

    for (const file of walkFiles(this.project.config.projectRoot)) {
      if (file.endsWith(".gml")) {
        const rel = this.project.sandbox.relative(file);
        const code = this.project.sandbox.readText(rel);
        if (regex.test(code)) {
          const updated = code.replace(regex, newName);
          this.project.sandbox.atomicWrite(rel, updated, { backup: true });
          refactoredFiles++;
        }
      }
    }

    return { oldName, newName, kind: resource.kind, newPath, refactoredFiles };
  }
}
