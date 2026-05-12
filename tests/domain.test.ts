import test from "node:test";
import assert from "node:assert/strict";
import { createExportPackage, generateSceneChoiceScript, generateStartupChoiceScript, lintProject } from "../src/domain/choicescript.ts";
import { importChoiceScriptArchive, importChoiceScriptSceneText } from "../src/domain/choicescriptImport.ts";
import type { ChoiceForgeProject, SceneGraph } from "../src/domain/types.ts";

test("imports inline choice option bodies as choice targets", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "Intro text.",
    "*choice",
    "  #Open the door",
    "    You open it.",
    "    *finish",
    "  #Leave",
    "    You leave.",
    "    *ending",
  ].join("\n"));

  const choice = graph.nodes.find((node) => node.type === "choice");
  assert.ok(choice);
  assert.equal(choice.options?.length, 2);
  assert.equal(graph.nodes.find((node) => node.id === choice.options?.[0].to)?.type, "passage");
  assert.equal(graph.nodes.find((node) => node.id === choice.options?.[1].to)?.type, "passage");
  assert.equal(graph.edges.filter((edge) => edge.from === choice.id && edge.kind === "choice").length, 2);
  assert.ok(graph.nodes.some((node) => node.type === "finish"));
  assert.ok(graph.nodes.some((node) => node.type === "ending"));
});

test("imports inline if branch bodies as branch targets", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  You stand firm.",
    "  *finish",
    "*else",
    "  You retreat.",
    "  *ending",
  ].join("\n"));

  const condition = graph.nodes.find((node) => node.type === "if");
  assert.ok(condition);
  assert.equal(condition.branches?.length, 2);
  assert.equal(graph.nodes.find((node) => node.id === condition.branches?.[0].to)?.type, "passage");
  assert.equal(graph.nodes.find((node) => node.id === condition.branches?.[1].to)?.type, "passage");
  assert.equal(graph.edges.filter((edge) => edge.from === condition.id && ["if", "else"].includes(edge.kind)).length, 2);
});

test("imports ChoiceScript archives with startup metadata", () => {
  const project = importChoiceScriptArchive([
    textEntry("mygame/startup.txt", [
      "*title Imported",
      "*author Writer",
      "*scene_list",
      "  startup",
      "  chapter_two",
      "*create courage 50",
      "Opening.",
      "*finish",
    ].join("\n")),
    textEntry("mygame/chapter_two.txt", [
      "The next scene.",
      "*ending",
    ].join("\n")),
  ]);

  assert.equal(project.title, "Imported");
  assert.equal(project.author, "Writer");
  assert.deepEqual(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name), ["startup", "chapter_two"]);
  assert.equal(project.variables[0]?.name, "courage");
  assert.match(project.sceneData?.startup.nodes[0]?.body ?? "", /Opening/);
});

test("imports startup scene content after metadata blocks", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Startup Body",
      "*author Writer",
      "*scene_list",
      "  startup",
      "*create courage 50",
      "*achievement first visible 5 First Step",
      "  Before.",
      "  After.",
      "",
      "The playable opening stays here.",
      "*finish",
    ].join("\n")),
  ]);

  const startupGraph = project.sceneData?.startup;
  assert.ok(startupGraph);
  assert.equal(startupGraph.nodes[0]?.type, "passage");
  assert.match(startupGraph.nodes[0]?.body ?? "", /playable opening/);
  assert.ok(!startupGraph.nodes.some((node) => node.body?.includes("*create courage")));
});

test("keeps playable startup even when scene_list omits startup", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Startup First",
      "*author Writer",
      "*scene_list",
      "  chapter_two",
      "",
      "The game starts in startup.",
      "*finish",
    ].join("\n")),
    textEntry("chapter_two.txt", [
      "Chapter two.",
      "*ending",
    ].join("\n")),
  ]);

  assert.deepEqual(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name), ["startup", "chapter_two"]);
  assert.match(project.sceneData?.startup.nodes[0]?.body ?? "", /game starts/);
});

test("generates lint-clean ChoiceScript for a minimal project", () => {
  const project = minimalProject();

  assert.match(generateStartupChoiceScript(project), /\*scene_list\n  intro/);
  assert.match(generateSceneChoiceScript(project), /\*goto cf_n2/);
  assert.equal(lintProject(project).filter((issue) => issue.level === "error").length, 0);
});

test("does not lint words inside quoted condition strings as variables", () => {
  const graph: SceneGraph = {
    nodes: [
      {
        id: "n1",
        type: "if",
        x: 0,
        y: 0,
        w: 300,
        title: "name_check",
        branches: [
          { kind: "if", expr: "name = \"Alex Hunter\"", to: "n2" },
          { kind: "else", to: "n3" },
        ],
      },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
      { id: "n3", type: "ending", x: 0, y: 320, w: 240, title: "*ending" },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    variables: [{ name: "name", type: "string" as const, initial: "\"Alex Hunter\"", desc: "Name", uses: 0 }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };

  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);
  assert.ok(!warnings.some((message) => message.includes("Alex") || message.includes("Hunter")));
});

test("lints gosub nodes that point to missing labels", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub", x: 0, y: 0, w: 240, title: "*gosub missing_subroutine" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };

  assert.ok(lintProject(project).some((issue) => issue.level === "error" && issue.msg.includes("*gosub points to a missing label")));
});

test("lints duplicate and empty label nodes", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "label", x: 0, y: 0, w: 240, title: "*label repeated" },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label repeated" },
      { id: "n3", type: "label", x: 0, y: 320, w: 240, title: "*label" },
      { id: "n4", type: "finish", x: 0, y: 480, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "flow" },
      { from: "n2", to: "n3", kind: "flow" },
      { from: "n3", to: "n4", kind: "flow" },
    ],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("duplicate *label")));
  assert.ok(errors.some((message) => message.includes("empty label")));
});

test("exports project metadata, scene files, and binary assets", () => {
  const project = {
    ...minimalProject(),
    assets: [{
      id: "logo",
      path: "images/logo.txt",
      kind: "data" as const,
      desc: "Logo data",
      dataUrl: "data:text/plain;base64,SGVsbG8=",
    }],
  };

  const exported = createExportPackage(project);
  const paths = exported.files.map((file) => file.path);
  assert.ok(paths.includes("_choiceforge/project.json"));
  assert.ok(paths.includes("mygame/startup.txt"));
  assert.ok(paths.includes("mygame/choicescript_stats.txt"));
  assert.ok(paths.includes("mygame/intro.txt"));
  assert.ok(paths.includes("mygame/images/logo.txt"));
  assert.equal(exported.files.find((file) => file.path === "mygame/images/logo.txt")?.encoding, "binary");
  assert.deepEqual([...exported.files.find((file) => file.path === "mygame/images/logo.txt")?.content as Uint8Array], [72, 101, 108, 108, 111]);
});

function minimalProject(): ChoiceForgeProject {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  return {
    title: "Test",
    author: "Author",
    sceneTitle: "intro",
    sceneSubtitle: "intro.txt",
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    variables: [],
    achievements: [],
    assets: [],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
    lints: [],
  };
}

function textEntry(name: string, content: string) {
  return { name, bytes: new TextEncoder().encode(content) };
}
