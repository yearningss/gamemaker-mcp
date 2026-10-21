import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerVariableTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_global_variables", "Get all global variables", {}, async () => {
    try {
      const result = await gm.sendCommand("get_global_variables", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "set_global_variable",
    "Set a global variable",
    {
      variable: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    },
    async ({ variable, value }) => {
      try {
        const result = await gm.sendCommand("set_global_variable", { variable, value });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_instance_variable_value",
    "Get a specific variable from an instance",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("get_instance_variable_value", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_built_in_variables",
    "Get common built-in variable values for an instance (x, y, speed, direction, etc.)",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_built_in_variables", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "watch_variable",
    "Start watching a variable for changes",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("watch_variable", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_variable_type",
    "Get the type information of a variable",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("get_variable_type", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
