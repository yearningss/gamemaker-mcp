import path from "node:path";

import { requireGmJson } from "./gm-json.js";
import type { GameMakerProject } from "./project.js";
import type { ProjectResourceRef } from "./types.js";

export type AnalysisSeverity = "error" | "warning" | "info";

export interface AnalysisDiagnostic {
  severity: AnalysisSeverity;
  code: string;
  file: string;
  line: number;
  column: number;
  message: string;
}

export interface GmlFunctionInfo {
  name: string;
  line: number;
  parameters: string[];
}

export interface GmlSymbolCount {
  name: string;
  count: number;
  lines: number[];
}

export interface GmlFileAnalysis {
  file: string;
  lines: number;
  codeLines: number;
  functions: GmlFunctionInfo[];
  macros: Array<{ name: string; line: number }>;
  enums: Array<{ name: string; line: number }>;
  localVariables: GmlSymbolCount[];
  globalVariables: GmlSymbolCount[];
  calls: GmlSymbolCount[];
  complexity: { cyclomatic: number; maximumBlockDepth: number };
  diagnostics: AnalysisDiagnostic[];
}

export interface GmlProjectAnalysis {
  filesScanned: number;
  truncated: boolean;
  lines: number;
  codeLines: number;
  functions: number;
  cyclomaticComplexity: number;
  diagnostics: { errors: number; warnings: number; info: number; items: AnalysisDiagnostic[] };
  files: GmlFileAnalysis[];
}

export interface ShaderDeclaration {
  qualifier: "uniform" | "attribute" | "varying" | "in" | "out";
  type: string;
  name: string;
  line: number;
}

export interface ShaderStageInspection {
  file: string;
  stage: "vertex" | "fragment";
  lines: number;
  codeLines: number;
  hasMain: boolean;
  declarations: ShaderDeclaration[];
  textureSamples: number;
}

export interface ShaderInspection {
  shader: string;
  ok: boolean;
  vertex?: ShaderStageInspection;
  fragment?: ShaderStageInspection;
  diagnostics: AnalysisDiagnostic[];
}

export interface ShaderProjectInspection {
  shadersScanned: number;
  errors: number;
  warnings: number;
  inspections: ShaderInspection[];
}

export type ReferenceKind = "declaration" | "call" | "write" | "read" | "metadata";

export interface SymbolReference {
  symbol: string;
  file: string;
  line: number;
  column: number;
  kind: ReferenceKind;
  text: string;
  owner?: { name: string; kind: string };
}

export interface ReferenceSearchResult {
  symbol: string;
  total: number;
  truncated: boolean;
  references: SymbolReference[];
}

export type DependencyKind =
  | "call"
  | "object-use"
  | "shader-use"
  | "sprite-use"
  | "metadata"
  | "reference";

export interface DependencyNode {
  name: string;
  kind: string;
  path: string;
  incoming: number;
  outgoing: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  kind: DependencyKind;
  occurrences: number;
  evidence: Array<{ file: string; line: number; text: string }>;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  isolated: string[];
  cycles: string[][];
}

export interface ProjectStatistics {
  resources: { total: number; byKind: Record<string, number> };
  files: {
    total: number;
    sourceFiles: number;
    bytes: number;
    lines: number;
    byExtension: Record<string, number>;
    largest: Array<{ path: string; bytes: number; lines: number }>;
  };
  gml: {
    files: number;
    lines: number;
    codeLines: number;
    functions: number;
    cyclomaticComplexity: number;
    calls: number;
  };
  shaders: { resources: number; stages: number; errors: number; warnings: number };
  dependencies: { nodes: number; edges: number; isolated: number; cycles: number };
}

interface ProjectTextFile {
  path: string;
  content: string;
  owner?: ProjectResourceRef;
}

const IDENTIFIER = "[A-Za-z_][A-Za-z0-9_]*";
const CALL_KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "repeat",
  "switch",
  "with",
  "catch",
  "function",
  "return",
  "new",
  "typeof",
  "defined",
]);

const LIFECYCLE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["ds_list_create", "ds_list_destroy"],
  ["ds_map_create", "ds_map_destroy"],
  ["ds_grid_create", "ds_grid_destroy"],
  ["ds_queue_create", "ds_queue_destroy"],
  ["ds_stack_create", "ds_stack_destroy"],
  ["ds_priority_create", "ds_priority_destroy"],
  ["surface_create", "surface_free"],
  ["buffer_create", "buffer_delete"],
  ["vertex_create_buffer", "vertex_delete_buffer"],
  ["audio_create_stream", "audio_destroy_stream"],
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function maskCode(source: string, maskStrings: boolean): string {
  const output = source.split("");
  let state: "code" | "line-comment" | "block-comment" | "single" | "double" = "code";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        output[index] = " ";
        output[index + 1] = " ";
        state = "line-comment";
        index += 1;
      } else if (char === "/" && next === "*") {
        output[index] = " ";
        output[index + 1] = " ";
        state = "block-comment";
        index += 1;
      } else if (char === "\"") {
        if (maskStrings) output[index] = " ";
        state = "double";
      } else if (char === "'") {
        if (maskStrings) output[index] = " ";
        state = "single";
      }
      continue;
    }

    if (state === "line-comment") {
      if (char === "\n") state = "code";
      else output[index] = " ";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output[index] = " ";
        output[index + 1] = " ";
        state = "code";
        index += 1;
      } else if (char !== "\r" && char !== "\n") {
        output[index] = " ";
      }
      continue;
    }

    if (maskStrings) output[index] = char === "\r" || char === "\n" ? char : " ";
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if ((state === "double" && char === "\"") || (state === "single" && char === "'")) {
      state = "code";
    }
  }
  return output.join("");
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function locate(starts: number[], offset: number): { line: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle]! <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const start = starts[Math.max(0, high)]!;
  return { line: Math.max(0, high) + 1, column: offset - start + 1 };
}

function addCount(map: Map<string, GmlSymbolCount>, name: string, line: number): void {
  const existing = map.get(name);
  if (existing) {
    existing.count += 1;
    if (existing.lines.at(-1) !== line) existing.lines.push(line);
  } else {
    map.set(name, { name, count: 1, lines: [line] });
  }
}

function countMatches(source: string, expression: RegExp): number {
  let count = 0;
  for (const _match of source.matchAll(expression)) count += 1;
  return count;
}

function checkDelimiters(masked: string, file: string, starts: number[]): AnalysisDiagnostic[] {
  const diagnostics: AnalysisDiagnostic[] = [];
  const stack: Array<{ char: string; offset: number }> = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index]!;
    if (char === "(" || char === "[" || char === "{") stack.push({ char, offset: index });
    else if (char in pairs) {
      const opening = stack.pop();
      if (!opening || opening.char !== pairs[char]) {
        diagnostics.push({
          severity: "error",
          code: "unexpected-delimiter",
          file,
          ...locate(starts, index),
          message: `Unexpected closing delimiter ${char}`,
        });
      }
    }
  }
  for (const opening of stack) {
    diagnostics.push({
      severity: "error",
      code: "unclosed-delimiter",
      file,
      ...locate(starts, opening.offset),
      message: `Unclosed delimiter ${opening.char}`,
    });
  }
  return diagnostics;
}

function maximumBlockDepth(masked: string): number {
  let depth = 0;
  let maximum = 0;
  for (const char of masked) {
    if (char === "{") maximum = Math.max(maximum, ++depth);
    else if (char === "}") depth = Math.max(0, depth - 1);
  }
  return maximum;
}

export function analyzeGmlSource(source: string, file = "<memory>.gml"): GmlFileAnalysis {
  const masked = maskCode(source, true);
  const starts = lineStarts(source);
  const diagnostics = checkDelimiters(masked, file, starts);
  const functions: GmlFunctionInfo[] = [];
  const macros: Array<{ name: string; line: number }> = [];
  const enums: Array<{ name: string; line: number }> = [];
  const locals = new Map<string, GmlSymbolCount>();
  const globals = new Map<string, GmlSymbolCount>();
  const calls = new Map<string, GmlSymbolCount>();

  const functionExpression = new RegExp(`\\bfunction\\s+(${IDENTIFIER})\\s*\\(([^)]*)\\)`, "g");
  for (const match of masked.matchAll(functionExpression)) {
    const name = match[1]!;
    const parameters = (match[2] ?? "")
      .split(",")
      .map((parameter) => parameter.trim().match(new RegExp(`^(${IDENTIFIER})`))?.[1])
      .filter((parameter): parameter is string => Boolean(parameter));
    functions.push({ name, line: locate(starts, match.index).line, parameters });
  }
  const assignedFunctionExpression = new RegExp(`\\b(${IDENTIFIER})\\s*=\\s*function(?:\\s+${IDENTIFIER})?\\s*\\(([^)]*)\\)`, "g");
  for (const match of masked.matchAll(assignedFunctionExpression)) {
    const name = match[1]!;
    const line = locate(starts, match.index).line;
    if (functions.some((item) => item.name === name && item.line === line)) continue;
    const parameters = (match[2] ?? "")
      .split(",")
      .map((parameter) => parameter.trim().match(new RegExp(`^(${IDENTIFIER})`))?.[1])
      .filter((parameter): parameter is string => Boolean(parameter));
    functions.push({ name, line, parameters });
  }

  const macroExpression = new RegExp(`^[ \\t]*#macro(?:[ \\t]+${IDENTIFIER}:)?[ \\t]+(${IDENTIFIER})`, "gm");
  for (const match of masked.matchAll(macroExpression)) {
    macros.push({ name: match[1]!, line: locate(starts, match.index).line });
  }
  const enumExpression = new RegExp(`\\benum\\s+(${IDENTIFIER})`, "g");
  for (const match of masked.matchAll(enumExpression)) {
    enums.push({ name: match[1]!, line: locate(starts, match.index).line });
  }

  const localExpression = new RegExp(`\\b(var|globalvar)\\s+(${IDENTIFIER})`, "g");
  for (const match of masked.matchAll(localExpression)) {
    const line = locate(starts, match.index).line;
    addCount(locals, match[2]!, line);
    if (match[1] === "globalvar") {
      diagnostics.push({
        severity: "warning",
        code: "legacy-globalvar",
        file,
        ...locate(starts, match.index),
        message: "globalvar is legacy syntax; prefer global.<name>",
      });
    }
  }
  const globalExpression = new RegExp(`\\bglobal\\.(${IDENTIFIER})`, "g");
  for (const match of masked.matchAll(globalExpression)) {
    addCount(globals, match[1]!, locate(starts, match.index).line);
  }

  const callExpression = new RegExp(`\\b(${IDENTIFIER})\\s*\\(`, "g");
  for (const match of masked.matchAll(callExpression)) {
    const name = match[1]!;
    if (CALL_KEYWORDS.has(name)) continue;
    const prefix = masked.slice(Math.max(0, match.index - 24), match.index);
    if (/function\s+$/.test(prefix)) continue;
    addCount(calls, name, locate(starts, match.index).line);
  }

  const duplicateFunctions = new Map<string, number[]>();
  for (const fn of functions) {
    const lines = duplicateFunctions.get(fn.name) ?? [];
    lines.push(fn.line);
    duplicateFunctions.set(fn.name, lines);
  }
  for (const [name, lines] of duplicateFunctions) {
    if (lines.length < 2) continue;
    diagnostics.push({
      severity: "warning",
      code: "duplicate-function",
      file,
      line: lines[1]!,
      column: 1,
      message: `Function ${name} is declared ${lines.length} times in this file`,
    });
  }

  for (const match of masked.matchAll(/\bexecute_string\s*\(/g)) {
    diagnostics.push({
      severity: "warning",
      code: "dynamic-code",
      file,
      ...locate(starts, match.index),
      message: "execute_string is difficult to validate and can hide runtime errors",
    });
  }
  for (const match of masked.matchAll(/(?:\/|div|mod|%)\s*0(?:\.0+)?\b/g)) {
    diagnostics.push({
      severity: "error",
      code: "literal-zero-divisor",
      file,
      ...locate(starts, match.index),
      message: "Literal zero used as a divisor",
    });
  }
  for (const match of masked.matchAll(/\bwhile\s*\(\s*(?:true|1)\s*\)/g)) {
    diagnostics.push({
      severity: "info",
      code: "unbounded-loop",
      file,
      ...locate(starts, match.index),
      message: "Unbounded loop detected; ensure every path yields or exits",
    });
  }
  const sourceLines = source.split(/\r?\n/);
  for (let index = 0; index < sourceLines.length; index += 1) {
    const todo = sourceLines[index]!.match(/\b(TODO|FIXME|HACK)\b/i);
    if (!todo) continue;
    diagnostics.push({
      severity: "info",
      code: "work-marker",
      file,
      line: index + 1,
      column: (todo.index ?? 0) + 1,
      message: `${todo[1]!.toUpperCase()} marker`,
    });
  }

  const branches =
    countMatches(masked, /\b(?:if|for|while|repeat|catch)\b/g) +
    countMatches(masked, /\bcase\b/g) +
    countMatches(masked, /&&|\|\||\?\?/g);
  const codeLines = masked.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  return {
    file,
    lines: sourceLines.length,
    codeLines,
    functions: functions.sort((left, right) => left.line - right.line),
    macros,
    enums,
    localVariables: [...locals.values()].sort((left, right) => left.name.localeCompare(right.name)),
    globalVariables: [...globals.values()].sort((left, right) => left.name.localeCompare(right.name)),
    calls: [...calls.values()].sort((left, right) => left.name.localeCompare(right.name)),
    complexity: { cyclomatic: 1 + branches, maximumBlockDepth: maximumBlockDepth(masked) },
    diagnostics: diagnostics.sort((left, right) => left.line - right.line || left.column - right.column),
  };
}

function inspectShaderStage(source: string, file: string, stage: "vertex" | "fragment"): {
  inspection: ShaderStageInspection;
  diagnostics: AnalysisDiagnostic[];
} {
  const masked = maskCode(source, true);
  const starts = lineStarts(source);
  const diagnostics = checkDelimiters(masked, file, starts);
  const declarations: ShaderDeclaration[] = [];
  const declarationExpression = /\b(uniform|attribute|varying|in|out)\s+(?:(?:lowp|mediump|highp)\s+)?([A-Za-z_]\w*)\s+([A-Za-z_]\w*)/g;
  for (const match of masked.matchAll(declarationExpression)) {
    declarations.push({
      qualifier: match[1] as ShaderDeclaration["qualifier"],
      type: match[2]!,
      name: match[3]!,
      line: locate(starts, match.index).line,
    });
  }
  const hasMain = /\bvoid\s+main\s*\(/.test(masked);
  if (!hasMain) {
    diagnostics.push({
      severity: "error",
      code: "missing-main",
      file,
      line: 1,
      column: 1,
      message: `${stage} shader has no void main() entry point`,
    });
  }
  if (stage === "vertex" && !/\bgl_Position\b/.test(masked)) {
    diagnostics.push({
      severity: "error",
      code: "missing-position-output",
      file,
      line: 1,
      column: 1,
      message: "Vertex shader never writes gl_Position",
    });
  }
  if (
    stage === "fragment" &&
    !/\bgl_FragColor\b/.test(masked) &&
    !declarations.some((declaration) => declaration.qualifier === "out")
  ) {
    diagnostics.push({
      severity: "error",
      code: "missing-color-output",
      file,
      line: 1,
      column: 1,
      message: "Fragment shader has no fragment color output",
    });
  }
  for (const declaration of declarations) {
    const uses = countMatches(masked, new RegExp(`\\b${escapeRegExp(declaration.name)}\\b`, "g"));
    if (uses > 1) continue;
    diagnostics.push({
      severity: "warning",
      code: "unused-shader-declaration",
      file,
      line: declaration.line,
      column: 1,
      message: `${declaration.qualifier} ${declaration.name} is declared but not used`,
    });
  }
  return {
    inspection: {
      file,
      stage,
      lines: source.split(/\r?\n/).length,
      codeLines: masked.split(/\r?\n/).filter((line) => line.trim()).length,
      hasMain,
      declarations,
      textureSamples: countMatches(masked, /\b(?:texture|texture2D|textureCube)\s*\(/g),
    },
    diagnostics,
  };
}

export function inspectShaderSources(options: {
  shader?: string;
  vertex?: string;
  fragment?: string;
  vertexPath?: string;
  fragmentPath?: string;
}): ShaderInspection {
  const shader = options.shader ?? "<memory>";
  const vertexPath = options.vertexPath ?? `${shader}.vsh`;
  const fragmentPath = options.fragmentPath ?? `${shader}.fsh`;
  const diagnostics: AnalysisDiagnostic[] = [];
  let vertex: ShaderStageInspection | undefined;
  let fragment: ShaderStageInspection | undefined;

  if (options.vertex === undefined) {
    diagnostics.push({ severity: "error", code: "missing-vertex-source", file: vertexPath, line: 1, column: 1, message: "Vertex shader source is missing" });
  } else {
    const result = inspectShaderStage(options.vertex, vertexPath, "vertex");
    vertex = result.inspection;
    diagnostics.push(...result.diagnostics);
  }
  if (options.fragment === undefined) {
    diagnostics.push({ severity: "error", code: "missing-fragment-source", file: fragmentPath, line: 1, column: 1, message: "Fragment shader source is missing" });
  } else {
    const result = inspectShaderStage(options.fragment, fragmentPath, "fragment");
    fragment = result.inspection;
    diagnostics.push(...result.diagnostics);
  }

  if (vertex && fragment) {
    const vertexOutputs = new Map(
      vertex.declarations
        .filter((item) => item.qualifier === "varying" || item.qualifier === "out")
        .map((item) => [item.name, item]),
    );
    const fragmentInputs = fragment.declarations.filter(
      (item) => item.qualifier === "varying" || item.qualifier === "in",
    );
    for (const input of fragmentInputs) {
      const output = vertexOutputs.get(input.name);
      if (!output) {
        diagnostics.push({
          severity: "error",
          code: "missing-vertex-varying",
          file: fragment.file,
          line: input.line,
          column: 1,
          message: `Fragment input ${input.name} is not produced by the vertex shader`,
        });
      } else if (output.type !== input.type) {
        diagnostics.push({
          severity: "error",
          code: "varying-type-mismatch",
          file: fragment.file,
          line: input.line,
          column: 1,
          message: `${input.name} is ${output.type} in vertex stage but ${input.type} in fragment stage`,
        });
      }
    }
    const vertexUniforms = new Map(
      vertex.declarations.filter((item) => item.qualifier === "uniform").map((item) => [item.name, item.type]),
    );
    for (const uniform of fragment.declarations.filter((item) => item.qualifier === "uniform")) {
      const vertexType = vertexUniforms.get(uniform.name);
      if (vertexType && vertexType !== uniform.type) {
        diagnostics.push({
          severity: "error",
          code: "uniform-type-mismatch",
          file: fragment.file,
          line: uniform.line,
          column: 1,
          message: `Uniform ${uniform.name} has incompatible stage types ${vertexType} and ${uniform.type}`,
        });
      }
    }
  }
  return { shader, ok: !diagnostics.some((item) => item.severity === "error"), ...(vertex ? { vertex } : {}), ...(fragment ? { fragment } : {}), diagnostics };
}

function referenceKind(file: string, line: string, offset: number, symbol: string): ReferenceKind {
  if ([".yy", ".yyp", ".json"].includes(path.posix.extname(file).toLowerCase())) return "metadata";
  const prefix = line.slice(0, offset);
  const suffix = line.slice(offset + symbol.length);
  if (new RegExp(`(?:\\bfunction|#macro|\\benum|\\bvar|\\bglobalvar|\\buniform|\\battribute|\\bvarying|\\bin|\\bout)\\s+$`).test(prefix)) return "declaration";
  if (/^\s*\(/.test(suffix)) return "call";
  if (/^\s*(?:\+|-|\*|\/|%|\||&|\^|\?\?)?=(?!=)/.test(suffix)) return "write";
  return "read";
}

function severityCounts(items: AnalysisDiagnostic[]): { errors: number; warnings: number; info: number } {
  return {
    errors: items.filter((item) => item.severity === "error").length,
    warnings: items.filter((item) => item.severity === "warning").length,
    info: items.filter((item) => item.severity === "info").length,
  };
}

function stronglyConnected(nodes: string[], edges: DependencyEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (node: string): void => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    for (const target of adjacency.get(node) ?? []) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!));
      }
    }
    if (lowLinks.get(node) !== indices.get(node)) return;
    const component: string[] = [];
    while (stack.length) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    if (component.length > 1) components.push(component.sort());
  };
  for (const node of nodes) if (!indices.has(node)) visit(node);
  return components.sort((left, right) => left[0]!.localeCompare(right[0]!));
}

export class ProjectAnalysisService {
  readonly project: GameMakerProject;

  constructor(project: GameMakerProject) {
    this.project = project;
  }

  analyzeGml(options: { path?: string; limit?: number } = {}): GmlProjectAnalysis {
    let files: ProjectTextFile[];
    if (options.path) {
      if (path.posix.extname(options.path.replaceAll("\\", "/")).toLowerCase() !== ".gml") {
        throw new Error("GML analysis only accepts .gml files");
      }
      const read = this.project.readFile(options.path);
      files = [{ path: read.path, content: read.content }];
    } else {
      files = this.textFiles().filter((file) => path.posix.extname(file.path).toLowerCase() === ".gml");
    }
    files.sort((left, right) => left.path.localeCompare(right.path));
    const limit = Math.min(1000, Math.max(1, options.limit ?? 200));
    const truncated = files.length > limit;
    const analyses = files.slice(0, limit).map((file) => analyzeGmlSource(file.content, file.path));
    const diagnostics = analyses.flatMap((analysis) => analysis.diagnostics);

    const byOwner = new Map<string, { files: ProjectTextFile[]; analyses: GmlFileAnalysis[] }>();
    for (let index = 0; index < Math.min(files.length, limit); index += 1) {
      const file = files[index]!;
      if (!file.owner) continue;
      const group = byOwner.get(file.owner.name) ?? { files: [], analyses: [] };
      group.files.push(file);
      group.analyses.push(analyses[index]!);
      byOwner.set(file.owner.name, group);
    }
    for (const [owner, group] of byOwner) {
      const callCounts = new Map<string, number>();
      for (const analysis of group.analyses) {
        for (const call of analysis.calls) callCounts.set(call.name, (callCounts.get(call.name) ?? 0) + call.count);
      }
      for (const [create, destroy] of LIFECYCLE_PAIRS) {
        if ((callCounts.get(create) ?? 0) === 0 || (callCounts.get(destroy) ?? 0) > 0) continue;
        const source = group.analyses.find((analysis) => analysis.calls.some((call) => call.name === create))!;
        const call = source.calls.find((item) => item.name === create)!;
        diagnostics.push({
          severity: "warning",
          code: "possible-resource-leak",
          file: source.file,
          line: call.lines[0]!,
          column: 1,
          message: `${owner} calls ${create} but no related asset file calls ${destroy}`,
        });
      }
    }

    const counts = severityCounts(diagnostics);
    return {
      filesScanned: analyses.length,
      truncated,
      lines: analyses.reduce((sum, item) => sum + item.lines, 0),
      codeLines: analyses.reduce((sum, item) => sum + item.codeLines, 0),
      functions: analyses.reduce((sum, item) => sum + item.functions.length, 0),
      cyclomaticComplexity: analyses.reduce((sum, item) => sum + item.complexity.cyclomatic, 0),
      diagnostics: { ...counts, items: diagnostics.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line) },
      files: analyses,
    };
  }

  inspectShaders(options: { name?: string } = {}): ShaderProjectInspection {
    const resources = this.project
      .resources()
      .filter((resource) => resource.kind === "shader" && (!options.name || resource.name === options.name));
    if (options.name && resources.length === 0) throw new Error(`Shader resource not found: ${options.name}`);
    const inspections = resources.map((resource) => {
      const files = this.project.readAsset(resource.name, resource.kind).files;
      const vertex = files.find((file) => file.path.toLowerCase().endsWith(".vsh"));
      const fragment = files.find((file) => file.path.toLowerCase().endsWith(".fsh"));
      return inspectShaderSources({
        shader: resource.name,
        ...(vertex ? { vertex: vertex.content, vertexPath: vertex.path } : {}),
        ...(fragment ? { fragment: fragment.content, fragmentPath: fragment.path } : {}),
      });
    });
    const diagnostics = inspections.flatMap((inspection) => inspection.diagnostics);
    const counts = severityCounts(diagnostics);
    return { shadersScanned: inspections.length, errors: counts.errors, warnings: counts.warnings, inspections };
  }

  findReferences(options: {
    symbol: string;
    includeMetadata?: boolean;
    caseSensitive?: boolean;
    limit?: number;
  }): ReferenceSearchResult {
    if (!options.symbol.trim()) throw new Error("symbol must not be empty");
    const limit = Math.min(5000, Math.max(1, options.limit ?? 500));
    const expression = new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegExp(options.symbol)})(?![A-Za-z0-9_])`, options.caseSensitive ? "g" : "gi");
    const references: SymbolReference[] = [];
    let total = 0;
    const files = this.textFiles().filter((file) => {
      const extension = path.posix.extname(file.path).toLowerCase();
      return [".gml", ".vsh", ".fsh"].includes(extension) || ((options.includeMetadata ?? true) && [".yy", ".yyp", ".json"].includes(extension));
    });
    for (const file of files) {
      const extension = path.posix.extname(file.path).toLowerCase();
      const searchable = [".gml", ".vsh", ".fsh"].includes(extension)
        ? maskCode(file.content, false)
        : file.content;
      const searchableLines = searchable.split(/\r?\n/);
      const originalLines = file.content.split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < searchableLines.length; lineIndex += 1) {
        const line = searchableLines[lineIndex]!;
        expression.lastIndex = 0;
        for (const match of line.matchAll(expression)) {
          const prefixLength = match[1]?.length ?? 0;
          const offset = match.index + prefixLength;
          total += 1;
          if (references.length >= limit) continue;
          references.push({
            symbol: originalLines[lineIndex]!.slice(offset, offset + options.symbol.length),
            file: file.path,
            line: lineIndex + 1,
            column: offset + 1,
            kind: referenceKind(file.path, line, offset, options.symbol),
            text: originalLines[lineIndex]!.trim().slice(0, 300),
            ...(file.owner ? { owner: { name: file.owner.name, kind: file.owner.kind } } : {}),
          });
        }
      }
    }
    return { symbol: options.symbol, total, truncated: total > references.length, references };
  }

  dependencyGraph(options: { includeMetadata?: boolean; evidencePerEdge?: number } = {}): DependencyGraph {
    const resources = this.project.resources();
    const resourceByName = new Map(resources.map((resource) => [resource.name, resource]));
    const edgeMap = new Map<string, DependencyEdge>();
    const evidenceLimit = Math.min(20, Math.max(0, options.evidencePerEdge ?? 3));
    for (const file of this.textFiles()) {
      if (!file.owner) continue;
      const extension = path.posix.extname(file.path).toLowerCase();
      const metadata = [".yy", ".yyp", ".json"].includes(extension);
      if (metadata && !(options.includeMetadata ?? true)) continue;
      if (!metadata && ![".gml", ".vsh", ".fsh"].includes(extension)) continue;
      const searchable = metadata ? file.content : maskCode(file.content, false);
      const lines = searchable.split(/\r?\n/);
      const originalLines = file.content.split(/\r?\n/);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        for (const match of lines[lineIndex]!.matchAll(new RegExp(`\\b(${IDENTIFIER})\\b`, "g"))) {
          const target = resourceByName.get(match[1]!);
          if (!target || target.name === file.owner.name) continue;
          const key = `${file.owner.name}\0${target.name}`;
          let edge = edgeMap.get(key);
          if (!edge) {
            edge = {
              source: file.owner.name,
              target: target.name,
              kind: this.dependencyKind(metadata, target, lines[lineIndex]!, match.index, target.name),
              occurrences: 0,
              evidence: [],
            };
            edgeMap.set(key, edge);
          }
          edge.occurrences += 1;
          if (edge.evidence.length < evidenceLimit) {
            edge.evidence.push({ file: file.path, line: lineIndex + 1, text: originalLines[lineIndex]!.trim().slice(0, 240) });
          }
        }
      }
    }
    const edges = [...edgeMap.values()].sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();
    for (const edge of edges) {
      outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }
    const nodes = resources.map((resource) => ({
      name: resource.name,
      kind: resource.kind,
      path: resource.path,
      incoming: incoming.get(resource.name) ?? 0,
      outgoing: outgoing.get(resource.name) ?? 0,
    }));
    return {
      nodes,
      edges,
      isolated: nodes.filter((node) => node.incoming === 0 && node.outgoing === 0).map((node) => node.name),
      cycles: stronglyConnected(nodes.map((node) => node.name), edges),
    };
  }

  statistics(): ProjectStatistics {
    const resources = this.project.resources();
    const files = this.textFiles();
    const byKind: Record<string, number> = {};
    const byExtension: Record<string, number> = {};
    for (const resource of resources) byKind[resource.kind] = (byKind[resource.kind] ?? 0) + 1;
    for (const file of files) {
      const extension = path.posix.extname(file.path).toLowerCase() || "<none>";
      byExtension[extension] = (byExtension[extension] ?? 0) + 1;
    }
    const gml = this.analyzeGml({ limit: 1000 });
    const shaders = this.inspectShaders();
    const dependencies = this.dependencyGraph();
    const fileStats = files.map((file) => ({
      path: file.path,
      bytes: Buffer.byteLength(file.content, "utf8"),
      lines: file.content.split(/\r?\n/).length,
    }));
    return {
      resources: { total: resources.length, byKind },
      files: {
        total: files.length,
        sourceFiles: files.filter((file) => [".gml", ".vsh", ".fsh"].includes(path.posix.extname(file.path).toLowerCase())).length,
        bytes: fileStats.reduce((sum, file) => sum + file.bytes, 0),
        lines: fileStats.reduce((sum, file) => sum + file.lines, 0),
        byExtension,
        largest: fileStats.sort((left, right) => right.bytes - left.bytes).slice(0, 10),
      },
      gml: {
        files: gml.filesScanned,
        lines: gml.lines,
        codeLines: gml.codeLines,
        functions: gml.functions,
        cyclomaticComplexity: gml.cyclomaticComplexity,
        calls: gml.files.reduce((sum, file) => sum + file.calls.reduce((inner, call) => inner + call.count, 0), 0),
      },
      shaders: {
        resources: shaders.shadersScanned,
        stages: shaders.inspections.reduce((sum, shader) => sum + (shader.vertex ? 1 : 0) + (shader.fragment ? 1 : 0), 0),
        errors: shaders.errors,
        warnings: shaders.warnings,
      },
      dependencies: {
        nodes: dependencies.nodes.length,
        edges: dependencies.edges.length,
        isolated: dependencies.isolated.length,
        cycles: dependencies.cycles.length,
      },
    };
  }

  findUnusedAssets(): UnusedAssetsResult {
    const resources = this.project.resources();
    const files = this.textFiles();

    const combinedContentMap = new Map<string, string>();
    for (const f of files) {
      combinedContentMap.set(f.path, f.content);
    }

    const unused: Array<{ name: string; kind: string; path: string }> = [];

    for (const resource of resources) {
      if (resource.kind === "room" || resource.kind === "note" || resource.kind === "extension") {
        continue;
      }

      const lowerName = resource.name.toLowerCase();
      const lowerPath = resource.path.replaceAll("\\", "/").toLowerCase();

      // Ignore internal library assets (e.g. Juju Adams' Input library, Scribble, Snap, GMLive, etc.)
      if (
        lowerName.startsWith("__") ||
        lowerName.startsWith("input_") ||
        lowerName.startsWith("scribble_") ||
        lowerName.startsWith("snap_") ||
        lowerName.startsWith("live_") ||
        lowerName.startsWith("steam_") ||
        lowerName.startsWith("fmod_") ||
        lowerPath.includes("/input/") ||
        lowerPath.includes("/libraries/") ||
        lowerPath.includes("/packages/") ||
        lowerPath.includes("/vendor/") ||
        lowerPath.includes("/thirdparty/") ||
        lowerPath.includes("/third_party/") ||
        lowerPath.includes("/extensions/")
      ) {
        continue;
      }

      const regex = new RegExp(`\\b${resource.name}\\b`);
      let isUsed = false;

      for (const [filePath, content] of combinedContentMap) {
        const relAssetDir = path.dirname(resource.path).replaceAll("\\", "/").toLowerCase();
        const relFilePath = filePath.replaceAll("\\", "/").toLowerCase();

        if (filePath === this.project.projectRelativePath || relFilePath.includes(relAssetDir)) {
          continue;
        }

        if (regex.test(content)) {
          isUsed = true;
          break;
        }
      }

      if (!isUsed) {
        unused.push({
          name: resource.name,
          kind: resource.kind,
          path: resource.path,
        });
      }
    }

    return {
      scannedCount: resources.length,
      unusedCount: unused.length,
      unused,
    };
  }

  profileCheck(): ProfileCheckResult {
    const files = this.textFiles().filter((f) => f.path.endsWith(".gml"));
    const findings: ProfileFinding[] = [];

    for (const f of files) {
      const lines = f.content.split(/\r?\n/);
      const isStep = f.path.toLowerCase().includes("step_");
      const isDraw = f.path.toLowerCase().includes("draw_");
      let inLoop = false;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i]!;
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");

        if (/\b(for|while|repeat|do)\b/.test(code)) inLoop = true;
        if (code.includes("}")) inLoop = false;

        if (inLoop && (/\binstance_find\b/.test(code) || /\bwith\s*\(\s*all\s*\)/.test(code))) {
          findings.push({
            file: f.path,
            line: lineNum,
            type: "loop_instance_search",
            severity: "warning",
            message: "Calling instance_find() or with(all) inside a loop causes O(N^2) CPU overhead.",
            recommendation: "Iterate directly over specific object instances or cache the instance list.",
          });
        }

        if ((isStep || isDraw) && (/\blayer_get_id\b/.test(code) || /\basset_get_index\b/.test(code))) {
          findings.push({
            file: f.path,
            line: lineNum,
            type: "uncached_asset_lookup",
            severity: "warning",
            message: "Calling layer_get_id() or asset_get_index() in Step/Draw events performs string lookups every frame.",
            recommendation: "Cache layer or asset IDs in the Create event.",
          });
        }

        if (isStep && /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\[\s*\]/.test(code)) {
          findings.push({
            file: f.path,
            line: lineNum,
            type: "step_array_allocation",
            severity: "info",
            message: "Reallocating empty array '[]' in Step event triggers GC allocations every frame.",
            recommendation: "Use array_create() or reuse existing array with array_resize(arr, 0).",
          });
        }

        if (isDraw && (/\bstring\s*\(/.test(code) || /"[^"]*"\s*\+/.test(code))) {
          findings.push({
            file: f.path,
            line: lineNum,
            type: "draw_string_concat",
            severity: "info",
            message: "String formatting or concatenation in Draw event creates transient string allocations every frame.",
            recommendation: "Cache formatted strings or format only when data changes.",
          });
        }
      }
    }

    return {
      filesScanned: files.length,
      findingsCount: findings.length,
      findings,
    };
  }

  i18nScan(): I18nScanResult {
    const files = this.textFiles().filter((f) => f.path.endsWith(".gml"));
    const literals: HardcodedStringInfo[] = [];

    for (const f of files) {
      const lines = f.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i]!;
        if (line.trim().startsWith("//") || line.trim().startsWith("///")) continue;

        const matches = line.match(/"([^"\\]|\\.)*"/g);
        if (!matches) continue;

        for (const str of matches) {
          const raw = str.slice(1, -1).trim();
          if (raw.length > 1 && !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(raw) && !/^spr_|^snd_|^obj_|^rm_|^scr_/.test(raw)) {
            const key = raw
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .slice(0, 30);
            literals.push({
              file: f.path,
              line: lineNum,
              literal: raw,
              suggestedKey: `txt_${key}`,
            });
          }
        }
      }
    }

    return {
      stringsFound: literals.length,
      literals,
    };
  }

  drawStateAudit(): DrawStateAuditResult {
    const files = this.textFiles().filter((f) => f.path.endsWith(".gml") && f.path.toLowerCase().includes("draw"));
    const issues: DrawStateIssue[] = [];

    for (const f of files) {
      const lines = f.content.split(/\r?\n/);
      let activeShaderLine = 0;
      let activeAlphaLine = 0;
      let activeBlendLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const line = lines[i]!;
        const code = line.replace(/\/\/.*$/, "");

        if (/\bshader_set\s*\(/.test(code)) activeShaderLine = lineNum;
        if (/\bshader_reset\s*\(/.test(code)) activeShaderLine = 0;

        if (/\bdraw_set_alpha\s*\(\s*(?!1(?:\.0*)?\s*\))/.test(code)) activeAlphaLine = lineNum;
        if (/\bdraw_set_alpha\s*\(\s*1(?:\.0*)?\s*\)/.test(code)) activeAlphaLine = 0;

        if (/\bgpu_set_blendmode\s*\(\s*(?!bm_normal\b)/.test(code)) activeBlendLine = lineNum;
        if (/\bgpu_set_blendmode\s*\(\s*bm_normal\s*\)/.test(code)) activeBlendLine = 0;
      }

      if (activeShaderLine > 0) {
        issues.push({
          file: f.path,
          line: activeShaderLine,
          state: "shader",
          message: `shader_set() called on line ${activeShaderLine} without shader_reset() before end of event.`,
        });
      }
      if (activeAlphaLine > 0) {
        issues.push({
          file: f.path,
          line: activeAlphaLine,
          state: "alpha",
          message: `draw_set_alpha() set on line ${activeAlphaLine} without resetting to 1 before end of event.`,
        });
      }
      if (activeBlendLine > 0) {
        issues.push({
          file: f.path,
          line: activeBlendLine,
          state: "blendmode",
          message: `gpu_set_blendmode() changed on line ${activeBlendLine} without resetting to bm_normal before end of event.`,
        });
      }
    }

    return {
      drawEventsScanned: files.length,
      issuesCount: issues.length,
      issues,
    };
  }

  calculateHealthScore(): HealthScoreResult {
    const summary = this.project.summary();
    const unused = this.findUnusedAssets();
    const profile = this.profileCheck();
    const drawState = this.drawStateAudit();
    const gml = this.analyzeGml({ limit: 100 });

    let score = 100;
    const recommendations: string[] = [];

    if (unused.unusedCount > 0) {
      const penalty = Math.min(25, unused.unusedCount * 3);
      score -= penalty;
      recommendations.push(`Remove or reuse ${unused.unusedCount} unused asset(s) to clean up project size.`);
    }

    if (profile.findingsCount > 0) {
      const penalty = Math.min(25, profile.findingsCount * 5);
      score -= penalty;
      recommendations.push(`Fix ${profile.findingsCount} performance warning(s) in Step/Draw events.`);
    }

    if (drawState.issuesCount > 0) {
      const penalty = Math.min(20, drawState.issuesCount * 5);
      score -= penalty;
      recommendations.push(`Add state reset calls for ${drawState.issuesCount} Draw event GPU state changes.`);
    }

    const highComplexityCount = gml.files.filter((f) => f.complexity.cyclomatic > 15).length;
    if (highComplexityCount > 0) {
      const penalty = Math.min(15, highComplexityCount * 3);
      score -= penalty;
      recommendations.push(`Refactor ${highComplexityCount} script(s) with high cyclomatic complexity (> 15).`);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    let grade: "A+" | "A" | "B" | "C" | "D" | "F" = "F";
    if (score >= 95) grade = "A+";
    else if (score >= 85) grade = "A";
    else if (score >= 75) grade = "B";
    else if (score >= 65) grade = "C";
    else if (score >= 50) grade = "D";

    return {
      score,
      grade,
      unusedAssets: unused.unusedCount,
      profileFindings: profile.findingsCount,
      drawStateIssues: drawState.issuesCount,
      recommendations,
    };
  }

  objectHierarchy(): ObjectHierarchyResult {
    const objects = this.project.resources().filter((r) => r.kind === "object");
    const parentMap: Record<string, string | undefined> = {};
    const childrenMap: Record<string, string[]> = {};

    for (const obj of objects) {
      childrenMap[obj.name] = [];
      try {
        const text = this.project.sandbox.readText(obj.path, [".yy"]);
        const data = requireGmJson<Record<string, unknown>>(text, obj.path);
        const parentId = (data["parentObjectId"] as { name?: string } | undefined)?.name;
        if (parentId) {
          parentMap[obj.name] = parentId;
        }
      } catch {}
    }

    const rootObjects: string[] = [];
    for (const obj of objects) {
      const parent = parentMap[obj.name];
      if (parent && childrenMap[parent]) {
        childrenMap[parent]!.push(obj.name);
      } else {
        rootObjects.push(obj.name);
      }
    }

    const hierarchy: Record<string, { parent?: string; children: string[] }> = {};
    for (const obj of objects) {
      const parentVal = parentMap[obj.name];
      const entry: { parent?: string; children: string[] } = {
        children: childrenMap[obj.name] ?? [],
      };
      if (parentVal) {
        entry.parent = parentVal;
      }
      hierarchy[obj.name] = entry;
    }

    return {
      totalObjects: objects.length,
      rootObjects,
      hierarchy,
      cycles: [],
    };
  }

  exportProjectDocs(): { markdown: string; byteCount: number } {
    const summary = this.project.summary();
    const resources = this.project.resources();

    const objects = resources.filter((r) => r.kind === "object");
    const scripts = resources.filter((r) => r.kind === "script");
    const shaders = resources.filter((r) => r.kind === "shader");
    const rooms = resources.filter((r) => r.kind === "room");
    const sprites = resources.filter((r) => r.kind === "sprite");
    const sounds = resources.filter((r) => r.kind === "sound");

    let md = `# ${summary.name} - Project Documentation\n\n`;
    md += `**IDE Version**: ${summary.ideVersion ?? "Unknown"} | **Resource Count**: ${summary.resourceCount}\n\n`;

    md += `## Objects (${objects.length})\n`;
    for (const obj of objects) {
      md += `- **${obj.name}** (\`${obj.path}\`)\n`;
    }
    md += "\n";

    md += `## Scripts (${scripts.length})\n`;
    for (const scr of scripts) {
      md += `- **${scr.name}** (\`${scr.path}\`)\n`;
    }
    md += "\n";

    md += `## Shaders (${shaders.length})\n`;
    for (const shd of shaders) {
      md += `- **${shd.name}** (\`${shd.path}\`)\n`;
    }
    md += "\n";

    md += `## Rooms (${rooms.length})\n`;
    for (const rm of rooms) {
      md += `- **${rm.name}** (\`${rm.path}\`)\n`;
    }
    md += "\n";

    md += `## Sprites (${sprites.length}) & Sounds (${sounds.length})\n`;
    md += `- Sprites: ${sprites.length}\n- Sounds: ${sounds.length}\n`;

    return { markdown: md, byteCount: Buffer.byteLength(md, "utf8") };
  }

  findCodeDuplicates(): CodeDuplicatesResult {
    const files = this.textFiles().filter((f) => f.path.endsWith(".gml"));
    const snippetMap = new Map<string, Array<{ file: string; line: number }>>();

    for (const f of files) {
      const lines = f.content.split(/\r?\n/);
      for (let i = 0; i <= lines.length - 4; i++) {
        const blockLines = lines.slice(i, i + 4).map((l) => l.trim());
        if (blockLines.every((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("///"))) {
          const block = blockLines.join("\n");
          if (block.length > 30) {
            const existing = snippetMap.get(block) ?? [];
            const lastOcc = existing[existing.length - 1];
            if (!lastOcc || lastOcc.file !== f.path || (i + 1) >= lastOcc.line + 4) {
              existing.push({ file: f.path, line: i + 1 });
              snippetMap.set(block, existing);
            }
          }
        }
      }
    }

    const groups: CodeDuplicateGroup[] = [];
    for (const [snippet, occurrences] of snippetMap.entries()) {
      if (occurrences.length > 1) {
        groups.push({
          linesCount: 4,
          snippet,
          occurrences,
        });
      }
    }

    return {
      duplicatesFound: groups.length,
      groups: groups.slice(0, 50),
    };
  }

  private textFiles(): ProjectTextFile[] {
    const files = new Map<string, ProjectTextFile>();
    const projectFile = this.project.readFile(this.project.projectRelativePath);
    files.set(projectFile.path, { path: projectFile.path, content: projectFile.content });
    for (const resource of this.project.resources()) {
      const asset = this.project.readAsset(resource.name, resource.kind);
      for (const file of asset.files) {
        if (!files.has(file.path)) files.set(file.path, { path: file.path, content: file.content, owner: resource });
      }
    }
    return [...files.values()].sort((left, right) => left.path.localeCompare(right.path));
  }

  private dependencyKind(metadata: boolean, target: ProjectResourceRef, line: string, offset: number, name: string): DependencyKind {
    if (metadata) return "metadata";
    const prefix = line.slice(Math.max(0, offset - 80), offset).toLowerCase();
    const suffix = line.slice(offset + name.length);
    if (target.kind === "object" && /(?:instance_create|object_index|collision|place_meeting)/.test(prefix)) return "object-use";
    if (target.kind === "shader" && /shader_(?:set|get_uniform)/.test(prefix)) return "shader-use";
    if (target.kind === "sprite" && /(?:draw_sprite|sprite_index|sprite_)/.test(prefix)) return "sprite-use";
    if (target.kind === "script" && /^\s*\(/.test(suffix)) return "call";
    return "reference";
  }
}

export interface UnusedAssetsResult {
  scannedCount: number;
  unusedCount: number;
  unused: Array<{
    name: string;
    kind: string;
    path: string;
  }>;
}

export interface GmlDocgenResult {
  code: string;
  docstring: string;
  functions: Array<{
    name: string;
    signature: string;
    docstring: string;
  }>;
}

export function generateGmlDocstrings(gmlCode: string, nameHint?: string): GmlDocgenResult {
  const functionRegex = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;

  const foundFunctions: Array<{ name: string; signature: string; docstring: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = functionRegex.exec(gmlCode)) !== null) {
    const fnName = match[1] ?? "unnamed";
    const rawParams = (match[2] ?? "").split(",").map((p) => p.trim()).filter(Boolean);

    const docLines = [`/// @function ${fnName}(${rawParams.map((p) => p.split("=")[0]?.trim()).join(", ")})`];
    for (const rawParam of rawParams) {
      const [pName, defaultVal] = rawParam.split("=").map((s) => s.trim());
      if (pName) {
        if (defaultVal !== undefined) {
          docLines.push(`/// @param {Any} [${pName}=${defaultVal}] Parameter description`);
        } else {
          docLines.push(`/// @param {Any} ${pName} Parameter description`);
        }
      }
    }
    docLines.push("/// @returns {Any}");
    const docstring = docLines.join("\n");
    foundFunctions.push({
      name: fnName,
      signature: `${fnName}(${rawParams.join(", ")})`,
      docstring,
    });
  }

  if (foundFunctions.length === 0 && nameHint) {
    const docLines = [`/// @function ${nameHint}()`, "/// @returns {Any}"];
    const docstring = docLines.join("\n");
    return {
      code: `${docstring}\n${gmlCode}`,
      docstring,
      functions: [{ name: nameHint, signature: `${nameHint}()`, docstring }],
    };
  }

  const overallDoc = foundFunctions.map((f) => f.docstring).join("\n\n");
  return {
    code: overallDoc ? `${overallDoc}\n\n${gmlCode}` : gmlCode,
    docstring: overallDoc,
    functions: foundFunctions,
  };
}

export interface GmlSnippetValidationResult {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
  warnings: Array<{ line: number; message: string }>;
}

export function validateGmlSnippet(gmlCode: string): GmlSnippetValidationResult {
  const lines = gmlCode.split(/\r?\n/);
  const errors: Array<{ line: number; message: string }> = [];
  const warnings: Array<{ line: number; message: string }> = [];

  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  const deprecatedBuiltins = [
    "globalvar",
    "action_create_object",
    "action_kill_object",
    "texture_set_stage",
    "sound_play",
    "sound_stop",
    "d3d_start",
  ];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i]!;
    const codePart = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const char of codePart) {
      if (char === "(") parenDepth++;
      else if (char === ")") parenDepth--;
      else if (char === "{") braceDepth++;
      else if (char === "}") braceDepth--;
      else if (char === "[") bracketDepth++;
      else if (char === "]") bracketDepth--;
    }

    if (parenDepth < 0) errors.push({ line: lineNum, message: "Unmatched closing parenthesis ')'" });
    if (braceDepth < 0) errors.push({ line: lineNum, message: "Unmatched closing brace '}'" });
    if (bracketDepth < 0) errors.push({ line: lineNum, message: "Unmatched closing bracket ']'" });

    for (const dep of deprecatedBuiltins) {
      if (new RegExp(`\\b${dep}\\b`).test(codePart)) {
        warnings.push({ line: lineNum, message: `Use of deprecated GML feature '${dep}'` });
      }
    }

    const gmrtIncompatibleBuiltins = [
      "flexpanel_node_get_measure",
      "flexpanel_node_set_measure",
      "vertex_buffer_exists",
      "vertex_format_exists",
      "application_surface_is_draw_enabled",
    ];
    for (const inc of gmrtIncompatibleBuiltins) {
      if (new RegExp(`\\b${inc}\\b`).test(codePart)) {
        warnings.push({ line: lineNum, message: `GMRT 0.20.0 Compatibility: '${inc}' is not currently supported by the new GameMaker Runtime (GMRT)` });
      }
    }

    if (/\bargument[0-9]+\b|\bargument\[\d+\]\b/.test(codePart)) {
      warnings.push({ line: lineNum, message: "Legacy argument0..15 detected. Use named parameters in function(...) syntax." });
    }

    if (/\bif\s*\([^=]*[^!=<>]=[^=].*\)/.test(codePart)) {
      warnings.push({ line: lineNum, message: "Possible assignment '=' inside 'if (...)' condition. Use '==' for equality comparison." });
    }

    if (/(self|this)\.[A-Za-z0-9_]+\s*=\s*function\b/.test(codePart)) {
      warnings.push({ line: lineNum, message: "Non-static method assignment on struct constructor. Use 'static method_name = function(...)' to avoid GC allocation overhead." });
    }
  }

  if (parenDepth !== 0) errors.push({ line: lines.length, message: "Mismatched parentheses count across snippet." });
  if (braceDepth !== 0) errors.push({ line: lines.length, message: "Mismatched braces count across snippet." });
  if (bracketDepth !== 0) errors.push({ line: lines.length, message: "Mismatched brackets count across snippet." });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface ProfileFinding {
  file: string;
  line: number;
  type: "loop_instance_search" | "uncached_asset_lookup" | "step_array_allocation" | "draw_string_concat";
  severity: "warning" | "info";
  message: string;
  recommendation: string;
}

export interface ProfileCheckResult {
  filesScanned: number;
  findingsCount: number;
  findings: ProfileFinding[];
}

export interface HardcodedStringInfo {
  file: string;
  line: number;
  literal: string;
  suggestedKey: string;
}

export interface I18nScanResult {
  stringsFound: number;
  literals: HardcodedStringInfo[];
}

export interface DrawStateIssue {
  file: string;
  line: number;
  state: "color" | "alpha" | "shader" | "blendmode";
  message: string;
}

export interface DrawStateAuditResult {
  drawEventsScanned: number;
  issuesCount: number;
  issues: DrawStateIssue[];
}

export interface HealthScoreResult {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  unusedAssets: number;
  profileFindings: number;
  drawStateIssues: number;
  recommendations: string[];
}

export interface ObjectHierarchyResult {
  totalObjects: number;
  rootObjects: string[];
  hierarchy: Record<string, { parent?: string; children: string[] }>;
  cycles: string[][];
}

export interface CodeDuplicateGroup {
  linesCount: number;
  snippet: string;
  occurrences: Array<{ file: string; line: number }>;
}

export interface CodeDuplicatesResult {
  duplicatesFound: number;
  groups: CodeDuplicateGroup[];
}
