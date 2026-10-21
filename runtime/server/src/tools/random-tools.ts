import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerRandomTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "get_random_seed",
    "Get the current random seed value",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_random_seed");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_random_seed",
    "Set the random seed to a specific value",
    { seed: z.number() },
    async ({ seed }) => {
      try {
        const result = await gm.sendCommand("set_random_seed", { seed });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "randomize_seed",
    "Randomize the seed (equivalent to randomize())",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("randomize_seed");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "random_range_test",
    "Generate random samples and return statistics",
    {
      min: z.number(),
      max: z.number(),
      count: z.number().optional().describe("Number of samples, default 100"),
    },
    async ({ min, max, count }) => {
      try {
        const result = await gm.sendCommand("random_range_test", { min, max, count });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
