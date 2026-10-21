import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerGameControlTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "pause_game",
    "Pause the game (freeze all instances)",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("pause_game");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "resume_game",
    "Resume a paused game",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("resume_game");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_game_speed",
    "Set the game speed (FPS target)",
    { speed: z.number() },
    async ({ speed }) => {
      try {
        const result = await gm.sendCommand("set_game_speed", { speed });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "restart_game",
    "Restart the game from the beginning",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("restart_game");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_game_state",
    "Get current game state (running, paused, room, etc.)",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_game_state");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "step_frame",
    "Advance the game by one frame (when paused)",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("step_frame");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
