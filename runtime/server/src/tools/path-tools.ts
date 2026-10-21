import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerPathTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_path_list",
    "Get a list of all path assets in the project",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_path_list", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_path_info",
    "Get detailed info about a path asset (length, points, closed, precision)",
    { path_name: z.string().describe("Path asset name") },
    async ({ path_name }) => {
      try {
        const result = await gm.sendCommand("get_path_info", { path_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "path_to_points",
    "Sample points along a path at even intervals",
    {
      path_name: z.string(),
      num_points: z.number().optional().describe("Number of sample points, default 20"),
    },
    async ({ path_name, num_points }) => {
      try {
        const result = await gm.sendCommand("path_to_points", { path_name, num_points });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "create_path",
    "Create a new runtime path resource",
    {
      name: z.string().optional(),
      closed: z.boolean().optional(),
      precision: z.number().optional(),
    },
    async ({ name, closed, precision }) => {
      try {
        const result = await gm.sendCommand("create_path", { name, closed, precision });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "add_path_point",
    "Add a point to a runtime path",
    {
      path_id: z.number(),
      x: z.number(),
      y: z.number(),
      speed: z.number().optional().describe("Speed factor at this point, default 1"),
    },
    async ({ path_id, x, y, speed }) => {
      try {
        const result = await gm.sendCommand("add_path_point", { path_id, x, y, speed });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_instance_path",
    "Start an instance moving along a path",
    {
      instance_id: instanceIdSchema,
      path_name: z.string().optional(),
      path_id: z.number().optional(),
      speed: z.number().optional(),
      end_action: z.number().optional().describe("0=stop, 1=restart, 2=continue, 3=reverse"),
    },
    async ({ instance_id, path_name, path_id, speed, end_action }) => {
      try {
        const result = await gm.sendCommand("set_instance_path", { instance_id, path_name, path_id, speed, end_action });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "create_mp_grid",
    "Create a motion planning grid for pathfinding",
    {
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      cell_width: z.number(),
      cell_height: z.number(),
    },
    async ({ x, y, width, height, cell_width, cell_height }) => {
      try {
        const result = await gm.sendCommand("create_mp_grid", { x, y, width, height, cell_width, cell_height });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "find_mp_path",
    "Find a path using motion planning grid (A* pathfinding)",
    {
      grid_id: z.number(),
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
      allowdiag: z.boolean().optional(),
    },
    async ({ grid_id, x1, y1, x2, y2, allowdiag }) => {
      try {
        const result = await gm.sendCommand("find_mp_path", { grid_id, x1, y1, x2, y2, allowdiag });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
