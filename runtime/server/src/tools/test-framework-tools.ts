import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GameMakerConnection } from "../gamemaker-connection.js";
import { formatError } from "../utils/errors.js";
import { instanceIdSchema } from "../utils/schemas.js";

export function registerTestFrameworkTools(server: McpServer, gm: GameMakerConnection): void {
  server.tool(
    "assert_equals",
    "Assert that a GML expression equals an expected value",
    {
      expected: z.union([z.number(), z.string(), z.boolean()]),
      actual: z.union([z.number(), z.string(), z.boolean()]),
      test_name: z.string().optional(),
    },
    async ({ expected, actual, test_name }) => {
      try {
        const result = await gm.sendCommand("assert_equals", { expected, actual, test_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "assert_instance_exists",
    "Assert that instances of an object exist",
    {
      object_name: z.string(),
      min_count: z.number().optional().describe("Minimum instance count, default 1"),
      test_name: z.string().optional(),
    },
    async ({ object_name, min_count, test_name }) => {
      try {
        const result = await gm.sendCommand("assert_instance_exists", { object_name, min_count, test_name });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "assert_variable_value",
    "Assert a variable value with a comparison operator",
    {
      instance_id: instanceIdSchema.optional().describe("Instance ID, or omit/-1 for global variables"),
      variable: z.string(),
      operator: z.string().describe("eq, ne, gt, lt, gte, lte"),
      expected: z.union([z.number(), z.string(), z.boolean()]),
      test_name: z.string().optional(),
    },
    async ({ instance_id, variable, operator, expected, test_name }) => {
      try {
        const params: Record<string, unknown> = { variable, operator, expected, test_name };
        if (instance_id !== undefined) params.instance_id = instance_id;
        const result = await gm.sendCommand("assert_variable_value", params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "run_test_suite",
    "Run multiple test commands sequentially and collect results",
    {
      tests: z.array(z.object({
        name: z.string(),
        command: z.string(),
        params: z.record(z.string(), z.any()).optional(),
      })).describe("Array of test definitions"),
    },
    async ({ tests }) => {
      const results = [];
      for (const test of tests) {
        try {
          const result = await gm.sendCommand(test.command, test.params || {});
          // Use the assertion's own passed field if available, otherwise true
          const passed = (result != null && typeof result === "object" && "passed" in result)
            ? Boolean(result.passed)
            : true;
          results.push({ name: test.name, passed, result });
        } catch (error) {
          results.push({ name: test.name, passed: false, error: formatError(error) });
        }
      }
      const passed = results.filter(r => r.passed).length;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            results,
            total: results.length,
            passed,
            failed: results.length - passed,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "get_test_results",
    "Get all recorded test results",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("get_test_results", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );

  server.tool(
    "clear_test_results",
    "Clear all recorded test results",
    {},
    async () => {
      try {
        const result = await gm.sendCommand("clear_test_results", {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text", text: formatError(error) }], isError: true };
      }
    }
  );
}
