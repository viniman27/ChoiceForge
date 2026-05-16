import test from "node:test";
import assert from "node:assert/strict";
import { sampleProjects } from "../src/data/sampleProject.ts";
import { computeAchievementUses, computeVariableUses, createExportPackage, generateNodeChoiceScript, generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript, lintProject } from "../src/domain/choicescript.ts";
import { layoutProjectGraphs } from "../src/domain/graphLayout.ts";
import { importChoiceScriptArchive, importChoiceScriptSceneText } from "../src/domain/choicescriptImport.ts";
import type { ChoiceForgeProject, SceneGraph, StoryNode } from "../src/domain/types.ts";

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
      "*create name \"Alex\"",
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
      "*create name \"Alex\"",
    ].join("\n")),
    textEntry("ch1.txt", [
      "*choice",
      "  #One",
      "    *set score +1",
      "  #Two",
      "    *set missing +1",
      "*set score %+ 10",
      "*set score =",
      "*set name + 1",
      "*goto_scene missing_scene",
      "*goto_scene bad-scene",
      "*if missing_condition",
      "  *finish",
      "*selectable_if (missing_choice) #Locked Door",
      "  *finish",
      "*temp local_flag false",
      "*set local_flag true",
      "*if local_flag",
      "  *finish",
      "*input_text local_flag",
      "*rand local_flag 1 2",
      "*input_text score",
      "*input_number name 1 2",
      "*rand name 1 2",
      "*input_number missing_input 10 1",
      "*rand bad-name 1 2",
      "*label helper",
      "*label helper",
      "*label bad-name",
      "*goto",
      "*gosub bad-name",
      "*save_checkpoint safe",
      "*restore_checkpoint missing",
      "*page_break",
      "*save_checkpoint",
      "*achieve",
      "*achieve bad-achievement",
      "*achieve missing_achievement",
      "*if",
      "*elseif",
      "*selectable_if #No Condition",
      "*params frag",
      "*if frag",
      "  *input_text frag",
      "  *return",
    ].join("\n")),
  ]);
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 5 && issue.msg.includes("undeclared variable: missing")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 7 && issue.msg.includes("empty value: score")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 8 && issue.msg.includes("invalid operator for string: +")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 9 && issue.msg.includes("missing scene")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 10 && issue.msg.includes("invalid scene identifier: bad-scene")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 11 && issue.msg.includes("undeclared variable: missing_condition")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 13 && issue.msg.includes("undeclared variable: missing_choice")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 21 && issue.msg.includes("*input_text requires a string variable: score")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 22 && issue.msg.includes("*input_number requires a number variable: name")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 23 && issue.msg.includes("*rand requires a number variable: name")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 24 && issue.msg.includes("undeclared variable: missing_input")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 24 && issue.msg.includes("invalid bounds: 10 1")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 25 && issue.msg.includes("invalid variable identifier")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 27 && issue.msg.includes("duplicate *label in source: helper")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 28 && issue.msg.includes("*label has an invalid identifier: bad-name")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 29 && issue.msg.includes("*goto needs a label target")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 30 && issue.msg.includes("*gosub has an invalid label identifier: bad-name")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 32 && issue.msg.includes("*restore_checkpoint \"missing\" has no matching *save_checkpoint")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 33 && issue.msg.includes("*page_break needs a button label")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 34 && issue.msg.includes("*save_checkpoint needs a checkpoint name")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 35 && issue.msg.includes("*achieve needs an achievement id")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 36 && issue.msg.includes("*achieve has an invalid achievement identifier: bad-achievement")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 37 && issue.msg.includes("*achieve uses an undeclared achievement: missing_achievement")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 38 && issue.msg.includes("*if condition is empty")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 39 && issue.msg.includes("*elseif condition is empty")));
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 40 && issue.msg.includes("*selectable_if condition is empty")));
  assert.ok(!issues.some((issue) => issue.scene === "ch1" && issue.line === 13 && issue.msg.includes("locked")));
  assert.ok(!issues.some((issue) => issue.scene === "ch1" && issue.msg.includes("local_flag")));
  assert.ok(!issues.some((issue) => issue.scene === "ch1" && issue.msg.includes("frag")));
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
      "*create name \"Alex\"",
      "*goto_scene missing_scene",
    ].join("\n")),
    textEntry("choicescript_stats.txt", [
      "*stat_chart",
      "  percent missing Missing",
      "  percent score Score",
      "  slider score Bad",
      "  text bad-name Bad",
      "  percent name Bad Percent",
      "  text score Bad Text",
      "Plain stats prose.",
    ].join("\n")),
    textEntry("ch1.txt", "Chapter one.\n*ending"),
  ]);
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 7 && issue.msg.includes("missing scene")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 1 && issue.msg.includes("preserved ChoiceScript")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 2 && issue.msg.includes("undeclared variable: missing")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 3 && issue.msg.includes("without percent stat format: score")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 4 && issue.msg.includes("invalid row type: slider")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 5 && issue.msg.includes("invalid variable identifier")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 6 && issue.msg.includes("*stat_chart percent requires a number variable: name")));
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 7 && issue.msg.includes("*stat_chart text requires a string variable: score")));
  assert.ok(!issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 8));
});

test("lintPreservedStatsSource does not flag opposed_pair label lines as invalid rows", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Pair Test",
      "*author Writer",
      "*scene_list",
      "  ch1",
      "*create courage 50",
    ].join("\n")),
    textEntry("choicescript_stats.txt", [
      "*stat_chart",
      "  opposed_pair courage",
      "    Brave",
      "    Cowardly",
    ].join("\n")),
    textEntry("ch1.txt", "Chapter one.\n*ending"),
  ]);
  const issues = lintProject(project).filter((i) => i.scene === "choicescript_stats" && i.level === "error");

  assert.equal(issues.length, 0, `unexpected stat chart errors: ${issues.map((i) => i.msg).join(", ")}`);
});

test("warns about preserved returns without gosub commands", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Return Lint",
      "*author Writer",
      "*scene_list",
      "  ch1",
    ].join("\n")),
    textEntry("ch1.txt", [
      "A stray subroutine return.",
      "*return",
    ].join("\n")),
  ]);
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 2 && issue.msg.includes("*return appears in a scene with no *gosub")));
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

test("lints preserved startup global declarations", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [
      { name: "score", type: "number", initial: "0", desc: "Score", fairmath: false },
      { name: "flag", type: "boolean", initial: "false", desc: "Flag", fairmath: false },
    ],
    achievements: [
      { id: "first", title: "First", desc: "First step", points: 10, hidden: false },
      { id: "untitled", title: "Untitled", desc: "Missing title", points: 5, hidden: false },
    ],
    startupSource: [
      "*title Globals",
      "*author Writer",
      "*scene_list",
      "  intro",
      "*create score 0",
      "*create score 1",
      "*create bad-name 0",
      "*create extra 0",
      "*create flag maybe",
      "*achievement first visible 10 First",
      "*achievement first visible 10 First Again",
      "*achievement bad-ach visible -1 Broken",
      "*achievement extra hidden 5 Extra",
      "*achievement untitled visible 5",
      "*achievement fractional visible 1.5 Fractional",
    ].join("\n"),
  };
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 6 && issue.msg.includes("repeats *create variable: score")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 7 && issue.msg.includes("invalid variable identifier")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 8 && issue.msg.includes("missing from project metadata: extra")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 9 && issue.msg.includes("invalid boolean initial value: maybe")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 11 && issue.msg.includes("repeats *achievement: first")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 12 && issue.msg.includes("invalid identifier")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 13 && issue.msg.includes("missing from project metadata: extra")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 14 && issue.msg.includes("empty title: untitled")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 15 && issue.msg.includes("invalid points: 1.5")));
});

test("lints empty preserved startup metadata", () => {
  const project = {
    ...minimalProject(),
    startupSource: [
      "*title",
      "*author",
      "*scene_list",
      "  intro",
    ].join("\n"),
  };
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 1 && issue.msg.includes("empty *title")));
  assert.ok(issues.some((issue) => issue.scene === "startup" && issue.line === 2 && issue.msg.includes("empty *author")));
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

test("lints empty visual page break labels", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "page_break", x: 0, y: 0, w: 280, title: "*page_break " },
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

  assert.ok(errors.some((message) => message.includes("*page_break needs a button label")));
});

test("lints empty visual checkpoint names", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "checkpoint", x: 0, y: 0, w: 280, title: "*save_checkpoint " },
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

  assert.ok(errors.some((message) => message.includes("*save_checkpoint needs a checkpoint name")));
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

test("lints empty project title and author", () => {
  const project = {
    ...minimalProject(),
    title: " ",
    author: "",
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("project has an empty title")));
  assert.ok(errors.some((message) => message.includes("project has an empty author")));
});

test("lints empty achievement metadata", () => {
  const project = {
    ...minimalProject(),
    achievements: [
      { id: "empty_title", title: " ", points: 5, desc: "Known", preDesc: "Locked", postDesc: "Unlocked" },
      { id: "empty_locked", title: "Locked", points: 5, desc: "", preDesc: " ", postDesc: "Unlocked" },
      { id: "empty_unlocked", title: "Unlocked", points: 5, desc: "", preDesc: "Locked", postDesc: "" },
    ],
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("achievement \"empty_title\" has an empty title")));
  assert.ok(errors.some((message) => message.includes("achievement \"empty_locked\" has an empty locked description")));
  assert.ok(errors.some((message) => message.includes("achievement \"empty_unlocked\" has an empty unlocked description")));
});

test("lints fractional achievement points", () => {
  const project = {
    ...minimalProject(),
    achievements: [
      { id: "fractional", title: "Fractional", points: 1.5, desc: "Fractional points.", preDesc: "Locked", postDesc: "Unlocked" },
    ],
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("achievement \"fractional\" has invalid points")));
});

test("lints unsafe asset metadata", () => {
  const project = {
    ...minimalProject(),
    assets: [
      { id: "logo", path: "images/logo.png", kind: "image" as const, desc: "Logo" },
      { id: "logo", path: "../outside.png", kind: "image" as const, desc: "Duplicate id and unsafe path" },
      { id: "absolute", path: "/tmp/file.png", kind: "image" as const, desc: "Absolute path" },
      { id: "windows", path: "images\\file.png", kind: "image" as const, desc: "Backslash path" },
    ],
  };
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.level === "warning" && issue.msg.includes("duplicate asset id: logo")));
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("asset \"logo\" has an unsafe export path: ../outside.png")));
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("asset \"absolute\" has an unsafe export path: /tmp/file.png")));
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("asset \"windows\" has an unsafe export path: images\\file.png")));
});

test("lints malformed asset data urls", () => {
  const project = {
    ...minimalProject(),
    assets: [
      { id: "missing_comma", path: "data/missing.txt", kind: "data" as const, desc: "Missing comma", dataUrl: "data:text/plain;base64" },
      { id: "bad_base64", path: "data/bad.txt", kind: "data" as const, desc: "Bad base64", dataUrl: "data:text/plain;base64,SGVsbG8!" },
      { id: "bad_uri", path: "data/bad-uri.txt", kind: "data" as const, desc: "Bad URI", dataUrl: "data:text/plain,%" },
    ],
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("asset \"missing_comma\" has a malformed data URL")));
  assert.ok(errors.some((message) => message.includes("asset \"bad_base64\" has invalid base64 data")));
  assert.ok(errors.some((message) => message.includes("asset \"bad_uri\" has invalid URL-encoded data")));
});

test("lints asset export path collisions", () => {
  const project = {
    ...minimalProject(),
    assets: [
      { id: "startup_asset", path: "startup.txt", kind: "data" as const, desc: "Startup collision", dataUrl: "data:text/plain;base64,SGVsbG8=" },
      { id: "scene_asset", path: "intro.txt", kind: "data" as const, desc: "Scene collision", dataUrl: "data:text/plain;base64,SGVsbG8=" },
      { id: "stats_asset", path: "choicescript_stats.txt", kind: "data" as const, desc: "Stats collision", dataUrl: "data:text/plain;base64,SGVsbG8=" },
    ],
  };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("asset \"startup_asset\" export path conflicts with a generated file: startup.txt")));
  assert.ok(errors.some((message) => message.includes("asset \"scene_asset\" export path conflicts with a generated file: intro.txt")));
  assert.ok(errors.some((message) => message.includes("asset \"stats_asset\" export path conflicts with a generated file: choicescript_stats.txt")));
});

test("lints duplicate exported asset paths", () => {
  const project = {
    ...minimalProject(),
    assets: [
      { id: "first", path: "images/shared.png", kind: "image" as const, desc: "First", dataUrl: "data:text/plain;base64,SGVsbG8=" },
      { id: "second", path: "images/shared.png", kind: "image" as const, desc: "Second", dataUrl: "data:text/plain;base64,SGVsbG8=" },
      { id: "metadata_only", path: "images/shared.png", kind: "image" as const, desc: "No data" },
    ],
  };
  const issues = lintProject(project);

  assert.ok(issues.some((issue) => issue.level === "warning" && issue.msg.includes("duplicate asset path: images/shared.png")));
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("duplicate exported asset path: images/shared.png")));
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

test("generates *gosub_scene command with optional entry label", () => {
  const base: StoryNode = { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene chapter_two", target: "chapter_two" };
  const withLabel: StoryNode = { ...base, body: "subroutine_start" };

  assert.match(generateNodeChoiceScript(base), /\*gosub_scene chapter_two\b/);
  assert.ok(!generateNodeChoiceScript(base).includes("undefined"));
  assert.match(generateNodeChoiceScript(withLabel), /\*gosub_scene chapter_two subroutine_start/);
});

test("generates *image command with alignment and optional alt text", () => {
  const noAlt: StoryNode = { id: "n1", type: "image", x: 0, y: 0, w: 280, title: "*image", target: "lighthouse.jpg", inputMin: "left" };
  const withAlt: StoryNode = { id: "n2", type: "image", x: 0, y: 0, w: 280, title: "*image", target: "coast.jpg", inputMin: "none", prompt: "Coastal view" };
  const emptyFile: StoryNode = { id: "n3", type: "image", x: 0, y: 0, w: 280, title: "*image", target: "", inputMin: "none" };

  assert.match(generateNodeChoiceScript(noAlt), /\*image lighthouse\.jpg left/);
  assert.match(generateNodeChoiceScript(withAlt), /\*image coast\.jpg none Coastal view/);
  assert.ok(!generateNodeChoiceScript(emptyFile).includes("*image"));
});

test("lints gosub_scene nodes with missing and invalid scene targets", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene", target: "" },
      { id: "n2", type: "gosub_scene", x: 0, y: 160, w: 280, title: "*gosub_scene Bad Scene", target: "Bad Scene" },
      { id: "n3", type: "gosub_scene", x: 0, y: 320, w: 280, title: "*gosub_scene missing_scene", target: "missing_scene" },
      { id: "n4", type: "finish", x: 0, y: 480, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n4", kind: "flow" },
      { from: "n2", to: "n4", kind: "flow" },
      { from: "n3", to: "n4", kind: "flow" },
    ],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const errors = lintProject(project).filter((issue) => issue.level === "error").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("*gosub_scene needs a scene target")));
  assert.ok(errors.some((message) => message.includes("*gosub_scene has an invalid scene identifier")));
  assert.ok(errors.some((message) => message.includes("*gosub_scene points to a missing scene")));
});

test("warns about gosub_scene nodes without flow continuation", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene intro", target: "intro" },
    ],
    edges: [],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((message) => message.includes("no flow continuation")));
});

test("warns about image nodes with missing filename", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "image", x: 0, y: 0, w: 280, title: "*image", target: "", inputMin: "none" },
    ],
    edges: [],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((message) => message.includes("*image needs a filename")));
});

test("warns when a passage node exceeds 600 words", () => {
  const longBody = Array(601).fill("word").join(" ");
  const shortBody = Array(600).fill("word").join(" ");
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "long", body: longBody },
      { id: "n2", type: "passage", x: 0, y: 200, w: 300, title: "exact", body: shortBody },
      { id: "n3", type: "finish", x: 0, y: 400, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((msg) => msg.includes("long") && msg.includes("601 words")));
  assert.ok(!warnings.some((msg) => msg.includes("exact") && msg.includes("words")));
});

test("counts variable uses across nodes, conditions, and sets", () => {
  const graph = {
    nodes: [
      { id: "n1", type: "passage" as const, x: 0, y: 0, w: 300, title: "p1", body: "Hello ${courage}." },
      {
        id: "n2", type: "choice" as const, x: 0, y: 160, w: 340, title: "c1", prompt: "Choose.",
        options: [
          { text: "Fight", to: "n3", cond: { type: "if" as const, expr: "courage > 50" }, sets: [{ var: "courage", op: "+" as const, val: "10" }] },
        ],
      },
      { id: "n3", type: "set" as const, x: 0, y: 320, w: 240, title: "*set name", sets: [{ var: "name", op: "=" as const, val: "\"Alex\"" }] },
      { id: "n4", type: "finish" as const, x: 0, y: 480, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" as const }],
  };
  const project = {
    ...minimalProject(),
    variables: [
      { name: "courage", type: "number" as const, initial: "50", desc: "Courage", uses: 0, fairmath: false },
      { name: "name", type: "string" as const, initial: "\"Hero\"", desc: "Name", uses: 0 },
      { name: "unused", type: "boolean" as const, initial: "false", desc: "Unused", uses: 0 },
    ],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const uses = computeVariableUses(project);

  assert.equal(uses.get("courage"), 3); // body ref + condition + set
  assert.equal(uses.get("name"), 1);    // set only
  assert.equal(uses.get("unused"), 0);  // never referenced
});

test("counts variable uses in preserved source text", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "courage", type: "number" as const, initial: "50", desc: "Courage", uses: 0, fairmath: false },
      { name: "name", type: "string" as const, initial: "\"Hero\"", desc: "Name", uses: 0 },
    ],
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: [
          "*if courage > 40",
          "  Good, ${name}!",
          "*set courage + 5",
        ].join("\n"),
      },
    },
  };
  const uses = computeVariableUses(project);

  assert.equal(uses.get("courage"), 2); // *if condition + *set target
  assert.equal(uses.get("name"), 1);    // body interpolation
});

test("imports gosub_scene and image command nodes", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*gosub_scene chapter_two intro_label",
    "Continuing after gosub.",
    "*finish",
    "*image lighthouse.jpg left A lighthouse on a cliff",
    "*finish",
  ].join("\n"));

  const gosubScene = graph.nodes.find((node) => node.type === "gosub_scene");
  const imageNode = graph.nodes.find((node) => node.type === "image");

  assert.ok(gosubScene);
  assert.equal(gosubScene?.target, "chapter_two");
  assert.equal(gosubScene?.body, "intro_label");
  assert.equal(gosubScene?.title, "*gosub_scene chapter_two");
  assert.equal(gosubScene?.w, 280);

  assert.ok(imageNode);
  assert.equal(imageNode?.target, "lighthouse.jpg");
  assert.equal(imageNode?.inputMin, "left");
  assert.equal(imageNode?.prompt, "A lighthouse on a cliff");
  assert.equal(imageNode?.w, 280);
});

test("normalizes edited gosub_scene and image command nodes on re-import", () => {
  const currentGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene old_scene", target: "old_scene" },
      { id: "n2", type: "image", x: 0, y: 160, w: 280, title: "*image old.jpg", target: "old.jpg", inputMin: "left" },
    ],
    edges: [],
  };
  const graph = importChoiceScriptSceneText("scene", [
    "*label cf_n1",
    "*gosub_scene New-Scene entry_point",
    "",
    "*label cf_n2",
    "*image new.jpg right Coast",
  ].join("\n"), currentGraph);

  const gosub = graph.nodes.find((node) => node.id === "n1");
  const image = graph.nodes.find((node) => node.id === "n2");

  assert.equal(gosub?.target, "new_scene");
  assert.equal(gosub?.title, "*gosub_scene new_scene");
  assert.equal(gosub?.body, "entry_point");
  assert.equal(image?.target, "new.jpg");
  assert.equal(image?.inputMin, "right");
  assert.equal(image?.prompt, "Coast");
});

test("lints gosub_scene and image in preserved script source", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: [
          "*gosub_scene",
          "*gosub_scene Bad Scene",
          "*gosub_scene missing_scene",
          "*image",
        ].join("\n"),
      },
    },
  };
  const issues = lintProject(project);
  const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.msg);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(errors.some((message) => message.includes("*gosub_scene needs a scene target")));
  assert.ok(errors.some((message) => message.includes("*gosub_scene has an invalid scene identifier")));
  assert.ok(errors.some((message) => message.includes("*gosub_scene points to a missing scene")));
  assert.ok(warnings.some((message) => message.includes("*image needs a filename")));
});

test("lintSceneReachability warns on unreachable scenes", () => {
  const makeGraph = (nodes: { id: string; type: string; target?: string }[]): SceneGraph => ({
    nodes: nodes.map((n) => ({ ...n, x: 0, y: 0, w: 240, title: n.type })) as StoryNode[],
    edges: [],
  });
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 1, current: true },
      { id: "scene2", name: "scene2", words: 0, nodes: 1 },
      { id: "scene3", name: "scene3", words: 0, nodes: 1 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: {
      intro: makeGraph([{ id: "n1", type: "goto_scene", target: "scene2" }]),
      scene2: makeGraph([{ id: "n2", type: "ending" }]),
      scene3: makeGraph([{ id: "n3", type: "ending" }]),
    },
    sceneTitle: "intro",
  };
  const issues = lintProject(project);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.msg);
  assert.ok(warnings.some((message) => message.includes('"scene3" has no incoming connections')));
  assert.ok(!warnings.some((message) => message.includes('"intro" has no incoming connections')));
  assert.ok(!warnings.some((message) => message.includes('"scene2" has no incoming connections')));
});

test("lintSceneReachability does not warn when all scenes are reachable via finish chain", () => {
  const makeGraph = (nodes: { id: string; type: string }[]): SceneGraph => ({
    nodes: nodes.map((n) => ({ ...n, x: 0, y: 0, w: 240, title: n.type })) as StoryNode[],
    edges: [],
  });
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "ch1", name: "ch1", words: 0, nodes: 1, current: true },
      { id: "ch2", name: "ch2", words: 0, nodes: 1 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: {
      ch1: makeGraph([{ id: "n1", type: "finish" }]),
      ch2: makeGraph([{ id: "n2", type: "finish" }]),
    },
    sceneTitle: "ch1",
  };
  const issues = lintProject(project);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.msg);
  assert.ok(!warnings.some((message) => message.includes("has no incoming connections")));
});

test("computeAchievementUses counts *achieve commands in node bodies", () => {
  const n1: StoryNode = { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "s", body: "*achieve brave\nSome text.\n*achieve brave" };
  const n2: StoryNode = { id: "n2", type: "passage", x: 0, y: 0, w: 300, title: "s", body: "*achieve clever" };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [
      { id: "brave", title: "Brave", desc: "desc", points: 10 },
      { id: "clever", title: "Clever", desc: "desc", points: 10 },
      { id: "unused", title: "Unused", desc: "desc", points: 10 },
    ],
    nodes: [n1, n2],
    edges: [],
    sceneData: { intro: { nodes: [n1, n2], edges: [] } },
  };
  const uses = computeAchievementUses(project);
  assert.equal(uses.get("brave"), 2);
  assert.equal(uses.get("clever"), 1);
  assert.equal(uses.get("unused"), 0);
});

test("computeAchievementUses counts *achieve in preserved source text", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [
      { id: "hero", title: "Hero", desc: "desc", points: 50 },
      { id: "ghost", title: "Ghost", desc: "desc", points: 5 },
    ],
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "*achieve hero\nSome prose.\n*achieve hero\n*achieve ghost",
      },
    },
    nodes: [],
    edges: [],
  };
  const uses = computeAchievementUses(project);
  assert.equal(uses.get("hero"), 2);
  assert.equal(uses.get("ghost"), 1);
});

test("generates *temp command with variable name and initial value", () => {
  const node: StoryNode = { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp score", inputVar: "score", body: "0" };
  assert.equal(generateNodeChoiceScript(node), "*label cf_n1\n*temp score 0");
});

test("generates *temp command with string initial value", () => {
  const node: StoryNode = { id: "n2", type: "temp", x: 0, y: 0, w: 280, title: "*temp greeting", inputVar: "greeting", body: "Hello there" };
  assert.equal(generateNodeChoiceScript(node), "*label cf_n2\n*temp greeting Hello there");
});

test("lints temp node with empty variable name as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp", inputVar: "", body: "0" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp", inputVar: "", body: "0" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  const errors = issues.filter((issue) => issue.level === "error").map((issue) => issue.msg);
  assert.ok(errors.some((message) => message.includes("*temp has an invalid variable identifier")));
});

test("lints temp node that shadows a global variable as warning", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "health", type: "number", initial: "100", fairmath: false, desc: "" }],
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp health", inputVar: "health", body: "0" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp health", inputVar: "health", body: "0" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.msg);
  assert.ok(warnings.some((message) => message.includes("*temp shadows a global variable: health")));
});

test("temp variable does not cause false undeclared-variable warnings", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp local_score", inputVar: "local_score", body: "0" },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "passage", body: "Your score is ${local_score}." },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp local_score", inputVar: "local_score", body: "0" },
          { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "passage", body: "Your score is ${local_score}." },
          { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
        ],
        edges: [
          { from: "n1", to: "n2", kind: "flow" },
          { from: "n2", to: "n3", kind: "flow" },
        ],
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((issue) => issue.level === "warning").map((issue) => issue.msg);
  assert.ok(!warnings.some((message) => message.includes("local_score")));
});

test("imports *temp lines as temp nodes with variable name and initial value", () => {
  const graph = importChoiceScriptSceneText("intro", [
    "*label cf_n1",
    "*temp score 0",
    "*goto cf_n2",
    "*label cf_n2",
    "*finish",
  ].join("\n"));
  const tempNode = graph.nodes.find((node) => node.type === "temp");
  assert.ok(tempNode, "temp node should be imported");
  assert.equal(tempNode?.inputVar, "score");
  assert.equal(tempNode?.body, "0");
  assert.equal(tempNode?.w, 280);
});

test("generates *params command from params node body", () => {
  const node: StoryNode = { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params target amount", body: "target amount" };
  const code = generateNodeChoiceScript(node, []);
  assert.ok(code.includes("*params target amount"));
});

test("generates no *params line when params node body is empty", () => {
  const node: StoryNode = { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params", body: "" };
  const code = generateNodeChoiceScript(node, []);
  assert.ok(!code.includes("*params"));
});

test("lints params node with no parameter names as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params", body: "" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params", body: "" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("*params has no parameter names")));
});

test("lints params node with invalid identifier as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params 1bad", body: "1bad" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params 1bad", body: "1bad" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("invalid parameter identifier")));
});

test("lints params node with duplicate parameter names as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params x x", body: "x x" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params x x", body: "x x" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((issue) => issue.level === "error" && issue.msg.includes("duplicate parameter name: x")));
});

test("lints params node that shadows a global variable as warning", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "gold", type: "number", initial: "0", fairmath: false, desc: "" }],
    nodes: [
      { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params gold", body: "gold" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params gold", body: "gold" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((issue) => issue.level === "warning" && issue.msg.includes("*params shadows a global variable: gold")));
});

test("params variable does not cause false undeclared-variable warnings", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params received", body: "received" },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "passage", body: "You got ${received}." },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 280, title: "*params received", body: "received" },
          { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "passage", body: "You got ${received}." },
          { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
        ],
        edges: [
          { from: "n1", to: "n2", kind: "flow" },
          { from: "n2", to: "n3", kind: "flow" },
        ],
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((issue) => issue.msg.includes("received")));
});

test("imports standalone *params lines as params nodes", () => {
  const graph = importChoiceScriptSceneText("sub", "*params target amount");
  const paramsNode = graph.nodes.find((node) => node.type === "params");
  assert.ok(paramsNode, "params node should be imported");
  assert.equal(paramsNode?.body, "target amount");
  assert.equal(paramsNode?.w, 280);
});

test("warns when @{} substitution references an undeclared variable", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "sub", body: "You are @{strength strong weak}." },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((msg) => msg.includes("strength") && msg.includes("undeclared")));
});

test("does not warn when @{} substitution references a declared variable", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "sub", body: "You are @{strength strong weak}." },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = {
    ...minimalProject(),
    variables: [{ name: "strength", type: "number" as const, initial: "50", desc: "Strength", fairmath: false, uses: 0 }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(!warnings.some((msg) => msg.includes("strength")));
});

test("generateStatsChoiceScript emits opposed_pair for variables with opposedLow set", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "courage", type: "number" as const, initial: "50", desc: "Brave", fairmath: false, uses: 0, opposedLow: "Cowardly" },
    ],
  };
  const stats = generateStatsChoiceScript(project);

  assert.ok(stats.includes("opposed_pair courage"), "should emit opposed_pair row");
  assert.ok(stats.includes("    Brave"), "should include high label");
  assert.ok(stats.includes("    Cowardly"), "should include low label");
  assert.ok(!stats.includes("text courage"), "should not emit text row");
  assert.ok(!stats.includes("percent courage"), "should not emit percent row");
});

test("generateStatsChoiceScript uses variable name as fallback when opposedLow is empty string", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "mood", type: "number" as const, initial: "50", desc: "Happy", fairmath: false, uses: 0, opposedLow: "" },
    ],
  };
  const stats = generateStatsChoiceScript(project);

  assert.ok(stats.includes("opposed_pair mood"), "should emit opposed_pair row");
  assert.ok(stats.includes("    Happy"), "should include desc as high label");
  assert.ok(stats.includes("    Mood"), "should use variable name as low label fallback");
});

test("importChoiceScriptArchive maps opposed_pair stat chart entries to opposedLow and desc", () => {
  const project = importChoiceScriptArchive([
    textEntry("mygame/startup.txt", [
      "*title Test",
      "*author Author",
      "*scene_list",
      "  startup",
      "*create courage 50",
      "*create name \"Alex\"",
      "*finish",
    ].join("\n")),
    textEntry("mygame/choicescript_stats.txt", [
      "*stat_chart",
      "  opposed_pair courage",
      "    Brave",
      "    Cowardly",
      "  text name Player Name",
    ].join("\n")),
  ]);

  const courage = project.variables.find((v) => v.name === "courage");
  const name = project.variables.find((v) => v.name === "name");

  assert.equal(courage?.desc, "Brave", "high label maps to desc");
  assert.equal(courage?.opposedLow, "Cowardly", "low label maps to opposedLow");
  assert.equal(courage?.fairmath, false, "opposed_pair clears fairmath");
  assert.equal(name?.opposedLow, undefined, "text row clears opposedLow");
  assert.equal(name?.desc, "Player Name", "text row maps label to desc");
});

test("generateStatsChoiceScript excludes variables with showInStats false", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "score", type: "number" as const, initial: "0", desc: "Score", fairmath: false, uses: 0 },
      { name: "internal", type: "number" as const, initial: "0", desc: "Internal", fairmath: false, uses: 0, showInStats: false },
      { name: "name", type: "string" as const, initial: '""', desc: "Name", fairmath: false, uses: 0 },
    ],
  };
  const stats = generateStatsChoiceScript(project);

  assert.ok(stats.includes("text score"), "score should appear in stat chart");
  assert.ok(stats.includes("text name"), "name should appear in stat chart");
  assert.ok(!stats.includes("internal"), "internal should be excluded from stat chart");
});

test("generateStatsChoiceScript omits stat_chart block when all variables are hidden", () => {
  const project = {
    ...minimalProject(),
    variables: [
      { name: "flag", type: "boolean" as const, initial: "false", desc: "Flag", fairmath: false, uses: 0, showInStats: false },
    ],
  };
  const stats = generateStatsChoiceScript(project);

  assert.ok(!stats.includes("*stat_chart"), "stat_chart block should be absent when all variables are hidden");
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
