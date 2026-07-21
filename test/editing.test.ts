import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { GameMakerEditingService } from "../src/editing.js";
import { requireGmJson } from "../src/gm-json.js";
import { GameMakerProject } from "../src/project.js";
import type { AccessMode } from "../src/types.js";
import { createFixtureProject } from "./helpers.js";

interface EditingFixture {
  root: string;
  project: GameMakerProject;
  editing: GameMakerEditingService;
  objectPath: string;
  objectCodePath: string;
  roomPath: string;
  roomCodePath: string;
  vertexPath: string;
  fragmentPath: string;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createEditingFixture(mode: AccessMode = "workspace-write"): EditingFixture {
  const fixture = createFixtureProject();
  const objectPath = "objects/obj_actor/obj_actor.yy";
  const objectCodePath = "objects/obj_actor/Create_0.gml";
  const roomPath = "rooms/rm_test/rm_test.yy";
  const roomCodePath = "rooms/rm_test/RoomCreationCode.gml";
  const vertexPath = "shaders/shd_test/shd_test.vsh";
  const fragmentPath = "shaders/shd_test/shd_test.fsh";

  const folders = ["Objects", "Rooms", "Shaders"].map((name) => ({
    $GMFolder: "",
    "%Name": name,
    folderPath: `folders/${name}.yy`,
    name,
    resourceType: "GMFolder",
    resourceVersion: "2.0",
  }));
  for (const folder of folders) writeJson(path.join(fixture.root, folder.folderPath), folder);

  writeJson(path.join(fixture.root, objectPath), {
    $GMObject: "",
    "%Name": "obj_actor",
    eventList: [
      {
        $GMEvent: "v1",
        "%Name": "",
        collisionObjectId: null,
        eventNum: 0,
        eventType: 0,
        isDnD: false,
        name: "",
        resourceType: "GMEvent",
        resourceVersion: "2.0",
      },
    ],
    managed: true,
    name: "obj_actor",
    overriddenProperties: [],
    parent: { name: "Objects", path: "folders/Objects.yy" },
    parentObjectId: null,
    persistent: false,
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
    solid: false,
    spriteId: null,
    spriteMaskId: null,
    visible: true,
  });
  fs.writeFileSync(path.join(fixture.root, objectCodePath), "score = 1;\n", "utf8");

  writeJson(path.join(fixture.root, roomPath), {
    $GMRoom: "v1",
    "%Name": "rm_test",
    creationCodeFile: roomCodePath,
    inheritCode: false,
    inheritCreationOrder: false,
    inheritLayers: false,
    instanceCreationOrder: [],
    isDnd: false,
    layers: [
      {
        $GMRInstanceLayer: "",
        "%Name": "Instances",
        depth: 0,
        instances: [],
        layers: [],
        name: "Instances",
        resourceType: "GMRInstanceLayer",
        resourceVersion: "2.0",
        visible: true,
      },
    ],
    name: "rm_test",
    parent: { name: "Rooms", path: "folders/Rooms.yy" },
    physicsSettings: { PhysicsWorld: false },
    resourceType: "GMRoom",
    resourceVersion: "2.0",
    roomSettings: { Height: 360, persistent: false, Width: 640 },
    viewSettings: { enableViews: false },
    volume: 1,
  });
  fs.writeFileSync(path.join(fixture.root, roomCodePath), "global.started = true;\n", "utf8");

  writeJson(path.join(fixture.root, "shaders/shd_test/shd_test.yy"), {
    $GMShader: "",
    "%Name": "shd_test",
    name: "shd_test",
    parent: { name: "Shaders", path: "folders/Shaders.yy" },
    resourceType: "GMShader",
    resourceVersion: "2.0",
    type: 1,
  });
  fs.writeFileSync(
    path.join(fixture.root, vertexPath),
    "attribute vec3 in_Position;\nvarying vec2 v_uv;\nvoid main(){v_uv=in_Position.xy;gl_Position=vec4(in_Position,1.0);}\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(fixture.root, fragmentPath),
    "varying vec2 v_uv;\nvoid main(){gl_FragColor=vec4(v_uv,0.0,1.0);}\n",
    "utf8",
  );

  const yyp = JSON.parse(fs.readFileSync(fixture.projectFile, "utf8")) as Record<string, unknown>;
  yyp.Folders = folders;
  yyp.resources = [
    { id: { name: "obj_actor", path: objectPath } },
    { id: { name: "rm_test", path: roomPath } },
    { id: { name: "shd_test", path: "shaders/shd_test/shd_test.yy" } },
  ];
  yyp.RoomOrderNodes = [{ roomId: { name: "rm_test", path: roomPath } }];
  writeJson(fixture.projectFile, yyp);

  const project = new GameMakerProject({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode,
    allowBuild: false,
    maxFileBytes: 1024 * 1024,
  });
  return {
    root: fixture.root,
    project,
    editing: new GameMakerEditingService(project),
    objectPath,
    objectCodePath,
    roomPath,
    roomCodePath,
    vertexPath,
    fragmentPath,
  };
}

function relativeFiles(root: string): string[] {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) output.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return output.sort();
}

test("read-only inspection returns hashes and resolves project-relative room creation code", () => {
  const fixture = createEditingFixture();
  const before = fs.readFileSync(path.join(fixture.root, fixture.objectCodePath), "utf8");
  const files = fixture.editing.listFiles({ extensions: ["gml"] });
  assert.equal(files.total, 2);

  const preview = fixture.editing.previewGmlPatch({
    path: fixture.objectCodePath,
    search: "score = 1",
    replacement: "score = 2",
    expectedMatches: 1,
  });
  assert.equal(preview.matches, 1);
  assert.match(String(preview.sha256), /^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.objectCodePath), "utf8"), before);

  const events = fixture.editing.listObjectEvents("obj_actor");
  assert.equal(events.total, 1);
  const event = fixture.editing.readObjectEvent("obj_actor", "create");
  assert.equal(event.content, before);

  const room = fixture.editing.inspectRoom("rm_test") as {
    creationCode: { path: string; exists: boolean; content?: string } | null;
  };
  assert.equal(room.creationCode?.path, fixture.roomCodePath);
  assert.equal(room.creationCode?.exists, true);
  assert.equal(room.creationCode?.content, "global.started = true;\n");

  const shader = fixture.editing.inspectShader("shd_test") as {
    vertex: { hasMain: boolean };
    fragment: { hasMain: boolean };
    interfaceIssues: { missingInFragment: string[]; missingInVertex: string[] };
  };
  assert.equal(shader.vertex.hasMain, true);
  assert.equal(shader.fragment.hasMain, true);
  assert.deepEqual(shader.interfaceIssues, { missingInFragment: [], missingInVertex: [] });
});

test("workspace writes enforce hashes, preserve stale files, and create valid object metadata", () => {
  const fixture = createEditingFixture();
  const roomHash = fixture.project.sandbox.sha256For(fixture.roomPath);
  fixture.editing.configureRoom({
    roomName: "rm_test",
    expectedRoomSha256: roomHash,
    width: 800,
    height: 450,
    volume: 0.5,
  });
  const roomText = fs.readFileSync(path.join(fixture.root, fixture.roomPath), "utf8");
  const room = requireGmJson<{ roomSettings: { Width: number; Height: number }; volume: number }>(roomText, fixture.roomPath);
  assert.deepEqual(room.roomSettings, { Height: 450, persistent: false, Width: 800 });
  assert.equal(room.volume, 0.5);
  assert.throws(
    () => fixture.editing.configureRoom({ roomName: "rm_test", expectedRoomSha256: roomHash, width: 900 }),
    /changed since/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.roomPath), "utf8"), roomText);

  const vertexHash = fixture.project.sandbox.sha256For(fixture.vertexPath);
  const shaderWrite = fixture.editing.updateShaderSources({
    shaderName: "shd_test",
    vertex: "void main(){gl_Position=vec4(0.0);}",
    expectedVertexSha256: vertexHash,
  }) as { writes: { vertex: { backupPath?: string } } };
  assert.ok(shaderWrite.writes.vertex.backupPath);
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.vertexPath), "utf8").endsWith("\n"), true);

  const created = fixture.editing.createObject({ name: "obj_new", folderName: "Objects", visible: false });
  assert.equal(created.kind, "object");
  const object = requireGmJson<Record<string, unknown>>(
    fs.readFileSync(path.join(fixture.root, "objects/obj_new/obj_new.yy"), "utf8"),
    "obj_new.yy",
  );
  assert.equal(object.resourceType, "GMObject");
  assert.equal(object.visible, false);
  assert.equal(fixture.project.findResource("obj_new", "object").path, "objects/obj_new/obj_new.yy");
});

test("all mutating operations are blocked in read-only mode", () => {
  const fixture = createEditingFixture("read-only");
  const roomBefore = fs.readFileSync(path.join(fixture.root, fixture.roomPath), "utf8");
  const shaderBefore = fs.readFileSync(path.join(fixture.root, fixture.vertexPath), "utf8");
  assert.throws(() => fixture.editing.createFolder("NewFolder"), /read-only/);
  assert.throws(
    () => fixture.editing.configureRoom({ roomName: "rm_test", expectedRoomSha256: fixture.project.sandbox.sha256For(fixture.roomPath), width: 700 }),
    /read-only/,
  );
  assert.throws(
    () => fixture.editing.updateShaderSources({ shaderName: "shd_test", vertex: "void main(){}", expectedVertexSha256: fixture.project.sandbox.sha256For(fixture.vertexPath) }),
    /read-only/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.roomPath), "utf8"), roomBefore);
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.vertexPath), "utf8"), shaderBefore);
});

test("event deletion validates every hash before mutating object metadata", () => {
  const fixture = createEditingFixture();
  const before = fs.readFileSync(path.join(fixture.root, fixture.objectPath), "utf8");
  assert.throws(
    () =>
      fixture.editing.removeObjectEvent({
        objectName: "obj_actor",
        event: "create",
        expectedObjectSha256: fixture.project.sandbox.sha256For(fixture.objectPath),
        deleteCode: true,
      }),
    /expectedCodeSha256/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.objectPath), "utf8"), before);
  assert.equal(fs.existsSync(path.join(fixture.root, fixture.objectCodePath)), true);
});

test("two-stage shader update preflights both hashes before writing either file", () => {
  const fixture = createEditingFixture();
  const vertexBefore = fs.readFileSync(path.join(fixture.root, fixture.vertexPath), "utf8");
  const fragmentBefore = fs.readFileSync(path.join(fixture.root, fixture.fragmentPath), "utf8");
  assert.throws(
    () =>
      fixture.editing.updateShaderSources({
        shaderName: "shd_test",
        vertex: "void main(){gl_Position=vec4(1.0);}",
        fragment: "void main(){gl_FragColor=vec4(1.0);}",
        expectedVertexSha256: fixture.project.sandbox.sha256For(fixture.vertexPath),
        expectedFragmentSha256: "0".repeat(64),
      }),
    /changed since/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.vertexPath), "utf8"), vertexBefore);
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.fragmentPath), "utf8"), fragmentBefore);
});

test("room creation-code update preflights room metadata and leaves no orphan files", () => {
  const fixture = createEditingFixture();
  const filesBefore = relativeFiles(fixture.root);
  const codeBefore = fs.readFileSync(path.join(fixture.root, fixture.roomCodePath), "utf8");
  assert.throws(
    () =>
      fixture.editing.upsertRoomCreationCode({
        roomName: "rm_test",
        code: "global.started = false;",
        expectedRoomSha256: "0".repeat(64),
        expectedCodeSha256: fixture.project.sandbox.sha256For(fixture.roomCodePath),
      }),
    /changed since|metadata changed/,
  );
  assert.equal(fs.readFileSync(path.join(fixture.root, fixture.roomCodePath), "utf8"), codeBefore);
  assert.deepEqual(relativeFiles(fixture.root), filesBefore);
});

test("addRoomInstance adds object instance to room layer", () => {
  const fixture = createEditingFixture();
  const roomSha = fixture.project.sandbox.sha256For(fixture.roomPath);
  fixture.editing.addRoomInstance({
    roomName: "rm_test",
    objectName: "obj_actor",
    x: 100,
    y: 200,
    expectedRoomSha256: roomSha,
  });

  const updatedText = fs.readFileSync(path.join(fixture.root, fixture.roomPath), "utf8");
  const data = requireGmJson<Record<string, unknown>>(updatedText, fixture.roomPath);
  const layers = data["layers"] as Array<Record<string, unknown>>;
  const instanceLayer = layers.find((l) => l["resourceType"] === "GMRInstanceLayer")!;
  const instances = instanceLayer["instances"] as Array<Record<string, unknown>>;
  assert.ok(instances.some((inst) => inst["x"] === 100 && inst["y"] === 200));
});

test("Note asset creation, inspection, and content update", () => {
  const fixture = createEditingFixture();
  const created = fixture.project.createNote({
    name: "note_readme",
    content: "This is a documentation note.",
    folderName: "Notes",
  });
  assert.equal(created.kind, "note");
  assert.equal(created.txtPath, "notes/note_readme/note_readme.txt");

  const inspected = fixture.project.inspectNote("note_readme") as {
    content: string;
    sha256: string;
    lines: number;
  };
  assert.equal(inspected.content.trim(), "This is a documentation note.");
  assert.equal(inspected.lines, 1);

  const updated = fixture.editing.updateNoteContent({
    noteName: "note_readme",
    content: "Updated documentation note content.",
    expectedSha256: inspected.sha256,
  });
  assert.ok(updated.write);

  const reinspected = fixture.project.inspectNote("note_readme") as { content: string };
  assert.equal(reinspected.content.trim(), "Updated documentation note content.");
});
