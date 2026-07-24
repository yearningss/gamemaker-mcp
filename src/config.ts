import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AccessMode, ServerConfig } from "./types.js";

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function findProjectFile(input: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`GameMaker project path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    if (path.extname(resolved).toLowerCase() !== ".yyp") {
      throw new Error(`Expected a .yyp file, received: ${resolved}`);
    }
    return fs.realpathSync(resolved);
  }

  if (!stat.isDirectory()) {
    throw new Error(`Project path is neither a directory nor a .yyp file: ${resolved}`);
  }

  let candidates = fs
    .readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".yyp"))
    .map((entry) => path.join(resolved, entry.name));

  if (candidates.length === 1) {
    return fs.realpathSync(candidates[0]!);
  }

  if (candidates.length === 0) {
    try {
      const subEntries = fs.readdirSync(resolved, { withFileTypes: true });
      for (const entry of subEntries) {
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          const subDir = path.join(resolved, entry.name);
          const subCandidates = fs
            .readdirSync(subDir, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".yyp"))
            .map((e) => path.join(subDir, e.name));
          if (subCandidates.length === 1) {
            return fs.realpathSync(subCandidates[0]!);
          }
        }
      }
    } catch {}
  }

  if (candidates.length > 1) {
    throw new Error(
      `Multiple .yyp files found in ${resolved}. ` +
        "Set GAMEMAKER_PROJECT to the exact project file.",
    );
  }

  throw new Error(
    `No .yyp GameMaker project found in or under ${resolved}. ` +
      "Set GAMEMAKER_PROJECT to your project's .yyp file path.",
  );
}

function optionalExistingFile(value: string | undefined, label: string): string | undefined {
  if (!value) return undefined;
  const resolved = path.resolve(value);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} is not a file: ${resolved}`);
  }
  return fs.realpathSync(resolved);
}

export function loadConfig(argv = process.argv.slice(2), env = process.env): ServerConfig {
  const projectInput = env.GAMEMAKER_PROJECT || argv[0] || process.cwd();
  let projectFile = "";
  let projectRoot = process.cwd();

  try {
    projectFile = findProjectFile(projectInput);
    projectRoot = fs.realpathSync(path.dirname(projectFile));
  } catch {
    // Zero-crash fallback when started outside a .yyp directory
    projectFile = "";
    projectRoot = fs.realpathSync(process.cwd());
  }
  const modeRaw = (env.GAMEMAKER_MCP_MODE ?? "read-only").toLowerCase();
  if (modeRaw !== "read-only" && modeRaw !== "workspace-write") {
    throw new Error("GAMEMAKER_MCP_MODE must be read-only or workspace-write");
  }

  const maxFileBytes = Number.parseInt(env.GAMEMAKER_MCP_MAX_FILE_BYTES ?? "1048576", 10);
  if (!Number.isFinite(maxFileBytes) || maxFileBytes < 1024 || maxFileBytes > 20 * 1024 * 1024) {
    throw new Error("GAMEMAKER_MCP_MAX_FILE_BYTES must be between 1024 and 20971520");
  }

  const userDir = env.GAMEMAKER_USER_DIR
    ? path.resolve(env.GAMEMAKER_USER_DIR)
    : undefined;

  return {
    projectRoot,
    projectFile,
    mode: modeRaw as AccessMode,
    allowBuild: parseBoolean(env.GAMEMAKER_MCP_ALLOW_BUILD, false),
    maxFileBytes,
    igorPath: optionalExistingFile(env.GAMEMAKER_IGOR, "GAMEMAKER_IGOR"),
    runtimePath: env.GAMEMAKER_RUNTIME ? path.resolve(env.GAMEMAKER_RUNTIME) : undefined,
    userDir,
  };
}

export function defaultConfigExample(projectFile: string): Record<string, unknown> {
  const indexPath = fileURLToPath(new URL("./index.js", import.meta.url));
  return {
    mcpServers: {
      gamemaker: {
        command: process.execPath || path.join(os.homedir(), "node"),
        args: [indexPath],
        env: {
          GAMEMAKER_PROJECT: projectFile,
          GAMEMAKER_MCP_MODE: "workspace-write",
          GAMEMAKER_MCP_ALLOW_BUILD: "1",
        },
      },
    },
  };
}
