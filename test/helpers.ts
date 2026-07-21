import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createFixtureProject(): { root: string; projectFile: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gamemaker-mcp-test-"));
  const projectFile = path.join(root, "Fixture.yyp");
  fs.writeFileSync(
    projectFile,
    JSON.stringify(
      {
        $GMProject: "v1",
        "%Name": "Fixture",
        Folders: [],
        MetaData: { IDEVersion: "2026.0.0.16" },
        name: "Fixture",
        resources: [],
        resourceType: "GMProject",
        resourceVersion: "2.0",
        RoomOrderNodes: [],
        TextureGroups: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  return { root, projectFile };
}
