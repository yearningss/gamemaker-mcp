import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  discoverUserDir,
  resolveIgorRuntime,
  type ResolvedIgorRuntime,
} from "./igor.js";
import type { ServerConfig } from "./types.js";

export const JOB_KINDS = ["compile", "package-zip"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = [
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "timed-out",
] as const;
export type JobState = (typeof JOB_STATES)[number];

export interface StartJobOptions {
  kind: JobKind;
  timeoutMs?: number | undefined;
  ignoreCache?: boolean | undefined;
}

export interface GameMakerJob {
  id: string;
  kind: JobKind;
  state: JobState;
  projectFile: string;
  createdAt: string;
  startedAt: string;
  finishedAt?: string | undefined;
  durationMs?: number | undefined;
  pid?: number | undefined;
  exitCode?: number | null | undefined;
  signal?: NodeJS.Signals | null | undefined;
  timedOut: boolean;
  cancelRequested: boolean;
  timeoutMs: number;
  ignoreCache: boolean;
  artifactPath: string;
  artifactExists: boolean;
  logPath: string;
  outputBytes: number;
  storedLogBytes: number;
  outputTruncated: boolean;
  diagnostics: string[];
  command: string;
  args: string[];
  error?: string | undefined;
}

export interface JobListOptions {
  limit?: number | undefined;
}

export interface JobLogOptions {
  tailBytes?: number | undefined;
}

export interface JobLog {
  jobId: string;
  state: JobState;
  content: string;
  startOffset: number;
  endOffset: number;
  storedBytes: number;
  outputBytes: number;
  truncated: boolean;
}

export interface JobSpawnOptions {
  cwd: string;
  shell: false;
  windowsHide: true;
  env: NodeJS.ProcessEnv;
  stdio: ["ignore", "pipe", "pipe"];
}

export interface JobChildProcess {
  readonly pid?: number | undefined;
  readonly stdout: NodeJS.ReadableStream | null;
  readonly stderr: NodeJS.ReadableStream | null;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "close",
    listener: (exitCode: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type JobSpawner = (
  command: string,
  args: readonly string[],
  options: JobSpawnOptions,
) => JobChildProcess;

export interface ProcessControlSpawnOptions {
  shell: false;
  windowsHide: true;
  env: NodeJS.ProcessEnv;
  stdio: "ignore";
}

export interface ProcessControlChild {
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "close",
    listener: (exitCode: number | null, signal: NodeJS.Signals | null) => void,
  ): this;
  kill(signal?: NodeJS.Signals): boolean;
}

export type ProcessControlSpawner = (
  command: string,
  args: readonly string[],
  options: ProcessControlSpawnOptions,
) => ProcessControlChild;

export type ProcessTreeTerminator = (pid: number) => Promise<boolean>;

export interface JobServiceOptions {
  maxLogBytes?: number | undefined;
  spawner?: JobSpawner | undefined;
  idFactory?: (() => string) | undefined;
  now?: (() => Date) | undefined;
  treeTerminator?: ProcessTreeTerminator | undefined;
}

interface ActiveJob {
  record: GameMakerJob;
  child: JobChildProcess;
  timer: NodeJS.Timeout;
  completion: Promise<GameMakerJob>;
  resolveCompletion: (job: GameMakerJob) => void;
  finished: boolean;
  terminationReason?: "cancel" | "timeout" | undefined;
  terminationTimer?: NodeJS.Timeout | undefined;
}

interface JobCommand {
  worker: "windows";
  igorCommand: "Compile" | "PackageZip";
  extension: ".win" | ".zip";
}

interface JobLock {
  jobId: string;
  ownerPid: number;
  childPid?: number | undefined;
  createdAt: string;
}

const COMMAND_ALLOWLIST: Readonly<Record<JobKind, JobCommand>> = Object.freeze({
  compile: Object.freeze({
    worker: "windows",
    igorCommand: "Compile",
    extension: ".win",
  }),
  "package-zip": Object.freeze({
    worker: "windows",
    igorCommand: "PackageZip",
    extension: ".zip",
  }),
});

const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_MAX_LOG_BYTES = 512_000;
const MAX_MAX_LOG_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 256 * 1024;
const JOB_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9-]{27,40}$/i;
const TREE_KILL_TIMEOUT_MS = 2_500;
const TERMINATION_SETTLE_MS = 1_500;

function defaultSpawner(
  command: string,
  args: readonly string[],
  options: JobSpawnOptions,
): JobChildProcess {
  return spawn(command, [...args], options) as unknown as JobChildProcess;
}

function defaultProcessControlSpawner(
  command: string,
  args: readonly string[],
  options: ProcessControlSpawnOptions,
): ProcessControlChild {
  return spawn(command, [...args], options) as unknown as ProcessControlChild;
}

function validatedPid(pid: number): string {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0xffff_ffff) {
    throw new Error("Process id must be a positive 32-bit integer");
  }
  return String(pid);
}

function systemTaskkillPath(): string {
  const systemRoot = process.env.SystemRoot;
  if (systemRoot && path.win32.isAbsolute(systemRoot)) {
    return path.win32.join(systemRoot, "System32", "taskkill.exe");
  }
  return "C:\\Windows\\System32\\taskkill.exe";
}

/** Terminate Igor and all descendants through the fixed Windows taskkill utility. */
export async function terminateWindowsProcessTree(
  pid: number,
  controlSpawner: ProcessControlSpawner = defaultProcessControlSpawner,
): Promise<boolean> {
  const pidArgument = validatedPid(pid);
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child: ProcessControlChild;
    try {
      child = controlSpawner(systemTaskkillPath(), ["/PID", pidArgument, "/T", "/F"], {
        shell: false,
        windowsHide: true,
        env: { ...process.env },
        stdio: "ignore",
      });
    } catch {
      return resolve(false);
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The taskkill helper may already have exited.
      }
      settle(false);
    }, TREE_KILL_TIMEOUT_MS);
    timer.unref();
    child.once("error", () => settle(false));
    child.once("close", (exitCode) => settle(exitCode === 0));
  });
}

function defaultTreeTerminator(pid: number): Promise<boolean> {
  if (process.platform !== "win32") return Promise.resolve(false);
  return terminateWindowsProcessTree(pid);
}

function cloneJob(job: GameMakerJob): GameMakerJob {
  return {
    ...job,
    args: [...job.args],
    diagnostics: [...job.diagnostics],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTerminal(state: JobState): boolean {
  return state !== "running";
}

function assertJobKind(value: unknown): asserts value is JobKind {
  if (value !== "compile" && value !== "package-zip") {
    throw new Error("Job kind must be one of: compile, package-zip");
  }
}

function assertJobId(id: string): void {
  if (!JOB_ID_PATTERN.test(id)) {
    throw new Error("Invalid job id");
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRealDirectory(directory: string, projectRoot: string): string {
  const trustedRoot = fs.realpathSync(projectRoot);
  const requested = path.resolve(directory);
  if (!isWithin(trustedRoot, requested)) {
    throw new Error(`Job directory escapes the configured project: ${requested}`);
  }

  // Validate the closest existing ancestor before mkdir. Otherwise a symlink
  // such as .gamemaker-mcp -> outside could be populated before containment is checked.
  let ancestor = requested;
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error(`Cannot resolve job directory ancestor: ${requested}`);
    ancestor = parent;
  }
  const ancestorActual = fs.realpathSync(ancestor);
  if (!isWithin(trustedRoot, ancestorActual)) {
    throw new Error(`Job directory ancestor escapes the configured project: ${ancestorActual}`);
  }

  fs.mkdirSync(requested, { recursive: true });
  const actual = fs.realpathSync(requested);
  if (!isWithin(trustedRoot, actual)) {
    throw new Error(`Job directory escapes the configured project: ${actual}`);
  }
  return actual;
}

function diagnosticsFrom(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((line) => /\b(error|warning|failed|exception)\b/i.test(line))
    .filter((line) => !/0 errors|0 warnings/i.test(line))
    .filter((line) => !/Failed to load Options from .*local_settings\.json/i.test(line))
    .slice(0, 200);
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

/**
 * Runs only the two explicitly allowlisted Windows Igor operations and keeps a
 * bounded, persistent job history under .gamemaker-mcp/jobs.
 */
export class GameMakerJobService {
  readonly jobsRoot: string;

  private readonly config: ServerConfig;
  private readonly maxLogBytes: number;
  private readonly spawner: JobSpawner;
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly treeTerminator: ProcessTreeTerminator;
  private readonly lockPath: string;
  private active?: ActiveJob | undefined;

  constructor(config: ServerConfig, options: JobServiceOptions = {}) {
    this.config = config;
    this.maxLogBytes = options.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES;
    if (
      !Number.isSafeInteger(this.maxLogBytes) ||
      this.maxLogBytes < 1 ||
      this.maxLogBytes > MAX_MAX_LOG_BYTES
    ) {
      throw new Error(`maxLogBytes must be between 1 and ${MAX_MAX_LOG_BYTES}`);
    }
    this.spawner = options.spawner ?? defaultSpawner;
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
    this.treeTerminator = options.treeTerminator ?? defaultTreeTerminator;

    const projectRoot = fs.realpathSync(config.projectRoot);
    this.jobsRoot = safeRealDirectory(
      path.join(projectRoot, ".gamemaker-mcp", "jobs"),
      projectRoot,
    );
    this.lockPath = path.join(this.jobsRoot, "active.lock");
  }

  start(options: StartJobOptions): GameMakerJob {
    if (!this.config.allowBuild) {
      throw new Error("Build jobs are disabled. Set GAMEMAKER_MCP_ALLOW_BUILD=1 to enable them.");
    }
    assertJobKind(options.kind);
    if (this.active && !this.active.finished) {
      throw new Error(`A GameMaker job is already running: ${this.active.record.id}`);
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw new Error(`timeoutMs must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`);
    }

    const runtime = resolveIgorRuntime(this.config, true)!;
    const id = this.idFactory();
    assertJobId(id);
    this.acquireLock(id);
    let launchedChild: JobChildProcess | undefined;
    try {
      const jobDirectory = this.createJobDirectory(id);
      const command = COMMAND_ALLOWLIST[options.kind];
      const projectName = path.basename(this.config.projectFile, path.extname(this.config.projectFile));
      const artifactPath = path.join(jobDirectory, `${projectName}${command.extension}`);
      const logPath = path.join(jobDirectory, "output.log");
      const args = this.createArguments(
        runtime,
        command,
        jobDirectory,
        artifactPath,
        options.ignoreCache === true,
      );
      const timestamp = this.now().toISOString();
      const header = Buffer.from(
        `GameMaker MCP job ${id}\nkind=${options.kind}\nstarted=${timestamp}\n\n`,
        "utf8",
      );
      const initialLog = header.subarray(0, this.maxLogBytes);
      fs.writeFileSync(logPath, initialLog, { flag: "wx" });
  
      const record: GameMakerJob = {
        id,
        kind: options.kind,
        state: "running",
        projectFile: this.config.projectFile,
        createdAt: timestamp,
        startedAt: timestamp,
        timedOut: false,
        cancelRequested: false,
        timeoutMs,
        ignoreCache: options.ignoreCache === true,
        artifactPath,
        artifactExists: false,
        logPath,
        outputBytes: 0,
        storedLogBytes: initialLog.length,
        outputTruncated: header.length > initialLog.length,
        diagnostics: [],
        command: runtime.igorPath,
        args,
      };
      this.writeRecord(record);
  
      let child: JobChildProcess;
      try {
        child = this.spawner(runtime.igorPath, args, {
          cwd: this.config.projectRoot,
          shell: false,
          windowsHide: true,
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        this.finishBeforeActive(record, "failed", errorMessage(error));
        throw new Error(`Could not start Igor job ${id}: ${errorMessage(error)}`);
      }
  
      launchedChild = child;
      if (child.pid !== undefined) record.pid = child.pid;
      this.updateLock(id, child.pid);
      this.writeRecord(record);
  
      let resolveCompletion!: (job: GameMakerJob) => void;
      const completion = new Promise<GameMakerJob>((resolve) => {
        resolveCompletion = resolve;
      });
      const timer = setTimeout(() => {
        const active = this.active;
        if (
          !active ||
          active.record.id !== id ||
          active.finished ||
          active.terminationReason !== undefined
        ) {
          return;
        }
        active.record.timedOut = true;
        this.writeRecord(active.record);
        this.requestTermination("timeout");
      }, timeoutMs);
      timer.unref();
  
      this.active = {
        record,
        child,
        timer,
        completion,
        resolveCompletion,
        finished: false,
      };
  
      child.stdout?.on("data", (chunk: Buffer | string) => {
        this.appendOutput(id, chunk);
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        this.appendOutput(id, chunk);
      });
      child.once("error", (error) => {
        this.finishActive("failed", null, null, errorMessage(error));
      });
      child.once("close", (exitCode, signal) => {
        const active = this.active;
        if (!active || active.record.id !== id || active.finished) return;
        const state: JobState =
          active.terminationReason === "cancel"
            ? "cancelled"
            : active.terminationReason === "timeout"
              ? "timed-out"
              : exitCode === 0
                ? "succeeded"
                : "failed";
        const failure =
          state === "failed"
            ? `Igor exited with code ${exitCode === null ? "null" : exitCode}`
            : undefined;
        this.finishActive(state, exitCode, signal, failure);
      });
  
      return cloneJob(record);
    } catch (error) {
      if (launchedChild) launchedChild.kill("SIGTERM");
      this.releaseLock(id);
      throw error;
    }
  }

  list(options: JobListOptions = {}): GameMakerJob[] {
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("limit must be between 1 and 200");
    }

    const jobs: GameMakerJob[] = [];
    for (const entry of fs.readdirSync(this.jobsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !JOB_ID_PATTERN.test(entry.name)) continue;
      try {
        jobs.push(this.readRecord(entry.name));
      } catch {
        // A corrupt/incomplete history entry cannot hide the rest of the history.
      }
    }
    if (this.active && !this.active.finished) {
      const index = jobs.findIndex((job) => job.id === this.active!.record.id);
      if (index >= 0) jobs[index] = cloneJob(this.active.record);
      else jobs.push(cloneJob(this.active.record));
    }
    return jobs
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(cloneJob);
  }

  status(id: string): GameMakerJob {
    assertJobId(id);
    if (this.active?.record.id === id && !this.active.finished) {
      return cloneJob(this.active.record);
    }
    return this.readRecord(id);
  }

  cancel(id: string): GameMakerJob {
    assertJobId(id);
    const active = this.active;
    if (!active || active.record.id !== id || active.finished) {
      const record = this.readRecord(id);
      if (isTerminal(record.state)) return record;
      throw new Error("This running job is not owned by the current server process");
    }

    if (active.terminationReason === "timeout") return cloneJob(active.record);
    if (active.terminationReason === undefined) {
      active.record.cancelRequested = true;
      this.writeRecord(active.record);
      this.requestTermination("cancel");
    }
    return cloneJob(active.record);
  }

  readLog(id: string, options: JobLogOptions = {}): JobLog {
    const record = this.status(id);
    const tailBytes = options.tailBytes ?? 64 * 1024;
    if (!Number.isSafeInteger(tailBytes) || tailBytes < 1 || tailBytes > this.maxLogBytes) {
      throw new Error(`tailBytes must be between 1 and ${this.maxLogBytes}`);
    }

    const logPath = this.safeLogPath(id);
    const stat = fs.statSync(logPath);
    if (!stat.isFile()) throw new Error(`Job log is not a file: ${id}`);
    const storedBytes = Math.min(stat.size, this.maxLogBytes);
    const startOffset = Math.max(0, storedBytes - tailBytes);
    const length = storedBytes - startOffset;
    const buffer = Buffer.alloc(length);
    const handle = fs.openSync(logPath, "r");
    try {
      if (length > 0) fs.readSync(handle, buffer, 0, length, startOffset);
    } finally {
      fs.closeSync(handle);
    }
    return {
      jobId: id,
      state: record.state,
      content: buffer.toString("utf8"),
      startOffset,
      endOffset: startOffset + length,
      storedBytes,
      outputBytes: record.outputBytes,
      truncated: record.outputTruncated || startOffset > 0,
    };
  }

  async wait(id: string, timeoutMs?: number): Promise<GameMakerJob> {
    assertJobId(id);
    const active = this.active;
    if (!active || active.record.id !== id || active.finished) return this.status(id);
    if (timeoutMs === undefined) return cloneJob(await active.completion);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(`wait timeoutMs must be between 1 and ${MAX_TIMEOUT_MS}`);
    }
    return await new Promise<GameMakerJob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for job ${id}`)), timeoutMs);
      timer.unref();
      active.completion.then(
        (job) => {
          clearTimeout(timer);
          resolve(cloneJob(job));
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private createArguments(
    runtime: ResolvedIgorRuntime,
    command: JobCommand,
    jobDirectory: string,
    artifactPath: string,
    ignoreCache: boolean,
  ): string[] {
    const cache = safeRealDirectory(
      path.join(this.config.projectRoot, ".gamemaker-mcp", "cache"),
      fs.realpathSync(this.config.projectRoot),
    );
    const temp = safeRealDirectory(
      path.join(jobDirectory, "temp"),
      fs.realpathSync(this.config.projectRoot),
    );
    const args = [
      "-j=4",
      `--project=${this.config.projectFile}`,
      `--runtimePath=${runtime.runtimePath}`,
      "--runtime=VM",
      `--cache=${cache}`,
      `--temp=${temp}`,
      `--of=${artifactPath}`,
      "--jsonErrors",
      ...(ignoreCache ? ["--ignorecache"] : []),
    ];
    const userDir = this.config.userDir ?? discoverUserDir();
    if (userDir) args.push(`--user=${userDir}`);
    args.push(command.worker, command.igorCommand);
    return args;
  }

  private createJobDirectory(id: string): string {
    assertJobId(id);
    const directory = path.join(this.jobsRoot, id);
    if (fs.existsSync(directory)) throw new Error(`Job directory already exists: ${id}`);
    return safeRealDirectory(directory, this.jobsRoot);
  }

  private metadataPath(id: string): string {
    assertJobId(id);
    const directory = path.join(this.jobsRoot, id);
    if (!fs.existsSync(directory)) throw new Error(`Unknown job: ${id}`);
    const info = fs.lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`Unsafe job directory: ${id}`);
    }
    const actual = fs.realpathSync(directory);
    if (!isWithin(this.jobsRoot, actual)) throw new Error(`Job directory escapes history root: ${id}`);
    return path.join(actual, "job.json");
  }

  private writeRecord(record: GameMakerJob): void {
    const metadataPath = path.join(this.jobsRoot, record.id, "job.json");
    const tempPath = `${metadataPath}.${process.pid}.${randomUUID()}.tmp`;
    const content = `${JSON.stringify(record, null, 2)}\n`;
    if (Buffer.byteLength(content, "utf8") > MAX_METADATA_BYTES) {
      throw new Error("Job metadata exceeds its safety limit");
    }
    fs.writeFileSync(tempPath, content, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tempPath, metadataPath);
  }

  private readRecord(id: string): GameMakerJob {
    const metadataPath = this.metadataPath(id);
    const stat = fs.statSync(metadataPath);
    if (!stat.isFile() || stat.size > MAX_METADATA_BYTES) {
      throw new Error(`Invalid job metadata: ${id}`);
    }
    const value = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Partial<GameMakerJob>;
    if (
      value.id !== id ||
      !JOB_KINDS.includes(value.kind as JobKind) ||
      !JOB_STATES.includes(value.state as JobState) ||
      typeof value.projectFile !== "string" ||
      typeof value.createdAt !== "string" ||
      typeof value.startedAt !== "string" ||
      typeof value.timedOut !== "boolean" ||
      typeof value.cancelRequested !== "boolean" ||
      typeof value.timeoutMs !== "number" ||
      typeof value.ignoreCache !== "boolean" ||
      typeof value.artifactPath !== "string" ||
      typeof value.artifactExists !== "boolean" ||
      typeof value.logPath !== "string" ||
      typeof value.outputBytes !== "number" ||
      typeof value.storedLogBytes !== "number" ||
      typeof value.outputTruncated !== "boolean" ||
      typeof value.command !== "string" ||
      !Array.isArray(value.args) ||
      !value.args.every((argument) => typeof argument === "string") ||
      !Array.isArray(value.diagnostics) ||
      !value.diagnostics.every((diagnostic) => typeof diagnostic === "string")
    ) {
      throw new Error(`Invalid job metadata: ${id}`);
    }
    const directory = path.dirname(metadataPath);
    const command = COMMAND_ALLOWLIST[value.kind as JobKind];
    const projectName = path.basename(this.config.projectFile, path.extname(this.config.projectFile));
    const expectedArtifact = path.join(directory, `${projectName}${command.extension}`);
    const expectedLog = path.join(directory, "output.log");
    if (
      path.resolve(value.artifactPath) !== path.resolve(expectedArtifact) ||
      path.resolve(value.logPath) !== path.resolve(expectedLog)
    ) {
      throw new Error(`Invalid job paths in metadata: ${id}`);
    }
    return value as GameMakerJob;
  }

  private safeLogPath(id: string): string {
    const directory = path.dirname(this.metadataPath(id));
    const logPath = path.join(directory, "output.log");
    const info = fs.lstatSync(logPath);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Unsafe job log: ${id}`);
    }
    const actual = fs.realpathSync(logPath);
    if (!isWithin(directory, actual)) throw new Error(`Job log escapes history root: ${id}`);
    return actual;
  }

  private appendOutput(id: string, chunk: Buffer | string): void {
    const active = this.active;
    if (!active || active.record.id !== id || active.finished) return;
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    active.record.outputBytes += data.length;
    const remaining = this.maxLogBytes - active.record.storedLogBytes;
    if (remaining > 0) {
      const portion = data.subarray(0, remaining);
      fs.appendFileSync(active.record.logPath, portion);
      active.record.storedLogBytes += portion.length;
    }
    if (data.length > Math.max(remaining, 0)) active.record.outputTruncated = true;
  }

  private finishBeforeActive(record: GameMakerJob, state: JobState, message: string): void {
    const finishedAt = this.now();
    record.state = state;
    record.finishedAt = finishedAt.toISOString();
    record.durationMs = Math.max(0, finishedAt.getTime() - Date.parse(record.startedAt));
    record.error = message;
    record.artifactExists = fs.existsSync(record.artifactPath);
    record.diagnostics = diagnosticsFrom(this.readBoundedLog(this.safeLogPath(record.id)));
    this.writeRecord(record);
    this.releaseLock(record.id);
  }

  private requestTermination(reason: "cancel" | "timeout"): void {
    const active = this.active;
    if (!active || active.finished || active.terminationReason !== undefined) return;
    active.terminationReason = reason;

    let terminationAttempt: Promise<boolean>;
    try {
      if (active.child.pid === undefined) {
        terminationAttempt = Promise.resolve(false);
      } else {
        validatedPid(active.child.pid);
        terminationAttempt = this.treeTerminator(active.child.pid);
      }
    } catch {
      terminationAttempt = Promise.resolve(false);
    }

    let handled = false;
    const handleResult = (treeTerminated: boolean) => {
      if (handled) return;
      handled = true;
      clearTimeout(guardTimer);
      const current = this.active;
      if (!current || current !== active || current.finished) return;

      let fallbackAccepted = false;
      if (!treeTerminated) {
        try {
          fallbackAccepted = current.child.kill("SIGKILL");
        } catch {
          fallbackAccepted = false;
        }
      }

      current.terminationTimer = setTimeout(() => {
        const pending = this.active;
        if (!pending || pending !== current || pending.finished) return;
        const state: JobState = reason === "cancel" ? "cancelled" : "timed-out";
        const message = treeTerminated
          ? "Igor process tree terminated but no close event was observed"
          : fallbackAccepted
            ? "Igor fallback termination did not produce a close event"
            : "Unable to confirm Igor process-tree termination";
        this.finishActive(state, null, null, message);
      }, TERMINATION_SETTLE_MS);
      current.terminationTimer.unref();
    };

    const guardTimer = setTimeout(() => handleResult(false), TREE_KILL_TIMEOUT_MS + 250);
    guardTimer.unref();
    void terminationAttempt.then(handleResult, () => handleResult(false));
  }

  private finishActive(
    state: JobState,
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    message?: string,
  ): void {
    const active = this.active;
    if (!active || active.finished) return;
    active.finished = true;
    clearTimeout(active.timer);
    if (active.terminationTimer) clearTimeout(active.terminationTimer);
    const finishedAt = this.now();
    active.record.state = state;
    active.record.finishedAt = finishedAt.toISOString();
    active.record.durationMs = Math.max(
      0,
      finishedAt.getTime() - Date.parse(active.record.startedAt),
    );
    active.record.exitCode = exitCode;
    active.record.signal = signal;
    active.record.artifactExists = fs.existsSync(active.record.artifactPath);
    if (message !== undefined) active.record.error = message;
    active.record.diagnostics = diagnosticsFrom(this.readBoundedLog(active.record.logPath));
    this.writeRecord(active.record);
    this.releaseLock(active.record.id);
    const result = cloneJob(active.record);
    this.active = undefined;
    active.resolveCompletion(result);
  }

  private readBoundedLog(logPath: string): string {
    const handle = fs.openSync(logPath, "r");
    try {
      const stat = fs.fstatSync(handle);
      const length = Math.min(stat.size, this.maxLogBytes);
      const buffer = Buffer.alloc(length);
      if (length > 0) fs.readSync(handle, buffer, 0, length, 0);
      return buffer.toString("utf8");
    } finally {
      fs.closeSync(handle);
    }
  }

  private acquireLock(jobId: string): void {
    const lock: JobLock = {
      jobId,
      ownerPid: process.pid,
      createdAt: this.now().toISOString(),
    };
    try {
      fs.writeFileSync(this.lockPath, `${JSON.stringify(lock)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }

    const existing = this.readLock();
    if (existing && (processIsAlive(existing.ownerPid) || processIsAlive(existing.childPid ?? -1))) {
      throw new Error(`A GameMaker job is already running: ${existing.jobId}`);
    }
    if (!existing) {
      throw new Error("A GameMaker job lock exists but is invalid; inspect .gamemaker-mcp/jobs/active.lock");
    }

    this.markInterrupted(existing.jobId);
    fs.unlinkSync(this.lockPath);
    fs.writeFileSync(this.lockPath, `${JSON.stringify(lock)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }

  private updateLock(jobId: string, childPid: number | undefined): void {
    const lock: JobLock = {
      jobId,
      ownerPid: process.pid,
      ...(childPid !== undefined ? { childPid } : {}),
      createdAt: this.now().toISOString(),
    };
    fs.writeFileSync(this.lockPath, `${JSON.stringify(lock)}\n`, "utf8");
  }

  private readLock(): JobLock | undefined {
    try {
      const stat = fs.statSync(this.lockPath);
      if (!stat.isFile() || stat.size > 16 * 1024) return undefined;
      const value = JSON.parse(fs.readFileSync(this.lockPath, "utf8")) as Partial<JobLock>;
      if (
        typeof value.jobId !== "string" ||
        !JOB_ID_PATTERN.test(value.jobId) ||
        !Number.isSafeInteger(value.ownerPid)
      ) {
        return undefined;
      }
      return value as JobLock;
    } catch {
      return undefined;
    }
  }

  private releaseLock(jobId: string): void {
    const lock = this.readLock();
    if (lock?.jobId !== jobId) return;
    try {
      fs.unlinkSync(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private markInterrupted(id: string): void {
    try {
      const record = this.readRecord(id);
      if (record.state !== "running") return;
      const finishedAt = this.now();
      record.state = "failed";
      record.finishedAt = finishedAt.toISOString();
      record.durationMs = Math.max(0, finishedAt.getTime() - Date.parse(record.startedAt));
      record.error = "The previous MCP server stopped before this job completed";
      record.artifactExists = fs.existsSync(record.artifactPath);
      record.diagnostics = diagnosticsFrom(this.readBoundedLog(this.safeLogPath(record.id)));
      this.writeRecord(record);
    } catch {
      // Keep stale-lock recovery independent from damaged history records.
    }
  }
}
