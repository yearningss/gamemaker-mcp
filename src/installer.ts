import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverRuntimes, resolveIgorRuntime, type RuntimeCandidate } from "./igor.js";

export interface NodeCheckResult {
  ok: boolean;
  version: string;
  execPath: string;
}

export interface GameMakerCheckResult {
  ok: boolean;
  runtimes: RuntimeCandidate[];
  selected?: { igorPath: string; runtimePath: string };
}

export interface ClientTarget {
  name: string;
  id: string;
  paths: string[];
}

export function checkNode(): NodeCheckResult {
  const version = process.version;
  const major = Number.parseInt(version.slice(1).split(".")[0] ?? "0", 10);
  return {
    ok: major >= 20,
    version,
    execPath: process.execPath || "node",
  };
}

export function checkGameMaker(): GameMakerCheckResult {
  const runtimes = discoverRuntimes();
  const selected = resolveIgorRuntime({ igorPath: undefined, runtimePath: undefined }, false);
  return {
    ok: Boolean(selected || runtimes.length > 0),
    runtimes,
    ...(selected ? { selected } : {}),
  };
}

export function getMcpPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let dir = path.dirname(currentFile);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as { name?: string };
        if (pkg.name === "gamemaker-mcp" || pkg.name === "gamemaker-mcp-server") {
          return dir;
        }
      } catch {}
    }
    dir = path.dirname(dir);
  }
  return path.resolve(path.dirname(currentFile), "../..");
}

export function discoverProjectFile(searchPath?: string): string | undefined {
  if (searchPath) {
    const resolved = path.resolve(searchPath);
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      if (stat.isFile() && resolved.toLowerCase().endsWith(".yyp")) {
        return fs.realpathSync(resolved);
      }
      if (stat.isDirectory()) {
        const candidates = fs
          .readdirSync(resolved, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".yyp"))
          .map((entry) => path.join(resolved, entry.name));
        if (candidates.length > 0) {
          return fs.realpathSync(candidates[0]!);
        }
      }
    }
  }

  if (process.env.GAMEMAKER_PROJECT && fs.existsSync(process.env.GAMEMAKER_PROJECT)) {
    const resolved = path.resolve(process.env.GAMEMAKER_PROJECT);
    const stat = fs.statSync(resolved);
    if (stat.isFile() && resolved.toLowerCase().endsWith(".yyp")) {
      return fs.realpathSync(resolved);
    }
    if (stat.isDirectory()) {
      const candidates = fs
        .readdirSync(resolved, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".yyp"))
        .map((entry) => path.join(resolved, entry.name));
      if (candidates.length > 0) {
        return fs.realpathSync(candidates[0]!);
      }
    }
  }

  const cwd = process.cwd();
  if (fs.existsSync(cwd)) {
    const candidates = fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".yyp"))
      .map((entry) => path.join(cwd, entry.name));
    if (candidates.length > 0) {
      return fs.realpathSync(candidates[0]!);
    }
  }

  return undefined;
}

export function getSupportedClients(projectDir?: string): ClientTarget[] {
  const home = process.env.GAMEMAKER_TEST_HOME || os.homedir();
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const pDir = projectDir ? path.resolve(projectDir) : process.cwd();

  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const claudePaths = [
    isWin
      ? path.join(appData, "Claude", "claude_desktop_config.json")
      : isMac
      ? path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : path.join(home, ".config", "Claude", "claude_desktop_config.json"),
    path.join(home, ".claude.json"),
    path.join(pDir, ".claude.json"),
  ];

  const antigravityPaths = [
    path.join(home, ".gemini", "config", "plugins", "gamemaker", "mcp_config.json"),
    path.join(home, ".gemini", "config", "mcp_config.json"),
    path.join(home, ".gemini", "antigravity-cli", "plugins", "gamemaker", "mcp_config.json"),
    path.join(home, ".gemini", "antigravity-cli", "settings.json"),
    path.join(home, ".gemini", "settings.json"),
    path.join(home, ".gemini", "antigravity.json"),
    path.join(pDir, ".gemini", "antigravity.json"),
    path.join(pDir, ".gemini", "settings.json"),
  ];

  const codexPaths = [
    path.join(home, ".codex", "mcp.json"),
    path.join(pDir, ".codex", "mcp.json"),
  ];

  const cursorPaths = [
    isWin
      ? path.join(appData, "Cursor", "User", "globalStorage", "mcp.json")
      : isMac
      ? path.join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "mcp.json")
      : path.join(home, ".config", "Cursor", "User", "globalStorage", "mcp.json"),
    path.join(pDir, ".cursor", "mcp.json"),
  ];

  const qwenPaths = [
    path.join(home, ".qwen", "mcp.json"),
    path.join(home, ".qwen", "settings.json"),
    isWin
      ? path.join(appData, "Qwen", "mcp.json")
      : isMac
      ? path.join(home, "Library", "Application Support", "Qwen", "mcp.json")
      : path.join(home, ".config", "Qwen", "mcp.json"),
    path.join(pDir, ".qwen", "mcp.json"),
  ];

  return [
    { name: "Claude Code / Desktop", id: "claude", paths: claudePaths },
    { name: "Google Antigravity", id: "antigravity", paths: antigravityPaths },
    { name: "Codex", id: "codex", paths: codexPaths },
    { name: "Cursor", id: "cursor", paths: cursorPaths },
    { name: "Qwen Code / CLI", id: "qwen", paths: qwenPaths },
  ];
}

export function writeClientConfig(
  targetPath: string,
  mcpIndexJsPath: string,
  projectFilePath?: string,
): boolean {
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(targetPath)) {
      try {
        const raw = fs.readFileSync(targetPath, "utf8");
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }

    if (typeof data !== "object" || data === null) {
      data = {};
    }
    let mcpServers = data["mcpServers"];
    if (typeof mcpServers !== "object" || mcpServers === null) {
      mcpServers = {};
      data["mcpServers"] = mcpServers;
    }

    const env: Record<string, string> = {
      GAMEMAKER_MCP_MODE: "workspace-write",
      GAMEMAKER_MCP_ALLOW_BUILD: "1",
    };
    if (projectFilePath) {
      env["GAMEMAKER_PROJECT"] = projectFilePath;
    }

    const isNpx = mcpIndexJsPath.includes("_npx") || mcpIndexJsPath.includes("npm-cache");
    const isWin = process.platform === "win32";
    const command = isNpx ? (isWin ? "cmd.exe" : "npx") : (process.execPath || "node");
    const args = isNpx ? (isWin ? ["/c", "npx", "-y", "gamemaker-mcp"] : ["-y", "gamemaker-mcp"]) : [mcpIndexJsPath];

    (mcpServers as Record<string, unknown>)["gamemaker"] = {
      command,
      args,
      env,
    };

    if (targetPath.toLowerCase().includes("qwen")) {
      let mcpObj = data["mcp"] as Record<string, unknown> | undefined;
      if (typeof mcpObj !== "object" || mcpObj === null) {
        mcpObj = {};
        data["mcp"] = mcpObj;
      }
      let serversObj = mcpObj["servers"] as Record<string, unknown> | undefined;
      if (typeof serversObj !== "object" || serversObj === null) {
        serversObj = {};
        mcpObj["servers"] = serversObj;
      }
      serversObj["gamemaker"] = {
        command,
        args,
        env,
      };
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf8");

    if (targetPath.endsWith("mcp_config.json")) {
      const pluginJsonPath = path.join(path.dirname(targetPath), "plugin.json");
      if (!fs.existsSync(pluginJsonPath)) {
        fs.writeFileSync(
          pluginJsonPath,
          JSON.stringify({ name: "gamemaker", version: "1.5.4", description: "GameMaker Studio MCP server plugin" }, null, 2),
          "utf8"
        );
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

export function checkClientConfigs(
  projectFile: string,
): Record<string, { installed: boolean; paths: string[] }> {
  const clients = getSupportedClients(path.dirname(projectFile));
  const result: Record<string, { installed: boolean; paths: string[] }> = {};

  for (const client of clients) {
    const existing: string[] = [];
    for (const p of client.paths) {
      if (fs.existsSync(p)) {
        try {
          const content = JSON.parse(fs.readFileSync(p, "utf8")) as { mcpServers?: Record<string, unknown> };
          if (content?.mcpServers?.["gamemaker"]) {
            existing.push(p);
          }
        } catch {}
      }
    }
    result[client.id] = {
      installed: existing.length > 0,
      paths: existing,
    };
  }

  return result;
}

export function runDoctor(projectArg?: string): void {
  console.log("\n🔍 GameMaker MCP Doctor\n=======================");

  const nodeRes = checkNode();
  if (nodeRes.ok) {
    console.log(`[✓] Node.js: ${nodeRes.version} (>= 20) -> ${nodeRes.execPath}`);
  } else {
    console.log(`[×] Node.js: ${nodeRes.version} (Error: Node.js 20 or newer required)`);
  }

  const gmRes = checkGameMaker();
  if (gmRes.selected) {
    console.log(`[✓] GameMaker Runtime & Igor: ${gmRes.selected.igorPath}`);
  } else if (gmRes.runtimes.length > 0) {
    console.log(`[✓] GameMaker Runtime: ${gmRes.runtimes[0]?.igorPath}`);
  } else {
    console.log(`[!] GameMaker Runtime / Igor.exe: Not automatically detected (Can be set via GAMEMAKER_IGOR env)`);
  }

  const projectFile = discoverProjectFile(projectArg);
  if (projectFile) {
    console.log(`[✓] Project: ${projectFile}`);
  } else {
    console.log(`[!] Project: No .yyp project specified or found in working directory`);
  }

  console.log("\n[✓] Client Configuration Status:");
  const clientStatus = checkClientConfigs(projectFile ?? process.cwd());
  const clients = getSupportedClients(projectFile ? path.dirname(projectFile) : process.cwd());

  for (const client of clients) {
    const status = clientStatus[client.id];
    if (status?.installed) {
      console.log(`    - ${client.name}: [Connected]`);
      for (const p of status.paths) {
        console.log(`      └─ ${p}`);
      }
    } else {
      console.log(`    - ${client.name}: [Not Connected] (run 'gamemaker-mcp connect ${client.id}')`);
    }
  }
  console.log();
}

export function runConnect(clientId: string, projectArg?: string): void {
  const projectFile = discoverProjectFile(projectArg);
  if (!projectFile && projectArg) {
    console.warn(`[!] Provided path '${projectArg}' is not a .yyp file or directory with .yyp. Connecting in Workspace Auto-Detect mode...`);
  }

  const mcpRoot = getMcpPackageRoot();
  const mcpIndexJs = path.join(mcpRoot, "dist", "src", "index.js");

  const projectDir = projectFile ? path.dirname(projectFile) : process.cwd();
  const clients = getSupportedClients(projectDir);
  const targetClients = clientId.toLowerCase() === "all"
    ? clients
    : clients.filter((c) => c.id.toLowerCase() === clientId.toLowerCase());

  if (targetClients.length === 0) {
    console.error(`❌ Unknown client '${clientId}'. Available clients: claude, antigravity, codex, cursor, qwen, all`);
    process.exit(1);
  }

  let totalUpdated = 0;
  for (const client of targetClients) {
    console.log(`\nConnecting ${client.name}...`);
    for (const p of client.paths) {
      const success = writeClientConfig(p, mcpIndexJs, projectFile);
      if (success) {
        console.log(`  [✓] Updated ${p}${projectFile ? "" : " (Workspace Auto-Detect Mode)"}`);
        totalUpdated++;
      } else {
        console.log(`  [×] Failed to write ${p}`);
      }
    }
  }

  if (totalUpdated > 0) {
    console.log(`\n✅ Connected successfully! (${totalUpdated} config file(s) updated)`);
    if (!projectFile) {
      console.log("ℹ️ Server connected in Workspace Auto-Detect mode. Just open your GameMaker project folder in your AI client!");
    }
  }
}

export function runInit(projectArg?: string, options: { client?: string } = {}): void {
  const projectFile = discoverProjectFile(projectArg);
  if (!projectFile) {
    console.error("❌ Error: GameMaker project (.yyp) not found. Specify path or run inside project directory.");
    process.exit(1);
  }

  const mcpRoot = getMcpPackageRoot();
  const mcpIndexJs = path.join(mcpRoot, "dist", "src", "index.js");
  const pDir = path.dirname(projectFile);

  const localMcpConfig = path.join(pDir, "mcp-config.json");
  const written = writeClientConfig(localMcpConfig, mcpIndexJs, projectFile);

  if (written) {
    console.log(`[✓] Created project config: ${localMcpConfig}`);
  }

  const targetClient = options.client ?? "all";
  runConnect(targetClient, projectFile);
}

export function runInstall(projectArg?: string): void {
  console.log("🚀 GameMaker MCP Installer\n========================");

  // 1. Check Node
  const nodeRes = checkNode();
  if (!nodeRes.ok) {
    console.error(`❌ Error: Node.js 20 or newer is required (found ${nodeRes.version}).`);
    process.exit(1);
  }
  console.log(`[✓] Node.js check passed (${nodeRes.version})`);

  // 2. Check GameMaker
  const gmRes = checkGameMaker();
  if (gmRes.selected) {
    console.log(`[✓] GameMaker runtime found (${gmRes.selected.igorPath})`);
  } else {
    console.log(`[!] GameMaker runtime not found. Inspection/editing will work; builds require Igor.exe.`);
  }

  // 3. Find Project
  const projectFile = discoverProjectFile(projectArg);
  if (!projectFile) {
    console.error("❌ Error: Could not locate a GameMaker project (.yyp).");
    console.error("Please provide the path to your .yyp file or directory: gamemaker-mcp install <path>");
    process.exit(1);
  }
  console.log(`[✓] Found GameMaker project: ${projectFile}`);

  // 4. Run Build if pre-built dist is missing
  const mcpRoot = getMcpPackageRoot();
  const mcpIndexJs = path.join(mcpRoot, "dist", "src", "index.js");

  if (!fs.existsSync(mcpIndexJs)) {
    console.log(`\n📦 Building GameMaker MCP server package at ${mcpRoot}...`);
    try {
      execSync("npm run build", { cwd: mcpRoot, stdio: "inherit" });
      console.log(`[✓] Package built successfully.`);
    } catch (err) {
      console.error("❌ Error during build:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  } else {
    console.log(`[✓] Server package verified (${mcpIndexJs}).`);
  }

  // 5. Connect Clients & Create Configs
  console.log("\n⚙️ Configuring MCP Clients...");

  const localMcpConfig = path.join(path.dirname(projectFile), "mcp-config.json");
  writeClientConfig(localMcpConfig, mcpIndexJs, projectFile);
  console.log(`[✓] Created local config at ${localMcpConfig}`);

  const clients = getSupportedClients(path.dirname(projectFile));
  for (const client of clients) {
    for (const p of client.paths) {
      const ok = writeClientConfig(p, mcpIndexJs, projectFile);
      if (ok) {
        console.log(`[✓] Connected ${client.name} -> ${p}`);
      }
    }
  }

  console.log("\n🎉 GameMaker MCP Installation Complete!");
  console.log(`Project: ${projectFile}`);
  console.log(`Server Entry: ${mcpIndexJs}`);
  console.log("\nYou can now start using GameMaker MCP in your favorite AI client!\n");
}

export function printHelp(): void {
  console.log(`
GameMaker MCP Manager & CLI Tool

Usage:
  gamemaker-mcp [command] [options]

Commands:
  install [projectPath]               Full automated setup: build server & configure all AI clients
  init [projectPath]                  Generate local mcp-config.json & connect clients
  doctor [projectPath]                Verify Node.js, GameMaker runtime, Igor.exe, project & client status
  connect <client> [projectPath]      Connect specific client (claude | antigravity | codex | cursor | all)
  help, --help, -h                    Show this help message

If no command is supplied and a GameMaker project is specified or GAMEMAKER_PROJECT is set,
gamemaker-mcp starts the MCP stdio server.

Examples:
  gamemaker-mcp install C:\\Projects\\MyGame\\MyGame.yyp
  gamemaker-mcp doctor
  gamemaker-mcp connect claude
  gamemaker-mcp connect antigravity
  gamemaker-mcp connect codex
  gamemaker-mcp connect cursor
`);
}

export function handleCliCommand(argv: string[]): boolean {
  const first = argv[0]?.toLowerCase();

  switch (first) {
    case "install":
      runInstall(argv[1]);
      return true;

    case "init":
      runInit(argv[1]);
      return true;

    case "doctor":
      runDoctor(argv[1]);
      return true;

    case "connect":
      if (!argv[1]) {
        console.error("❌ Error: Missing client name. Usage: gamemaker-mcp connect <claude|antigravity|codex|cursor|all> [projectPath]");
        process.exit(1);
      }
      runConnect(argv[1], argv[2]);
      return true;

    case "help":
    case "--help":
    case "-h":
      printHelp();
      return true;

    default:
      return false;
  }
}
