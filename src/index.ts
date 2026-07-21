#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { discoverProjectFile, handleCliCommand, printHelp } from "./installer.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (handleCliCommand(argv)) {
    return;
  }

  if (!process.env.GAMEMAKER_PROJECT && argv.length === 0) {
    const discovered = discoverProjectFile();
    if (!discovered) {
      printHelp();
      return;
    }
  }

  const config = loadConfig(argv);
  const server = createServer(config);
  const transport = new StdioServerTransport();

  process.on("SIGINT", () => {
    void server.close().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void server.close().finally(() => process.exit(0));
  });

  await server.connect(transport);
  console.error(
    `[gamemaker-mcp] connected: ${config.projectFile} (${config.mode}, build=${config.allowBuild})`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[gamemaker-mcp] fatal: ${message}`);
  process.exit(1);
});
