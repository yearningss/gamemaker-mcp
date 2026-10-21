import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerAudioExtendedTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "create_audio_emitter",
    "Create a 3D audio emitter at a position",
    {
      x: z.number(),
      y: z.number(),
      falloff_ref: z.number().optional(),
      falloff_max: z.number().optional(),
      falloff_factor: z.number().optional()
    },
    async ({ x, y, falloff_ref, falloff_max, falloff_factor }) => {
      try {
        const result = await gm.sendCommand("create_audio_emitter", { x, y, falloff_ref, falloff_max, falloff_factor });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_emitter_position",
    "Set the position of an audio emitter",
    {
      emitter_id: z.number(),
      x: z.number(),
      y: z.number()
    },
    async ({ emitter_id, x, y }) => {
      try {
        const result = await gm.sendCommand("set_emitter_position", { emitter_id, x, y });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_emitter_gain",
    "Set the gain/volume of an audio emitter",
    {
      emitter_id: z.number(),
      gain: z.number().describe("Gain 0.0 to 1.0")
    },
    async ({ emitter_id, gain }) => {
      try {
        const result = await gm.sendCommand("set_emitter_gain", { emitter_id, gain });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "play_sound_on_emitter",
    "Play a sound on an audio emitter",
    {
      emitter_id: z.number(),
      sound_name: z.string(),
      loop: z.boolean().optional(),
      priority: z.number().optional()
    },
    async ({ emitter_id, sound_name, loop, priority }) => {
      try {
        const result = await gm.sendCommand("play_sound_on_emitter", { emitter_id, sound_name, loop, priority });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "free_audio_emitter",
    "Free/destroy an audio emitter",
    {
      emitter_id: z.number()
    },
    async ({ emitter_id }) => {
      try {
        const result = await gm.sendCommand("free_audio_emitter", { emitter_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_emitter_list",
    "Get a list of all tracked audio emitters",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_emitter_list");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_audio_listener",
    "Set the audio listener position",
    {
      x: z.number(),
      y: z.number(),
      z: z.number().optional()
    },
    async ({ x, y, z: zPos }) => {
      try {
        const result = await gm.sendCommand("set_audio_listener", { x, y, z: zPos });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_track_position",
    "Get the current playback position of a sound",
    {
      sound_instance: z.number().describe("Sound instance ID")
    },
    async ({ sound_instance }) => {
      try {
        const result = await gm.sendCommand("get_track_position", { sound_instance });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_track_position",
    "Set the playback position of a sound",
    {
      sound_instance: z.number(),
      position: z.number().describe("Position in seconds")
    },
    async ({ sound_instance, position }) => {
      try {
        const result = await gm.sendCommand("set_track_position", { sound_instance, position });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "load_audio_group",
    "Load an audio group into memory",
    {
      group_id: z.number()
    },
    async ({ group_id }) => {
      try {
        const result = await gm.sendCommand("load_audio_group", { group_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "unload_audio_group",
    "Unload an audio group from memory",
    {
      group_id: z.number()
    },
    async ({ group_id }) => {
      try {
        const result = await gm.sendCommand("unload_audio_group", { group_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
