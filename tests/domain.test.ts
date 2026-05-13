import test from "node:test";
import assert from "node:assert/strict";
import { sampleProjects } from "../src/data/sampleProject.ts";
import { createExportPackage, generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript, lintProject } from "../src/domain/choicescript.ts";
import { layoutProjectGraphs } from "../src/domain/graphLayout.ts";
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

test("links inline choice bodies back to the following passage", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Open the door",
    "    You open it.",
    "  #Leave",
    "    You leave.",
    "After the choice.",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((node) => node.type === "choice");
  const after = graph.nodes.find((node) => node.body?.includes("After the choice"));

  assert.ok(choice);
  assert.ok(after);
  choice.options?.forEach((option) => {
    assert.ok(graph.edges.some((edge) => edge.kind === "flow" && edge.from === option.to && edge.to === after.id));
  });
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
  const startupSource = [
    "*title Imported",
    "*author Writer",
    "*scene_list",
    "  startup",
    "  chapter_two",
    "*create courage 50",
    "*create player_name \"Alex\"",
    "Opening.",
    "*finish",
  ].join("\n");
  const project = importChoiceScriptArchive([
    textEntry("mygame/startup.txt", startupSource),
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
  assert.equal(project.startupSource, startupSource);
  assert.equal(generateStartupChoiceScript(project), `${startupSource}\n`);
});

test("imports startup body as prologue without duplicating startup scene", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Prologue",
      "*author Writer",
      "*scene_list",
      "  ch1_lobby",
      "Opening in startup.",
      "*goto_scene ch1_lobby",
    ].join("\n")),
    textEntry("ch1_lobby.txt", [
      "Chapter one.",
      "*ending",
    ].join("\n")),
  ]);
  const playableScenes = project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name);

  assert.deepEqual(playableScenes, ["startup_prologue", "ch1_lobby"]);
  assert.equal(project.scenes.filter((scene) => scene.name === "startup").length, 1);
  assert.match(project.sceneData?.startup_prologue.nodes[0]?.body ?? "", /Opening in startup/);
});

test("preserves imported scene source for safe export", () => {
  const source = [
    "Opening.",
    "*line_break",
    "*choice",
    "  #Go",
    "    Inline body.",
    "After.",
    "*finish",
  ].join("\n");
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Preserve",
      "*author Writer",
      "*scene_list",
      "  ch1",
    ].join("\n")),
    textEntry("ch1.txt", source),
  ]);

  assert.equal(project.sceneData?.ch1.sourceText, source);
  assert.equal(generateSceneChoiceScript(project, "ch1"), source);
  assert.match(createExportPackage(project).files.find((file) => file.path === "mygame/ch1.txt")?.content.toString() ?? "", /\*line_break/);
});

test("preserves imported startup source in export package", () => {
  const startupSource = [
    "*comment original startup heading",
    "*title Preserve Startup",
    "*author Writer",
    "*scene_list",
    "  ch1",
    "*create score 0",
    "*goto_scene ch1",
  ].join("\n");
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", startupSource),
    textEntry("ch1.txt", "Chapter one.\n*ending"),
  ]);
  const startupFile = createExportPackage(project).files.find((file) => file.path === "mygame/startup.txt");

  assert.equal(project.startupSource, startupSource);
  assert.equal(startupFile?.content, `${startupSource}\n`);
});

test("preserves imported stats source in export package", () => {
  const statsSource = [
    "*comment custom stats heading",
    "*stat_chart",
    "  percent score Score",
    "",
    "A custom status page line.",
  ].join("\n");
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Preserve Stats",
      "*author Writer",
      "*scene_list",
      "  ch1",
      "*create score 0",
    ].join("\n")),
    textEntry("choicescript_stats.txt", statsSource),
    textEntry("ch1.txt", "Chapter one.\n*ending"),
  ]);
  const statsFile = createExportPackage(project).files.find((file) => file.path === "mygame/choicescript_stats.txt");

  assert.equal(project.statsSource, statsSource);
  assert.equal(generateStatsChoiceScript(project), `${statsSource}\n`);
  assert.equal(statsFile?.content, `${statsSource}\n`);
});

test("lints preserved source without graph approximation false positives", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Preserve Lint",
      "*author Writer",
      "*scene_list",
      "  ch1",
      "*create score 0",
    ].join("\n")),
    textEntry("ch1.txt", [
      "*choice",
      "  #One",
      "    *set score +1",
      "  #Two",
      "    *set missing +1",
      "*goto_scene missing_scene",
    ].join("\n")),
  ]);
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 5 && issue.msg.includes("undeclared variable: missing")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 6 && issue.msg.includes("missing scene")));
  assert.ok(!issues.some((issue) => issue.scene === "ch1" && issue.node && issue.msg.includes("incoming connection")));
});

test("lints preserved startup and stats source by line", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Preserve Lint",
      "*author Writer",
      "*scene_list",
      "  ch1",
      "*create score 0",
      "*goto_scene missing_scene",
    ].join("\n")),
    textEntry("choicescript_stats.txt", [
      "*stat_chart",
      "  percent missing Missing",
      "  percent score Score",
    ].join("\n")),
    textEntry("ch1.txt", "Chapter one.\n*ending"),
  ]);
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 6 && issue.msg.includes("missing scene")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 2 && issue.msg.includes("undeclared variable: missing")));
});

test("lints preserved startup scene list against project scenes", () => {
  const project = {
    ...minimalProject(),
    startupSource: [
      "*title Scene List",
      "*author Writer",
      "*scene_list",
      "  missing_scene",
      "  invalid-scene",
    ].join("\n"),
  };
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 4 && issue.msg.includes("missing scene: missing_scene")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 5 && issue.msg.includes("invalid scene identifier")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 1 && issue.msg.includes("omits project scene: intro")));
});

test("imports gosub arguments and params without corrupting label targets", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*gosub add_truth_fragment \"SPINE\"",
    "*finish",
    "*label add_truth_fragment",
    "*params frag",
    "*return",
  ].join("\n"));
  const gosub = graph.nodes.find((node) => node.type === "gosub");
  const label = graph.nodes.find((node) => node.type === "label");
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const generated = generateSceneChoiceScript(project);

  assert.equal(gosub?.title, "*gosub add_truth_fragment \"SPINE\"");
  assert.equal(label?.body, "*params frag");
  assert.match(generated, /\*label add_truth_fragment\n\*params frag/);
  assert.ok(!lintProject(project).some((issue) => issue.level === "error" && issue.msg.includes("*gosub")));
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

  assert.deepEqual(playableScenes.map((scene) => scene.name), ["startup_prologue", "chapter_two"]);
  assert.deepEqual(playableScenes.map((scene) => scene.id), ["startup_prologue", "chapter_two"]);
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

test("normalizes imported gosub targets with label names", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*gosub Sub-Routine",
    "*finish",
    "*label Sub-Routine",
    "*return",
  ].join("\n"));
  const gosub = graph.nodes.find((node) => node.type === "gosub");
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };

  assert.equal(gosub?.title, "*gosub sub_routine");
  assert.ok(!lintProject(project).some((issue) => issue.level === "error" && issue.msg.includes("*gosub")));
});

test("imports and exports return command nodes", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*label subroutine",
    "Subroutine text.",
    "*return",
  ].join("\n"));
  const returnNode = graph.nodes.find((node) => node.type === "return");
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const generated = generateSceneChoiceScript(project);

  assert.ok(returnNode);
  assert.match(generated, /\*return/);
  assert.ok(!graph.edges.some((edge) => edge.from === returnNode.id && edge.kind === "flow"));
});

test("imports and exports restore checkpoint command nodes", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*save_checkpoint major",
    "*choice",
    "  #Restore",
    "    *restore_checkpoint major",
    "  #Continue",
    "    *finish",
  ].join("\n"));
  const restoreNode = graph.nodes.find((node) => node.type === "restore_checkpoint");
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const generated = generateSceneChoiceScript(project);

  assert.equal(restoreNode?.title, "*restore_checkpoint major");
  assert.match(generated, /\*restore_checkpoint major/);
});

test("warns about restore checkpoints without matching saves", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "restore_checkpoint", x: 0, y: 0, w: 280, title: "*restore_checkpoint missing" },
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

  assert.ok(warnings.some((message) => message.includes("no matching *save_checkpoint")));
});

test("normalizes edited ChoiceForge command identifiers", () => {
  const currentGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "goto_scene", x: 0, y: 0, w: 280, title: "*goto_scene chapter_two", target: "chapter_two" },
      { id: "n2", type: "gosub", x: 0, y: 160, w: 240, title: "*gosub sub_routine" },
      { id: "n3", type: "input_text", x: 0, y: 320, w: 280, title: "*input_text player_name", inputVar: "player_name" },
    ],
    edges: [],
  };
  const graph = importChoiceScriptSceneText("intro", [
    "*label cf_n1",
    "*goto_scene Chapter-Two",
    "",
    "*label cf_n2",
    "*gosub Sub-Routine",
    "",
    "*label cf_n3",
    "*input_text Player-Name",
  ].join("\n"), currentGraph);

  assert.equal(graph.nodes.find((node) => node.id === "n1")?.target, "chapter_two");
  assert.equal(graph.nodes.find((node) => node.id === "n1")?.title, "*goto_scene chapter_two");
  assert.equal(graph.nodes.find((node) => node.id === "n2")?.title, "*gosub sub_routine");
  assert.equal(graph.nodes.find((node) => node.id === "n3")?.inputVar, "player_name");
});

test("warns about return nodes without gosub nodes", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "return", x: 0, y: 0, w: 240, title: "*return" },
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

  assert.ok(warnings.some((message) => message.includes("no *gosub nodes")));
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

  assert.deepEqual(project.scenes.filter((scene) => !scene.isStart && !scene.special).map((scene) => scene.name), ["startup_prologue", "chapter_two"]);
  assert.match(project.sceneData?.startup_prologue.nodes[0]?.body ?? "", /game starts/);
});

test("generates lint-clean ChoiceScript for a minimal project", () => {
  const project = minimalProject();

  assert.match(generateStartupChoiceScript(project), /\*scene_list\n  intro/);
  assert.match(generateSceneChoiceScript(project), /\*goto cf_n2/);
  assert.equal(lintProject(project).filter((issue) => issue.level === "error").length, 0);
});

test("keeps bundled sample projects lint-clean", () => {
  Object.values(sampleProjects).forEach((project) => {
    const errors = lintProject(project).filter((issue) => issue.level === "error");
    assert.deepEqual(errors, []);
  });
});

test("layouts project graphs for starter and imported projects", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 900, y: 900, w: 300, title: "start", body: "Start." },
      { id: "n2", type: "choice", x: 50, y: 400, w: 340, title: "choice", prompt: "Choose.", options: [{ text: "Go", to: "n3", cond: null }] },
      { id: "n3", type: "finish", x: 20, y: 40, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const laidOut = layoutProjectGraphs(project);

  assert.deepEqual(pickPosition(laidOut.nodes.find((node) => node.id === "n1")), { x: 70, y: 70 });
  assert.ok((laidOut.nodes.find((node) => node.id === "n2")?.x ?? 0) > 70);
  assert.ok((laidOut.nodes.find((node) => node.id === "n3")?.x ?? 0) > (laidOut.nodes.find((node) => node.id === "n2")?.x ?? 0));
  assert.deepEqual(laidOut.sceneData?.intro.nodes.map(pickPosition), laidOut.nodes.map(pickPosition));
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

test("warns about gosub nodes without flow continuation", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub", x: 0, y: 0, w: 240, title: "*gosub subroutine" },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label subroutine" },
      { id: "n3", type: "return", x: 0, y: 320, w: 240, title: "*return" },
    ],
    edges: [{ from: "n2", to: "n3", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((message) => message.includes("no flow continuation")));
});

test("lints empty and invalid command targets", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "goto", x: 0, y: 0, w: 240, title: "*goto" },
      { id: "n2", type: "gosub", x: 0, y: 160, w: 240, title: "*gosub Bad Label" },
      { id: "n3", type: "goto_scene", x: 0, y: 320, w: 240, title: "*goto_scene Bad Scene", target: "Bad Scene" },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("*goto needs a label target")));
  assert.ok(errors.some((message) => message.includes("*gosub has an invalid label identifier")));
  assert.ok(errors.some((message) => message.includes("*goto_scene has an invalid scene identifier")));
});

test("lints empty and invalid input command targets", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "input_text", x: 0, y: 0, w: 280, title: "*input_text", inputVar: "" },
      { id: "n2", type: "input_number", x: 0, y: 160, w: 280, title: "*input_number Bad Score", inputVar: "Bad Score", inputMin: "1", inputMax: "10" },
      { id: "n3", type: "rand", x: 0, y: 320, w: 280, title: "*rand 1roll", inputVar: "1roll", inputMin: "1", inputMax: "6" },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("*input_text needs a variable target")));
  assert.ok(errors.some((message) => message.includes("*input_number has an invalid variable identifier")));
  assert.ok(errors.some((message) => message.includes("*rand has an invalid variable identifier")));
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

test("lints malformed achievement commands in node text", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "empty", body: "*achieve" },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "invalid", body: "*achieve Bad Id" },
      { id: "n3", type: "passage", x: 0, y: 320, w: 300, title: "missing", body: "*achieve missing_id" },
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
    achievements: [{ id: "known_id", title: "Known", points: 5, desc: "Known", preDesc: "Before", postDesc: "After" }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("*achieve needs an achievement id")));
  assert.ok(errors.some((message) => message.includes("*achieve has an invalid achievement identifier")));
  assert.ok(errors.some((message) => message.includes("*achieve uses an undeclared achievement")));
});

test("lints empty and invalid set targets", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "set", x: 0, y: 0, w: 240, title: "*set empty", sets: [{ var: "", op: "=", val: "1" }] },
      { id: "n2", type: "set", x: 0, y: 160, w: 240, title: "*set invalid", sets: [{ var: "Bad Score", op: "=", val: "1" }] },
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

  assert.ok(errors.some((message) => message.includes("*set needs a variable target")));
  assert.ok(errors.some((message) => message.includes("*set has an invalid variable identifier")));
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

test("lints invalid if branch ordering", () => {
  const graph: SceneGraph = {
    nodes: [
      {
        id: "n1",
        type: "if",
        x: 0,
        y: 0,
        w: 300,
        title: "condition",
        branches: [
          { kind: "elseif", expr: "true", to: "n2" },
          { kind: "else", to: "n3" },
          { kind: "else", to: "n4" },
          { kind: "elseif", expr: "false", to: "n5" },
        ],
      },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "a", body: "A." },
      { id: "n3", type: "passage", x: 0, y: 320, w: 300, title: "b", body: "B." },
      { id: "n4", type: "passage", x: 0, y: 480, w: 300, title: "c", body: "C." },
      { id: "n5", type: "finish", x: 0, y: 640, w: 240, title: "*finish" },
    ],
    edges: [],
  };
  const project = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("must start with an *if branch")));
  assert.ok(errors.some((message) => message.includes("multiple *else branches")));
  assert.ok(errors.some((message) => message.includes("branch after *else")));
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

function pickPosition(node: { x: number; y: number } | undefined) {
  return node ? { x: node.x, y: node.y } : undefined;
}
