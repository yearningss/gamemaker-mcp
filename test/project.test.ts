import assert from "node:assert/strict";
import test from "node:test";

import { parseGmJson } from "../src/gm-json.js";
import { GameMakerProject } from "../src/project.js";
import type { ServerConfig } from "../src/types.js";
import { createFixtureProject } from "./helpers.js";

test("GameMaker JSON parser accepts trailing commas", () => {
  const parsed = parseGmJson<{ items: number[] }>(`{"items":[1,2,],}`);
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(parsed.value, { items: [1, 2] });
});

test("project summary and structural validation work", () => {
  const fixture = createFixtureProject();
  const config: ServerConfig = {
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: false,
    maxFileBytes: 1024 * 1024,
  };
  const project = new GameMakerProject(config);
  assert.equal(project.summary().name, "Fixture");
  assert.equal(project.summary().resourceCount, 0);
  assert.deepEqual(project.listAssets().assets, []);
  assert.equal(project.validate().ok, true);
});

test("script creation updates the YYP and remains valid", () => {
  const fixture = createFixtureProject();
  const project = new GameMakerProject({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: false,
    maxFileBytes: 1024 * 1024,
  });
  project.createScript("scr_test", "function scr_test() { return 42; }");
  const asset = project.findResource("scr_test", "script");
  assert.equal(asset.path, "scripts/scr_test/scr_test.yy");
  assert.equal(project.validate().ok, true);
});
