export type AccessMode = "read-only" | "workspace-write";

export interface ServerConfig {
  projectRoot: string;
  projectFile: string;
  mode: AccessMode;
  allowBuild: boolean;
  maxFileBytes: number;
  igorPath?: string | undefined;
  runtimePath?: string | undefined;
  userDir?: string | undefined;
}

export interface ProjectResourceRef {
  name: string;
  path: string;
  kind: string;
  parent?: { name?: string; path?: string } | null;
}

export interface ProjectSummary {
  name: string;
  projectFile: string;
  projectRoot: string;
  ideVersion?: string;
  resourceVersion?: string;
  resourceCount: number;
  counts: Record<string, number>;
  roomOrder: string[];
  mode: AccessMode;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  file: string;
  message: string;
}

export interface BuildResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  outputFile: string;
  stdout: string;
  stderr: string;
  diagnostics: string[];
  command: string;
  args: string[];
}
