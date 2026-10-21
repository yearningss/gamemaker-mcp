import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerProfilingTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_performance_stats", "Get comprehensive performance statistics", {}, async () => {
    try {
      const result = await gm.sendCommand("get_performance_stats", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("start_profiling", "Start collecting profiling data", {
    duration_frames: z.number().optional().describe("Number of frames to profile, default 60"),
  }, async ({ duration_frames }) => {
    try {
      const result = await gm.sendCommand("start_profiling", { duration_frames });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("stop_profiling", "Stop profiling and return collected data", {}, async () => {
    try {
      const result = await gm.sendCommand("stop_profiling", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_profiling_report", "Get a formatted profiling report", {}, async () => {
    try {
      const result = await gm.sendCommand("get_profiling_report", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_texture_page_info", "Get texture page usage information", {}, async () => {
    try {
      const result = await gm.sendCommand("get_texture_page_info", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
