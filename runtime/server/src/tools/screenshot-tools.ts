import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerScreenshotTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_game_screenshot",
    "Capture a screenshot of the game screen",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_game_screenshot") as { image: string; width: number; height: number };
        return {
          content: [
            { type: "image", data: result.image, mimeType: "image/png" },
            { type: "text", text: `Screenshot: ${result.width}x${result.height}` },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_gui_screenshot",
    "Capture a screenshot of the GUI layer",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_gui_screenshot") as { image: string; width: number; height: number };
        return {
          content: [
            { type: "image", data: result.image, mimeType: "image/png" },
            { type: "text", text: `Screenshot: ${result.width}x${result.height}` },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_surface_screenshot",
    "Capture a specific surface",
    { surface_id: z.number() },
    async ({ surface_id }) => {
      try {
        const result = await gm.sendCommand("get_surface_screenshot", { surface_id }) as { image: string; width: number; height: number };
        return {
          content: [
            { type: "image", data: result.image, mimeType: "image/png" },
            { type: "text", text: `Screenshot: ${result.width}x${result.height}` },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "compare_screenshots",
    "Compare two screenshots and highlight differences",
    { file_a: z.string().describe("Path to first screenshot file"), file_b: z.string().describe("Path to second screenshot file") },
    async ({ file_a, file_b }) => {
      try {
        const result = await gm.sendCommand("compare_screenshots", { file_a, file_b });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "start_recording",
    "Start recording frames",
    { interval: z.number().optional().describe("Capture interval in frames, default 1") },
    async ({ interval }) => {
      try {
        const result = await gm.sendCommand("start_recording", { interval });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "stop_recording",
    "Stop recording and get frame count",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("stop_recording");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
