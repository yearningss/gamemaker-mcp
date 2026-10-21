import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerAnimationTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_sprite_info",
    "Get sprite information (frames, size, speed, origin). Provide sprite_name to look up by name, or instance_id to get sprite from an instance.",
    {
      sprite_name: z.string().optional().describe("Sprite asset name (e.g. 'spr_player')"),
      instance_id: instanceIdSchema.optional().describe("Instance ID to get sprite from"),
    },
    async ({ sprite_name, instance_id }) => {
      try {
        const params: Record<string, unknown> = {};
        if (sprite_name !== undefined) params.sprite_name = sprite_name;
        if (instance_id !== undefined) params.instance_id = instance_id;
        const result = await gm.sendCommand("get_sprite_info", params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_sprite_index",
    "Change the sprite of an instance",
    { instance_id: instanceIdSchema, sprite_name: z.string() },
    async ({ instance_id, sprite_name }) => {
      try {
        const result = await gm.sendCommand("set_sprite_index", { instance_id, sprite_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_image_index",
    "Set the current animation frame",
    { instance_id: instanceIdSchema, frame: z.number() },
    async ({ instance_id, frame }) => {
      try {
        const result = await gm.sendCommand("set_image_index", { instance_id, frame });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_image_speed",
    "Set the animation playback speed",
    { instance_id: instanceIdSchema, speed: z.number() },
    async ({ instance_id, speed }) => {
      try {
        const result = await gm.sendCommand("set_image_speed", { instance_id, speed });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_animation_state",
    "Get the current animation state of an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_animation_state", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_image_properties",
    "Set image blend, alpha, scale, and angle",
    {
      instance_id: instanceIdSchema,
      blend: z.string().optional(),
      alpha: z.number().optional(),
      xscale: z.number().optional(),
      yscale: z.number().optional(),
      angle: z.number().optional(),
    },
    async ({ instance_id, blend, alpha, xscale, yscale, angle }) => {
      try {
        const result = await gm.sendCommand("set_image_properties", { instance_id, blend, alpha, xscale, yscale, angle });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
