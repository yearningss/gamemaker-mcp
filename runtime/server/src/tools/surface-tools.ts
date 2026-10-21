import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerSurfaceTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("list_surfaces", "List all active surfaces", {}, async () => {
    try {
      const result = await gm.sendCommand("list_surfaces", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_surface_info", "Get surface information (size, exists)", { surface_id: z.number() }, async ({ surface_id }) => {
    try {
      const result = await gm.sendCommand("get_surface_info", { surface_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("capture_surface", "Capture a surface as an image", { surface_id: z.number() }, async ({ surface_id }) => {
    try {
      const result = await gm.sendCommand("capture_surface", { surface_id }) as { image: string; width: number; height: number };
      return { content: [{ type: "image", data: result.image, mimeType: "image/png" }, { type: "text", text: `Surface ${surface_id}: ${result.width}x${result.height}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("create_surface", "Create a new surface", { width: z.number(), height: z.number() }, async ({ width, height }) => {
    try {
      const result = await gm.sendCommand("create_surface", { width, height });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("free_surface", "Free a surface from memory", { surface_id: z.number() }, async ({ surface_id }) => {
    try {
      const result = await gm.sendCommand("free_surface", { surface_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
