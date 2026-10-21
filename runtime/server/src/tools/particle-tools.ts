import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerParticleTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool("get_particle_systems", "Get all particle systems", {}, async () => {
    try {
      const result = await gm.sendCommand("get_particle_systems", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("create_particle_system", "Create a new particle system", {
    layer_name: z.string().optional(),
    persistent: z.boolean().optional(),
  }, async ({ layer_name, persistent }) => {
    try {
      const result = await gm.sendCommand("create_particle_system", { layer_name, persistent });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("create_particle_type", "Create and configure a particle type", {
    system_id: z.number(),
    shape: z.string().optional(),
    color1: z.string().optional(),
    color2: z.string().optional(),
    alpha1: z.number().optional(),
    alpha2: z.number().optional(),
    size_min: z.number().optional(),
    size_max: z.number().optional(),
    life_min: z.number().optional(),
    life_max: z.number().optional(),
    speed_min: z.number().optional(),
    speed_max: z.number().optional(),
    direction_min: z.number().optional(),
    direction_max: z.number().optional(),
    gravity_amount: z.number().optional(),
    gravity_direction: z.number().optional(),
  }, async (params) => {
    try {
      const result = await gm.sendCommand("create_particle_type", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("emit_particles", "Emit particles from a position", {
    system_id: z.number(),
    type_id: z.number(),
    x: z.number(),
    y: z.number(),
    count: z.number(),
  }, async ({ system_id, type_id, x, y, count }) => {
    try {
      const result = await gm.sendCommand("emit_particles", { system_id, type_id, x, y, count });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("get_particle_count", "Get the number of active particles", { system_id: z.number() }, async ({ system_id }) => {
    try {
      const result = await gm.sendCommand("get_particle_count", { system_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });

  server.tool("clear_particles", "Clear all particles in a system", { system_id: z.number() }, async ({ system_id }) => {
    try {
      const result = await gm.sendCommand("clear_particles", { system_id });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: formatError(error) }], isError: true };
    }
  });
}
