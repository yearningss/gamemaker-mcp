import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BuildResult, ServerConfig } from "./types.js";

export interface RuntimeCandidate {
  igorPath: string;
  runtimePath: string;
  version: string;
}

export interface ResolvedIgorRuntime {
  igorPath: string;
  runtimePath: string;
}

function directories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name));
}

export function discoverRuntimes(): RuntimeCandidate[] {
  const candidates: RuntimeCandidate[] = [];
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const home = os.homedir();
  const programData = process.env.ProgramData || "C:\\ProgramData";
  const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";

  const searchBases: string[] = [];

  if (isWin) {
    searchBases.push(
      programData,
      appData,
      localAppData,
      programFiles,
      programFilesX86,
      path.join(programFiles, "Steam", "steamapps", "common"),
      path.join(programFilesX86, "Steam", "steamapps", "common"),
      "C:\\GameMaker",
      "D:\\GameMaker",
      "E:\\GameMaker",
    );
  } else if (isMac) {
    searchBases.push(
      path.join(home, "Library", "Application Support"),
      "/Applications",
      path.join(home, "Applications"),
    );
  } else {
    searchBases.push(
      path.join(home, ".config"),
      path.join(home, ".local", "share"),
      "/opt",
      "/usr/local/share",
    );
  }

  const igorSubpaths = isWin
    ? [
        path.join("bin", "igor", "windows", "x64", "Igor.exe"),
        path.join("bin", "igor", "windows", "x86", "Igor.exe"),
        path.join("bin", "Igor.exe"),
        "Igor.exe",
      ]
    : isMac
    ? [
        path.join("bin", "igor", "osx", "x64", "Igor"),
        path.join("bin", "igor", "osx", "arm64", "Igor"),
        path.join("bin", "Igor"),
        "Igor",
      ]
    : [
        path.join("bin", "igor", "linux", "x64", "Igor"),
        path.join("bin", "Igor"),
        "Igor",
      ];

  const scannedRoots = new Set<string>();

  for (const base of searchBases) {
    if (!fs.existsSync(base)) continue;

    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderName = entry.name;
        if (!/GameMaker|YoYo/i.test(folderName)) continue;

        const gmDir = path.join(base, folderName);
        const runtimeDirs = [
          path.join(gmDir, "Cache", "runtimes"),
          path.join(gmDir, "runtimes"),
          gmDir,
        ];

        for (const rDir of runtimeDirs) {
          if (scannedRoots.has(rDir) || !fs.existsSync(rDir)) continue;
          scannedRoots.add(rDir);

          const subDirs = directories(rDir);
          const dirsToCheck = subDirs.length > 0 ? subDirs : [rDir];

          for (const runtimePath of dirsToCheck) {
            for (const sub of igorSubpaths) {
              const igorPath = path.join(runtimePath, sub);
              if (fs.existsSync(igorPath)) {
                const version = path.basename(runtimePath).replace(/^runtime-/, "");
                candidates.push({
                  igorPath: fs.realpathSync(igorPath),
                  runtimePath: fs.realpathSync(runtimePath),
                  version,
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  const unique = new Map<string, RuntimeCandidate>();
  for (const c of candidates) {
    if (!unique.has(c.igorPath)) {
      unique.set(c.igorPath, c);
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );
}

function inferRuntimePath(igorPath: string): string {
  return path.resolve(path.dirname(igorPath), "../../../..");
}

export function discoverUserDir(): string | undefined {
  const home = os.homedir();
  const bases = ([
    process.env.APPDATA,
    process.env.LOCALAPPDATA,
    path.join(home, "AppData", "Roaming"),
    path.join(home, "Library", "Application Support"),
    path.join(home, ".config"),
  ] as (string | undefined)[])
    .filter((b): b is string => typeof b === "string" && b.length > 0 && fs.existsSync(b));

  for (const base of bases) {
    try {
      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && /GameMaker|YoYo/i.test(entry.name)) {
          return path.join(base, entry.name);
        }
      }
    } catch {}
  }

  return undefined;
}

/** Resolve the configured or newest discovered Igor runtime. */
export function resolveIgorRuntime(
  config: Pick<ServerConfig, "igorPath" | "runtimePath">,
  required = true,
): ResolvedIgorRuntime | undefined {
  if (config.igorPath) {
    return {
      igorPath: config.igorPath,
      runtimePath: config.runtimePath ?? inferRuntimePath(config.igorPath),
    };
  }
  const detected = discoverRuntimes()[0];
  if (detected) return { igorPath: detected.igorPath, runtimePath: detected.runtimePath };
  if (required) {
    throw new Error("No Igor.exe was found. Set GAMEMAKER_IGOR and optionally GAMEMAKER_RUNTIME.");
  }
  return undefined;
}

function diagnosticsFrom(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((line) => /\b(error|warning|failed|exception)\b/i.test(line))
    .filter((line) => !/0 errors|0 warnings/i.test(line))
    .filter((line) => !/Failed to load Options from .*local_settings\.json/i.test(line))
    .slice(0, 200);
}

function appendLimited(current: string, chunk: Buffer, limit = 512_000): string {
  if (current.length >= limit) return current;
  const addition = chunk.toString("utf8");
  return `${current}${addition}`.slice(0, limit);
}

export class IgorService {
  private readonly config: ServerConfig;
  private active = false;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  inventory(): {
    configured?: { igorPath: string; runtimePath: string };
    detected: RuntimeCandidate[];
    selected?: { igorPath: string; runtimePath: string };
  } {
    const detected = discoverRuntimes();
    const selected = this.resolveRuntime(false);
    return {
      ...(this.config.igorPath
        ? {
            configured: {
              igorPath: this.config.igorPath,
              runtimePath: this.config.runtimePath ?? inferRuntimePath(this.config.igorPath),
            },
          }
        : {}),
      detected,
      ...(selected ? { selected } : {}),
    };
  }

  async compile(options: { timeoutMs?: number | undefined; ignoreCache?: boolean | undefined } = {}): Promise<BuildResult> {
    if (!this.config.allowBuild) {
      throw new Error("Builds are disabled. Set GAMEMAKER_MCP_ALLOW_BUILD=1 to enable them.");
    }
    if (this.active) throw new Error("A GameMaker build is already running");
    const runtime = this.resolveRuntime(true)!;
    const timeoutMs = Math.min(10 * 60_000, Math.max(5_000, options.timeoutMs ?? 120_000));
    const workRoot = path.join(this.config.projectRoot, ".gamemaker-mcp");
    const cache = path.join(workRoot, "cache");
    const temp = path.join(workRoot, "temp");
    const outputFile = path.join(temp, `${path.basename(this.config.projectFile, ".yyp")}.win`);
    fs.mkdirSync(cache, { recursive: true });
    fs.mkdirSync(temp, { recursive: true });

    const args = [
      "-j=4",
      `--project=${this.config.projectFile}`,
      `--runtimePath=${runtime.runtimePath}`,
      "--runtime=VM",
      `--cache=${cache}`,
      `--temp=${temp}`,
      `--of=${outputFile}`,
      "--jsonErrors",
      ...(options.ignoreCache ? ["--ignorecache"] : []),
    ];
    const userDir = this.config.userDir ?? discoverUserDir();
    if (userDir) args.push(`--user=${userDir}`);
    args.push("windows", "Compile");

    this.active = true;
    const started = Date.now();
    try {
      return await new Promise<BuildResult>((resolve, reject) => {
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const child = spawn(runtime.igorPath, args, {
          cwd: this.config.projectRoot,
          shell: false,
          windowsHide: true,
          env: process.env,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs);

        child.stdout.on("data", (chunk: Buffer) => {
          stdout = appendLimited(stdout, chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr = appendLimited(stderr, chunk);
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.on("close", (exitCode) => {
          clearTimeout(timer);
          const combined = `${stdout}\n${stderr}`;
          resolve({
            ok: exitCode === 0 && !timedOut,
            exitCode,
            timedOut,
            durationMs: Date.now() - started,
            outputFile,
            stdout,
            stderr,
            diagnostics: diagnosticsFrom(combined),
            command: runtime.igorPath,
            args,
          });
        });
      });
    } finally {
      this.active = false;
    }
  }

  async compileDiagnose(options: { timeoutMs?: number | undefined; ignoreCache?: boolean | undefined } = {}): Promise<{
    ok: boolean;
    errors: Array<{ file: string; line: number; column: number; message: string }>;
    warnings: Array<{ file: string; line: number; column: number; message: string }>;
    stdout: string;
  }> {
    const result = await this.compile(options);
    const errors: Array<{ file: string; line: number; column: number; message: string }> = [];
    const warnings: Array<{ file: string; line: number; column: number; message: string }> = [];

    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/);

    for (const line of lines) {
      // Form 1: Temp files matching GML compiler output format
      // Variation A: "Error : gml_Script_scr_test.gml(42) : message"
      // Variation B: "gml_Object_obj_player_Step_0.gml(15) : Error : message"
      const m = /(?:(Error|Warning)\s*:\s*)?(gml_(?:Script|Object|Room)_[A-Za-z0-9_]+)\.gml\((\d+)\)\s*:\s*(?:(Error|Warning)\s*:\s*)?(.+)/i.exec(line);
      if (m) {
        const fullAsset = m[2] ?? "";
        const lineNum = parseInt(m[3] ?? "1", 10);
        const severity = (m[1] ?? m[4] ?? "Error").toLowerCase();
        const message = (m[5] ?? "").trim();

        let file = `${fullAsset}.gml`;

        if (fullAsset.startsWith("gml_Script_")) {
          const scriptName = fullAsset.replace("gml_Script_", "");
          file = `scripts/${scriptName}/${scriptName}.gml`;
        } else if (fullAsset.startsWith("gml_Object_")) {
          const body = fullAsset.replace("gml_Object_", "");
          const eventMatch = /(.+?)_(Create|Destroy|Alarm|Step|Collision|Draw|KeyPress|KeyRelease|Mouse|Other|CleanUp|PreCreate|Gesture)_(\d+|[A-Za-z0-9_]+)$/i.exec(body);
          if (eventMatch) {
            const objName = eventMatch[1] ?? "";
            const eventName = eventMatch[2] ?? "";
            const eventNum = eventMatch[3] ?? "";
            file = `objects/${objName}/${eventName}_${eventNum}.gml`;
          }
        }

        const diag = { file, line: lineNum, column: 0, message };
        if (severity === "warning") {
          warnings.push(diag);
        } else {
          errors.push(diag);
        }
      } else {
        // Form 2: Absolute file paths matching GML format (like C:\Projects\scripts\...)
        const absMatch = /(?:(Error|Warning)\s*:\s*)?([A-Za-z]:\\[^[(\n\r]+?\.gml)\((\d+)\)\s*:\s*(?:(Error|Warning)\s*:\s*)?(.+)/i.exec(line);
        if (absMatch) {
          const absPath = absMatch[2] ?? "";
          const lineNum = parseInt(absMatch[3] ?? "1", 10);
          const severity = (absMatch[1] ?? absMatch[4] ?? "Error").toLowerCase();
          const message = (absMatch[5] ?? "").trim();

          let file = absPath;
          try {
            file = path.relative(this.config.projectRoot, absPath).replace(/\\/g, "/");
          } catch {}

          const diag = { file, line: lineNum, column: 0, message };
          if (severity === "warning") {
            warnings.push(diag);
          } else {
            errors.push(diag);
          }
        } else {
          // Form 3: General Igor compile warnings/errors
          const generalMatch = /(?:Error|Warning)\s*:\s*(.+)/i.exec(line);
          if (generalMatch && !line.includes("0 errors") && !line.includes("0 warnings")) {
            const msg = (generalMatch[1] ?? "").trim();
            if (msg && !errors.some(e => e.message === msg) && !warnings.some(w => w.message === msg)) {
              const diag = { file: "Project", line: 0, column: 0, message: msg };
              if (line.toLowerCase().includes("warning")) {
                warnings.push(diag);
              } else {
                errors.push(diag);
              }
            }
          }
        }
      }
    }

    return {
      ok: result.ok,
      errors,
      warnings,
      stdout: result.stdout,
    };
  }

  private resolveRuntime(required: boolean): { igorPath: string; runtimePath: string } | undefined {
    return resolveIgorRuntime(this.config, required);
  }
}
