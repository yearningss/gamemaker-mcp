import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AccessMode } from "./types.js";

const SAFE_TEXT_EXTENSIONS = new Set([
  ".gml",
  ".yy",
  ".yyp",
  ".vsh",
  ".fsh",
  ".json",
  ".md",
  ".txt",
  ".csv",
  ".ini",
]);

export class ProjectSandbox {
  readonly root: string;
  readonly mode: AccessMode;
  readonly maxFileBytes: number;

  constructor(root: string, mode: AccessMode, maxFileBytes: number) {
    this.root = fs.realpathSync(root);
    this.mode = mode;
    this.maxFileBytes = maxFileBytes;
  }

  resolve(relativePath: string, options: { mustExist?: boolean; extension?: string[] } = {}): string {
    if (!relativePath || relativePath.includes("\0")) {
      throw new Error("Path is empty or contains a NUL byte");
    }
    if (path.isAbsolute(relativePath)) {
      throw new Error("Only project-relative paths are accepted");
    }

    const target = path.resolve(this.root, relativePath);
    this.assertLexicallyInside(target);

    const mustExist = options.mustExist ?? true;
    if (fs.existsSync(target)) {
      const real = fs.realpathSync(target);
      this.assertLexicallyInside(real);
      if (mustExist && !fs.statSync(real).isFile()) {
        throw new Error(`Expected a file: ${relativePath}`);
      }
    } else {
      if (mustExist) throw new Error(`File does not exist: ${relativePath}`);
      const parent = this.nearestExistingParent(path.dirname(target));
      this.assertLexicallyInside(fs.realpathSync(parent));
    }

    if (options.extension?.length) {
      const ext = path.extname(target).toLowerCase();
      const allowed = options.extension.map((item) => item.toLowerCase());
      if (!allowed.includes(ext)) {
        throw new Error(`Extension ${ext || "<none>"} is not allowed; expected ${allowed.join(", ")}`);
      }
    }
    return target;
  }

  relative(absolutePath: string): string {
    this.assertLexicallyInside(path.resolve(absolutePath));
    return path.relative(this.root, absolutePath).replaceAll("\\", "/");
  }

  readText(relativePath: string, extensions?: string[]): string {
    const target = this.resolve(relativePath, {
      mustExist: true,
      ...(extensions ? { extension: extensions } : {}),
    });
    const stat = fs.statSync(target);
    if (stat.size > this.maxFileBytes) {
      throw new Error(`File exceeds ${this.maxFileBytes} byte limit: ${relativePath}`);
    }
    return fs.readFileSync(target, "utf8");
  }

  assertWritable(): void {
    if (this.mode !== "workspace-write") {
      throw new Error(
        "Server is read-only. Set GAMEMAKER_MCP_MODE=workspace-write to enable project edits.",
      );
    }
  }

  assertSafeTextExtension(relativePath: string): void {
    const base = path.basename(relativePath).toLowerCase();
    if (base === ".featherconfig") return;
    const ext = path.extname(relativePath).toLowerCase();
    if (!SAFE_TEXT_EXTENSIONS.has(ext)) {
      throw new Error(`Writing ${ext || "extensionless"} files is not allowed`);
    }
  }

  atomicWrite(
    relativePath: string,
    content: string,
    options: { expectedSha256?: string; force?: boolean; backup?: boolean } = {},
  ): { path: string; sha256: string; previousSha256?: string; backupPath?: string } {
    this.assertWritable();
    this.assertSafeTextExtension(relativePath);
    if (Buffer.byteLength(content, "utf8") > this.maxFileBytes) {
      throw new Error(`Content exceeds ${this.maxFileBytes} byte limit`);
    }

    const target = this.resolve(relativePath, { mustExist: false });
    const exists = fs.existsSync(target);
    let previousSha256: string | undefined;
    let backupPath: string | undefined;

    if (exists) {
      const previous = fs.readFileSync(target);
      previousSha256 = sha256(previous);
      if (!options.force && !options.expectedSha256) {
        throw new Error(
          "Refusing to overwrite an existing file without expectedSha256. Read it first, then retry.",
        );
      }
      if (options.expectedSha256 && options.expectedSha256.toLowerCase() !== previousSha256) {
        throw new Error(
          `File changed since it was read: expected ${options.expectedSha256}, current ${previousSha256}`,
        );
      }

      if (options.backup ?? true) {
        const backupRoot = path.join(this.root, ".gamemaker-mcp", "backups");
        fs.mkdirSync(backupRoot, { recursive: true });
        const stamp = new Date().toISOString().replaceAll(":", "-");
        const flatName = this.relative(target).replaceAll(/[\\/]/g, "__");
        const backupTarget = path.join(backupRoot, `${stamp}__${flatName}`);
        fs.writeFileSync(backupTarget, previous);
        backupPath = this.relative(backupTarget);
      }
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.gm-mcp-${process.pid}-${Date.now()}.tmp`;
    fs.writeFileSync(temporary, content, "utf8");
    fs.renameSync(temporary, target);
    const resultSha = sha256(Buffer.from(content, "utf8"));

    return {
      path: this.relative(target),
      sha256: resultSha,
      ...(previousSha256 ? { previousSha256 } : {}),
      ...(backupPath ? { backupPath } : {}),
    };
  }

  sha256For(relativePath: string): string {
    const target = this.resolve(relativePath, { mustExist: true });
    return sha256(fs.readFileSync(target));
  }

  private assertLexicallyInside(target: string): void {
    const relative = path.relative(this.root, target);
    if (relative === "") return;
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Path escapes GameMaker project root: ${target}`);
    }
  }

  private nearestExistingParent(input: string): string {
    let current = input;
    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) throw new Error(`No existing parent for ${input}`);
      current = parent;
    }
    return current;
  }
}

export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
