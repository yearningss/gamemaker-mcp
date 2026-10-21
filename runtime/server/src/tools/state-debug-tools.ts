import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";

export function registerStateDebugTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "register_state_machine",
    "Register a state machine for tracking and debugging",
    {
      name: z.string(),
      initial_state: z.string(),
      states: z.array(z.string()).optional().describe("List of valid state names"),
    },
    async ({ name, initial_state, states }) => {
      try {
        const result = await gm.sendCommand("register_state_machine", { name, initial_state, states });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "set_fsm_state",
    "Set the current state of a registered state machine",
    {
      name: z.string(),
      state: z.string(),
    },
    async ({ name, state }) => {
      try {
        const result = await gm.sendCommand("set_fsm_state", { name, state });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_fsm_state",
    "Get the current state and duration info of a state machine",
    {
      name: z.string(),
    },
    async ({ name }) => {
      try {
        const result = await gm.sendCommand("get_fsm_state", { name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_state_history",
    "Get the transition history of a state machine",
    {
      name: z.string(),
      limit: z.number().optional().describe("Max entries to return, default 20"),
    },
    async ({ name, limit }) => {
      try {
        const result = await gm.sendCommand("get_state_history", { name, limit });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "get_all_state_machines",
    "Get a list of all registered state machines and their current states",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_all_state_machines", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "log_state_change",
    "Log an external state change (for game-side FSMs reporting to MCP)",
    {
      name: z.string(),
      from_state: z.string(),
      to_state: z.string(),
      trigger: z.string().optional(),
    },
    async ({ name, from_state, to_state, trigger }) => {
      try {
        const result = await gm.sendCommand("log_state_change", { name, from_state, to_state, trigger });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
