import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerPhysicsTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_physics_info", "Get physics world information", {}, async () => {
    try {
      const result = await gm.sendCommand("get_physics_info", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("apply_force", "Apply a continuous force to a physics instance", {
    instance_id: instanceIdSchema,
    fx: z.number(),
    fy: z.number(),
    x_offset: z.number().optional(),
    y_offset: z.number().optional(),
  }, async ({ instance_id, fx, fy, x_offset, y_offset }) => {
    try {
      const result = await gm.sendCommand("apply_force", { instance_id, fx, fy, x_offset, y_offset });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("apply_impulse", "Apply an impulse to a physics instance", {
    instance_id: instanceIdSchema,
    fx: z.number(),
    fy: z.number(),
    x_offset: z.number().optional(),
    y_offset: z.number().optional(),
  }, async ({ instance_id, fx, fy, x_offset, y_offset }) => {
    try {
      const result = await gm.sendCommand("apply_impulse", { instance_id, fx, fy, x_offset, y_offset });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("set_physics_properties", "Set physics properties on an instance", {
    instance_id: instanceIdSchema,
    density: z.number().optional(),
    friction: z.number().optional(),
    restitution: z.number().optional(),
    linear_damping: z.number().optional(),
    angular_damping: z.number().optional(),
    sensor: z.boolean().optional(),
  }, async (params) => {
    try {
      const result = await gm.sendCommand("set_physics_properties", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_fixtures", "Get fixture information for a physics instance", { instance_id: instanceIdSchema }, async ({ instance_id }) => {
    try {
      const result = await gm.sendCommand("get_fixtures", { instance_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("raycast", "Perform a physics raycast", {
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    all_hits: z.boolean().optional(),
  }, async ({ x1, y1, x2, y2, all_hits }) => {
    try {
      const result = await gm.sendCommand("raycast", { x1, y1, x2, y2, all_hits });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
