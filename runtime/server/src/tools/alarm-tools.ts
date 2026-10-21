import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerAlarmTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_alarms",
    "Get alarm values for an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_alarms", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_alarm",
    "Set an alarm value on an instance",
    {
      instance_id: instanceIdSchema,
      alarm_index: z.number().describe("Alarm index 0-11"),
      value: z.number(),
    },
    async ({ instance_id, alarm_index, value }) => {
      try {
        const result = await gm.sendCommand("set_alarm", { instance_id, alarm_index, value });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_all_alarms",
    "Get all active alarms across all instances",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_all_alarms");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "cancel_alarm",
    "Cancel an alarm on an instance",
    { instance_id: instanceIdSchema, alarm_index: z.number() },
    async ({ instance_id, alarm_index }) => {
      try {
        const result = await gm.sendCommand("cancel_alarm", { instance_id, alarm_index });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
