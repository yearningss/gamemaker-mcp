import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { createFixtureProject } from "./helpers.js";

test("stdio MCP server lists and calls GameMaker tools", async () => {
  const fixture = createFixtureProject();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(currentDir, "../src/index.js");
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      GAMEMAKER_PROJECT: fixture.projectFile,
      GAMEMAKER_MCP_MODE: "read-only",
      GAMEMAKER_MCP_ALLOW_BUILD: "0",
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "gamemaker-mcp-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    assert.ok(names.includes("gm_project_info"));
    assert.ok(names.includes("gm_build"));
    const result = await client.callTool({ name: "gm_project_info", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.match(JSON.stringify(result.content), /Fixture/);
  } finally {
    await client.close();
  }
});
