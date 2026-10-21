import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerLayerTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_layers",
    "Get all layers in the current room",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_layers");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_layer_instances",
    "Get all instances on a specific layer",
    { layer_name: z.string() },
    async ({ layer_name }) => {
      try {
        const result = await gm.sendCommand("get_layer_instances", { layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_layer_elements",
    "Get all elements on a layer (tiles, sprites, etc.)",
    { layer_name: z.string() },
    async ({ layer_name }) => {
      try {
        const result = await gm.sendCommand("get_layer_elements", { layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_layer_visible",
    "Set layer visibility",
    { layer_name: z.string(), visible: z.boolean() },
    async ({ layer_name, visible }) => {
      try {
        const result = await gm.sendCommand("set_layer_visible", { layer_name, visible });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_layer_depth",
    "Set layer depth",
    { layer_name: z.string(), depth: z.number() },
    async ({ layer_name, depth }) => {
      try {
        const result = await gm.sendCommand("set_layer_depth", { layer_name, depth });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_layer_info",
    "Get detailed layer information",
    { layer_name: z.string() },
    async ({ layer_name }) => {
      try {
        const result = await gm.sendCommand("get_layer_info", { layer_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
