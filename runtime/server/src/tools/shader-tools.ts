import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerShaderTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_shader_list",
    "Get a list of all shader assets in the project",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_shader_list");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_shader_info",
    "Get information about a shader (compiled status, name)",
    { shader_name: z.string() },
    async ({ shader_name }) => {
      try {
        const result = await gm.sendCommand("get_shader_info", { shader_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_shader_uniforms",
    "Get uniform handles for specified uniform names in a shader",
    {
      shader_name: z.string(),
      uniform_names: z.array(z.string()).describe("List of uniform names to look up")
    },
    async ({ shader_name, uniform_names }) => {
      try {
        const result = await gm.sendCommand("get_shader_uniforms", { shader_name, uniform_names });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_shader_uniform",
    "Set a shader uniform value (queued for next draw)",
    {
      shader_name: z.string(),
      uniform_name: z.string(),
      values: z.array(z.number()).describe("Uniform values (1-4 floats)")
    },
    async ({ shader_name, uniform_name, values }) => {
      try {
        const result = await gm.sendCommand("set_shader_uniform", { shader_name, uniform_name, values });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_shader",
    "Activate a shader for drawing (via draw queue)",
    {
      shader_name: z.string(),
      uniforms: z.record(z.string(), z.array(z.number())).optional().describe("Optional uniforms to set: {name: [values]}")
    },
    async ({ shader_name, uniforms }) => {
      try {
        const result = await gm.sendCommand("set_shader", { shader_name, uniforms });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "reset_shader",
    "Reset/deactivate the current shader (via draw queue)",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("reset_shader");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "is_shader_compiled",
    "Check if a specific shader is compiled and ready to use",
    { shader_name: z.string() },
    async ({ shader_name }) => {
      try {
        const result = await gm.sendCommand("is_shader_compiled", { shader_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
