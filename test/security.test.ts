import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ProjectSandbox } from "../src/security.js";
import { createFixtureProject } from "./helpers.js";

test("path guard rejects traversal and absolute paths", () => {
  const fixture = createFixtureProject();
  const sandbox = new ProjectSandbox(fixture.root, "read-only", 1024 * 1024);
  assert.throws(() => sandbox.resolve("../outside.gml", { mustExist: false }), /escapes/);
  assert.throws(() => sandbox.resolve(path.resolve(fixture.root, "x.gml"), { mustExist: false }), /relative/);
});

test("atomic writes use optimistic concurrency and backups", () => {
  const fixture = createFixtureProject();
  const sandbox = new ProjectSandbox(fixture.root, "workspace-write", 1024 * 1024);
  const created = sandbox.atomicWrite("scripts/test/test.gml", "return 1;\n");
  assert.match(created.sha256, /^[a-f0-9]{64}$/);
  assert.equal(fs.readFileSync(path.join(fixture.root, "scripts/test/test.gml"), "utf8"), "return 1;\n");
  assert.throws(
    () => sandbox.atomicWrite("scripts/test/test.gml", "return 2;\n", { expectedSha256: "0".repeat(64) }),
    /changed since/,
  );
  const updated = sandbox.atomicWrite("scripts/test/test.gml", "return 2;\n", {
    expectedSha256: created.sha256,
  });
  assert.ok(updated.backupPath);
});
