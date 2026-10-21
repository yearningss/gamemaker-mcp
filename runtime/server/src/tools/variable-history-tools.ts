import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerVariableHistoryTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "enable_variable_tracking",
    "Start tracking a variable's value history over time",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
      max_samples: z.number().optional().describe("Max history samples to keep, default 300"),
    },
    async ({ instance_id, variable, max_samples }) => {
      try {
        const result = await gm.sendCommand("enable_variable_tracking", { instance_id, variable, max_samples });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "disable_variable_tracking",
    "Stop tracking a variable",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("disable_variable_tracking", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_variable_history",
    "Get the recorded value history of a tracked variable",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
      limit: z.number().optional().describe("Max entries to return, default 50"),
    },
    async ({ instance_id, variable, limit }) => {
      try {
        const result = await gm.sendCommand("get_variable_history", { instance_id, variable, limit });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_variable_change_count",
    "Get how many times a tracked variable has changed",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("get_variable_change_count", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "diff_variable_snapshots",
    "Compare current value to initial value of a tracked variable",
    {
      instance_id: instanceIdSchema,
      variable: z.string(),
    },
    async ({ instance_id, variable }) => {
      try {
        const result = await gm.sendCommand("diff_variable_snapshots", { instance_id, variable });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_all_tracked_variables",
    "Get a list of all currently tracked variables",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_all_tracked_variables");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
