import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const project = process.argv[2] || process.env.GAMEMAKER_PROJECT;
if (!project) {
  console.error("Usage: node scripts/smoke.mjs C:\\path\\to\\Game.yyp");
  process.exitCode = 2;
} else {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(scriptDir, "../dist/src/index.js");
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      GAMEMAKER_PROJECT: path.resolve(project),
      GAMEMAKER_MCP_MODE: "read-only",
      GAMEMAKER_MCP_ALLOW_BUILD: "0",
    }).filter((entry) => typeof entry[1] === "string"),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "gamemaker-mcp-smoke", version: "1.0.0" });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const prompts = await client.listPrompts();
    const resources = await client.listResources();
    const resourceTemplates = await client.listResourceTemplates();
    const calls = {};
    for (const name of [
      "gm_project_info",
      "gm_project_validate",
      "gm_project_statistics",
      "gm_gml_analyze",
      "gm_shader_analyze",
    ]) {
      const result = await client.callTool({ name, arguments: {} });
      calls[name] = {
        ok: result.isError !== true,
        content: result.content,
      };
    }
    console.log(
      JSON.stringify(
        {
          ok: Object.values(calls).every((call) => call.ok),
          toolCount: tools.tools.length,
          promptCount: prompts.prompts.length,
          resourceCount: resources.resources.length + resourceTemplates.resourceTemplates.length,
          prompts: prompts.prompts.map((prompt) => prompt.name).sort(),
          resources: resources.resources.map((resource) => resource.uri).sort(),
          resourceTemplates: resourceTemplates.resourceTemplates.map((resource) => resource.uriTemplate).sort(),
          tools: tools.tools.map((tool) => tool.name).sort(),
          calls,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}
