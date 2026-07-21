import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  checkClientConfigs,
  checkGameMaker,
  checkNode,
  discoverProjectFile,
  getSupportedClients,
  handleCliCommand,
  writeClientConfig,
} from "../src/installer.js";
import { createFixtureProject } from "./helpers.js";

void test("installer node and gamemaker environment checks", () => {
  const nodeRes = checkNode();
  assert.equal(typeof nodeRes.ok, "boolean");
  assert.ok(nodeRes.version.startsWith("v"));
  assert.ok(nodeRes.execPath.length > 0);

  const gmRes = checkGameMaker();
  assert.equal(typeof gmRes.ok, "boolean");
  assert.ok(Array.isArray(gmRes.runtimes));
});

void test("discoverProjectFile resolves explicitly provided .yyp files and directories", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const fromFile = discoverProjectFile(projectFile);
    assert.equal(fromFile, fs.realpathSync(projectFile));

    const fromDir = discoverProjectFile(root);
    assert.equal(fromDir, fs.realpathSync(projectFile));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("writeClientConfig creates and safely merges mcpServers entries", () => {
  const { root, projectFile } = createFixtureProject();
  try {
    const targetFile = path.join(root, ".claude.json");

    // Initial write
    const success1 = writeClientConfig(targetFile, "C:\\test\\dist\\src\\index.js", projectFile);
    assert.equal(success1, true);

    const content1 = JSON.parse(fs.readFileSync(targetFile, "utf8")) as {
      mcpServers?: { gamemaker?: { command: string; args: string[]; env: { GAMEMAKER_PROJECT: string } } };
    };
    assert.ok(content1.mcpServers?.gamemaker);
    assert.equal(content1.mcpServers.gamemaker.env.GAMEMAKER_PROJECT, projectFile);

    // Merge into existing file without overwriting other keys
    const existingData = JSON.parse(fs.readFileSync(targetFile, "utf8")) as Record<string, unknown>;
    existingData["customField"] = "hello";
    fs.writeFileSync(targetFile, JSON.stringify(existingData, null, 2), "utf8");

    const success2 = writeClientConfig(targetFile, "C:\\test\\dist\\src\\index.js", projectFile);
    assert.equal(success2, true);

    const content2 = JSON.parse(fs.readFileSync(targetFile, "utf8")) as Record<string, unknown>;
    assert.equal(content2["customField"], "hello");
    assert.ok((content2["mcpServers"] as Record<string, unknown>)?.["gamemaker"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("checkClientConfigs detects configured client targets", () => {
  const { root, projectFile } = createFixtureProject();
  process.env.GAMEMAKER_TEST_HOME = root;
  try {
    const targetFile = path.join(root, ".gemini", "antigravity.json");
    writeClientConfig(targetFile, "C:\\test\\dist\\src\\index.js", projectFile);

    const clients = checkClientConfigs(projectFile);
    assert.ok(clients["antigravity"]);
    assert.equal(clients["antigravity"].installed, true);
    assert.ok(clients["antigravity"].paths.includes(targetFile));
  } finally {
    delete process.env.GAMEMAKER_TEST_HOME;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

void test("handleCliCommand routes doctor, init, connect, and help subcommands", () => {
  const { root, projectFile } = createFixtureProject();
  process.env.GAMEMAKER_TEST_HOME = root;
  try {
    const isDoctor = handleCliCommand(["doctor", projectFile]);
    assert.equal(isDoctor, true);

    const isHelp = handleCliCommand(["--help"]);
    assert.equal(isHelp, true);

    const isConnect = handleCliCommand(["connect", "antigravity", projectFile]);
    assert.equal(isConnect, true);

    const isUnknown = handleCliCommand(["someUnknownCommand"]);
    assert.equal(isUnknown, false);
  } finally {
    delete process.env.GAMEMAKER_TEST_HOME;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
