import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { ProjectSandbox, sha256 } from "../src/security.js";
import { SnapshotService } from "../src/snapshots.js";
import type { AccessMode } from "../src/types.js";
import { createFixtureProject } from "./helpers.js";

function serviceFor(
  fixture: ReturnType<typeof createFixtureProject>,
  mode: AccessMode = "workspace-write",
): SnapshotService {
  return new SnapshotService({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode,
    maxFileBytes: 1024 * 1024,
  });
}

function writeFixtureFiles(root: string): void {
  fs.mkdirSync(path.join(root, "scripts", "demo"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "demo", "demo.gml"), "return 1;\n", "utf8");
  fs.mkdirSync(path.join(root, "notes"), { recursive: true });
  fs.writeFileSync(path.join(root, "notes", "guide.md"), "# Guide\n", "utf8");
  fs.writeFileSync(path.join(root, "preview.png"), Buffer.from([0, 1, 2, 3]));
  fs.mkdirSync(path.join(root, ".gamemaker-mcp", "backups"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".gamemaker-mcp", "backups", "ignored.gml"),
    "do_not_capture();\n",
    "utf8",
  );
}

test("snapshot create, list, and inspect capture only supported project text", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);

  const manifest = service.create({ label: "Before enemy AI" });
  assert.match(manifest.id, /^[A-Za-z0-9][A-Za-z0-9_-]+$/);
  assert.equal(manifest.label, "Before enemy AI");
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    ["Fixture.yyp", "notes/guide.md", "scripts/demo/demo.gml"],
  );
  assert.equal(manifest.files.some((file) => file.path.endsWith(".png")), false);
  assert.equal(manifest.files.some((file) => file.path.includes(".gamemaker-mcp")), false);

  const gml = manifest.files.find((file) => file.path.endsWith("demo.gml"));
  assert.ok(gml);
  assert.equal(gml.sha256, sha256("return 1;\n"));

  const listed = service.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, manifest.id);
  assert.equal(listed[0]?.fileCount, 3);

  const inspection = service.inspect(manifest.id);
  assert.equal(inspection.ok, true);
  assert.equal(inspection.verifiedFiles, manifest.fileCount);
  assert.deepEqual(inspection.issues, []);
});

test("restore requires workspace-write and restores deleted/changed files with backups", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const writable = serviceFor(fixture);
  const manifest = writable.create();
  const gmlPath = path.join(fixture.root, "scripts", "demo", "demo.gml");
  const guidePath = path.join(fixture.root, "notes", "guide.md");

  fs.writeFileSync(gmlPath, "return 99;\n", "utf8");
  fs.rmSync(guidePath);
  assert.throws(() => serviceFor(fixture, "read-only").restore(manifest.id), /read-only/);

  const restored = writable.restore(manifest.id);
  assert.equal(restored.restored, 2);
  assert.equal(restored.created, 1);
  assert.equal(restored.overwritten, 1);
  assert.equal(fs.readFileSync(gmlPath, "utf8"), "return 1;\n");
  assert.equal(fs.readFileSync(guidePath, "utf8"), "# Guide\n");

  const gmlResult = restored.files.find((file) => file.path.endsWith("demo.gml"));
  assert.equal(gmlResult?.action, "overwritten");
  assert.ok(gmlResult?.backupPath);
  assert.equal(
    fs.readFileSync(path.join(fixture.root, gmlResult!.backupPath!), "utf8"),
    "return 99;\n",
  );
});

test("restore verifies every payload before modifying the project", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const projectGml = path.join(fixture.root, "scripts", "demo", "demo.gml");
  const payloadGml = path.join(
    fixture.root,
    ".gamemaker-mcp",
    "snapshots",
    manifest.id,
    "files",
    "scripts",
    "demo",
    "demo.gml",
  );

  fs.writeFileSync(projectGml, "keep_current();\n", "utf8");
  fs.writeFileSync(payloadGml, "tampered();\n", "utf8");
  const inspection = service.inspect(manifest.id);
  assert.equal(inspection.ok, false);
  assert.match(inspection.issues.join("\n"), /mismatch/);
  assert.throws(() => service.restore(manifest.id), /integrity verification/);
  assert.equal(fs.readFileSync(projectGml, "utf8"), "keep_current();\n");
});

test("snapshot identifiers and manifest paths reject traversal", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  assert.throws(() => service.inspect("../outside"), /snapshotId is required/);
  assert.throws(() => service.restore("..\\outside"), /snapshotId is required/);

  const manifest = service.create();
  const manifestPath = path.join(
    fixture.root,
    ".gamemaker-mcp",
    "snapshots",
    manifest.id,
    "manifest.json",
  );
  const forged = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    files: Array<{ path: string }>;
  };
  forged.files[0]!.path = "../outside.gml";
  fs.writeFileSync(manifestPath, `${JSON.stringify(forged, null, 2)}\n`, "utf8");
  assert.throws(() => service.inspect(manifest.id), /Unsafe snapshot file path/);
});

test("snapshot creation and manifest inspection enforce a bounded total payload", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const tinyService = new SnapshotService({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    maxFileBytes: 1024 * 1024,
    maxSnapshotBytes: 10,
  });
  assert.throws(() => tinyService.create(), /total byte limit/);

  const service = serviceFor(fixture);
  const manifest = service.create();
  const limitedReader = new SnapshotService({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "read-only",
    maxFileBytes: 1024 * 1024,
    maxSnapshotBytes: manifest.totalBytes - 1,
  });
  assert.throws(() => limitedReader.inspect(manifest.id), /total byte limit/);
});

test("snapshot manifest must belong to the exact configured project file", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const manifestPath = path.join(
    fixture.root,
    ".gamemaker-mcp",
    "snapshots",
    manifest.id,
    "manifest.json",
  );
  const forged = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    projectFile: string;
  };
  forged.projectFile = "OtherProject.yyp";
  fs.writeFileSync(manifestPath, `${JSON.stringify(forged, null, 2)}\n`, "utf8");
  assert.throws(() => service.inspect(manifest.id), /belongs to OtherProject\.yyp/);
});

test("snapshot payload root cannot be replaced with a symlink or junction", (context) => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const snapshotDirectory = path.join(
    fixture.root,
    ".gamemaker-mcp",
    "snapshots",
    manifest.id,
  );
  const payloadRoot = path.join(snapshotDirectory, "files");
  const savedPayload = path.join(snapshotDirectory, "files-original");
  fs.renameSync(payloadRoot, savedPayload);
  try {
    fs.symlinkSync(fixture.root, payloadRoot, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    fs.renameSync(savedPayload, payloadRoot);
    context.skip(`Symlink creation is unavailable: ${String(error)}`);
    return;
  }

  try {
    assert.throws(() => service.inspect(manifest.id), /real directory/);
  } finally {
    fs.unlinkSync(payloadRoot);
    fs.renameSync(savedPayload, payloadRoot);
  }
});

test("restore uses the exact bytes verified before a later payload mutation", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const projectGml = path.join(fixture.root, "scripts", "demo", "demo.gml");
  const payloadGml = path.join(
    fixture.root,
    ".gamemaker-mcp",
    "snapshots",
    manifest.id,
    "files",
    "scripts",
    "demo",
    "demo.gml",
  );
  fs.writeFileSync(projectGml, "current();\n", "utf8");

  type Verification = {
    inspection: unknown;
    payloads: Map<string, Buffer>;
  };
  const internal = service as unknown as {
    verifySnapshot(snapshotId: string): Verification;
  };
  const originalVerify = internal.verifySnapshot.bind(service);
  internal.verifySnapshot = (snapshotId) => {
    const verified = originalVerify(snapshotId);
    fs.writeFileSync(payloadGml, "tampered_after_verify();\n", "utf8");
    return verified;
  };

  service.restore(manifest.id);
  assert.equal(fs.readFileSync(projectGml, "utf8"), "return 1;\n");
});

test("partial restore rolls back previously written files", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const guidePath = path.join(fixture.root, "notes", "guide.md");
  const gmlPath = path.join(fixture.root, "scripts", "demo", "demo.gml");
  fs.writeFileSync(guidePath, "guide before restore\n", "utf8");
  fs.writeFileSync(gmlPath, "gml before restore\n", "utf8");

  const internal = service as unknown as { sandbox: ProjectSandbox };
  const originalWrite = internal.sandbox.atomicWrite.bind(internal.sandbox);
  let calls = 0;
  internal.sandbox.atomicWrite = (...args) => {
    calls += 1;
    if (calls === 2) throw new Error("injected second-write failure");
    return originalWrite(...args);
  };

  assert.throws(
    () => service.restore(manifest.id),
    /Rollback completed for 1 change\(s\)/,
  );
  assert.equal(fs.readFileSync(guidePath, "utf8"), "guide before restore\n");
  assert.equal(fs.readFileSync(gmlPath, "utf8"), "gml before restore\n");
});

test("rollback refuses to overwrite a concurrent change and reports failure", () => {
  const fixture = createFixtureProject();
  writeFixtureFiles(fixture.root);
  const service = serviceFor(fixture);
  const manifest = service.create();
  const guidePath = path.join(fixture.root, "notes", "guide.md");
  const gmlPath = path.join(fixture.root, "scripts", "demo", "demo.gml");
  fs.writeFileSync(guidePath, "guide before restore\n", "utf8");
  fs.writeFileSync(gmlPath, "gml before restore\n", "utf8");

  const internal = service as unknown as { sandbox: ProjectSandbox };
  const originalWrite = internal.sandbox.atomicWrite.bind(internal.sandbox);
  let calls = 0;
  internal.sandbox.atomicWrite = (...args) => {
    calls += 1;
    if (calls === 2) {
      fs.writeFileSync(guidePath, "concurrent change\n", "utf8");
      throw new Error("injected second-write failure");
    }
    return originalWrite(...args);
  };

  assert.throws(
    () => service.restore(manifest.id),
    /Rollback failed: notes\/guide\.md: safe hash check failed/,
  );
  assert.equal(fs.readFileSync(guidePath, "utf8"), "concurrent change\n");
  assert.equal(fs.readFileSync(gmlPath, "utf8"), "gml before restore\n");
});
