import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerCollisionTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("check_collision_point", "Check for collisions at a specific point", {
    x: z.number(),
    y: z.number(),
    object_name: z.string().optional(),
  }, async ({ x, y, object_name }) => {
    try {
      const result = await gm.sendCommand("check_collision_point", { x, y, object_name });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("check_collision_rectangle", "Check for collisions in a rectangle", {
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    object_name: z.string().optional(),
  }, async ({ x1, y1, x2, y2, object_name }) => {
    try {
      const result = await gm.sendCommand("check_collision_rectangle", { x1, y1, x2, y2, object_name });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("check_collision_line", "Check for collisions along a line", {
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    object_name: z.string().optional(),
  }, async ({ x1, y1, x2, y2, object_name }) => {
    try {
      const result = await gm.sendCommand("check_collision_line", { x1, y1, x2, y2, object_name });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_collision_mask", "Get the collision mask info of an instance", { instance_id: instanceIdSchema }, async ({ instance_id }) => {
    try {
      const result = await gm.sendCommand("get_collision_mask", { instance_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("find_collisions", "Find all instances colliding with a given instance", { instance_id: instanceIdSchema }, async ({ instance_id }) => {
    try {
      const result = await gm.sendCommand("find_collisions", { instance_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
