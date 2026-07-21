import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { ProjectSandbox, sha256 } from "./security.js";
import type { AccessMode, ServerConfig } from "./types.js";

const SNAPSHOT_FORMAT_VERSION = 1 as const;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024;
const MAX_SNAPSHOT_FILES = 100_000;
const SNAPSHOT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

export const SNAPSHOT_TEXT_EXTENSIONS = [
  ".yyp",
  ".yy",
  ".gml",
  ".vsh",
  ".fsh",
  ".json",
  ".md",
  ".txt",
] as const;

const SNAPSHOT_TEXT_EXTENSION_SET = new Set<string>(SNAPSHOT_TEXT_EXTENSIONS);
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".gamemaker-mcp",
  ".build_cache",
  ".build_temp",
  "node_modules",
]);

export interface SnapshotFileEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface SnapshotManifest {
  version: typeof SNAPSHOT_FORMAT_VERSION;
  id: string;
  createdAt: string;
  label?: string;
  projectFile: string;
  fileCount: number;
  totalBytes: number;
  files: SnapshotFileEntry[];
}

export interface SnapshotSummary {
  id: string;
  createdAt: string;
  label?: string;
  fileCount: number;
  totalBytes: number;
}

export interface SnapshotInspection {
  manifest: SnapshotManifest;
  ok: boolean;
  verifiedFiles: number;
  issues: string[];
}

export interface SnapshotRestoreFile {
  path: string;
  action: "created" | "overwritten" | "unchanged";
  sha256: string;
  previousSha256?: string;
  backupPath?: string;
}

export interface SnapshotRestoreResult {
  snapshotId: string;
  restored: number;
  created: number;
  overwritten: number;
  unchanged: number;
  files: SnapshotRestoreFile[];
}

export interface SnapshotServiceOptions {
  projectRoot: string;
  projectFile?: string | undefined;
  mode: AccessMode;
  maxFileBytes?: number | undefined;
  maxSnapshotBytes?: number | undefined;
}

export interface SnapshotCreateOptions {
  label?: string | undefined;
}

interface CapturedFile extends SnapshotFileEntry {
  content: Buffer;
}

interface RestorePlanEntry {
  entry: SnapshotFileEntry;
  content: string;
  previous?: {
    sha256: string;
    content: string;
  };
}

interface AppliedRestoreEntry {
  plan: RestorePlanEntry;
  appliedSha256: string;
}

interface VerifiedSnapshot {
  inspection: SnapshotInspection;
  payloads: Map<string, Buffer>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertInside(base: string, target: string, label: string): void {
  const relative = path.relative(base, target);
  if (relative === "") return;
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its allowed directory: ${target}`);
  }
}

function normalizeProjectRelativePath(input: string): string {
  if (!input || input.includes("\0")) {
    throw new Error("Snapshot file path is empty or contains a NUL byte");
  }
  if (path.isAbsolute(input) || path.win32.isAbsolute(input) || path.posix.isAbsolute(input)) {
    throw new Error(`Snapshot file path must be project-relative: ${input}`);
  }

  const normalized = input.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    segments.some((segment) => segment === "" || segment === "." || segment === "..") ||
    path.posix.normalize(normalized) !== normalized
  ) {
    throw new Error(`Unsafe snapshot file path: ${input}`);
  }
  if (segments[0]!.toLowerCase() === ".gamemaker-mcp") {
    throw new Error("Snapshot payload cannot target .gamemaker-mcp");
  }

  const extension = path.posix.extname(normalized).toLowerCase();
  if (!SNAPSHOT_TEXT_EXTENSION_SET.has(extension)) {
    throw new Error(`Snapshot file extension is not allowed: ${extension || "<none>"}`);
  }
  return normalized;
}

function validateSnapshotId(snapshotId: string): string {
  if (!snapshotId || !SNAPSHOT_ID_PATTERN.test(snapshotId)) {
    throw new Error(
      "snapshotId is required and must contain only letters, numbers, underscores, or hyphens",
    );
  }
  return snapshotId;
}

function decodeText(buffer: Buffer, label: string): string {
  if (buffer.includes(0)) throw new Error(`${label} contains NUL bytes and is not a text file`);
  try {
    return TEXT_DECODER.decode(buffer);
  } catch {
    throw new Error(`${label} is not valid UTF-8 text`);
  }
}

function safeLabel(input: string | undefined): string | undefined {
  if (input === undefined) return undefined;
  const label = input.trim();
  if (!label) throw new Error("Snapshot label must not be empty");
  if (label.length > 200) throw new Error("Snapshot label must be at most 200 characters");
  if (/\p{Cc}/u.test(label)) throw new Error("Snapshot label must not contain control characters");
  return label;
}

function snapshotIdFor(date: Date): string {
  const timestamp = date.toISOString().replaceAll(/[-:.]/g, "");
  return `${timestamp}-${randomBytes(6).toString("hex")}`;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value as number;
}

/**
 * Creates and restores self-contained snapshots of GameMaker text resources.
 * Snapshot data is kept below .gamemaker-mcp/snapshots and is never included
 * in subsequent snapshots.
 */
export class SnapshotService {
  readonly projectRoot: string;
  readonly mode: AccessMode;
  readonly maxFileBytes: number;
  readonly maxSnapshotBytes: number;
  readonly projectFile: string;

  private readonly sandbox: ProjectSandbox;

  constructor(options: SnapshotServiceOptions | ServerConfig) {
    this.projectRoot = fs.realpathSync(options.projectRoot);
    if (!fs.statSync(this.projectRoot).isDirectory()) {
      throw new Error(`GameMaker project root is not a directory: ${this.projectRoot}`);
    }
    this.mode = options.mode;
    this.maxFileBytes = options.maxFileBytes ?? 20 * 1024 * 1024;
    if (!Number.isSafeInteger(this.maxFileBytes) || this.maxFileBytes < 1) {
      throw new Error("maxFileBytes must be a positive integer");
    }
    const configuredMaxSnapshotBytes =
      "maxSnapshotBytes" in options ? options.maxSnapshotBytes : undefined;
    this.maxSnapshotBytes = configuredMaxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES;
    if (!Number.isSafeInteger(this.maxSnapshotBytes) || this.maxSnapshotBytes < 1) {
      throw new Error("maxSnapshotBytes must be a positive integer");
    }
    this.sandbox = new ProjectSandbox(this.projectRoot, this.mode, this.maxFileBytes);

    const projectFileInput = options.projectFile ?? this.findOnlyProjectFile();
    const realProjectFile = fs.realpathSync(projectFileInput);
    assertInside(this.projectRoot, realProjectFile, "Project file");
    const relative = this.sandbox.relative(realProjectFile);
    this.projectFile = normalizeProjectRelativePath(relative);
    if (!this.projectFile.toLowerCase().endsWith(".yyp")) {
      throw new Error(`Project file must use the .yyp extension: ${this.projectFile}`);
    }
  }

  create(options: SnapshotCreateOptions = {}): SnapshotManifest {
    const label = safeLabel(options.label);
    const captured = this.captureProjectFiles();
    const snapshotsRoot = this.getSnapshotsRoot(true)!;

    let id = snapshotIdFor(new Date());
    while (fs.existsSync(path.join(snapshotsRoot, id))) id = snapshotIdFor(new Date());
    const finalDirectory = path.join(snapshotsRoot, id);
    assertInside(snapshotsRoot, finalDirectory, "Snapshot directory");

    const temporaryDirectory = path.join(
      snapshotsRoot,
      `.tmp-${id}-${process.pid}-${randomBytes(4).toString("hex")}`,
    );
    assertInside(snapshotsRoot, temporaryDirectory, "Temporary snapshot directory");

    const files = captured.map(({ content: _content, ...entry }) => entry);
    const manifest: SnapshotManifest = {
      version: SNAPSHOT_FORMAT_VERSION,
      id,
      createdAt: new Date().toISOString(),
      ...(label !== undefined ? { label } : {}),
      projectFile: this.projectFile,
      fileCount: files.length,
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      files,
    };

    fs.mkdirSync(temporaryDirectory, { recursive: false });
    try {
      const payloadRoot = path.join(temporaryDirectory, "files");
      fs.mkdirSync(payloadRoot);
      for (const file of captured) {
        const target = this.resolvePayloadPath(payloadRoot, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content);
      }
      fs.writeFileSync(
        path.join(temporaryDirectory, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      );
      fs.renameSync(temporaryDirectory, finalDirectory);
    } catch (error) {
      if (fs.existsSync(temporaryDirectory)) {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      }
      throw error;
    }
    return manifest;
  }

  list(): SnapshotSummary[] {
    const snapshotsRoot = this.getSnapshotsRoot(false);
    if (snapshotsRoot === undefined) return [];

    const snapshots: SnapshotSummary[] = [];
    for (const entry of fs.readdirSync(snapshotsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !SNAPSHOT_ID_PATTERN.test(entry.name)) {
        continue;
      }
      const manifest = this.readManifest(entry.name);
      snapshots.push({
        id: manifest.id,
        createdAt: manifest.createdAt,
        ...(manifest.label !== undefined ? { label: manifest.label } : {}),
        fileCount: manifest.fileCount,
        totalBytes: manifest.totalBytes,
      });
    }
    return snapshots.sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
    );
  }

  inspect(snapshotId: string): SnapshotInspection {
    const id = validateSnapshotId(snapshotId);
    return this.verifySnapshot(id).inspection;
  }

  restore(snapshotId: string): SnapshotRestoreResult {
    const id = validateSnapshotId(snapshotId);
    this.sandbox.assertWritable();

    const verified = this.verifySnapshot(id);
    const { inspection } = verified;
    if (!inspection.ok) {
      throw new Error(
        `Snapshot ${id} failed integrity verification: ${inspection.issues.join("; ")}`,
      );
    }

    let rollbackBytes = 0;
    const plan: RestorePlanEntry[] = inspection.manifest.files.map((entry) => {
      const payload = verified.payloads.get(entry.path);
      if (payload === undefined) {
        throw new Error(`Verified snapshot payload is unavailable: ${entry.path}`);
      }
      const content = decodeText(payload, `Snapshot payload ${entry.path}`);
      const target = this.sandbox.resolve(entry.path, { mustExist: false });

      if (!fs.existsSync(target)) return { entry, content };
      const targetStat = fs.lstatSync(target);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
        throw new Error(`Refusing to restore over a non-regular file: ${entry.path}`);
      }
      if (targetStat.size > this.maxFileBytes) {
        throw new Error(`Cannot safely back up ${entry.path}: file exceeds the per-file limit`);
      }
      const current = fs.readFileSync(target);
      if (current.length > this.maxFileBytes) {
        throw new Error(`Cannot safely back up ${entry.path}: file exceeds the per-file limit`);
      }
      rollbackBytes += current.length;
      if (rollbackBytes > this.maxSnapshotBytes) {
        throw new Error(`Restore rollback data exceeds ${this.maxSnapshotBytes} byte limit`);
      }
      return {
        entry,
        content,
        previous: {
          sha256: sha256(current),
          content: decodeText(current, `Current project file ${entry.path}`),
        },
      };
    });

    // Resource files are restored before the YYP, so project references are committed last.
    plan.sort((left, right) => {
      const leftProject = left.entry.path.toLowerCase().endsWith(".yyp") ? 1 : 0;
      const rightProject = right.entry.path.toLowerCase().endsWith(".yyp") ? 1 : 0;
      return leftProject - rightProject || left.entry.path.localeCompare(right.entry.path);
    });

    const files: SnapshotRestoreFile[] = [];
    const applied: AppliedRestoreEntry[] = [];
    try {
      for (const item of plan) {
        if (item.previous?.sha256 === item.entry.sha256) {
          files.push({ path: item.entry.path, action: "unchanged", sha256: item.entry.sha256 });
          continue;
        }

        const write = this.sandbox.atomicWrite(item.entry.path, item.content, {
          ...(item.previous !== undefined
            ? { expectedSha256: item.previous.sha256, backup: true }
            : {}),
        });
        applied.push({ plan: item, appliedSha256: write.sha256 });
        files.push({
          path: item.entry.path,
          action: item.previous === undefined ? "created" : "overwritten",
          sha256: write.sha256,
          ...(write.previousSha256 !== undefined
            ? { previousSha256: write.previousSha256 }
            : {}),
          ...(write.backupPath !== undefined ? { backupPath: write.backupPath } : {}),
        });
      }
    } catch (error) {
      const failure = error instanceof Error ? error.message : String(error);
      const rollback = this.rollbackAppliedChanges(applied);
      if (rollback.failures.length > 0) {
        throw new Error(
          `Snapshot restore failed: ${failure}. Rollback failed: ${rollback.failures.join("; ")}`,
        );
      }
      throw new Error(
        `Snapshot restore failed: ${failure}. Rollback completed for ${rollback.rolledBack} change(s).`,
      );
    }

    const created = files.filter((file) => file.action === "created").length;
    const overwritten = files.filter((file) => file.action === "overwritten").length;
    const unchanged = files.filter((file) => file.action === "unchanged").length;
    return {
      snapshotId: id,
      restored: created + overwritten,
      created,
      overwritten,
      unchanged,
      files,
    };
  }

  private captureProjectFiles(): CapturedFile[] {
    const captured: CapturedFile[] = [];
    let totalBytes = 0;
    const stack = [this.projectRoot];

    while (stack.length > 0) {
      const directory = stack.pop()!;
      const directoryStat = fs.lstatSync(directory);
      if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
        throw new Error(`Project directory changed during snapshot capture: ${directory}`);
      }
      assertInside(this.projectRoot, fs.realpathSync(directory), "Captured project directory");
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name.toLowerCase())) stack.push(absolute);
          continue;
        }
        if (!entry.isFile()) continue;

        const extension = path.extname(entry.name).toLowerCase();
        if (!SNAPSHOT_TEXT_EXTENSION_SET.has(extension)) continue;
        const fileStat = fs.lstatSync(absolute);
        if (fileStat.isSymbolicLink() || !fileStat.isFile()) continue;
        assertInside(this.projectRoot, fs.realpathSync(absolute), "Captured project file");
        const relative = normalizeProjectRelativePath(this.sandbox.relative(absolute));
        if (fileStat.size > this.maxFileBytes) {
          throw new Error(
            `Cannot snapshot ${relative}: file exceeds ${this.maxFileBytes} byte limit`,
          );
        }
        const content = fs.readFileSync(absolute);
        if (content.length > this.maxFileBytes) {
          throw new Error(
            `Cannot snapshot ${relative}: file exceeds ${this.maxFileBytes} byte limit`,
          );
        }
        totalBytes += content.length;
        if (totalBytes > this.maxSnapshotBytes) {
          throw new Error(
            `Snapshot payload exceeds ${this.maxSnapshotBytes} total byte limit at ${relative}`,
          );
        }
        decodeText(content, relative);
        captured.push({
          path: relative,
          size: content.length,
          sha256: sha256(content),
          content,
        });
      }
    }

    captured.sort((left, right) => left.path.localeCompare(right.path));
    const seen = new Set<string>();
    for (const file of captured) {
      const key = file.path.toLowerCase();
      if (seen.has(key)) throw new Error(`Case-insensitive duplicate project path: ${file.path}`);
      seen.add(key);
    }
    return captured;
  }

  private getSnapshotsRoot(create: boolean): string | undefined {
    const metadataRoot = path.join(this.projectRoot, ".gamemaker-mcp");
    const snapshotsRoot = path.join(metadataRoot, "snapshots");
    assertInside(this.projectRoot, metadataRoot, "Snapshot metadata directory");
    assertInside(this.projectRoot, snapshotsRoot, "Snapshots directory");

    if (!fs.existsSync(metadataRoot)) {
      if (!create) return undefined;
      fs.mkdirSync(metadataRoot);
    }
    const realMetadataRoot = this.assertRealDirectory(metadataRoot, "Snapshot metadata directory", this.projectRoot);

    if (!fs.existsSync(snapshotsRoot)) {
      if (!create) return undefined;
      fs.mkdirSync(snapshotsRoot);
    }
    return this.assertRealDirectory(snapshotsRoot, "Snapshots directory", realMetadataRoot);
  }

  private getSnapshotDirectory(snapshotId: string): string {
    const id = validateSnapshotId(snapshotId);
    const snapshotsRoot = this.getSnapshotsRoot(false);
    if (snapshotsRoot === undefined) throw new Error(`Snapshot does not exist: ${id}`);
    const snapshotDirectory = path.join(snapshotsRoot, id);
    assertInside(snapshotsRoot, snapshotDirectory, "Snapshot directory");
    if (!fs.existsSync(snapshotDirectory)) throw new Error(`Snapshot does not exist: ${id}`);
    return this.assertRealDirectory(snapshotDirectory, "Snapshot directory", snapshotsRoot);
  }

  private readManifest(snapshotId: string): SnapshotManifest {
    const id = validateSnapshotId(snapshotId);
    const snapshotDirectory = this.getSnapshotDirectory(id);
    const manifestPath = path.join(snapshotDirectory, "manifest.json");
    if (!fs.existsSync(manifestPath)) throw new Error(`Snapshot manifest is missing: ${id}`);
    const manifestStat = fs.lstatSync(manifestPath);
    if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
      throw new Error(`Snapshot manifest is not a regular file: ${id}`);
    }
    const realManifestPath = fs.realpathSync(manifestPath);
    assertInside(snapshotDirectory, realManifestPath, "Snapshot manifest");
    if (manifestStat.size > MAX_MANIFEST_BYTES) {
      throw new Error(`Snapshot manifest exceeds ${MAX_MANIFEST_BYTES} byte limit: ${id}`);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(realManifestPath, "utf8"));
    } catch (error) {
      throw new Error(
        `Snapshot manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!isRecord(raw)) throw new Error("Snapshot manifest must be a JSON object");
    if (raw.version !== SNAPSHOT_FORMAT_VERSION) {
      throw new Error(`Unsupported snapshot manifest version: ${String(raw.version)}`);
    }
    if (raw.id !== id) throw new Error(`Snapshot manifest id does not match directory: ${id}`);
    if (typeof raw.createdAt !== "string" || !Number.isFinite(Date.parse(raw.createdAt))) {
      throw new Error("Snapshot manifest createdAt is invalid");
    }
    if (raw.label !== undefined && typeof raw.label !== "string") {
      throw new Error("Snapshot manifest label must be a string");
    }
    if (raw.projectFile !== undefined && typeof raw.projectFile !== "string") {
      throw new Error("Snapshot manifest projectFile must be a string");
    }
    if (typeof raw.projectFile !== "string") {
      throw new Error("Snapshot manifest projectFile is required");
    }
    if (!Array.isArray(raw.files)) throw new Error("Snapshot manifest files must be an array");
    if (raw.files.length > MAX_SNAPSHOT_FILES) {
      throw new Error(`Snapshot manifest exceeds ${MAX_SNAPSHOT_FILES} file limit`);
    }
    const fileCount = asNonNegativeInteger(raw.fileCount, "Snapshot manifest fileCount");
    const totalBytes = asNonNegativeInteger(raw.totalBytes, "Snapshot manifest totalBytes");
    if (totalBytes > this.maxSnapshotBytes) {
      throw new Error(`Snapshot manifest exceeds ${this.maxSnapshotBytes} total byte limit`);
    }

    const files: SnapshotFileEntry[] = [];
    const seen = new Set<string>();
    for (const [index, value] of raw.files.entries()) {
      if (!isRecord(value)) throw new Error(`Snapshot file entry ${index} must be an object`);
      if (typeof value.path !== "string") {
        throw new Error(`Snapshot file entry ${index} path must be a string`);
      }
      const relativePath = normalizeProjectRelativePath(value.path);
      const key = relativePath.toLowerCase();
      if (seen.has(key)) throw new Error(`Duplicate snapshot file path: ${relativePath}`);
      seen.add(key);
      const size = asNonNegativeInteger(value.size, `Snapshot file ${relativePath} size`);
      if (size > this.maxFileBytes) {
        throw new Error(`Snapshot file ${relativePath} exceeds ${this.maxFileBytes} byte limit`);
      }
      if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
        throw new Error(`Snapshot file ${relativePath} has an invalid SHA-256`);
      }
      files.push({ path: relativePath, size, sha256: value.sha256 });
    }

    const calculatedTotalBytes = files.reduce((total, file) => total + file.size, 0);
    if (!Number.isSafeInteger(calculatedTotalBytes)) {
      throw new Error("Snapshot manifest total file size exceeds the safe integer limit");
    }
    if (fileCount !== files.length) throw new Error("Snapshot manifest fileCount does not match files");
    if (totalBytes !== calculatedTotalBytes) {
      throw new Error("Snapshot manifest totalBytes does not match files");
    }

    let projectFile: string | undefined;
    if (typeof raw.projectFile === "string") {
      projectFile = normalizeProjectRelativePath(raw.projectFile);
      if (!projectFile.toLowerCase().endsWith(".yyp")) {
        throw new Error("Snapshot manifest projectFile must use the .yyp extension");
      }
    }
    if (projectFile !== this.projectFile) {
      throw new Error(`Snapshot belongs to ${projectFile ?? "<unknown>"}, expected ${this.projectFile}`);
    }

    return {
      version: SNAPSHOT_FORMAT_VERSION,
      id,
      createdAt: raw.createdAt,
      ...(typeof raw.label === "string" ? { label: raw.label } : {}),
      projectFile,
      fileCount,
      totalBytes,
      files,
    };
  }

  private readPayloadFile(payloadRoot: string, entry: SnapshotFileEntry): Buffer {
    const segments = entry.path.split("/");
    let directory = payloadRoot;
    for (const segment of segments.slice(0, -1)) {
      const next = path.join(directory, segment);
      if (!fs.existsSync(next)) throw new Error(`Payload directory is missing: ${entry.path}`);
      directory = this.assertRealDirectory(next, "Snapshot payload directory", payloadRoot);
    }
    const target = path.join(directory, segments.at(-1)!);
    assertInside(payloadRoot, target, "Snapshot payload file");
    if (!fs.existsSync(target)) throw new Error("Payload file is missing");
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Payload is not a regular file");
    const realTarget = fs.realpathSync(target);
    assertInside(payloadRoot, realTarget, "Snapshot payload");
    if (stat.size > this.maxFileBytes || stat.size !== entry.size) {
      throw new Error(
        `Payload size mismatch or limit exceeded (manifest ${entry.size}, payload ${stat.size})`,
      );
    }
    const content = fs.readFileSync(realTarget);
    if (content.length > this.maxFileBytes || content.length !== entry.size) {
      throw new Error(
        `Payload changed while reading (manifest ${entry.size}, payload ${content.length})`,
      );
    }
    return content;
  }

  private verifySnapshot(snapshotId: string): VerifiedSnapshot {
    const manifest = this.readManifest(snapshotId);
    const snapshotDirectory = this.getSnapshotDirectory(snapshotId);
    const payloadRoot = this.assertRealDirectory(
      path.join(snapshotDirectory, "files"),
      "Snapshot payload root",
      snapshotDirectory,
    );
    const issues: string[] = [];
    const payloads = new Map<string, Buffer>();
    let verifiedBytes = 0;

    for (const entry of manifest.files) {
      try {
        const content = this.readPayloadFile(payloadRoot, entry);
        verifiedBytes += content.length;
        if (verifiedBytes > this.maxSnapshotBytes) {
          throw new Error(`Verified payload exceeds ${this.maxSnapshotBytes} total byte limit`);
        }
        const actualSha256 = sha256(content);
        if (actualSha256 !== entry.sha256) {
          issues.push(
            `${entry.path}: SHA-256 mismatch (manifest ${entry.sha256}, payload ${actualSha256})`,
          );
          continue;
        }
        decodeText(content, `Snapshot payload ${entry.path}`);
        payloads.set(entry.path, content);
      } catch (error) {
        issues.push(`${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      inspection: {
        manifest,
        ok: issues.length === 0,
        verifiedFiles: payloads.size,
        issues,
      },
      payloads,
    };
  }

  private rollbackAppliedChanges(applied: AppliedRestoreEntry[]): {
    rolledBack: number;
    failures: string[];
  } {
    let rolledBack = 0;
    const failures: string[] = [];
    for (const change of [...applied].reverse()) {
      const { plan, appliedSha256 } = change;
      try {
        const target = this.sandbox.resolve(plan.entry.path, { mustExist: false });
        if (!fs.existsSync(target)) {
          if (plan.previous === undefined) {
            rolledBack += 1;
            continue;
          }
          throw new Error("file disappeared after restore");
        }
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink() || !stat.isFile()) {
          throw new Error("restored path is no longer a regular file");
        }
        const currentSha256 = sha256(fs.readFileSync(target));
        if (currentSha256 !== appliedSha256) {
          throw new Error(
            `safe hash check failed (expected ${appliedSha256}, current ${currentSha256})`,
          );
        }

        if (plan.previous === undefined) {
          fs.unlinkSync(target);
        } else {
          this.sandbox.atomicWrite(plan.entry.path, plan.previous.content, {
            expectedSha256: appliedSha256,
            backup: false,
          });
        }
        rolledBack += 1;
      } catch (error) {
        failures.push(
          `${plan.entry.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { rolledBack, failures };
  }

  private resolvePayloadPath(payloadRoot: string, relativePath: string): string {
    const safePath = normalizeProjectRelativePath(relativePath);
    const target = path.resolve(payloadRoot, ...safePath.split("/"));
    assertInside(payloadRoot, target, "Snapshot payload path");
    return target;
  }

  private assertRealDirectory(directory: string, label: string, anchor: string): string {
    if (!fs.existsSync(directory)) throw new Error(`${label} is missing: ${directory}`);
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`${label} must be a real directory: ${directory}`);
    }
    const realDirectory = fs.realpathSync(directory);
    assertInside(anchor, realDirectory, label);
    return realDirectory;
  }

  private findOnlyProjectFile(): string {
    const candidates = fs
      .readdirSync(this.projectRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith(".yyp"),
      )
      .map((entry) => path.join(this.projectRoot, entry.name));
    if (candidates.length !== 1) {
      throw new Error(
        `Expected exactly one .yyp in ${this.projectRoot}; found ${candidates.length}`,
      );
    }
    return candidates[0]!;
  }
}

// Alias retained for callers that prefer a manager-style name.
export class SnapshotManager extends SnapshotService {}

export function createSnapshot(
  serviceOptions: SnapshotServiceOptions | ServerConfig,
  createOptions: SnapshotCreateOptions = {},
): SnapshotManifest {
  return new SnapshotService(serviceOptions).create(createOptions);
}

export function listSnapshots(
  serviceOptions: SnapshotServiceOptions | ServerConfig,
): SnapshotSummary[] {
  return new SnapshotService(serviceOptions).list();
}

export function inspectSnapshot(
  serviceOptions: SnapshotServiceOptions | ServerConfig,
  snapshotId: string,
): SnapshotInspection {
  return new SnapshotService(serviceOptions).inspect(snapshotId);
}

export function restoreSnapshot(
  serviceOptions: SnapshotServiceOptions | ServerConfig,
  snapshotId: string,
): SnapshotRestoreResult {
  return new SnapshotService(serviceOptions).restore(snapshotId);
}
