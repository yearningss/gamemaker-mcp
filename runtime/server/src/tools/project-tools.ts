import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerProjectTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_project_info", "Get project metadata (GameMaker version, room order, etc.)", {}, async () => {
    try {
      const result = await gm.sendCommand("get_project_info", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_resource_tree", "Get the resource tree (objects, sprites, scripts, etc.)", {}, async () => {
    try {
      const result = await gm.sendCommand("get_resource_tree", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "search_resources",
    "Search resources by name",
    {
      query: z.string(),
      type: z.string().optional(),
    },
    async ({ query, type }) => {
      try {
        const result = await gm.sendCommand("search_resources", { query, type });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool("get_room_order", "Get the room execution order", {}, async () => {
    try {
      const result = await gm.sendCommand("get_room_order", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_config_info", "Get build configuration information", {}, async () => {
    try {
      const result = await gm.sendCommand("get_config_info", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_resource_count", "Get resource count statistics by type", {}, async () => {
    try {
      const result = await gm.sendCommand("get_resource_count", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
