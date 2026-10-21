import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerCameraTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_camera_info",
    "Get camera information",
    { camera_id: z.number().optional() },
    async ({ camera_id }) => {
      try {
        const result = await gm.sendCommand("get_camera_info", { camera_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_camera_position",
    "Set camera position",
    { camera_id: z.number().optional(), x: z.number(), y: z.number() },
    async ({ camera_id, x, y }) => {
      try {
        const result = await gm.sendCommand("set_camera_position", { camera_id, x, y });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_camera_size",
    "Set camera view size",
    { camera_id: z.number().optional(), width: z.number(), height: z.number() },
    async ({ camera_id, width, height }) => {
      try {
        const result = await gm.sendCommand("set_camera_size", { camera_id, width, height });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "camera_shake",
    "Apply camera shake effect",
    { intensity: z.number(), duration: z.number().describe("Duration in frames") },
    async ({ intensity, duration }) => {
      try {
        const result = await gm.sendCommand("camera_shake", { intensity, duration });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "follow_instance",
    "Make camera follow an instance",
    { instance_id: instanceIdSchema, camera_id: z.number().optional() },
    async ({ instance_id, camera_id }) => {
      try {
        const result = await gm.sendCommand("follow_instance", { instance_id, camera_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_view_info",
    "Get view port and camera details",
    { view_index: z.number().optional() },
    async ({ view_index }) => {
      try {
        const result = await gm.sendCommand("get_view_info", { view_index });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
