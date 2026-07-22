import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  GameMakerJobService,
  terminateWindowsProcessTree,
  type JobChildProcess,
  type JobSpawner,
  type JobSpawnOptions,
  type ProcessControlChild,
  type ProcessControlSpawnOptions,
} from "../src/jobs.js";
import type { ServerConfig } from "../src/types.js";
import { IgorService } from "../src/igor.js";
import { createFixtureProject } from "./helpers.js";

class FakeChild extends EventEmitter implements JobChildProcess {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly pid = 4242;
  killed = false;
  killSignal?: NodeJS.Signals | undefined;

  kill(signal?: NodeJS.Signals): boolean {
    this.killed = true;
    this.killSignal = signal;
    return true;
  }

  close(exitCode: number | null, signal: NodeJS.Signals | null = null): void {
    this.stdout.end();
    this.stderr.end();
    this.emit("close", exitCode, signal);
  }
}

class FakeControlChild extends EventEmitter implements ProcessControlChild {
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

interface SpawnCall {
  command: string;
  args: readonly string[];
  options: JobSpawnOptions;
  child: FakeChild;
}

function fixtureService(maxLogBytes = 512, treeTerminationResult = true): {
  service: GameMakerJobService;
  calls: SpawnCall[];
  config: ServerConfig;
  terminatedPids: number[];
} {
  const fixture = createFixtureProject();
  const calls: SpawnCall[] = [];
  const terminatedPids: number[] = [];
  const spawner: JobSpawner = (command, args, options) => {
    const child = new FakeChild();
    calls.push({ command, args: [...args], options, child });
    return child;
  };
  const config: ServerConfig = {
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: true,
    maxFileBytes: 1024 * 1024,
    igorPath: "C:\\FakeGameMaker\\Igor.exe",
    runtimePath: "C:\\FakeGameMaker\\runtime",
  };
  let sequence = 0;
  const service = new GameMakerJobService(config, {
    maxLogBytes,
    spawner,
    idFactory: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
    treeTerminator: async (pid) => {
      terminatedPids.push(pid);
      return treeTerminationResult;
    },
  });
  return { service, calls, config, terminatedPids };
}

test("compile jobs use the Igor allowlist, shell:false, history, and one-active-job guard", async () => {
  const { service, calls, config } = fixtureService();
  const started = service.start({ kind: "compile", timeoutMs: 5_000, ignoreCache: true });

  assert.equal(started.state, "running");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.command, config.igorPath);
  assert.equal(calls[0]!.options.shell, false);
  assert.deepEqual(calls[0]!.options.stdio, ["ignore", "pipe", "pipe"]);
  assert.deepEqual(calls[0]!.args.slice(-2), ["windows", "Compile"]);
  assert.ok(calls[0]!.args.some((argument) => argument === "--ignorecache"));
  assert.match(started.artifactPath, /Fixture\.win$/);
  assert.ok(started.logPath.includes(".gamemaker-mcp"));
  assert.throws(
    () => service.start({ kind: "package-zip" }),
    /already running/,
  );

  calls[0]!.child.stderr.write("warning: fake compiler warning\n");
  calls[0]!.child.close(0);
  const finished = await service.wait(started.id);

  assert.equal(finished.state, "succeeded");
  assert.equal(finished.exitCode, 0);
  assert.deepEqual(finished.diagnostics, ["warning: fake compiler warning"]);
  assert.equal(service.status(started.id).state, "succeeded");
  assert.equal(service.list()[0]!.id, started.id);
  assert.ok(fs.existsSync(path.join(service.jobsRoot, started.id, "job.json")));
});

test("package zip jobs have bounded logs and cancel the full process tree", async () => {
  const { service, calls, terminatedPids } = fixtureService(192);
  const started = service.start({ kind: "package-zip" });

  assert.deepEqual(calls[0]!.args.slice(-2), ["windows", "PackageZip"]);
  assert.match(started.artifactPath, /Fixture\.zip$/);

  calls[0]!.child.stdout.write(Buffer.alloc(2_000, 65));
  const live = service.status(started.id);
  assert.equal(live.outputBytes, 2_000);
  assert.equal(live.outputTruncated, true);
  assert.equal(live.storedLogBytes, 192);

  const cancelling = service.cancel(started.id);
  assert.equal(cancelling.cancelRequested, true);
  assert.deepEqual(terminatedPids, [4242]);
  assert.equal(calls[0]!.child.killed, false);
  calls[0]!.child.close(null, "SIGKILL");

  const finished = await service.wait(started.id);
  assert.equal(finished.state, "cancelled");
  const log = service.readLog(started.id, { tailBytes: 32 });
  assert.equal(Buffer.byteLength(log.content, "utf8"), 32);
  assert.equal(log.truncated, true);
  assert.equal(log.outputBytes, 2_000);
  assert.throws(() => service.status("../../outside"), /Invalid job id/);
});

test("tree termination failure escalates to a direct SIGKILL fallback", async () => {
  const { service, calls } = fixtureService(512, false);
  const started = service.start({ kind: "compile" });
  service.cancel(started.id);
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(calls[0]!.child.killed, true);
  assert.equal(calls[0]!.child.killSignal, "SIGKILL");
  calls[0]!.child.close(null, "SIGKILL");
  assert.equal((await service.wait(started.id)).state, "cancelled");
});

test("taskkill process-tree invocation is fixed, shell-free, bounded, and PID-only", async () => {
  const child = new FakeControlChild();
  const calls: Array<{
    command: string;
    args: readonly string[];
    options: ProcessControlSpawnOptions;
  }> = [];
  const result = terminateWindowsProcessTree(321, (command, args, options) => {
    calls.push({ command, args: [...args], options });
    return child;
  });

  assert.match(calls[0]!.command, /[\\/]System32[\\/]taskkill\.exe$/i);
  assert.deepEqual(calls[0]!.args, ["/PID", "321", "/T", "/F"]);
  assert.equal(calls[0]!.options.shell, false);
  assert.equal(calls[0]!.options.stdio, "ignore");
  child.emit("close", 0, null);
  assert.equal(await result, true);

  await assert.rejects(
    () => terminateWindowsProcessTree(Number.NaN, () => child),
    /positive 32-bit integer/,
  );
  await assert.rejects(
    () => terminateWindowsProcessTree(-1, () => child),
    /positive 32-bit integer/,
  );
});

test("job directories reject symlink escape before mkdir creates outside content", (t) => {
  const fixture = createFixtureProject();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "gamemaker-mcp-outside-"));
  const link = path.join(fixture.root, ".gamemaker-mcp");
  try {
    fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    t.skip(`symlink creation is unavailable: ${String(error)}`);
    return;
  }

  const config: ServerConfig = {
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: true,
    maxFileBytes: 1024 * 1024,
    igorPath: "C:\\FakeGameMaker\\Igor.exe",
    runtimePath: "C:\\FakeGameMaker\\runtime",
  };
  assert.throws(
    () => new GameMakerJobService(config),
    /ancestor escapes/,
  );
  assert.equal(fs.existsSync(path.join(outside, "jobs")), false);
});

test("build jobs remain disabled unless explicitly allowed", () => {
  const fixture = createFixtureProject();
  const service = new GameMakerJobService({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: false,
    maxFileBytes: 1024 * 1024,
    igorPath: "C:\\FakeGameMaker\\Igor.exe",
    runtimePath: "C:\\FakeGameMaker\\runtime",
  });
  assert.throws(() => service.start({ kind: "compile" }), /disabled/);
});

test("persisted job metadata cannot redirect log reads outside the jobs directory", async () => {
  const { service, calls, config } = fixtureService();
  const started = service.start({ kind: "compile" });
  calls[0]!.child.close(0);
  await service.wait(started.id);

  const metadataPath = path.join(service.jobsRoot, started.id, "job.json");
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
  metadata.logPath = config.projectFile;
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  assert.throws(() => service.readLog(started.id), /Invalid job paths/);
});

test("IgorService compileDiagnose parses compiler outputs correctly", async () => {
  const fixture = createFixtureProject();
  const igor = new class extends IgorService {
    override async compile() {
      return {
        ok: false,
        exitCode: 1,
        timedOut: false,
        durationMs: 42,
        outputFile: "game.win",
        stdout: `
Error : gml_Script_scr_player_state.gml(42) : variable name not found
gml_Object_obj_player_Step_0.gml(15) : Error : unexpected token '}'
C:\\Projects\\MyGame\\scripts\\scr_init\\scr_init.gml(5) : Warning : comparison with undefined
Error : Compilation Failed
`,
        stderr: "",
        diagnostics: [],
        command: "Igor.exe",
        args: [],
      };
    }
  }({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: true,
    maxFileBytes: 1024 * 1024,
  });

  const diag = await igor.compileDiagnose();
  assert.equal(diag.ok, false);
  assert.equal(diag.errors.length, 3);
  assert.equal(diag.warnings.length, 1);

  const scriptError = diag.errors.find((e) => e.file.includes("scr_player_state"));
  assert.ok(scriptError);
  assert.equal(scriptError.line, 42);
  assert.equal(scriptError.message, "variable name not found");

  const objectError = diag.errors.find((e) => e.file.includes("obj_player"));
  assert.ok(objectError);
  assert.equal(objectError.file, "objects/obj_player/Step_0.gml");
  assert.equal(objectError.line, 15);
  assert.equal(objectError.message, "unexpected token '}'");

  const warning = diag.warnings.find((w) => w.file.includes("scr_init"));
  assert.ok(warning);
  assert.equal(warning.line, 5);
  assert.equal(warning.message, "comparison with undefined");
});

