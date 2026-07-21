import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeGmlSource,
  inspectShaderSources,
  ProjectAnalysisService,
} from "../src/analysis.js";
import { GameMakerProject } from "../src/project.js";
import { createFixtureProject } from "./helpers.js";

function createProject(): GameMakerProject {
  const fixture = createFixtureProject();
  return new GameMakerProject({
    projectRoot: fixture.root,
    projectFile: fixture.projectFile,
    mode: "workspace-write",
    allowBuild: false,
    maxFileBytes: 1024 * 1024,
  });
}

test("GML source analysis reports symbols, complexity, and concrete diagnostics", () => {
  const result = analyzeGmlSource(
    `/// TODO: tune this
function scr_update(amount) {
  var next = global.score + amount;
  if (next > 10 && amount > 0) {
    show_debug_message(next);
  }
  return next / 0;
}
`,
    "scripts/scr_update/scr_update.gml",
  );

  assert.deepEqual(result.functions, [{ name: "scr_update", line: 2, parameters: ["amount"] }]);
  assert.equal(result.globalVariables[0]?.name, "score");
  assert.equal(result.calls.some((call) => call.name === "show_debug_message"), true);
  assert.equal(result.complexity.cyclomatic, 3);
  assert.equal(result.diagnostics.some((issue) => issue.code === "literal-zero-divisor"), true);
  assert.equal(result.diagnostics.some((issue) => issue.code === "work-marker"), true);
});

test("shader inspection validates entry points and cross-stage varying types", () => {
  const result = inspectShaderSources({
    shader: "shd_test",
    vertex: `attribute vec3 in_Position;
varying vec2 v_uv;
void main() { v_uv = in_Position.xy; gl_Position = vec4(in_Position, 1.0); }
`,
    fragment: `varying vec3 v_uv;
void main() { gl_FragColor = vec4(v_uv, 1.0); }
`,
  });

  assert.equal(result.ok, false);
  assert.equal(result.vertex?.hasMain, true);
  assert.equal(result.fragment?.hasMain, true);
  assert.equal(result.diagnostics.some((issue) => issue.code === "varying-type-mismatch"), true);
});

test("project analysis finds references, dependency cycles, lifecycle warnings, and statistics", () => {
  const project = createProject();
  project.createScript(
    "scr_alpha",
    `function scr_alpha() {
  var values = ds_list_create();
  return scr_beta(values);
}
`,
  );
  project.createScript(
    "scr_beta",
    `function scr_beta(values) {
  if (ds_list_size(values) > 0) return scr_alpha();
  return 0;
}
`,
  );
  project.createShader({
    name: "shd_valid",
    vertex: `attribute vec3 in_Position;
attribute vec4 in_Colour;
varying vec4 v_colour;
void main() { v_colour = in_Colour; gl_Position = vec4(in_Position, 1.0); }
`,
    fragment: `varying vec4 v_colour;
void main() { gl_FragColor = v_colour; }
`,
  });

  const analysis = new ProjectAnalysisService(project);
  const references = analysis.findReferences({ symbol: "scr_beta", includeMetadata: false });
  assert.equal(references.references.some((item) => item.kind === "call" && item.owner?.name === "scr_alpha"), true);

  const graph = analysis.dependencyGraph({ includeMetadata: false });
  assert.equal(graph.edges.some((edge) => edge.source === "scr_alpha" && edge.target === "scr_beta" && edge.kind === "call"), true);
  assert.equal(graph.cycles.some((cycle) => cycle.includes("scr_alpha") && cycle.includes("scr_beta")), true);

  const gml = analysis.analyzeGml();
  assert.equal(gml.diagnostics.items.some((issue) => issue.code === "possible-resource-leak"), true);

  const shaders = analysis.inspectShaders({ name: "shd_valid" });
  assert.equal(shaders.errors, 0);
  assert.equal(shaders.shadersScanned, 1);

  const statistics = analysis.statistics();
  assert.deepEqual(statistics.resources.byKind, { script: 2, shader: 1 });
  assert.equal(statistics.gml.files, 2);
  assert.equal(statistics.dependencies.cycles, 1);
});
