import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerGcMemoryTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("gc_collect", "Force garbage collection", {}, async () => {
    try {
      const result = await gm.sendCommand("gc_collect", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("gc_get_stats", "Get garbage collector statistics", {}, async () => {
    try {
      const result = await gm.sendCommand("gc_get_stats", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool(
    "gc_set_target_frame_time",
    "Set the GC target frame time for incremental collection",
    { target_time: z.number().describe("Target frame time in microseconds, e.g. 16000 for 60fps") },
    async ({ target_time }) => {
      try {
        const result = await gm.sendCommand("gc_set_target_frame_time", { target_time });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool("get_surface_memory", "Estimate memory used by tracked surfaces", {}, async () => {
    try {
      const result = await gm.sendCommand("get_surface_memory", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_ds_memory_estimate", "Estimate memory used by data structure allocations", {}, async () => {
    try {
      const result = await gm.sendCommand("get_ds_memory_estimate", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_memory_snapshot", "Get a comprehensive memory usage snapshot", {}, async () => {
    try {
      const result = await gm.sendCommand("get_memory_snapshot", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
