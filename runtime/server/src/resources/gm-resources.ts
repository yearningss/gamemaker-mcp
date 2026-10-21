import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { GML_FUNCTIONS, GML_CATEGORIES } from "../data/gml-docs.js";

export function registerResources(server: McpServer, gm: GameMakerConnection): void {
  server.resource(
    "project",
    "gamemaker://project",
    { description: "GameMaker project metadata" },
    async () => {
      try {
        const result = await gm.sendCommand("get_project_info");
        return {
          contents: [{
            uri: "gamemaker://project",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "gamemaker://project",
            mimeType: "text/plain",
            text: formatError(error),
          }],
        };
      }
    }
  );

  server.resource(
    "current-room",
    "gamemaker://room/current",
    { description: "Current room information" },
    async () => {
      try {
        const result = await gm.sendCommand("get_current_room");
        return {
          contents: [{
            uri: "gamemaker://room/current",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "gamemaker://room/current",
            mimeType: "text/plain",
            text: formatError(error),
          }],
        };
      }
    }
  );

  server.resource(
    "instances",
    "gamemaker://instances",
    { description: "Active instances in the current room" },
    async () => {
      try {
        const result = await gm.sendCommand("get_all_instances");
        return {
          contents: [{
            uri: "gamemaker://instances",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "gamemaker://instances",
            mimeType: "text/plain",
            text: formatError(error),
          }],
        };
      }
    }
  );

  server.resource(
    "performance",
    "gamemaker://performance",
    { description: "FPS, memory, and performance metrics" },
    async () => {
      try {
        const result = await gm.sendCommand("get_performance_stats");
        return {
          contents: [{
            uri: "gamemaker://performance",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "gamemaker://performance",
            mimeType: "text/plain",
            text: formatError(error),
          }],
        };
      }
    }
  );

  server.resource(
    "console",
    "gamemaker://console",
    { description: "Debug output log" },
    async () => {
      try {
        const result = await gm.sendCommand("get_error_log");
        return {
          contents: [{
            uri: "gamemaker://console",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: "gamemaker://console",
            mimeType: "text/plain",
            text: formatError(error),
          }],
        };
      }
    }
  );

  // GML Documentation Reference (static, no runtime needed)
  server.resource(
    "gml-reference",
    "gamemaker://docs/gml-reference",
    { description: "GML function reference — categories and function count summary" },
    async () => {
      const summary: Record<string, number> = {};
      for (const cat of GML_CATEGORIES) {
        summary[cat] = GML_FUNCTIONS.filter(f => f.category === cat).length;
      }
      const data = {
        totalFunctions: GML_FUNCTIONS.length,
        categories: summary,
        usage: "Use lookup_gml_function, search_gml_docs, get_function_category, validate_variable_name, get_gml_reserved_words, or get_deprecated_functions tools for details.",
      };
      return {
        contents: [{
          uri: "gamemaker://docs/gml-reference",
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
  );
}
