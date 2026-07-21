import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { generateGmlDocstrings, ProjectAnalysisService, validateGmlSnippet } from "../src/analysis.js";
import { GameMakerEditingService } from "../src/editing.js";
import { GameMakerProject } from "../src/project.js";
import { createFixtureProject } from "./helpers.js";

void test("generateGmlDocstrings produces Feather JSDoc headers", () => {
  const gml = `function scr_move(spd, dir = 0) {\n  return spd > 0;\n}`;
  const res = generateGmlDocstrings(gml);
  assert.ok(res.docstring.includes("/// @function scr_move(spd, dir)"));
  assert.ok(res.docstring.includes("/// @param {Any} spd"));
  assert.ok(res.docstring.includes("/// @param {Any} [dir=0]"));
  assert.ok(res.docstring.includes("/// @returns {Any}"));
});

void test("inspectSprite parses sprite YY metadata", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const sprDir = path.join(root, "sprites", "spr_player");
    fs.mkdirSync(sprDir, { recursive: true });
    const sprYy = path.join(sprDir, "spr_player.yy");
    fs.writeFileSync(
      sprYy,
      JSON.stringify(
        {
          name: "spr_player",
          width: 32,
          height: 32,
          bboxMode: 0,
          collisionKind: 1,
          sequence: { xorigin: 16, yorigin: 16, playbackSpeed: 30, playbackSpeedType: 0 },
          frames: [{}],
        },
        null,
        2,
      ),
      "utf8",
    );

    // Add to project resources
    const yypContent = JSON.parse(fs.readFileSync(projectFile, "utf8")) as { resources: unknown[] };
    yypContent.resources.push({ id: { name: "spr_player", path: "sprites/spr_player/spr_player.yy" } });
    fs.writeFileSync(projectFile, JSON.stringify(yypContent, null, 2), "utf8");

    const project = new GameMakerProject({
      projectRoot: root,
      projectFile,
      mode: "read-only",
      allowBuild: false,
      maxFileBytes: 1048576,
    });

    const info = project.inspectSprite("spr_player");
    assert.equal(info.name, "spr_player");
    assert.equal(info.width, 32);
    assert.equal(info.height, 32);
    assert.equal(info.origin.x, 16);
    assert.equal(info.origin.y, 16);
    assert.equal(info.framesCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("inspectSound parses sound YY metadata", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const sndDir = path.join(root, "sounds", "snd_laser");
    fs.mkdirSync(sndDir, { recursive: true });
    const sndYy = path.join(sndDir, "snd_laser.yy");
    fs.writeFileSync(
      sndYy,
      JSON.stringify(
        {
          name: "snd_laser",
          soundFile: "snd_laser.wav",
          sampleRate: 44100,
          bitDepth: 16,
          duration: 1.5,
          type: 0,
        },
        null,
        2,
      ),
      "utf8",
    );

    const yypContent = JSON.parse(fs.readFileSync(projectFile, "utf8")) as { resources: unknown[] };
    yypContent.resources.push({ id: { name: "snd_laser", path: "sounds/snd_laser/snd_laser.yy" } });
    fs.writeFileSync(projectFile, JSON.stringify(yypContent, null, 2), "utf8");

    const project = new GameMakerProject({
      projectRoot: root,
      projectFile,
      mode: "read-only",
      allowBuild: false,
      maxFileBytes: 1048576,
    });

    const info = project.inspectSound("snd_laser");
    assert.equal(info.name, "snd_laser");
    assert.equal(info.soundFile, "snd_laser.wav");
    assert.equal(info.duration, 1.5);
    assert.equal(info.sampleRate, 44100);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("findUnusedAssets detects unreferenced resources", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const sprDir = path.join(root, "sprites", "spr_unused");
    fs.mkdirSync(sprDir, { recursive: true });
    fs.writeFileSync(
      path.join(sprDir, "spr_unused.yy"),
      JSON.stringify({ name: "spr_unused" }, null, 2),
      "utf8",
    );

    const yypContent = JSON.parse(fs.readFileSync(projectFile, "utf8")) as { resources: unknown[] };
    yypContent.resources.push({ id: { name: "spr_unused", path: "sprites/spr_unused/spr_unused.yy" } });
    fs.writeFileSync(projectFile, JSON.stringify(yypContent, null, 2), "utf8");

    const project = new GameMakerProject({
      projectRoot: root,
      projectFile,
      mode: "read-only",
      allowBuild: false,
      maxFileBytes: 1048576,
    });

    const analysis = new ProjectAnalysisService(project);
    const res = analysis.findUnusedAssets();
    assert.ok(res.unused.some((u) => u.name === "spr_unused"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("validateGmlSnippet detects mismatched braces and warnings", () => {
  const badGml = "function test() {\n  if (a = b) {\n    var x = 5;\n";
  const res = validateGmlSnippet(badGml);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: { message: string }) => e.message.includes("Mismatched braces")));
  assert.ok(res.warnings.some((w: { message: string }) => w.message.includes("equality comparison")));
});

void test("profileCheck, i18nScan, and drawStateAudit analyze GML code", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const project = new GameMakerProject({
      projectRoot: root,
      projectFile,
      mode: "read-only",
      allowBuild: false,
      maxFileBytes: 1048576,
    });
    const analysis = new ProjectAnalysisService(project);

    const prof = analysis.profileCheck();
    assert.equal(typeof prof.filesScanned, "number");

    const i18n = analysis.i18nScan();
    assert.equal(typeof i18n.stringsFound, "number");

    const draw = analysis.drawStateAudit();
    assert.equal(typeof draw.drawEventsScanned, "number");

    const health = analysis.calculateHealthScore();
    assert.ok(health.score >= 0 && health.score <= 100);
    assert.ok(["A+", "A", "B", "C", "D", "F"].includes(health.grade));

    const hier = analysis.objectHierarchy();
    assert.equal(typeof hier.totalObjects, "number");

    const docs = analysis.exportProjectDocs();
    assert.ok(docs.markdown.includes("Project Documentation"));

    const dupes = analysis.findCodeDuplicates();
    assert.equal(typeof dupes.duplicatesFound, "number");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("powerhouse tools: sprite, sound, state machine, room layer, rename, and autofix", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const project = new GameMakerProject({
      projectRoot: root,
      projectFile,
      mode: "workspace-write",
      allowBuild: false,
      maxFileBytes: 1048576,
    });
    const editing = new GameMakerEditingService(project);

    const spr = project.createSprite({ name: "spr_player_idle", width: 32, height: 32 });
    assert.equal(spr.kind, "sprite");
    assert.equal(project.findResource("spr_player_idle", "sprite").name, "spr_player_idle");

    const snd = project.createSound({ name: "snd_coin", volume: 0.8 });
    assert.equal(snd.kind, "sound");
    assert.equal(project.findResource("snd_coin", "sound").name, "snd_coin");

    const sm = project.generateStateMachine({ scriptName: "scr_player_fsm" });
    assert.equal(sm.kind, "script");

    const roomFile = path.join(root, "rooms/rm_test/rm_test.yy");
    fs.mkdirSync(path.dirname(roomFile), { recursive: true });
    fs.writeFileSync(roomFile, JSON.stringify({ name: "rm_test", layers: [] }));
    const yyp = JSON.parse(fs.readFileSync(projectFile, "utf8")) as { resources: unknown[] };
    yyp.resources.push({ id: { name: "rm_test", path: "rooms/rm_test/rm_test.yy" } });
    fs.writeFileSync(projectFile, JSON.stringify(yyp, null, 2), "utf8");

    const roomSha = project.sandbox.sha256For("rooms/rm_test/rm_test.yy");
    const layer = editing.addRoomLayer({
      roomName: "rm_test",
      layerName: "Instances_Enemy",
      expectedRoomSha256: roomSha,
      layerType: "instance",
      depth: -100,
    });
    assert.equal(layer.layerName, "Instances_Enemy");

    const renamed = editing.renameAsset({ oldName: "scr_player_fsm", newName: "scr_player_fsm_renamed" });
    assert.equal(renamed.newName, "scr_player_fsm_renamed");

    const fix = project.autofixProject();
    assert.equal(typeof fix.repaired, "boolean");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
