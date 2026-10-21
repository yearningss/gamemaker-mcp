import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerInstanceTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_all_instances", "Get all active instances in the current room", {}, async () => {
    try {
      const result = await gm.sendCommand("get_all_instances", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "get_instance_info",
    "Get detailed information about a specific instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_instance_info", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "find_instances_by_object",
    "Find all instances of a specific object",
    { object_name: z.string() },
    async ({ object_name }) => {
      try {
        const result = await gm.sendCommand("find_instances_by_object", { object_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_instance_variables",
    "Get all variables of an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_instance_variables", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_instance_variable",
    "Set a variable on an instance",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    },
    async ({ instance_id, variable, value }) => {
      try {
        const result = await gm.sendCommand("set_instance_variable", { instance_id, variable, value });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "create_instance",
    "Create a new instance",
    {
      object_name: z.string(),
      x: z.number(),
      y: z.number(),
      layer: z.string().optional(),
    },
    async ({ object_name, x, y, layer }) => {
      try {
        const result = await gm.sendCommand("create_instance", { object_name, x, y, layer });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "destroy_instance",
    "Destroy an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("destroy_instance", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "move_instance",
    "Move an instance to a new position",
    {
      instance_id: instanceIdSchema,
      x: z.number(),
      y: z.number(),
    },
    async ({ instance_id, x, y }) => {
      try {
        const result = await gm.sendCommand("move_instance", { instance_id, x, y });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool("get_instance_count", "Get the total number of active instances", {}, async () => {
    try {
      const result = await gm.sendCommand("get_instance_count", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "find_nearest_instance",
    "Find the nearest instance of an object type",
    {
      x: z.number(),
      y: z.number(),
      object_name: z.string(),
    },
    async ({ x, y, object_name }) => {
      try {
        const result = await gm.sendCommand("find_nearest_instance", { x, y, object_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
