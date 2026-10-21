import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Capture public registration handles; no SDK internals or callback bypass.
export function installToolDiscovery(server: McpServer): () => void {
  const original = server.registerTool.bind(server);
  const tools = new Map<string, { description: string; handle: ReturnType<McpServer["registerTool"]> }>();
  server.registerTool = ((name: string, config: any, callback: any) => {
    const handle = original(name, config, callback);
    tools.set(name, { description: config.description ?? "", handle });
    return handle;
  }) as McpServer["registerTool"];
  return () => {
    server.registerTool = original;
    if (process.env.GM_MCP_TOOL_MODE === "full") return;
    for (const { handle } of tools.values()) handle.disable();
    original("gm_tools_search", {
      description: "Find tools by words in names/descriptions. Then enable selected names with gm_tools_enable.",
      inputSchema: { query: z.string().min(1), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(30).default(10) },
      annotations: { readOnlyHint: true },
    }, async ({ query, offset, limit }) => {
      const words = query.toLowerCase().split(/\s+/);
      const matches = [...tools].filter(([name, t]) => words.every(w => `${name} ${t.description}`.toLowerCase().includes(w)));
      return { content: [{ type: "text", text: JSON.stringify({ total: matches.length, tools: matches.slice(offset, offset + limit).map(([name, t]) => ({ name, description: t.description })) }) }] };
    });
    original("gm_tools_enable", {
      description: "Enable or disable named tools. Disable finished tools to keep context small. Unknown names fail atomically.",
      inputSchema: { names: z.array(z.string()).min(1).max(30), enabled: z.boolean().default(true) },
      annotations: { readOnlyHint: true },
    }, async ({ names, enabled }) => {
      const missing = names.filter(name => !tools.has(name));
      if (missing.length) return { isError: true, content: [{ type: "text", text: `Unknown tools: ${missing.join(", ")}` }] };
      for (const name of names) { const t = tools.get(name)!; if (enabled) t.handle.enable(); else t.handle.disable(); }
      return { content: [{ type: "text", text: JSON.stringify({ names, enabled }) }] };
    });
  };
}

