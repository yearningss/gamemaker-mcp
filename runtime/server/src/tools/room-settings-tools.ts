import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerRoomSettingsTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "set_room_size",
    "Set the width and height of a room",
    {
      width: z.number(),
      height: z.number(),
      room_name: z.string().optional().describe("Room name, defaults to current room"),
    },
    async ({ width, height, room_name }) => {
      try {
        const result = await gm.sendCommand("set_room_size", { width, height, room_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_room_background_color",
    "Set the background color of a room",
    {
      color: z.number(),
      room_name: z.string().optional(),
    },
    async ({ color, room_name }) => {
      try {
        const result = await gm.sendCommand("set_room_background_color", { color, room_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_room_physics",
    "Get the physics world settings for a room",
    {
      room_name: z.string().optional(),
    },
    async ({ room_name }) => {
      try {
        const result = await gm.sendCommand("get_room_physics", { room_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "create_room_instance_batch",
    "Create multiple instances at once in a batch",
    {
      object_name: z.string(),
      positions: z.array(z.object({ x: z.number(), y: z.number() })),
      layer_name: z.string().optional(),
    },
    async ({ object_name, positions, layer_name }) => {
      try {
        const result = await gm.sendCommand("create_room_instance_batch", { object_name, positions, layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_room_speed",
    "Set the game speed (room_speed)",
    {
      speed: z.number().describe("Game speed in frames per second"),
    },
    async ({ speed }) => {
      try {
        const result = await gm.sendCommand("set_room_speed", { speed });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
