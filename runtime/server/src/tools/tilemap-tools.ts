import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerTilemapTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_tilemap_data",
    "Get tilemap data from a layer",
    {
      layer_name: z.string(),
      x1: z.number().optional(),
      y1: z.number().optional(),
      x2: z.number().optional(),
      y2: z.number().optional(),
    },
    async ({ layer_name, x1, y1, x2, y2 }) => {
      try {
        const result = await gm.sendCommand("get_tilemap_data", { layer_name, x1, y1, x2, y2 });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_tilemap_cell",
    "Set a tile at a position",
    { layer_name: z.string(), cell_x: z.number(), cell_y: z.number(), tile_index: z.number() },
    async ({ layer_name, cell_x, cell_y, tile_index }) => {
      try {
        const result = await gm.sendCommand("set_tilemap_cell", { layer_name, cell_x, cell_y, tile_index });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_tilemap_info",
    "Get tilemap information (dimensions, tile size)",
    { layer_name: z.string() },
    async ({ layer_name }) => {
      try {
        const result = await gm.sendCommand("get_tilemap_info", { layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "clear_tilemap",
    "Clear all tiles on a tilemap layer",
    { layer_name: z.string() },
    async ({ layer_name }) => {
      try {
        const result = await gm.sendCommand("clear_tilemap", { layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_tileset_info",
    "Get tileset information",
    { tileset_name: z.string() },
    async ({ tileset_name }) => {
      try {
        const result = await gm.sendCommand("get_tileset_info", { tileset_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "fill_tilemap_region",
    "Fill a region with a tile",
    {
      layer_name: z.string(),
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      tile_index: z.number(),
    },
    async ({ layer_name, x1, y1, x2, y2, tile_index }) => {
      try {
        const result = await gm.sendCommand("fill_tilemap_region", { layer_name, x1, y1, x2, y2, tile_index });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
