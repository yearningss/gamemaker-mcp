import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerSkeletonTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_skeleton_info",
    "Get basic skeleton/Spine animation info for an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_skeleton_info", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_skeleton_animations",
    "List all available Spine animations for an instance's sprite",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_skeleton_animations", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_skeleton_skins",
    "List all available Spine skins for an instance's sprite",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_skeleton_skins", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_skeleton_slots",
    "Get Spine slot data for an instance",
    { instance_id: instanceIdSchema },
    async ({ instance_id }) => {
      try {
        const result = await gm.sendCommand("get_skeleton_slots", { instance_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_skeleton_animation",
    "Set the Spine animation for an instance",
    {
      instance_id: instanceIdSchema,
      animation: z.string(),
      track: z.number().optional().describe("Animation track, default 0"),
    },
    async ({ instance_id, animation, track }) => {
      try {
        const result = await gm.sendCommand("set_skeleton_animation", { instance_id, animation, track });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_skeleton_skin",
    "Set the Spine skin for an instance",
    { instance_id: instanceIdSchema, skin: z.string() },
    async ({ instance_id, skin }) => {
      try {
        const result = await gm.sendCommand("set_skeleton_skin", { instance_id, skin });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
