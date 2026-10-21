import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerTimelineTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_timeline_list",
    "Get a list of all timeline assets in the project",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_timeline_list", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_timeline_info",
    "Get info about a timeline (size/moment count)",
    { timeline_name: z.string() },
    async ({ timeline_name }) => {
      try {
        const result = await gm.sendCommand("get_timeline_info", { timeline_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_instance_timeline",
    "Set a timeline on an instance",
    {
      instance_id: instanceIdSchema,
      timeline_name: z.string(),
      position: z.number().optional(),
      speed: z.number().optional(),
      loop: z.boolean().optional(),
      running: z.boolean().optional(),
    },
    async ({ instance_id, timeline_name, position, speed, loop, running }) => {
      try {
        const result = await gm.sendCommand("set_instance_timeline", { instance_id, timeline_name, position, speed, loop, running });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_sequence_list",
    "Get a list of all sequence assets in the project",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_sequence_list", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_sequence_info",
    "Get info about a sequence asset",
    { sequence_name: z.string() },
    async ({ sequence_name }) => {
      try {
        const result = await gm.sendCommand("get_sequence_info", { sequence_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "play_sequence",
    "Create and play a sequence on a layer",
    {
      sequence_name: z.string(),
      x: z.number(),
      y: z.number(),
      layer_name: z.string().optional().describe("Layer name, defaults to first layer"),
    },
    async ({ sequence_name, x, y, layer_name }) => {
      try {
        const result = await gm.sendCommand("play_sequence", { sequence_name, x, y, layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "stop_sequence",
    "Stop/destroy a playing sequence element",
    { element_id: z.number() },
    async ({ element_id }) => {
      try {
        const result = await gm.sendCommand("stop_sequence", { element_id });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
