import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerAudioTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_playing_sounds",
    "Get list of currently playing sounds",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_playing_sounds");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "play_sound",
    "Play a sound",
    { sound_name: z.string(), loop: z.boolean().optional(), gain: z.number().optional() },
    async ({ sound_name, loop, gain }) => {
      try {
        const result = await gm.sendCommand("play_sound", { sound_name, loop, gain });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "stop_sound",
    "Stop a playing sound",
    { sound_name: z.string() },
    async ({ sound_name }) => {
      try {
        const result = await gm.sendCommand("stop_sound", { sound_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_sound_volume",
    "Set the volume of a sound",
    { sound_name: z.string(), volume: z.number() },
    async ({ sound_name, volume }) => {
      try {
        const result = await gm.sendCommand("set_sound_volume", { sound_name, volume });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_audio_info",
    "Get audio system information",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_audio_info");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "stop_all_sounds",
    "Stop all currently playing sounds",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("stop_all_sounds");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
