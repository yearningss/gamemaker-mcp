import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerFileSystemTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "list_files",
    "List files in a directory within the GameMaker sandbox",
    {
      directory: z.string().optional().describe("Directory path, defaults to working_directory"),
      pattern: z.string().optional().describe("File pattern e.g. *.json"),
    },
    async ({ directory, pattern }) => {
      try {
        const result = await gm.sendCommand("list_files", { directory, pattern });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "read_text_file",
    "Read a text file from the GameMaker sandbox (64KB limit)",
    { filename: z.string() },
    async ({ filename }) => {
      try {
        const result = await gm.sendCommand("read_text_file", { filename });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "write_text_file",
    "Write or append text to a file in the GameMaker sandbox",
    {
      filename: z.string(),
      content: z.string(),
      append: z.boolean().optional().describe("Append instead of overwrite"),
    },
    async ({ filename, content, append }) => {
      try {
        const result = await gm.sendCommand("write_text_file", { filename, content, append });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "read_json_file",
    "Read and parse a JSON file from the GameMaker sandbox",
    { filename: z.string() },
    async ({ filename }) => {
      try {
        const result = await gm.sendCommand("read_json_file", { filename });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "file_exists_check",
    "Check if a file exists in the GameMaker sandbox",
    { filename: z.string() },
    async ({ filename }) => {
      try {
        const result = await gm.sendCommand("file_exists_check", { filename });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool("get_save_directory", "Get the game save directory and working directory paths", {}, async () => {
    try {
      const result = await gm.sendCommand("get_save_directory", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
