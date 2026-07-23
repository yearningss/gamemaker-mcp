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
  const badGml = "function test() {\n  if (a = b) {\n    var x = 5;\n    flexpanel_node_get_measure();\n";
  const res = validateGmlSnippet(badGml);
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e: { message: string }) => e.message.includes("Mismatched braces")));
  assert.ok(res.warnings.some((w: { message: string }) => w.message.includes("equality comparison")));
  assert.ok(res.warnings.some((w: { message: string }) => w.message.includes("GMRT 0.20.0 Compatibility")));
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

    // Font test
    const fontRes = project.createFont({ name: "fnt_arial", size: 16, bold: true });
    assert.equal(fontRes.kind, "font");
    const fontIns = project.inspectFont("fnt_arial");
    assert.equal(fontIns.size, 16);
    assert.equal(fontIns.bold, true);

    // Tileset test
    const tilesetRes = project.createTileset({ name: "ts_grass", spriteName: "spr_player_idle", tileSize: 32 });
    assert.equal(tilesetRes.kind, "tileset");
    const tilesetIns = project.inspectTileset("ts_grass");
    assert.equal(tilesetIns.tileSize, 32);

    // Anim curve test
    const curveRes = project.createAnimCurve({ name: "ac_bounce", channels: ["x", "y"] });
    assert.equal(curveRes.kind, "animcurve");
    const curveIns = project.inspectAnimCurve("ac_bounce");
    assert.ok(curveIns.channels.includes("x"));

    // Generators
    const ps = project.generateParticleSystem({ scriptName: "scr_parts" });
    assert.equal(ps.kind, "script");
    const gui = project.generateGuiLayout({ scriptName: "scr_gui" });
    assert.equal(gui.kind, "script");
    const inv = project.generateInventorySystem({ scriptName: "scr_inv" });
    assert.equal(inv.kind, "script");

    // Timeline test
    const timelineRes = project.createTimeline({
      name: "tl_spawner",
      moments: {
        "0": "show_debug_message('Start'); state = State.RUN;",
        "100": "show_debug_message('End'); state = State.JUMP;"
      }
    });
    assert.equal(timelineRes.kind, "timeline");
    const timelineIns = project.inspectTimeline("tl_spawner");
    assert.equal(timelineIns.momentsCount, 2);
    assert.equal(timelineIns.moments[0]?.moment, 0);

    // Macros test
    const macroScript = project.createScript(
      "scr_config",
      `#macro GAME_VERSION "1.0.0"\n#macro MAX_PLAYERS 4\n`
    );
    const macros = project.listMacros();
    assert.ok(macros.some((m) => m.name === "GAME_VERSION" && m.value === '"1.0.0"'));

    // State machine visualization test
    const fsmScript = project.createScript(
      "scr_fsm_example",
      `enum State { IDLE, RUN, JUMP }\nfunction update() {\n  switch(state) {\n    case State.IDLE:\n      if (keyboard_check(vk_right)) state = State.RUN;\n      break;\n  }\n}\n`
    );
    const scriptPath = `scripts/scr_fsm_example/scr_fsm_example.gml`;
    const fsmVis = project.visualizeStateMachine(scriptPath);
    assert.ok(fsmVis.states.includes("IDLE"));
    assert.ok(fsmVis.states.includes("RUN"));
    assert.ok(fsmVis.mermaid.includes("stateDiagram-v2"));

    // Event chain test
    const parentObj = editing.createObject({ name: "obj_actor" });
    const childObj = editing.createObject({ name: "obj_hero" });
    const heroSha = project.sandbox.sha256For(childObj.yyPath as string);
    editing.configureObject({
      objectName: "obj_hero",
      expectedObjectSha256: heroSha,
      parentObjectName: "obj_actor",
    });

    const actorSha = project.sandbox.sha256For(parentObj.yyPath as string);
    project.upsertObjectEvent({
      objectName: "obj_actor",
      event: "create",
      code: "hp = 100;",
      expectedObjectSha256: actorSha,
    });

    const chainInfo = project.getObjectEventChain({
      objectName: "obj_hero",
      eventName: "create",
    });
    assert.equal(chainInfo.chain.length, 2);
    assert.equal(chainInfo.chain[0]?.objectName, "obj_hero");
    assert.equal(chainInfo.chain[0]?.implementsEvent, false);
    assert.equal(chainInfo.chain[1]?.objectName, "obj_actor");
    assert.equal(chainInfo.chain[1]?.implementsEvent, true);

    // Dead GML code detect test
    project.createScript(
      "scr_combat",
      `function take_damage() { hp -= 10; }\nfunction unused_combat_function() { show_debug_message('Dead code'); }`
    );

    const actorSha2 = project.sandbox.sha256For(parentObj.yyPath as string);
    project.upsertObjectEvent({
      objectName: "obj_actor",
      event: "step",
      code: "take_damage();",
      expectedObjectSha256: actorSha2,
    });

    const deadFunctions = project.detectDeadCode();
    assert.ok(deadFunctions.some((f) => f.functionName === "unused_combat_function"));
    assert.ok(!deadFunctions.some((f) => f.functionName === "take_damage"));

    // GML testing framework tests
    const initTest = project.initTestFramework();
    assert.equal(initTest.name, "scr_test_framework");

    const suiteTest = project.createTestSuite({ suiteName: "player" });
    assert.equal(suiteTest.name, "scr_test_player");

    // Room setup test
    const runnerSetup = project.setupTestRunner();
    assert.ok(runnerSetup.targetRoomPath || runnerSetup.targetRoomCreationCodePath);

    // Datafiles & Groups tests
    const df = project.createDataFile({ filePath: "datafiles/config.json", content: '{"v":1}' });
    assert.equal(df.name, "config.json");
    const dfl = project.listDataFiles();
    assert.ok(dfl.some((f) => f.name === "config.json"));
    const dfr = project.readDataFile("config.json");
    assert.equal(dfr.content, '{"v":1}');

    const ag = project.listAudioGroups();
    assert.ok(Array.isArray(ag.audioGroups));
    const tg = project.listTextureGroups();
    assert.ok(Array.isArray(tg.textureGroups));

    // Global variables test
    project.createScript("scr_globals", "global.player_score = 100;\nvar s = global.player_score;");
    const gvars = project.listGlobalVars();
    const varsList = gvars.variables as Array<{ name: string }>;
    assert.ok(varsList.some((v) => v.name === "player_score"));

    // Physics audit and asset references test
    const pa = project.auditPhysics();
    assert.equal(typeof pa.totalObjects, "number");
    const refs = project.findAssetReferences("obj_actor");
    assert.equal(typeof refs.totalMatches, "number");

    // Enterprise tools test
    const i18nExt = project.extractI18nStrings();
    assert.equal(typeof i18nExt.extractedCount, "number");

    const shEffect = project.generateShaderEffect({ shaderName: "shd_outline", effectType: "outline" });
    assert.equal(shEffect.name, "shd_outline");

    const archAudit = project.auditArchitecture();
    assert.equal(typeof archAudit.architectureScore, "number");

    // IDE Integration tools test
    const pref = project.inspectIdePreferences();
    assert.equal(typeof pref.found, "boolean");

    const fthr = project.configureFeatherRules({ enabled: true });
    assert.equal(fthr.configPath, ".featherconfig");

    const cacheRes = project.clearProjectCache();
    assert.equal(typeof cacheRes.cleared, "boolean");

    const rec = project.getRecentProjects();
    assert.equal(typeof rec.totalRecent, "number");

    const fix = project.autofixProject();
    assert.equal(typeof fix.repaired, "boolean");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
