import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerBufferTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("create_buffer", "Create a new buffer", { size: z.number(), type: z.string().describe("fixed, grow, wrap, or fast"), alignment: z.number().optional().describe("Byte alignment, default 1") }, async ({ size, type, alignment }) => {
    try {
      const result = await gm.sendCommand("create_buffer", { size, type, alignment });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("write_buffer", "Write a value to a buffer at the current position", { buffer_id: z.number(), data_type: z.string().describe("u8, s8, u16, s16, u32, s32, f32, f64, string, bool"), value: z.union([z.number(), z.string(), z.boolean()]) }, async ({ buffer_id, data_type, value }) => {
    try {
      const result = await gm.sendCommand("write_buffer", { buffer_id, data_type, value });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("read_buffer", "Read a value from a buffer at the current position", { buffer_id: z.number(), data_type: z.string().describe("u8, s8, u16, s16, u32, s32, f32, f64, string, bool") }, async ({ buffer_id, data_type }) => {
    try {
      const result = await gm.sendCommand("read_buffer", { buffer_id, data_type });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("dump_buffer_hex", "Hex dump of buffer contents", { buffer_id: z.number(), offset: z.number().optional(), length: z.number().optional().describe("Number of bytes, default 256") }, async ({ buffer_id, offset, length }) => {
    try {
      const result = await gm.sendCommand("dump_buffer_hex", { buffer_id, offset, length });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_buffer_info", "Get buffer size, position, and type info", { buffer_id: z.number() }, async ({ buffer_id }) => {
    try {
      const result = await gm.sendCommand("get_buffer_info", { buffer_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("delete_buffer", "Delete a tracked buffer", { buffer_id: z.number() }, async ({ buffer_id }) => {
    try {
      const result = await gm.sendCommand("delete_buffer", { buffer_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("list_buffers", "List all tracked buffers", {}, async () => {
    try {
      const result = await gm.sendCommand("list_buffers", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("buffer_to_base64", "Encode buffer contents as base64", { buffer_id: z.number() }, async ({ buffer_id }) => {
    try {
      const result = await gm.sendCommand("buffer_to_base64", { buffer_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("buffer_from_base64", "Create a buffer from base64 data", { base64: z.string(), type: z.string().optional().describe("Buffer type, default grow") }, async ({ base64, type }) => {
    try {
      const result = await gm.sendCommand("buffer_from_base64", { base64, type });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("copy_buffer", "Copy buffer data to another buffer", { src_buffer_id: z.number(), src_offset: z.number().optional(), length: z.number().optional(), dest_buffer_id: z.number().optional().describe("If omitted, creates a new buffer") }, async ({ src_buffer_id, src_offset, length, dest_buffer_id }) => {
    try {
      const result = await gm.sendCommand("copy_buffer", { src_buffer_id, src_offset, length, dest_buffer_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
