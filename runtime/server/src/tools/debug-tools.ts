import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerDebugTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_fps", "Get the current FPS (frames per second)", {}, async () => {
    try {
      const result = await gm.sendCommand("get_fps", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_step_time", "Get the Step event execution time in microseconds", {}, async () => {
    try {
      const result = await gm.sendCommand("get_step_time", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "show_debug_overlay",
    "Toggle the debug overlay visibility",
    { visible: z.boolean() },
    async ({ visible }) => {
      try {
        const result = await gm.sendCommand("show_debug_overlay", { visible });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_error_log",
    "Get recent error log entries",
    { count: z.number().optional() },
    async ({ count }) => {
      try {
        const result = await gm.sendCommand("get_error_log", { count });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

}
