import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerAnalyticsTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("start_event_log", "Start/enable the analytics event log", {}, async () => {
    try {
      const result = await gm.sendCommand("start_event_log", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("clear_event_log", "Clear all logged events", {}, async () => {
    try {
      const result = await gm.sendCommand("clear_event_log", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("log_event", "Log a custom analytics event", {
    event_type: z.string(),
    data: z.record(z.string(), z.any()).optional(),
    category: z.string().optional(),
  }, async ({ event_type, data, category }) => {
    try {
      const result = await gm.sendCommand("log_event", { event_type, data, category });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_event_log", "Get logged events with optional filters", {
    event_type: z.string().optional().describe("Filter by type"),
    category: z.string().optional(),
    limit: z.number().optional().describe("Max entries, default 100"),
  }, async ({ event_type, category, limit }) => {
    try {
      const result = await gm.sendCommand("get_event_log", { event_type, category, limit });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_play_session_stats", "Get play session statistics (duration, event counts, FPS average)", {}, async () => {
    try {
      const result = await gm.sendCommand("get_play_session_stats", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("generate_heatmap_data", "Generate heatmap grid data from position-based events", {
    event_type: z.string().optional(),
    grid_size: z.number().optional().describe("Grid cell size, default 32"),
    room_width: z.number().optional(),
    room_height: z.number().optional(),
  }, async ({ event_type, grid_size, room_width, room_height }) => {
    try {
      const result = await gm.sendCommand("generate_heatmap_data", { event_type, grid_size, room_width, room_height });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
