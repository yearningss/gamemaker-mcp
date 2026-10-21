import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerDrawingTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "draw_text_at",
    "Draw text at a position via the draw queue",
    {
      x: z.number(),
      y: z.number(),
      text: z.string(),
      color: z.number().optional(),
      alpha: z.number().optional(),
      font_name: z.string().optional(),
      persistent: z.boolean().optional().describe("If true, text persists every frame")
    },
    async ({ x, y, text, color, alpha, font_name, persistent }) => {
      try {
        const result = await gm.sendCommand("draw_text_at", { x, y, text, color, alpha, font_name, persistent });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "draw_rectangle_at",
    "Draw a rectangle via the draw queue",
    {
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      outline: z.boolean().optional(),
      color: z.number().optional(),
      alpha: z.number().optional(),
      persistent: z.boolean().optional()
    },
    async ({ x1, y1, x2, y2, outline, color, alpha, persistent }) => {
      try {
        const result = await gm.sendCommand("draw_rectangle_at", { x1, y1, x2, y2, outline, color, alpha, persistent });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "draw_circle_at",
    "Draw a circle via the draw queue",
    {
      x: z.number(),
      y: z.number(),
      radius: z.number(),
      outline: z.boolean().optional(),
      color: z.number().optional(),
      alpha: z.number().optional(),
      persistent: z.boolean().optional()
    },
    async ({ x, y, radius, outline, color, alpha, persistent }) => {
      try {
        const result = await gm.sendCommand("draw_circle_at", { x, y, radius, outline, color, alpha, persistent });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "draw_line_at",
    "Draw a line via the draw queue",
    {
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      width: z.number().optional(),
      color: z.number().optional(),
      alpha: z.number().optional(),
      persistent: z.boolean().optional()
    },
    async ({ x1, y1, x2, y2, width, color, alpha, persistent }) => {
      try {
        const result = await gm.sendCommand("draw_line_at", { x1, y1, x2, y2, width, color, alpha, persistent });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "draw_sprite_at",
    "Draw a sprite via the draw queue",
    {
      sprite_name: z.string(),
      x: z.number(),
      y: z.number(),
      subimg: z.number().optional(),
      xscale: z.number().optional(),
      yscale: z.number().optional(),
      rot: z.number().optional(),
      color: z.number().optional(),
      alpha: z.number().optional(),
      persistent: z.boolean().optional()
    },
    async ({ sprite_name, x, y, subimg, xscale, yscale, rot, color, alpha, persistent }) => {
      try {
        const result = await gm.sendCommand("draw_sprite_at", { sprite_name, x, y, subimg, xscale, yscale, rot, color, alpha, persistent });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_draw_color",
    "Set the default draw color for subsequent draw operations",
    {
      color: z.number().describe("GameMaker color value (e.g. 65535 for yellow, 255 for red)")
    },
    async ({ color }) => {
      try {
        const result = await gm.sendCommand("set_draw_color", { color });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_draw_alpha",
    "Set the default draw alpha for subsequent draw operations",
    {
      alpha: z.number().describe("Alpha 0.0 to 1.0")
    },
    async ({ alpha }) => {
      try {
        const result = await gm.sendCommand("set_draw_alpha", { alpha });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_draw_color",
    "Get the current draw color and alpha",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_draw_color", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_blend_mode",
    "Set the GPU blend mode via draw queue",
    {
      mode: z.number().describe("0=normal, 1=add, 2=subtract, 3=max")
    },
    async ({ mode }) => {
      try {
        const result = await gm.sendCommand("set_blend_mode", { mode });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "clear_draw_queue",
    "Clear the draw queue",
    {
      persistent_only: z.boolean().optional().describe("If true, only clear persistent items")
    },
    async ({ persistent_only }) => {
      try {
        const result = await gm.sendCommand("clear_draw_queue", { persistent_only });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
