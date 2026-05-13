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

test("imports top-level set commands as set nodes", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*set Player-Score + 5",
    "*finish",
  ].join("\n"));
  const setNode = graph.nodes.find((node) => node.type === "set");

  assert.ok(setNode);
  assert.equal(setNode.title, "*set player_score");
  assert.deepEqual(setNode.sets, [{ var: "player_score", op: "+", val: "5" }]);
  assert.equal(graph.edges.find((edge) => edge.from === setNode.id)?.kind, "flow");
});

test("normalizes imported input and rand variable names", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*input_text Player-Name",
    "*input_number Player-Score 1 10",
    "*rand Random-Value 1 6",
    "*finish",
  ].join("\n"));

  assert.equal(graph.nodes.find((node) => node.type === "input_text")?.inputVar, "player_name");
  assert.equal(graph.nodes.find((node) => node.type === "input_number")?.inputVar, "player_score");
  assert.equal(graph.nodes.find((node) => node.type === "rand")?.inputVar, "random_value");
});

test("normalizes imported condition identifiers", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Conditions",
      "*author Writer",
      "*scene_list",
      "  startup",
      "*create Player-Score 5",
      "*if Player-Score > 3",
      "  *finish",
      "*else",
      "  *ending",
    ].join("\n")),
  ]);
  const condition = project.sceneData?.startup.nodes.find((node) => node.type === "if");

  assert.equal(condition?.branches?.[0]?.expr, "player_score > 3");
  assert.ok(!lintProject(project).some((issue) => issue.level === "warning" && issue.msg.includes("Player")));
});

test("normalizes imported set variables inside choices and branches", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Train",
    "    *set Player-Score + 5",
    "    *goto trained",
    "  #Rest",
    "    *goto rested",
    "*label trained",
    "*if Player-Score > 5",
    "  *set Player-Score + 1",
    "  *goto rested",
    "*else",
    "  *goto rested",
    "*label rested",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((node) => node.type === "choice");
  const condition = graph.nodes.find((node) => node.type === "if");

  assert.equal(choice?.options?.[0]?.sets?.[0]?.var, "player_score");
  assert.equal(condition?.branches?.[0]?.sets?.[0]?.var, "player_score");
  assert.equal(condition?.branches?.[0]?.expr, "player_score > 5");
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
      "*create player_name \"Alex\"",
      "Opening.",
      "*finish",
    ].join("\n")),
    textEntry("mygame/chapter_two.txt", [
      "The next scene.",
      "*ending",
    ].join("\n")),
    textEntry("mygame/choicescript_stats.txt", [
      "*stat_chart",
      "  percent courage Courage Score",
      "  text player_name Player Name",
    ].join("\n")),
  ]);

  assert.equal(project.title, "Imported");
  assert.equal(project.author, "Writer");
  assert.deepEqual(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name), ["startup", "chapter_two"]);
  assert.equal(project.variables[0]?.name, "courage");
  assert.equal(project.variables[0]?.desc, "Courage Score");
  assert.equal(project.variables[0]?.fairmath, true);
  assert.equal(project.variables[1]?.name, "player_name");
  assert.equal(project.variables[1]?.desc, "Player Name");
  assert.equal(project.variables[1]?.fairmath, false);
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

test("normalizes imported startup identifiers", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Identifiers",
      "*author Writer",
      "*scene_list",
      "  startup",
      "*create Player-Name \"Alex\"",
      "*achievement First-Step visible 5 First Step",
      "  Before.",
      "  After.",
      "Opening.",
      "*ending",
    ].join("\n")),
  ]);

  assert.equal(project.variables[0]?.name, "player_name");
  assert.equal(project.achievements[0]?.id, "first_step");
});

test("normalizes imported scene names and keeps scene ids stable", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Scene Names",
      "*author Writer",
      "*scene_list",
      "  Chapter-Two",
      "",
      "Opening.",
      "*finish",
    ].join("\n")),
    textEntry("Chapter-Two.txt", [
      "Chapter two.",
      "*ending",
    ].join("\n")),
  ]);
  const playableScenes = project.scenes.filter((scene) => !scene.isStart && !scene.special);

  assert.deepEqual(playableScenes.map((scene) => scene.name), ["startup", "chapter_two"]);
  assert.deepEqual(playableScenes.map((scene) => scene.id), ["scene_startup", "chapter_two"]);
  assert.ok(project.sceneData?.chapter_two);
});

test("normalizes imported goto_scene targets with scene names", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Scene Jump",
      "*author Writer",
      "*scene_list",
      "  startup",
      "  Chapter-Two",
      "",
      "*goto_scene Chapter-Two",
    ].join("\n")),
    textEntry("Chapter-Two.txt", [
      "Chapter two.",
      "*ending",
    ].join("\n")),
  ]);
  const gotoScene = project.sceneData?.startup.nodes.find((node) => node.type === "goto_scene");

  assert.equal(gotoScene?.target, "chapter_two");
  assert.ok(!lintProject(project).some((issue) => issue.level === "error" && issue.msg.includes("*goto_scene points to a missing scene")));
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

test("lints label nodes that collide with generated labels", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Start." },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label cf_n1" },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "flow" },
      { from: "n2", to: "n3", kind: "flow" },
    ],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("collides with a generated ChoiceForge label")));
});

test("lints invalid ChoiceScript identifiers", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "label", x: 0, y: 0, w: 240, title: "*label Bad Label" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "bad", name: "Bad Scene", words: 0, nodes: 2, current: true },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneTitle: "Bad Scene",
    variables: [{ name: "1score", type: "number" as const, initial: "0", desc: "Score", uses: 0 }],
    achievements: [{ id: "First-Step", title: "First", points: 5, desc: "First", preDesc: "Before", postDesc: "After" }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { "Bad Scene": graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("scene has an invalid identifier")));
  assert.ok(errors.some((message) => message.includes("variable has an invalid identifier")));
  assert.ok(errors.some((message) => message.includes("achievement has an invalid identifier")));
  assert.ok(errors.some((message) => message.includes("*label has an invalid identifier")));
});

test("lints variable initial values that do not match their type", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "courage", type: "number" as const, initial: "high", desc: "Courage", uses: 0 },
      { name: "ready", type: "boolean" as const, initial: "maybe", desc: "Ready", uses: 0 },
      { name: "name", type: "string" as const, initial: "Alex", desc: "Name", uses: 0 },
    ],
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("courage") && message.includes("invalid number")));
  assert.ok(errors.some((message) => message.includes("ready") && message.includes("invalid boolean")));
  assert.ok(!errors.some((message) => message.includes("name") && message.includes("invalid string")));
});

test("lints duplicate and empty node ids", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "first", body: "First." },
      { id: "n1", type: "passage", x: 0, y: 160, w: 300, title: "duplicate", body: "Duplicate." },
      { id: "", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("duplicate node id")));
  assert.ok(errors.some((message) => message.includes("empty id")));
});

test("lints empty choice conditions", () => {
  const graph: SceneGraph = {
    nodes: [
      {
        id: "n1",
        type: "choice",
        x: 0,
        y: 0,
        w: 340,
        title: "choice",
        prompt: "Choose.",
        options: [{ text: "Go", to: "n2", cond: { type: "selectable_if", expr: " " } }],
      },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };

  assert.ok(lintProject(project).some((issue) => issue.level === "error" && issue.msg.includes("*selectable_if condition is empty")));
});

test("warns about choice and if branches that loop to themselves", () => {
  const graph: SceneGraph = {
    nodes: [
      {
        id: "n1",
        type: "choice",
        x: 0,
        y: 0,
        w: 340,
        title: "choice",
        prompt: "Choose.",
        options: [{ text: "Again", to: "n1", cond: null }],
      },
      {
        id: "n2",
        type: "if",
        x: 0,
        y: 160,
        w: 300,
        title: "condition",
        branches: [{ kind: "if", expr: "true", to: "n2" }],
      },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((message) => message.includes("loops back to its own *choice")));
  assert.ok(warnings.some((message) => message.includes("loops back to its own *if")));
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
