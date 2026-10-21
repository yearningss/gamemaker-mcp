import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerFontTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_font_list",
    "Get a list of all font assets in the project",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_font_list");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_font_info",
    "Get detailed info about a font (name, size, bold, italic, first/last char)",
    { font_name: z.string() },
    async ({ font_name }) => {
      try {
        const result = await gm.sendCommand("get_font_info", { font_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_text_dimensions",
    "Measure text dimensions (width/height) with optional font and wrapping",
    {
      text: z.string(),
      font_name: z.string().optional(),
      sep: z.number().optional().describe("Line separation for _ext, default -1"),
      width: z.number().optional().describe("Max width for _ext wrapping, default -1")
    },
    async ({ text, font_name, sep, width }) => {
      try {
        const result = await gm.sendCommand("get_text_dimensions", { text, font_name, sep, width });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_draw_font",
    "Set the current drawing font",
    { font_name: z.string() },
    async ({ font_name }) => {
      try {
        const result = await gm.sendCommand("set_draw_font", { font_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_current_font",
    "Get the currently active drawing font",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_current_font");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
