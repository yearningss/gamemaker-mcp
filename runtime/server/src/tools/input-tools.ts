import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerInputTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "simulate_key_press",
    "Simulate a key press. Use 'frames' to auto-release after N frames (e.g. frames=1 for a single-tile move). Omit to hold until simulate_key_release is called. IMPORTANT: The game window must have focus, otherwise GML clears keyboard state every frame and the simulated press will have no effect.",
    {
      key: z.string().describe("Key name (e.g. 'vk_left', 'vk_space', 'ord_a')"),
      frames: z.number().int().positive().optional().describe("Auto-release after this many frames. 1 = single tap/move. 12+ = triggers key-repeat for multiple moves."),
    },
    async ({ key, frames }) => {
      try {
        const result = await gm.sendCommand("simulate_key_press", { key, ...(frames !== undefined ? { frames } : {}) });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_key_release",
    "Simulate a key release. IMPORTANT: The game window must have focus for keyboard simulation to work.",
    { key: z.string() },
    async ({ key }) => {
      try {
        const result = await gm.sendCommand("simulate_key_release", { key });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_mouse_move",
    "Simulate mouse movement to a position",
    { x: z.number(), y: z.number() },
    async ({ x, y }) => {
      try {
        const result = await gm.sendCommand("simulate_mouse_move", { x, y });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_mouse_click",
    "Simulate a mouse click",
    { x: z.number(), y: z.number(), button: z.enum(["left", "right", "middle"]).optional() },
    async ({ x, y, button }) => {
      try {
        const result = await gm.sendCommand("simulate_mouse_click", { x, y, button });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_mouse_wheel",
    "Simulate mouse wheel scrolling",
    { direction: z.enum(["up", "down"]), amount: z.number().optional() },
    async ({ direction, amount }) => {
      try {
        const result = await gm.sendCommand("simulate_mouse_wheel", { direction, amount });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_gamepad",
    "Simulate gamepad input",
    {
      pad_index: z.number().optional(),
      button: z.string().optional(),
      axis_h: z.number().optional(),
      axis_v: z.number().optional(),
    },
    async ({ pad_index, button, axis_h, axis_v }) => {
      try {
        const result = await gm.sendCommand("simulate_gamepad", { pad_index, button, axis_h, axis_v });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "simulate_input_sequence",
    "Execute a sequence of input actions with timing",
    {
      actions: z.array(
        z.object({
          type: z.string(),
          params: z.record(z.string(), z.unknown()),
          delay_ms: z.number().optional(),
        })
      ),
    },
    async ({ actions }) => {
      try {
        const result = await gm.sendCommand("simulate_input_sequence", { actions });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
