import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { installToolDiscovery } from "../src/tool-discovery.js";

test("compact discovery preserves validation, enables, disables and rejects unknown names", async () => {
  delete process.env.GM_MCP_TOOL_MODE;
  const server = new McpServer({ name: "test", version: "1" });
  const finish = installToolDiscovery(server);
  server.registerTool("gm_example", { description: "Inspect example", inputSchema: {} }, async () => ({ content: [{ type: "text", text: "ok" }] }));
  finish();
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await server.connect(a); await client.connect(b);
  try {
    assert.equal((await client.listTools()).tools.length, 2);
    const search = await client.callTool({ name: "gm_tools_search", arguments: { query: "example" } });
    assert.match(JSON.stringify(search), /gm_example/);
    const bad = await client.callTool({ name: "gm_tools_enable", arguments: { names: ["gm_example", "missing"] } });
    assert.equal(bad.isError, true);
    assert.equal((await client.listTools()).tools.length, 2);
    await client.callTool({ name: "gm_tools_enable", arguments: { names: ["gm_example"] } });
    assert.equal((await client.listTools()).tools.length, 3);
    assert.match(JSON.stringify(await client.callTool({ name: "gm_example", arguments: {} })), /ok/);
    await client.callTool({ name: "gm_tools_enable", arguments: { names: ["gm_example"], enabled: false } });
    assert.equal((await client.listTools()).tools.length, 2);
  } finally { await client.close(); await server.close(); }
});
