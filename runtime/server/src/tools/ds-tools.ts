import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerDsTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("inspect_ds_list", "Inspect the contents of a ds_list", {
    list_id: z.number(),
    start: z.number().optional(),
    count: z.number().optional(),
  }, async ({ list_id, start, count }) => {
    try {
      const result = await gm.sendCommand("inspect_ds_list", { list_id, start, count });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("inspect_ds_map", "Inspect the contents of a ds_map", { map_id: z.number() }, async ({ map_id }) => {
    try {
      const result = await gm.sendCommand("inspect_ds_map", { map_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("inspect_ds_grid", "Inspect the contents of a ds_grid", {
    grid_id: z.number(),
    x1: z.number().optional(),
    y1: z.number().optional(),
    x2: z.number().optional(),
    y2: z.number().optional(),
  }, async ({ grid_id, x1, y1, x2, y2 }) => {
    try {
      const result = await gm.sendCommand("inspect_ds_grid", { grid_id, x1, y1, x2, y2 });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("inspect_ds_stack", "Inspect the contents of a ds_stack", { stack_id: z.number() }, async ({ stack_id }) => {
    try {
      const result = await gm.sendCommand("inspect_ds_stack", { stack_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("inspect_array", "Inspect an array variable", {
    instance_id: instanceIdSchema,
    variable: z.string(),
    start: z.number().optional(),
    count: z.number().optional(),
  }, async ({ instance_id, variable, start, count }) => {
    try {
      const result = await gm.sendCommand("inspect_array", { instance_id, variable, start, count });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("inspect_struct", "Inspect a struct variable", {
    instance_id: instanceIdSchema,
    variable: z.string(),
  }, async ({ instance_id, variable }) => {
    try {
      const result = await gm.sendCommand("inspect_struct", { instance_id, variable });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
