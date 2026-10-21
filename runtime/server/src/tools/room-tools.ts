import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerRoomTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_current_room", "Get information about the current room", {}, async () => {
    try {
      const result = await gm.sendCommand("get_current_room", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "get_room_info",
    "Get detailed room information",
    { room_name: z.string() },
    async ({ room_name }) => {
      try {
        const result = await gm.sendCommand("get_room_info", { room_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "goto_room",
    "Navigate to a different room",
    { room_name: z.string() },
    async ({ room_name }) => {
      try {
        const result = await gm.sendCommand("goto_room", { room_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool("restart_room", "Restart the current room", {}, async () => {
    try {
      const result = await gm.sendCommand("restart_room", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_room_instances", "Get all instances in the current room with positions", {}, async () => {
    try {
      const result = await gm.sendCommand("get_room_instances", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_room_list", "Get a list of all rooms in the project", {}, async () => {
    try {
      const result = await gm.sendCommand("get_room_list", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "room_get_viewport",
    "Get viewport information for a view",
    { view_index: z.number().optional() },
    async ({ view_index }) => {
      try {
        const result = await gm.sendCommand("room_get_viewport", { view_index });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
