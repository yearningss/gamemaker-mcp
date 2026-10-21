#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GameMakerConnection } from "./gamemaker-connection.js";
import { registerMetaTools } from "./tool-registry.js";

// Resources
import { registerResources } from "./resources/gm-resources.js";

const PORT = parseInt(process.env.GAMEMAKER_MCP_PORT || "6705", 10);
const HOST = process.env.GAMEMAKER_MCP_HOST || "127.0.0.1";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "gamemaker-mcp-runtime",
    version: "1.0.0",
  });

  const gm = new GameMakerConnection({ host: HOST, port: PORT });

  gm.on("connected", () => {
    process.stderr.write(`[GameMaker MCP] Connected to GameMaker at ${HOST}:${PORT}\n`);
  });

  gm.on("disconnected", () => {
    process.stderr.write("[GameMaker MCP] Disconnected from GameMaker\n");
  });

  gm.on("error", (err: Error) => {
    process.stderr.write(`[GameMaker MCP] Error: ${err.message}\n`);
  });

  // Register meta tools (list_tool_categories + load_category)
  // All 40 tool categories are loaded on-demand via load_category
  registerMetaTools(server, gm);

  // Register MCP Resources
  registerResources(server, gm);

  // Start the MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[GameMaker MCP] Server started. Waiting for GameMaker connection...\n");
}

main().catch((error) => {
  process.stderr.write(`[GameMaker MCP] Fatal error: ${error}\n`);
  process.exit(1);
});
