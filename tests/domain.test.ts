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

test("imports *selectable_if and reuse-mode option prefixes from choice blocks", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  *selectable_if (courage > 10) #Brave option",
    "    You are brave.",
    "    *finish",
    "  *hide_reuse #Hide after use",
    "    Hidden.",
    "    *finish",
    "  *disable_reuse #Disable after use",
    "    Disabled.",
    "    *finish",
    "  *allow_reuse #Always available",
    "    Always.",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((node) => node.type === "choice");
  assert.ok(choice, "choice node should be imported");
  assert.equal(choice?.options?.length, 4);
  const selectableOpt = choice?.options?.[0];
  assert.equal(selectableOpt?.cond?.type, "selectable_if");
  assert.equal(selectableOpt?.cond?.expr, "courage > 10");
  assert.equal(selectableOpt?.text, "Brave option");
  const hideOpt = choice?.options?.[1];
  assert.equal(hideOpt?.reuse, "hide");
  assert.equal(hideOpt?.text, "Hide after use");
  const disableOpt = choice?.options?.[2];
  assert.equal(disableOpt?.reuse, "disable");
  assert.equal(disableOpt?.text, "Disable after use");
  const allowOpt = choice?.options?.[3];
  assert.equal(allowOpt?.reuse, "allow");
  assert.equal(allowOpt?.text, "Always available");
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

test("imports *achievement declarations from startup.txt into project achievements", () => {
  const project = importChoiceScriptArchive([
    textEntry("mygame/startup.txt", [
      "*title Hero's Journey",
      "*author Dev",
      "*achievement first_blood visible 10 First Blood",
      "  Kill your first enemy.",
      "  You have vanquished a foe.",
      "*achievement secret_ending hidden 50 True Ending",
      "  Find the secret path.",
      "  You found the true ending.",
      "*scene_list",
      "  startup",
    ].join("\n")),
  ]);

  assert.equal(project.achievements.length, 2);
  const fb = project.achievements.find((a) => a.id === "first_blood");
  assert.ok(fb, "first_blood achievement should be imported");
  assert.equal(fb?.title, "First Blood");
  assert.equal(fb?.points, 10);
  assert.equal(fb?.hidden, false);
  assert.equal(fb?.preDesc, "Kill your first enemy.");
  assert.equal(fb?.postDesc, "You have vanquished a foe.");
  const se = project.achievements.find((a) => a.id === "secret_ending");
  assert.ok(se, "secret_ending achievement should be imported");
  assert.equal(se?.points, 50);
  assert.equal(se?.hidden, true);
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
  assert.ok(issues.some((issue) => issue.scene === "ch1" && issue.line === 24 && issue.msg.includes("min bound") && issue.msg.includes("exceeds")));
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
  assert.ok(issues.some((issue) => issue.scene === "choicescript_stats" && issue.line === 7 && issue.msg.includes("raw number")));
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

test("warns about restore checkpoints without matching saves anywhere in the project", () => {
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

test("does not warn when restore_checkpoint slot is saved in a different scene", () => {
  const base = minimalProject();
  const scene1: SceneGraph = {
    nodes: [
      { id: "n1", type: "checkpoint", x: 0, y: 0, w: 280, title: "*save_checkpoint fight" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const scene2: SceneGraph = {
    nodes: [
      { id: "n1", type: "restore_checkpoint", x: 0, y: 0, w: 280, title: "*restore_checkpoint fight" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...base,
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "s1", name: "s1", words: 0, nodes: 2 },
      { id: "s2", name: "s2", words: 0, nodes: 2, current: true },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    nodes: scene2.nodes,
    edges: scene2.edges,
    sceneData: { s1: scene1, s2: scene2 },
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "restore_no_save"), "cross-scene checkpoint save should suppress the warning");
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

test("generateStartupChoiceScript always goto_scenes the first playable scene regardless of active scene", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 1 },
      { id: "chapter_2", name: "chapter_2", words: 0, nodes: 1 },
      { id: "epilogue", name: "epilogue", words: 0, nodes: 1 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneTitle: "epilogue",
  };
  const startup = generateStartupChoiceScript(project);
  assert.ok(startup.includes("*goto_scene intro"), "should go to first playable scene, not the active editor scene");
  assert.ok(!startup.includes("*goto_scene epilogue"), "should not use the active editor scene as the jump target");
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

test("warns when a *choice node has only one option", () => {
  const graph: SceneGraph = {
    nodes: [
      {
        id: "n1",
        type: "choice",
        x: 0, y: 0, w: 340,
        title: "single_option_choice",
        prompt: "Choose.",
        options: [{ text: "Only option", to: "n2", cond: null }],
      },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "choice" }],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((i) => i.level === "warning").map((i) => i.msg);

  assert.ok(warnings.some((msg) => msg.includes("only one option") && msg.includes("single_option_choice")));
});

test("importChoiceScriptArchive maps *comment before *create to variable desc", () => {
  const project = importChoiceScriptArchive([
    textEntry("mygame/startup.txt", [
      "*title Test",
      "*author Author",
      "*scene_list",
      "  startup",
      "*comment Player courage (0-100)",
      "*create courage 50",
      "*create name \"Alex\"",
      "*finish",
    ].join("\n")),
  ]);

  const courage = project.variables.find((v) => v.name === "courage");
  const name = project.variables.find((v) => v.name === "name");

  assert.equal(courage?.desc, "Player courage (0-100)", "comment becomes variable desc");
  assert.equal(name?.desc, "name", "variable without preceding comment uses its name as desc");
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

test("warns when gosub_scene target scene has no *return node", () => {
  const callerGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene helper", target: "helper" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const helperGraph: SceneGraph = {
    nodes: [{ id: "n1", type: "passage", x: 0, y: 0, w: 240, title: "helper body", body: "Helper text." }],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "helper", name: "helper", words: 0, nodes: 1 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: { intro: callerGraph, helper: helperGraph },
    sceneTitle: "intro",
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning").map((i) => i.msg);
  assert.ok(warnings.some((m) => m.includes('scene "helper"') && m.includes("no *return")));
});

test("does not warn when gosub_scene target scene has a *return node", () => {
  const callerGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene helper", target: "helper" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const helperGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 240, title: "helper body", body: "Helper text." },
      { id: "n2", type: "return", x: 0, y: 160, w: 240, title: "*return" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "helper", name: "helper", words: 0, nodes: 2 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: { intro: callerGraph, helper: helperGraph },
    sceneTitle: "intro",
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("no *return")).map((i) => i.msg);
  assert.equal(warnings.length, 0);
});

test("warns when gosub_scene target is a preserved source scene with no *return", () => {
  const callerGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene helper", target: "helper" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "helper", name: "helper", words: 0, nodes: 0 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: {
      intro: callerGraph,
      helper: { nodes: [], edges: [], sourceText: "Some helper prose.\n*finish" },
    },
    sceneTitle: "intro",
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("no *return")).map((i) => i.msg);
  assert.ok(warnings.some((m) => m.includes('scene "helper"')));
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

test("generates *sound command with filename", () => {
  const node: StoryNode = { id: "n1", type: "sound", x: 0, y: 0, w: 280, title: "*sound theme.mp3", target: "theme.mp3" };
  const code = generateNodeChoiceScript(node, []);
  assert.ok(code.includes("*sound theme.mp3"), "should emit *sound with filename");
});

test("skips *sound command when filename is empty", () => {
  const node: StoryNode = { id: "n1", type: "sound", x: 0, y: 0, w: 280, title: "*sound", target: "" };
  const code = generateNodeChoiceScript(node, []);
  assert.ok(!code.includes("*sound "), "should not emit *sound with empty filename");
});

test("warns about sound nodes with missing filename", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "sound", x: 0, y: 0, w: 280, title: "*sound", target: "" },
    ],
    edges: [],
  };
  const project = { ...minimalProject(), nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((issue) => issue.level === "warning").map((issue) => issue.msg);

  assert.ok(warnings.some((message) => message.includes("*sound needs a filename")));
});

test("warns when image node references unknown asset when project has assets", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "image", x: 0, y: 0, w: 280, title: "*image ghost.png", target: "ghost.png", inputMin: "none" },
    ],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    assets: [{ id: "hero", path: "images/hero.png", kind: "image", desc: "hero", fileName: "hero.png" }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("unknown asset")).map((i) => i.msg);
  assert.ok(warnings.some((m) => m.includes("ghost.png")));
});

test("does not warn when image node references a known asset by filename", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "image", x: 0, y: 0, w: 280, title: "*image hero.png", target: "hero.png", inputMin: "none" },
    ],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    assets: [{ id: "hero", path: "images/hero.png", kind: "image", desc: "hero", fileName: "hero.png" }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("unknown asset")).map((i) => i.msg);
  assert.equal(warnings.length, 0);
});

test("does not warn when project has no assets (image_unknown only fires when assets are registered)", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "image", x: 0, y: 0, w: 280, title: "*image external.png", target: "external.png", inputMin: "none" },
    ],
    edges: [],
  };
  const project = { ...minimalProject(), assets: [], nodes: graph.nodes, edges: graph.edges, sceneData: { intro: graph } };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("unknown asset")).map((i) => i.msg);
  assert.equal(warnings.length, 0);
});

test("warns when preserved source *image references unknown asset", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    assets: [{ id: "hero", path: "images/hero.png", kind: "image", desc: "hero", fileName: "hero.png" }],
    sceneData: {
      intro: { nodes: [], edges: [], sourceText: "*image ghost.png\nSome text." },
    },
  };
  const warnings = lintProject(project).filter((i) => i.level === "warning" && i.msg.includes("unknown asset")).map((i) => i.msg);
  assert.ok(warnings.some((m) => m.includes("ghost.png")));
});

test("imports *sound lines as sound nodes", () => {
  const graph = importChoiceScriptSceneText("intro", [
    "*label cf_n1",
    "*sound theme.mp3",
    "*goto cf_n2",
    "*label cf_n2",
    "*finish",
  ].join("\n"));
  const soundNode = graph.nodes.find((node) => node.type === "sound");
  assert.ok(soundNode, "sound node should be imported");
  assert.equal(soundNode?.target, "theme.mp3");
  assert.equal(soundNode?.title, "*sound theme.mp3");
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

test("preserved source: prose with declared global var does not trigger undef_var warning", () => {
  const project = {
    ...minimalProject(),
    variables: [{ name: "hero_name", type: "string" as const, initial: "Hero" }],
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "Hello, ${hero_name}!\nAnother line.",
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((i) => i.level === "warning" && i.msg.includes("undeclared variable"));
  assert.equal(warnings.length, 0);
});

test("preserved source: prose with undeclared var triggers undef_var warning", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "Hello, ${ghost_name}!\nAnother line with @{shadow choice1 choice2}.",
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((i) => i.level === "warning" && i.msg.includes("undeclared variable"));
  assert.ok(warnings.some((w) => w.msg.includes("ghost_name")));
  assert.ok(warnings.some((w) => w.msg.includes("shadow")));
});

test("preserved source: prose referencing a *temp declared later in the file does not trigger undef_var", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "Your name is ${player_name}.\n*temp player_name Hero",
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((i) => i.level === "warning" && i.msg.includes("undeclared variable"));
  assert.equal(warnings.length, 0);
});

test("preserved source: *comment lines do not trigger undef_var for interpolation-like text", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "*comment ${internal_note} not linted\n*temp internal_note 0",
      },
    },
  };
  const issues = lintProject(project);
  const warnings = issues.filter((i) => i.level === "warning" && i.msg.includes("undeclared variable"));
  assert.equal(warnings.length, 0, "command lines should not be scanned for prose variable references");
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

test("generates *goto for false path of *if node without *else when flow edge exists", () => {
  const node: StoryNode = {
    id: "n2", type: "if", x: 0, y: 160, w: 280, title: "*if courage > 50",
    branches: [{ kind: "if", expr: "courage > 50", to: "n3" }],
  };
  const edges: StoryEdge[] = [{ from: "n2", to: "n4", kind: "flow" }];
  const cs = generateNodeChoiceScript(node, edges);
  assert.ok(cs.includes("*if (courage > 50)"), "should include the if condition");
  assert.ok(cs.includes("*goto cf_n3"), "should goto true branch");
  assert.ok(cs.includes("*goto cf_n4"), "should goto false-path continuation via flow edge");
});

test("does not generate extra *goto for *if node with *else branch", () => {
  const node: StoryNode = {
    id: "n2", type: "if", x: 0, y: 160, w: 280, title: "*if courage > 50",
    branches: [
      { kind: "if", expr: "courage > 50", to: "n3" },
      { kind: "else", to: "n4" },
    ],
  };
  const edges: StoryEdge[] = [{ from: "n2", to: "n5", kind: "flow" }];
  const cs = generateNodeChoiceScript(node, edges);
  assert.ok(cs.includes("*if (courage > 50)"), "should include the if condition");
  assert.ok(cs.includes("*else"), "should include else branch");
  assert.ok(!cs.includes("cf_n5"), "should NOT generate goto for flow edge when else exists");
});

test("lints *set value that references an undeclared variable", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "score", type: "number", initial: "0", desc: "Score", fairmath: false }],
    nodes: [
      { id: "n1", type: "set", x: 0, y: 0, w: 280, title: "*set score", sets: [{ var: "score", op: "=", val: "ghost_var + 10" }] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  project.sceneData = { intro: { nodes: project.nodes, edges: project.edges } };
  const issues = lintProject(project);

  assert.ok(issues.some((i) => i.scene === "intro" && i.level === "warning" && i.msg.includes("undeclared variable: ghost_var")));
});

test("does not warn when *set value references a declared variable", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [
      { name: "score", type: "number", initial: "0", desc: "Score", fairmath: false },
      { name: "bonus", type: "number", initial: "0", desc: "Bonus", fairmath: false },
    ],
    nodes: [
      { id: "n1", type: "set", x: 0, y: 0, w: 280, title: "*set score", sets: [{ var: "score", op: "=", val: "bonus + 10" }] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  project.sceneData = { intro: { nodes: project.nodes, edges: project.edges } };
  const issues = lintProject(project);

  assert.ok(!issues.some((i) => i.level === "warning" && i.msg.includes("undeclared variable: bonus")));
});

test("lints *gosub_scene entry label that does not exist in target scene", () => {
  const targetGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "label", x: 0, y: 0, w: 240, title: "*label real_sub" },
      { id: "n2", type: "return", x: 0, y: 160, w: 240, title: "*return" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "sub", name: "sub", words: 0, nodes: 2 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene sub missing_sub", target: "sub", body: "missing_sub" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {
      intro: { nodes: [], edges: [] },
      sub: targetGraph,
    },
  };
  project.sceneData!.intro = { nodes: project.nodes, edges: project.edges };
  const issues = lintProject(project);

  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes('entry label "missing_sub" not found in scene sub')));
});

test("warns when a variable is declared but never read", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "set", x: 0, y: 0, w: 280, title: "*set courage", sets: [{ var: "courage", op: "=", val: "50" }] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "courage", type: "number", initial: "50", desc: "Courage", fairmath: false, showInStats: false }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes('"courage"') && i.msg.includes("never read")));
});

test("does not warn when variable is read in a condition", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "set", x: 0, y: 0, w: 280, title: "*set courage", sets: [{ var: "courage", op: "=", val: "50" }] },
      {
        id: "n2",
        type: "choice",
        x: 0, y: 160, w: 340,
        title: "choice",
        prompt: "Choose.",
        options: [{ text: "Bold move", to: "n3", cond: { type: "if", expr: "courage > 40" } }],
      },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "courage", type: "number", initial: "50", desc: "Courage", fairmath: false, showInStats: false }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  assert.ok(!lintProject(project).some((i) => i.msg.includes('"courage"') && i.msg.includes("never read")));
});

test("does not warn about unused variable when it is shown in the stats screen", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Begin." },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "strength", type: "number", initial: "50", desc: "Strength", fairmath: false }],
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  assert.ok(!lintProject(project).some((i) => i.msg.includes('"strength"') && i.msg.includes("never read")));
});

test("imports inline fake_choice option bodies onto fakeOptions", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*fake_choice",
    "  #You look at the painting",
    "    A swirling landscape in dark oils.",
    "  #You look at the statue",
    "    Cold marble, a warrior mid-stride.",
    "After the gallery.",
  ].join("\n"));
  const fc = graph.nodes.find((node) => node.type === "fake_choice");
  assert.ok(fc, "fake_choice node should be created");
  assert.equal(fc?.fakeOptions?.length, 2);
  assert.equal(fc?.fakeOptions?.[0]?.body, "A swirling landscape in dark oils.");
  assert.equal(fc?.fakeOptions?.[1]?.body, "Cold marble, a warrior mid-stride.");
  assert.ok(!graph.nodes.some((node) => node.title === "choice_option_body"));
});

test("inlines pure prose body text directly onto choice options", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Open the door",
    "    You open it carefully.",
    "  #Leave",
    "    You walk away.",
    "After the choice.",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((node) => node.type === "choice");
  assert.ok(choice);
  assert.equal(choice.options?.[0]?.body, "You open it carefully.");
  assert.equal(choice.options?.[1]?.body, "You walk away.");
  assert.ok(!graph.nodes.some((node) => node.title === "choice_option_body"));
});

test("generates option body text inline between header and goto", () => {
  const node: StoryNode = {
    id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choice",
    prompt: "Choose:",
    options: [
      { text: "Open the door", to: "n2", body: "You push it open.\nThe room is dark." },
      { text: "Leave", to: "n3" },
    ],
  };
  const cs = generateNodeChoiceScript(node);
  assert.ok(cs.includes("  #Open the door\n    You push it open.\n    The room is dark.\n    *goto"));
  assert.ok(cs.includes("  #Leave\n    *goto"));
});

test("generates fake_choice option body text inline between header and next option", () => {
  const node: StoryNode = {
    id: "n1", type: "fake_choice", x: 0, y: 0, w: 360, title: "fake_choice",
    prompt: "What do you see?",
    fakeOptions: [
      { text: "The door", body: "A heavy oak door." },
      { text: "The window" },
    ],
  };
  const cs = generateNodeChoiceScript(node);
  assert.ok(cs.includes("  #The door\n    A heavy oak door."));
  assert.ok(cs.includes("  #The window"));
  assert.ok(!cs.includes("*goto"));
});

test("lints undeclared variable in choice option body", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        options: [{ text: "Go", to: "n2", body: "Your strength is ${undeclared_var}." }] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.msg.includes("undeclared variable") && i.msg.includes("undeclared_var")));
});

test("does not flag unused variable that is only used in option body", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "strength", type: "number", initial: "50", desc: "", fairmath: false }],
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        options: [{ text: "Go", to: "n2", body: "Your strength is ${strength}." }] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes('"strength"') && i.msg.includes("never read")));
});

test("lints undeclared variable in choice option text", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        options: [
          { text: "Ask about ${ghost_topic}.", to: "n2" },
          { text: "Leave.", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("undeclared variable") && i.msg.includes("ghost_topic")));
});

test("does not flag declared variable used in choice option text", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "topic", type: "string", initial: "" }],
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        options: [
          { text: "Ask about ${topic}.", to: "n2" },
          { text: "Leave.", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.level === "warning" && i.msg.includes("undeclared variable")));
});

test("lints undeclared variable in choice node prompt", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        prompt: "You are ${rank_name}. What do you do?",
        options: [
          { text: "Fight.", to: "n2" },
          { text: "Flee.", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("undeclared variable") && i.msg.includes("rank_name")));
});

test("lints undeclared variable in fake_choice option text", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "fake_choice", x: 0, y: 0, w: 360, title: "browse",
        fakeOptions: [
          { text: "The ${phantom_item}.", body: "" },
          { text: "Something else.", body: "" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("undeclared variable") && i.msg.includes("phantom_item")));
});

test("imports *if guard on inline fake_choice option group with body text", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*fake_choice",
    "  *if (wisdom > 5)",
    "    #Study the runes",
    "      You decipher an ancient warning.",
    "    #Touch the crystal",
    "      The crystal hums as you reach out.",
    "  #Walk away",
    "    You leave without looking back.",
  ].join("\n"));
  const fakeChoice = graph.nodes.find((n) => n.type === "fake_choice");
  assert.ok(fakeChoice, "fake_choice node should be imported");
  assert.equal(fakeChoice?.fakeOptions?.length, 3);
  assert.equal(fakeChoice?.fakeOptions?.[0]?.text, "Study the runes");
  assert.equal(fakeChoice?.fakeOptions?.[0]?.cond?.type, "if");
  assert.equal(fakeChoice?.fakeOptions?.[0]?.cond?.expr, "wisdom > 5");
  assert.ok(fakeChoice?.fakeOptions?.[0]?.body?.includes("ancient warning"));
  assert.equal(fakeChoice?.fakeOptions?.[1]?.cond?.expr, "wisdom > 5");
  assert.ok(fakeChoice?.fakeOptions?.[1]?.body?.includes("crystal"));
  assert.equal(fakeChoice?.fakeOptions?.[2]?.text, "Walk away");
  assert.ok(!fakeChoice?.fakeOptions?.[2]?.cond, "top-level option has no condition");
  assert.ok(fakeChoice?.fakeOptions?.[2]?.body?.includes("leave"));
});

test("imports *if guard on inline choice option group", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *if (speed > 5)",
    "    #Run away",
    "      You sprint through the door.",
    "      *finish",
    "    #Dodge",
    "      You duck under the swing.",
    "      *finish",
    "  #Stand your ground",
    "    You face them bravely.",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "choice node should be imported");
  assert.equal(choice?.options?.length, 3);
  assert.equal(choice?.options?.[0]?.text, "Run away");
  assert.equal(choice?.options?.[0]?.cond?.type, "if");
  assert.equal(choice?.options?.[0]?.cond?.expr, "speed > 5");
  assert.equal(choice?.options?.[1]?.text, "Dodge");
  assert.equal(choice?.options?.[1]?.cond?.expr, "speed > 5");
  assert.equal(choice?.options?.[2]?.text, "Stand your ground");
  assert.ok(!choice?.options?.[2]?.cond, "top-level option should have no condition");
  const runBody = graph.nodes.find((n) => n.body?.includes("sprint"));
  assert.ok(runBody, "option body passage should exist");
});

test("imports *if guard on fake_choice option group", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*fake_choice",
    "  *if (courage > 3)",
    "    #Inspect the altar",
    "  *else",
    "    #Cower in the corner",
    "  #Leave the room",
  ].join("\n"));
  const fakeChoice = graph.nodes.find((n) => n.type === "fake_choice");
  assert.ok(fakeChoice, "fake_choice node should be imported");
  assert.equal(fakeChoice?.fakeOptions?.length, 3);
  assert.equal(fakeChoice?.fakeOptions?.[0]?.cond?.expr, "courage > 3");
  assert.ok(!fakeChoice?.fakeOptions?.[1]?.cond, "*else branch options have no condition");
  assert.ok(!fakeChoice?.fakeOptions?.[2]?.cond, "top-level option has no condition");
});

test("imports *if guard on option group in choice block", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *if (strength > 5)",
    "    #Kick the door",
    "      *goto door_kicked",
    "    #Smash the window",
    "      *goto window_smashed",
    "  #Give up",
    "    *goto gave_up",
    "*label door_kicked",
    "*finish",
    "*label window_smashed",
    "*finish",
    "*label gave_up",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "choice node should be imported");
  assert.equal(choice?.options?.length, 3);
  assert.equal(choice?.options?.[0]?.text, "Kick the door");
  assert.equal(choice?.options?.[0]?.cond?.type, "if");
  assert.equal(choice?.options?.[0]?.cond?.expr, "strength > 5");
  assert.equal(choice?.options?.[1]?.text, "Smash the window");
  assert.equal(choice?.options?.[1]?.cond?.type, "if");
  assert.equal(choice?.options?.[1]?.cond?.expr, "strength > 5");
  assert.equal(choice?.options?.[2]?.text, "Give up");
  assert.ok(!choice?.options?.[2]?.cond, "top-level option should have no condition");
});

test("imports *if/*elseif guard on option groups in choice block", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *if (speed > 5)",
    "    #Run",
    "      *goto ran",
    "  *elseif (strength > 5)",
    "    #Fight",
    "      *goto fought",
    "  *else",
    "    #Surrender",
    "      *goto surrendered",
    "*label ran",
    "*finish",
    "*label fought",
    "*finish",
    "*label surrendered",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "choice node should be imported");
  assert.equal(choice?.options?.length, 3);
  assert.equal(choice?.options?.[0]?.cond?.expr, "speed > 5");
  assert.equal(choice?.options?.[1]?.cond?.expr, "strength > 5");
  assert.ok(!choice?.options?.[2]?.cond, "*else branch options have no condition");
});

test("lints *achieve in choice option body", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [{ id: "known", title: "Known", points: 10, desc: "Known", preDesc: "Before", postDesc: "After" }],
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose",
        options: [
          { text: "Fight", to: "n2", body: "You fight bravely.\n*achieve missing_ach" },
          { text: "Flee", to: "n2", body: "*achieve known" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.msg.includes("missing_ach") && i.msg.includes("undeclared achievement")));
  assert.ok(!issues.some((i) => i.msg.includes("\"known\"") && i.msg.includes("undeclared achievement")));
});

test("lints *achieve in fake_choice option body", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [],
    nodes: [
      { id: "n1", type: "fake_choice", x: 0, y: 0, w: 360, title: "fake_choose",
        prompt: "Choose:",
        fakeOptions: [
          { text: "Inspect", body: "You look carefully.\n*achieve ghost_achieve" },
          { text: "Leave" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.msg.includes("ghost_achieve") && i.msg.includes("undeclared achievement")));
});

test("imports *gosub in *if branch body as a gosub node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  *gosub check_armor",
    "  *finish",
    "*else",
    "  *goto flee",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");
  assert.equal(ifNode.branches?.length, 2);

  const ifBranchTargetId = ifNode.branches![0].to;
  const gosubNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.ok(gosubNode, "if branch points to gosub node");
  assert.equal(gosubNode?.type, "gosub");
  assert.ok(gosubNode?.title.includes("check_armor"));

  const finishId = graph.nodes.find((n) => n.type === "finish")?.id;
  assert.ok(finishId, "finish node exists");
  assert.ok(graph.edges.some((e) => e.from === gosubNode!.id && e.to === finishId), "gosub → finish edge exists");
});

test("imports *page_break in *if branch body as a page_break node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if found_clue",
    "  You examine the evidence.",
    "  *page_break Continue",
    "  *goto next_scene",
    "*else",
    "  *goto dead_end",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");

  const ifBranchTargetId = ifNode!.branches![0].to;
  const passageNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.equal(passageNode?.type, "passage");
  assert.ok(passageNode?.body?.includes("You examine the evidence."));

  const pageBreakNode = graph.nodes.find((n) => n.type === "page_break");
  assert.ok(pageBreakNode, "page_break node exists");
  assert.ok(pageBreakNode?.title.includes("Continue"));
  assert.ok(graph.edges.some((e) => e.from === passageNode!.id && e.to === pageBreakNode!.id), "passage → page_break edge");

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("next_scene"));
  assert.ok(gotoNode, "goto next_scene node exists");
  assert.ok(graph.edges.some((e) => e.from === pageBreakNode!.id && e.to === gotoNode!.id), "page_break → goto edge");
});

test("imports *gosub in *choice option body as a gosub node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Search the room",
    "    *gosub find_clue",
    "    *goto next_room",
    "  #Leave",
    "    *ending",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");
  assert.equal(choiceNode?.options?.length, 2);

  const option1TargetId = choiceNode!.options![0].to;
  const gosubNode = graph.nodes.find((n) => n.id === option1TargetId);
  assert.ok(gosubNode, "option 1 points to gosub node");
  assert.equal(gosubNode?.type, "gosub");
  assert.ok(gosubNode?.title.includes("find_clue"));

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("next_room"));
  assert.ok(gotoNode, "goto next_room node exists");
  assert.ok(graph.edges.some((e) => e.from === gosubNode!.id && e.to === gotoNode!.id), "gosub → goto edge");
});

test("imports nested *choice inside *if branch body — all options with goto terminals", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  *choice",
    "    #Fight bravely",
    "      *goto fight_path",
    "    #Retreat safely",
    "      *goto flee_path",
    "*else",
    "  *goto coward_path",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");
  assert.equal(ifNode!.branches?.length, 2);

  const ifBranchTargetId = ifNode!.branches![0].to;
  const choiceNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.ok(choiceNode, "if branch points to nested choice node");
  assert.equal(choiceNode?.type, "choice");
  assert.equal(choiceNode?.options?.length, 2);

  const opt1Target = graph.nodes.find((n) => n.id === choiceNode!.options![0].to);
  assert.equal(opt1Target?.type, "goto");
  assert.ok(opt1Target?.title.includes("fight_path"));

  const opt2Target = graph.nodes.find((n) => n.id === choiceNode!.options![1].to);
  assert.equal(opt2Target?.type, "goto");
  assert.ok(opt2Target?.title.includes("flee_path"));

  const elseBranchTargetId = ifNode!.branches![1].to;
  const elseGoto = graph.nodes.find((n) => n.id === elseBranchTargetId);
  assert.equal(elseGoto?.type, "goto");
  assert.ok(elseGoto?.title.includes("coward_path"));
});

test("imports nested *choice inside *if branch body — options with prose and terminal", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  *choice",
    "    #Fight",
    "      You fight bravely!",
    "      *finish",
    "    #Flee",
    "      You flee safely.",
    "      *ending",
    "*else",
    "  *goto coward",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  const ifBranchTargetId = ifNode!.branches![0].to;
  const choiceNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.equal(choiceNode?.type, "choice");

  const opt1Id = choiceNode!.options![0].to;
  const passage1 = graph.nodes.find((n) => n.id === opt1Id);
  assert.equal(passage1?.type, "passage");
  assert.ok(passage1?.body?.includes("You fight bravely!"));
  assert.ok(graph.nodes.some((n) => n.type === "finish"));
  assert.ok(graph.edges.some((e) => e.from === opt1Id && graph.nodes.find((n) => n.id === e.to)?.type === "finish"));

  const opt2Id = choiceNode!.options![1].to;
  const passage2 = graph.nodes.find((n) => n.id === opt2Id);
  assert.equal(passage2?.type, "passage");
  assert.ok(passage2?.body?.includes("You flee safely."));
});

test("imports nested *fake_choice inside *if branch body with following prose", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if exploring",
    "  *fake_choice",
    "    #Look north",
    "      You see mountains.",
    "    #Look south",
    "      You see a river.",
    "  You finish exploring.",
    "  *finish",
    "*else",
    "  *ending",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  const ifBranchTargetId = ifNode!.branches![0].to;
  const fakeChoiceNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.equal(fakeChoiceNode?.type, "fake_choice");
  assert.equal(fakeChoiceNode?.fakeOptions?.length, 2);

  const afterPassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You finish exploring."));
  assert.ok(afterPassage, "passage after fake_choice exists");
  assert.ok(graph.edges.some((e) => e.from === fakeChoiceNode!.id && e.to === afterPassage!.id), "fake_choice → passage edge");

  assert.ok(graph.nodes.some((n) => n.type === "finish"), "finish node exists");
});

test("imports *rand in *if branch body as a rand node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if lucky",
    "  *rand result 1 100",
    "  *goto check_result",
    "*else",
    "  *goto default_path",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");

  const ifBranchTargetId = ifNode!.branches![0].to;
  const randNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.equal(randNode?.type, "rand");
  assert.ok(randNode?.title.includes("result"));

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("check_result"));
  assert.ok(gotoNode, "goto check_result node exists");
  assert.ok(graph.edges.some((e) => e.from === randNode!.id && e.to === gotoNode!.id), "rand → goto edge");
});

test("imports *image in *if branch body as an image node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if portrait_unlocked",
    "  *image portrait.jpg center",
    "  You see the portrait.",
    "  *finish",
    "*else",
    "  *goto no_portrait",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");

  const ifBranchTargetId = ifNode!.branches![0].to;
  const imageNode = graph.nodes.find((n) => n.id === ifBranchTargetId);
  assert.equal(imageNode?.type, "image");
  assert.ok(imageNode?.target?.includes("portrait.jpg"));

  const passageNode = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You see the portrait."));
  assert.ok(passageNode, "passage node with body exists");
  assert.ok(graph.edges.some((e) => e.from === imageNode!.id && e.to === passageNode!.id), "image → passage edge");
});

test("imports *save_checkpoint in *choice option body as a checkpoint node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Save progress and continue",
    "    *save_checkpoint before_boss",
    "    *goto boss_fight",
    "  #Skip save",
    "    *goto boss_fight",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");

  const option1TargetId = choiceNode!.options![0].to;
  const checkpointNode = graph.nodes.find((n) => n.id === option1TargetId);
  assert.equal(checkpointNode?.type, "checkpoint");
  assert.ok(checkpointNode?.title.includes("before_boss"));

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("boss_fight"));
  assert.ok(gotoNode, "goto boss_fight node exists");
  assert.ok(graph.edges.some((e) => e.from === checkpointNode!.id && e.to === gotoNode!.id), "checkpoint → goto edge");
});

test("warns when all *choice options lead to the same node", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "choice", x: 0, y: 0, w: 360, title: "choose", prompt: "Pick:",
        options: [
          { text: "Option A", to: "n2" },
          { text: "Option B", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("all options") && i.msg.includes("choose")));
});

test("warns when all *if branches lead to the same node (with *else)", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "if", x: 0, y: 0, w: 360, title: "*if",
        branches: [
          { kind: "if", expr: "courage > 50", to: "n2" },
          { kind: "else", expr: "", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("all branches")));
});

test("does not warn when *if branches lead to different nodes", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "if", x: 0, y: 0, w: 360, title: "*if",
        branches: [
          { kind: "if", expr: "courage > 50", to: "n2" },
          { kind: "else", expr: "", to: "n3" },
        ] },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "brave", body: "You stand firm." },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.level === "warning" && i.msg.includes("all branches")));
});

test("does not warn about all-same-target *if without *else", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "if", x: 0, y: 0, w: 360, title: "*if",
        branches: [
          { kind: "if", expr: "courage > 50", to: "n2" },
          { kind: "elseif", expr: "courage > 25", to: "n2" },
        ] },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.level === "warning" && i.msg.includes("all branches")));
});

test("warns when *if without *else has all branches leading to same node as false path (no-op condition)", () => {
  const n1: StoryNode = { id: "n1", type: "if", x: 0, y: 0, w: 300, title: "*if",
    branches: [{ kind: "if", expr: "courage > 50", to: "n2" }] };
  const n2: StoryNode = { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [n1, n2],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: { intro: { nodes: [n1, n2], edges: [{ from: "n1", to: "n2", kind: "flow" }] } },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("no-op")));
});

test("does not flag *if without *else when branch and false path lead to different nodes", () => {
  const n1: StoryNode = { id: "n1", type: "if", x: 0, y: 0, w: 300, title: "*if",
    branches: [{ kind: "if", expr: "courage > 50", to: "n2" }] };
  const n2: StoryNode = { id: "n2", type: "passage", x: 0, y: 0, w: 300, title: "brave", body: "Brave!" };
  const n3: StoryNode = { id: "n3", type: "finish", x: 0, y: 160, w: 240, title: "*finish" };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [n1, n2, n3],
    edges: [{ from: "n1", to: "n3", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }],
    sceneData: { intro: { nodes: [n1, n2, n3], edges: [{ from: "n1", to: "n3", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }] } },
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("no-op")));
});

test("reports unreferenced *label as info", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label orphan" },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "flow" },
      { from: "n2", to: "n3", kind: "flow" },
    ],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "info" && i.msg.includes('"orphan"') && i.msg.includes("never referenced")));
});

test("does not report referenced *label as unreferenced", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label checkpoint" },
      { id: "n3", type: "goto", x: 0, y: 320, w: 240, title: "*goto checkpoint" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "flow" },
      { from: "n3", to: "n2", kind: "goto" },
    ],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("never referenced")));
});

test("preserved source: unreferenced *label reported as info", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "*label orphan_label\nSome text.\n*finish",
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "info" && i.msg.includes('"orphan_label"') && i.msg.includes("never referenced")));
});

test("preserved source: referenced *label not reported as unreferenced", () => {
  const project = {
    ...minimalProject(),
    sceneData: {
      intro: {
        nodes: [],
        edges: [],
        sourceText: "*label subroutine\nSome text.\n*return\n*gosub subroutine\n*finish",
      },
    },
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.level === "info" && i.msg.includes('"subroutine"') && i.msg.includes("never referenced")));
});

test("imports *label inside *if branch body as a label node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if courage > 50",
    "  *label brave_path",
    "  You charge forward!",
    "  *finish",
    "*else",
    "  You flee.",
    "  *finish",
  ].join("\n"));

  const labelNode = graph.nodes.find((n) => n.type === "label");
  assert.ok(labelNode, "label node should be created from *label inside *if branch body");
  assert.ok(labelNode!.title.includes("brave_path"), "label node should have the correct name");
});

test("imports *label inside choice option body as a label node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Attack",
    "    *label fight_start",
    "    You swing your sword.",
    "    *finish",
    "  #Flee",
    "    *finish",
  ].join("\n"));

  const labelNode = graph.nodes.find((n) => n.type === "label");
  assert.ok(labelNode, "label node should be created from *label inside choice option body");
  assert.ok(labelNode!.title.includes("fight_start"), "label should have the correct name");
});

test("imports nested *if inside *if branch body with goto terminals", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  You feel brave.",
    "  *if has_sword",
    "    *goto fight_armed",
    "  *else",
    "    *goto fight_unarmed",
    "*else",
    "  *goto flee",
  ].join("\n"));

  const outerIf = graph.nodes.find((n) => n.type === "if");
  assert.ok(outerIf, "outer if node exists");
  assert.equal(outerIf!.branches?.length, 2);

  const bravePassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You feel brave."));
  assert.ok(bravePassage, "prose before nested if exists");
  assert.equal(outerIf!.branches![0].to, bravePassage!.id, "outer if branch[0] points to brave passage");
  assert.ok(graph.edges.some((e) => e.from === outerIf!.id && e.to === bravePassage!.id), "outer if → brave passage edge");

  const innerIf = graph.nodes.find((n) => n.type === "if" && n !== outerIf);
  assert.ok(innerIf, "inner *if node exists");
  assert.equal(innerIf!.branches?.length, 2);

  const gotoArmed = graph.nodes.find((n) => n.type === "goto" && n.title.includes("fight_armed"));
  const gotoUnarmed = graph.nodes.find((n) => n.type === "goto" && n.title.includes("fight_unarmed"));
  const gotoFlee = graph.nodes.find((n) => n.type === "goto" && n.title.includes("flee"));
  assert.ok(gotoArmed, "goto fight_armed exists");
  assert.ok(gotoUnarmed, "goto fight_unarmed exists");
  assert.ok(gotoFlee, "goto flee exists");
});

test("imports nested *if inside *choice option body with elseif", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Search the room",
    "    *if perception > 3",
    "      You find a hidden key.",
    "      *goto found_key",
    "    *elseif perception > 1",
    "      You find nothing of note.",
    "      *goto found_nothing",
    "    *else",
    "      You miss everything.",
    "      *goto missed_all",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");
  assert.equal(choiceNode!.options?.length, 1);

  const innerIf = graph.nodes.find((n) => n.type === "if");
  assert.ok(innerIf, "nested if node inside option exists");
  assert.equal(innerIf!.branches?.length, 3);

  const foundKey = graph.nodes.find((n) => n.type === "goto" && n.title.includes("found_key"));
  const foundNothing = graph.nodes.find((n) => n.type === "goto" && n.title.includes("found_nothing"));
  const missedAll = graph.nodes.find((n) => n.type === "goto" && n.title.includes("missed_all"));
  assert.ok(foundKey, "goto found_key exists");
  assert.ok(foundNothing, "goto found_nothing exists");
  assert.ok(missedAll, "goto missed_all exists");

  const keyPassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You find a hidden key."));
  assert.ok(keyPassage, "prose inside *if branch preserved");
});

test("imports nested *if inside *choice option body — prose continues after if", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Investigate",
    "    You approach cautiously.",
    "    *if has_lantern",
    "      You light the lantern.",
    "    *else",
    "      You grope in the dark.",
    "    You press on regardless.",
    "    *finish",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");

  const innerIf = graph.nodes.find((n) => n.type === "if");
  assert.ok(innerIf, "nested if inside option exists");
  assert.equal(innerIf!.branches?.length, 2);

  const afterPassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You press on regardless."));
  assert.ok(afterPassage, "prose after nested if exists");

  const finishNode = graph.nodes.find((n) => n.type === "finish");
  assert.ok(finishNode, "finish node exists");
  assert.ok(graph.edges.some((e) => e.from === afterPassage!.id && e.to === finishNode!.id), "prose → finish edge");
});

test("imports *gosub inside choice option body", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Ask for help",
    "    *gosub ask_helper",
    "    *finish",
    "  #Go alone",
    "    *finish",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");
  assert.equal(choiceNode!.options?.length, 2);

  const gosubNode = graph.nodes.find((n) => n.type === "gosub");
  assert.ok(gosubNode, "gosub node created inside option body");
  assert.ok(gosubNode!.title.includes("ask_helper"), "gosub points to correct label");

  const finishNodes = graph.nodes.filter((n) => n.type === "finish");
  assert.equal(finishNodes.length, 2, "two finish nodes created");
});

test("imports *label inside choice option body", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Fight",
    "    *label fight_start",
    "    You swing your sword.",
    "    *finish",
    "  #Flee",
    "    *finish",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");

  const labelNode = graph.nodes.find((n) => n.type === "label");
  assert.ok(labelNode, "label node created inside option body");
  assert.ok(labelNode!.title.includes("fight_start"), "label has correct name");
});

test("imports *if block containing nested *choice in branch body", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if courage > 50",
    "  You feel brave.",
    "  *choice",
    "    #Attack",
    "      *finish",
    "    #Defend",
    "      *finish",
    "*else",
    "  *goto flee",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node created");
  assert.equal(ifNode!.branches?.length, 2, "if has two branches");

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node created inside if branch");
  assert.equal(choiceNode!.options?.length, 2, "choice has two options");

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("flee"));
  assert.ok(gotoNode, "goto flee in else branch");
});

test("imports *if block where branch has *goto_scene terminal", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if chapter > 1",
    "  *goto_scene chapter2",
    "*else",
    "  *goto begin",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node created");
  assert.equal(ifNode!.branches?.length, 2, "if has two branches");

  const gotoScene = graph.nodes.find((n) => n.type === "goto_scene");
  assert.ok(gotoScene, "goto_scene node in if branch");

  const gotoNode = graph.nodes.find((n) => n.type === "goto" && n.title.includes("begin"));
  assert.ok(gotoNode, "goto begin in else branch");
});

test("does not lint *rand with variable bounds as invalid", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [
      { name: "result", type: "number", initial: "0", showInStats: false },
      { name: "low", type: "number", initial: "1", showInStats: false },
      { name: "high", type: "number", initial: "10", showInStats: false },
    ],
    nodes: [
      { id: "n1", type: "rand", x: 0, y: 0, w: 280, title: "*rand result", inputVar: "result", inputMin: "low", inputMax: "high" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.level === "error" && i.msg.includes("bound")), "no bounds error for variable bounds");
});

test("lints *rand with numeric min exceeding max as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "roll", type: "number", initial: "0", showInStats: false }],
    nodes: [
      { id: "n1", type: "rand", x: 0, y: 0, w: 280, title: "*rand roll", inputVar: "roll", inputMin: "10", inputMax: "1" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "error" && i.msg.includes("min bound") && i.msg.includes("exceeds")));
});

test("warns *rand with undeclared variable bounds", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "roll", type: "number", initial: "0", showInStats: false }],
    nodes: [
      { id: "n1", type: "rand", x: 0, y: 0, w: 280, title: "*rand roll", inputVar: "roll", inputMin: "1", inputMax: "max_val" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("max bound uses undeclared variable: max_val")));
});

test("imports *achieve in scene body as achieve node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "You have defeated the dragon.",
    "*achieve dragon_slayer",
    "*finish",
  ].join("\n"));

  const achieveNode = graph.nodes.find((n) => n.type === "achieve");
  assert.ok(achieveNode, "achieve node exists");
  assert.equal(achieveNode!.target, "dragon_slayer");
  assert.ok(graph.edges.some((e) => e.kind === "flow" && e.to === achieveNode!.id), "prose → achieve edge");
  assert.ok(graph.nodes.some((n) => n.type === "finish"), "finish node exists");
});

test("imports *achieve in *if branch body as achieve node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*if won_battle",
    "  *achieve battle_won",
    "  *finish",
    "*else",
    "  *ending",
  ].join("\n"));

  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "if node exists");

  const achieveNode = graph.nodes.find((n) => n.type === "achieve");
  assert.ok(achieveNode, "achieve node inside if branch exists");
  assert.equal(achieveNode!.target, "battle_won");
  assert.equal(ifNode!.branches![0].to, achieveNode!.id, "if branch points to achieve node");
});

test("imports *achieve in *choice option body as achieve node", () => {
  const graph = importChoiceScriptSceneText("startup", [
    "*choice",
    "  #Help the villager",
    "    *achieve good_deed",
    "    *finish",
    "  #Ignore them",
    "    *ending",
  ].join("\n"));

  const choiceNode = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choiceNode, "choice node exists");

  const achieveNode = graph.nodes.find((n) => n.type === "achieve");
  assert.ok(achieveNode, "achieve node inside option exists");
  assert.equal(achieveNode!.target, "good_deed");
  assert.equal(choiceNode!.options![0].to, achieveNode!.id, "option points to achieve node");
});

test("lints achieve node with undeclared achievement as error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "achieve", x: 0, y: 0, w: 240, title: "*achieve missing_ach", target: "missing_ach" },
    ],
    edges: [],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "error" && i.msg.includes("undeclared achievement") && i.msg.includes("missing_ach")));
});

test("lints achieve node with valid achievement as no error", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "You are a hero.", preDesc: "", postDesc: "", points: 10, hidden: false }],
    nodes: [
      { id: "n1", type: "achieve", x: 0, y: 0, w: 240, title: "*achieve hero", target: "hero" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("achieve") && i.level === "error"));
});

test("generates *achieve command in code output", () => {
  const node: StoryNode = { id: "n1", type: "achieve", x: 0, y: 0, w: 240, title: "*achieve hero", target: "hero" };
  const output = generateNodeChoiceScript(node);
  assert.ok(output.includes("*achieve hero"));
});

test("merges consecutive top-level *set commands into a single set node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "Opening prose.",
    "*set strength + 10",
    "*set courage + 5",
    "*set pistas + 1",
    "Continuing prose.",
    "*finish",
  ].join("\n"));

  const setNodes = graph.nodes.filter((n) => n.type === "set");
  assert.equal(setNodes.length, 1, "should have exactly one set node");
  assert.equal(setNodes[0].sets?.length, 3, "set node should have 3 entries");
  assert.equal(setNodes[0].sets?.[0].var, "strength");
  assert.equal(setNodes[0].sets?.[1].var, "courage");
  assert.equal(setNodes[0].sets?.[2].var, "pistas");
  assert.ok(setNodes[0].title?.includes("+2"), "title should indicate multiple sets");
});

test("does not merge non-consecutive *set commands", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*set strength + 10",
    "Some prose between sets.",
    "*set courage + 5",
    "*finish",
  ].join("\n"));

  const setNodes = graph.nodes.filter((n) => n.type === "set");
  assert.equal(setNodes.length, 2, "should have two separate set nodes");
  assert.equal(setNodes[0].sets?.length, 1);
  assert.equal(setNodes[1].sets?.length, 1);
});

test("merges consecutive top-level *comment lines into a single comment node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*comment First line of notes",
    "*comment Second line of notes",
    "*comment Third line of notes",
    "*finish",
  ].join("\n"));

  const commentNodes = graph.nodes.filter((n) => n.type === "comment");
  assert.equal(commentNodes.length, 1, "should have exactly one comment node");
  assert.ok(commentNodes[0].body?.includes("First line of notes"));
  assert.ok(commentNodes[0].body?.includes("Second line of notes"));
  assert.ok(commentNodes[0].body?.includes("Third line of notes"));
});

test("*goto_scene with optional starting label uses only the scene name as target", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*goto_scene fighting scene_choice",
  ].join("\n"));

  const gotoScene = graph.nodes.find((n) => n.type === "goto_scene");
  assert.ok(gotoScene, "should create a goto_scene node");
  assert.equal(gotoScene!.target, "fighting", "target should be scene name only, not scene_name_label");
  assert.ok(gotoScene!.title?.includes("fighting"), "title should include scene name");
  assert.ok(!gotoScene!.title?.includes("scene_choice"), "title should not include the optional starting label");
});

test("*line_break in top-level prose becomes a paragraph break in the passage body", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "First paragraph.",
    "*line_break",
    "Second paragraph.",
    "*finish",
  ].join("\n"));

  const passage = graph.nodes.find((n) => n.type === "passage");
  assert.ok(passage, "should create a passage node");
  assert.ok(passage!.body?.includes("First paragraph."), "body should have first paragraph");
  assert.ok(passage!.body?.includes("Second paragraph."), "body should have second paragraph");
  assert.ok(!passage!.body?.includes("*line_break"), "body should not contain literal *line_break text");
});

test("*line_break in choice option body becomes a blank line, not literal text", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Read slowly",
    "    First part.",
    "    *line_break",
    "    Second part.",
    "After the choice.",
    "*finish",
  ].join("\n"));

  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice);
  const opt = choice!.options?.[0];
  assert.ok(opt?.body, "option should have a body");
  assert.ok(opt!.body!.includes("First part."), "option body should have first part");
  assert.ok(opt!.body!.includes("Second part."), "option body should have second part");
  assert.ok(!opt!.body!.includes("*line_break"), "option body should not contain literal *line_break");
});

test("prose before *choice is captured as choice prompt, not a separate passage node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "You stand at a crossroads.",
    "What will you do?",
    "*choice",
    "  #Go left",
    "    You go left.",
    "    *finish",
    "  #Go right",
    "    You go right.",
    "    *ending",
  ].join("\n"));

  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  assert.ok(choice!.prompt?.includes("You stand at a crossroads."), "prompt should contain preceding prose");
  assert.ok(choice!.prompt?.includes("What will you do?"), "prompt should contain all prose lines");
  const passageWithPromptText = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You stand at a crossroads."));
  assert.equal(passageWithPromptText, undefined, "preceding prose should not create a separate passage node");
});

test("prose before *fake_choice is captured as fake_choice prompt", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "Make your selection.",
    "*fake_choice",
    "  #Option A",
    "  #Option B",
    "*finish",
  ].join("\n"));

  const fakeChoice = graph.nodes.find((n) => n.type === "fake_choice");
  assert.ok(fakeChoice, "should have a fake_choice node");
  assert.ok(fakeChoice!.prompt?.includes("Make your selection."), "prompt should contain preceding prose");
  const passages = graph.nodes.filter((n) => n.type === "passage");
  assert.equal(passages.length, 0, "no separate passage node created for prompt prose");
});

test("*choice without preceding prose still gets the default prompt", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Option A",
    "    *finish",
    "  #Option B",
    "    *ending",
  ].join("\n"));

  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  assert.ok(choice!.prompt, "choice should still have a prompt");
});

test("prose before *choice inside *if branch body is captured as choice prompt", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if strong",
    "  You are strong.",
    "  Pick your weapon.",
    "  *choice",
    "    #Sword",
    "      *finish",
    "    #Axe",
    "      *finish",
    "*finish",
  ].join("\n"));

  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  assert.ok(choice!.prompt?.includes("Pick your weapon."), "prompt should contain preceding branch prose");
  const passageWithPromptText = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("Pick your weapon."));
  assert.equal(passageWithPromptText, undefined, "preceding branch prose should not create a separate passage node");
});

test("prose before *fake_choice inside *if branch body is captured as fake_choice prompt", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  Be brave.",
    "  *fake_choice",
    "    #Stay",
    "    #Run",
    "*finish",
  ].join("\n"));

  const fakeChoice = graph.nodes.find((n) => n.type === "fake_choice");
  assert.ok(fakeChoice, "should have a fake_choice node");
  assert.ok(fakeChoice!.prompt?.includes("Be brave."), "prompt should contain preceding branch prose");
  const passageWithPromptText = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("Be brave."));
  assert.equal(passageWithPromptText, undefined, "preceding branch prose should not create a separate passage node");
});

test("*set at start of *if branch body (before prose) is extracted to branch.sets", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  *set courage +1",
    "  You step forward.",
    "  *finish",
  ].join("\n"));
  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "should have an if node");
  const branch = ifNode!.branches?.[0];
  assert.deepEqual(branch?.sets, [{ var: "courage", op: "+", val: "1" }]);
  const passage = graph.nodes.find((n) => n.type === "passage");
  assert.ok(passage?.body?.includes("You step forward."), "passage body should have prose");
});

test("*set after prose in *if branch body becomes a set node in the graph", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  You step forward.",
    "  *set courage +1",
    "  *finish",
  ].join("\n"));
  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "should have an if node");
  const branch = ifNode!.branches?.[0];
  assert.deepEqual(branch?.sets ?? [], [], "no sets in branch.sets when set appears after prose");
  const setNode = graph.nodes.find((n) => n.type === "set");
  assert.ok(setNode, "should have a set node in the graph");
  assert.deepEqual(setNode!.sets, [{ var: "courage", op: "+", val: "1" }]);
  const passage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You step forward."));
  assert.ok(passage, "should have a passage with prose");
});

test("*set at start of inline choice option body (before prose) is extracted to option.sets", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Be brave",
    "    *set courage +1",
    "    You step forward.",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  const option = choice!.options?.[0];
  assert.ok(option, "should have an option");
  assert.deepEqual(option!.sets, [{ var: "courage", op: "+", val: "1" }]);
});

test("*set after prose in inline choice option body becomes a set node in the graph", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Be brave",
    "    You step forward.",
    "    *set courage +1",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  const option = choice!.options?.[0];
  assert.ok(option, "option should exist");
  assert.deepEqual(option!.sets ?? [], [], "no sets in option.sets when set appears after prose");
  const setNode = graph.nodes.find((n) => n.type === "set");
  assert.ok(setNode, "should have a set node in the graph");
  assert.deepEqual(setNode!.sets, [{ var: "courage", op: "+", val: "1" }]);
});

test("multiple consecutive *set after prose in *if branch body merge into single set node", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  You step forward.",
    "  *set courage +1",
    "  *set strength +2",
    "  *finish",
  ].join("\n"));
  const setNode = graph.nodes.find((n) => n.type === "set");
  assert.ok(setNode, "should have a set node");
  assert.equal(setNode!.sets?.length, 2, "should have two sets merged");
  assert.equal(setNode!.sets?.[0].var, "courage");
  assert.equal(setNode!.sets?.[1].var, "strength");
});

test("*if without *else creates flow edge from if node to following passage", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  You step forward.",
    "  *finish",
    "The story continues.",
    "*finish",
  ].join("\n"));
  const ifNode = graph.nodes.find((n) => n.type === "if");
  const followingPassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("The story continues."));
  assert.ok(ifNode, "should have an if node");
  assert.ok(followingPassage, "should have following passage");
  const edge = graph.edges.find((e) => e.from === ifNode!.id && e.to === followingPassage!.id);
  assert.ok(edge, "should have flow edge from if node to following passage (false path)");
});

test("*if with *else does not create extra flow edge from if node to following passage", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if brave",
    "  You are brave.",
    "  *finish",
    "*else",
    "  You are not brave.",
    "  *finish",
    "This text is unreachable.",
    "*finish",
  ].join("\n"));
  const ifNode = graph.nodes.find((n) => n.type === "if");
  const unreachable = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("This text is unreachable."));
  assert.ok(ifNode, "should have an if node");
  assert.ok(unreachable, "should have unreachable passage node");
  const directEdge = graph.edges.find((e) => e.from === ifNode!.id && e.to === unreachable!.id && e.kind === "flow");
  assert.equal(directEdge, undefined, "should not have direct flow edge from if to unreachable passage");
});

test("two consecutive *if without *else: first if connects to second if, second if connects to following passage", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if flag1",
    "  Do thing 1.",
    "*if flag2",
    "  Do thing 2.",
    "The story continues.",
    "*finish",
  ].join("\n"));
  const [if1, if2] = graph.nodes.filter((n) => n.type === "if");
  const followingPassage = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("The story continues."));
  assert.ok(if1 && if2, "should have two if nodes");
  assert.ok(followingPassage, "should have following passage");
  const edgeIf1ToIf2 = graph.edges.find((e) => e.from === if1!.id && e.to === if2!.id && e.kind === "flow");
  assert.ok(edgeIf1ToIf2, "first if should connect to second if (false-path flow)");
  const edgeIf2ToPassage = graph.edges.find((e) => e.from === if2!.id && e.to === followingPassage!.id && e.kind === "flow");
  assert.ok(edgeIf2ToPassage, "second if should connect to following passage (false-path flow)");
});

test("compound *if condition (a) and (b) is preserved without stripping inner parens", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if (strength > 50) and (courage > 30)",
    "  You are powerful and brave.",
    "  *finish",
  ].join("\n"));
  const ifNode = graph.nodes.find((n) => n.type === "if");
  assert.ok(ifNode, "should have an if node");
  const expr = ifNode!.branches?.[0]?.expr;
  assert.equal(expr, "(strength > 50) and (courage > 30)", "compound expression should be preserved intact");
});

test("*if guard on choice option without parentheses is parsed correctly", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *if courage > 50 #Be brave",
    "    You step forward.",
    "    *finish",
    "  #Run",
    "    You flee.",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  const option = choice!.options?.find((o) => o.cond?.expr === "courage > 50");
  assert.ok(option, "should have option with courage > 50 condition");
  assert.equal(option!.text, "Be brave");
  assert.equal(option!.cond?.type, "if");
});

test("*selectable_if guard on choice option without parentheses is parsed correctly", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *selectable_if courage > 50 #Be brave",
    "    You step forward.",
    "    *finish",
    "  #Run",
    "    You flee.",
    "    *finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  const option = choice!.options?.find((o) => o.cond?.expr === "courage > 50");
  assert.ok(option, "should have option with courage > 50 condition");
  assert.equal(option!.cond?.type, "selectable_if");
});

test("*if group guard on choice block without parentheses applies to options", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  *if courage > 50",
    "    #Charge",
    "      *goto brave",
    "  *else",
    "    #Hide",
    "      *goto coward",
    "*label brave",
    "*finish",
    "*label coward",
    "*finish",
  ].join("\n"));
  const choice = graph.nodes.find((n) => n.type === "choice");
  assert.ok(choice, "should have a choice node");
  const chargeOption = choice!.options?.find((o) => o.text === "Charge");
  assert.ok(chargeOption, "should have Charge option");
  assert.deepEqual(chargeOption!.cond, { type: "if", expr: "courage > 50" });
  const hideOption = choice!.options?.find((o) => o.text === "Hide");
  assert.ok(hideOption, "should have Hide option");
  assert.equal(hideOption!.cond, null);
});

test("roundtrip: *if without *else produces valid code with false-path goto", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*if courage > 50",
    "  You are brave.",
    "  *finish",
    "You continue regardless.",
    "*finish",
  ].join("\n"));
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: { intro: graph },
  };
  const code = generateSceneChoiceScript(project, "intro");
  const ifNode = graph.nodes.find((n) => n.type === "if");
  const continuationNode = graph.nodes.find((n) => n.type === "passage" && n.body?.includes("You continue regardless."));
  assert.ok(ifNode && continuationNode, "should have both if and continuation nodes");
  assert.ok(
    code.includes(`*goto cf_${continuationNode!.id}`),
    "exported code should include goto for false-path continuation"
  );
});

test("warns when fairmath variable has initial value above 100", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "strength", type: "number", initial: "150", desc: "Strength", fairmath: true, showInStats: false }],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "fairmath_range" && i.msg.includes("strength")), "should warn about out-of-range fairmath initial");
});

test("warns when fairmath variable has negative initial value", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "courage", type: "number", initial: "-10", desc: "Courage", fairmath: true, showInStats: false }],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "fairmath_range" && i.msg.includes("courage")));
});

test("does not warn when fairmath variable is within 0–100", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "luck", type: "number", initial: "50", desc: "Luck", fairmath: true, showInStats: false }],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "fairmath_range"));
});

test("does not warn about non-fairmath variable initial value range", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "gold", type: "number", initial: "500", desc: "Gold", fairmath: false, showInStats: false }],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "fairmath_range"), "non-fairmath variable should not be range-checked");
});

test("warns when *rand min equals max", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "roll", type: "number", initial: "0", showInStats: false }],
    nodes: [
      { id: "n1", type: "rand", x: 0, y: 0, w: 280, title: "*rand roll", inputVar: "roll", inputMin: "5", inputMax: "5" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.key === "rand_same_bounds"), "should warn about same bounds");
});

test("does not warn when *rand min equals max and min equals max but they differ", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "roll", type: "number", initial: "0", showInStats: false }],
    nodes: [
      { id: "n1", type: "rand", x: 0, y: 0, w: 280, title: "*rand roll", inputVar: "roll", inputMin: "1", inputMax: "10" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "rand_same_bounds"), "should not warn when bounds differ");
});

test("lints passage with no body text as info", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "empty" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "info" && i.key === "empty_passage_body"), "should flag empty passage");
});

test("does not flag structural routing nodes from import as empty passage", () => {
  const graph = importChoiceScriptSceneText("scene", [
    "*choice",
    "  #Go left",
    "    You go left.",
    "  #Go right",
    "    You go right.",
    "*finish",
  ].join("\n"));
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: graph.nodes,
    edges: graph.edges,
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "empty_passage_body"), "structural choice_option_empty routing nodes must not be flagged");
});

test("does not flag passage with body text as empty", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "intro", body: "Once upon a time." },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "empty_passage_body"), "should not flag passage with content");
});

test("lints write-only *temp variable as info", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp counter", inputVar: "counter", body: "0" },
      { id: "n2", type: "set", x: 0, y: 160, w: 280, title: "*set counter", sets: [{ var: "counter", op: "=", val: "5" }] },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "info" && i.key === "unused_temp" && i.msg.includes("counter")), "should flag write-only temp");
});

test("does not flag *temp variable read in a condition as unused", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp counter", inputVar: "counter", body: "0" },
      {
        id: "n2", type: "if", x: 0, y: 160, w: 280, title: "*if counter > 0",
        branches: [
          { kind: "if", expr: "counter > 0", to: "n3" },
          { kind: "else", to: "n3" },
        ],
      },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp"), "should not flag temp used in condition");
});

test("does not flag *temp variable interpolated in passage body as unused", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    nodes: [
      { id: "n1", type: "temp", x: 0, y: 0, w: 280, title: "*temp hero", inputVar: "hero", body: "Bilbo" },
      { id: "n2", type: "passage", x: 0, y: 160, w: 300, title: "intro", body: "Hello, ${hero}!" },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }],
    sceneData: {},
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp"), "should not flag temp used in body interpolation");
});

test("lints *image node with invalid alignment as warning", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "image", x: 0, y: 0, w: 240, title: "*image hero.png", target: "hero.png", inputMin: "center" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.node === "n1" && i.msg.includes("invalid alignment")));
});

test("does not flag modulo operator as undeclared variable in expression", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "" }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          {
            id: "n1", type: "if", x: 0, y: 0, w: 300, title: "*if",
            branches: [
              { kind: "if", expr: "score modulo 2 = 0", to: "n2" },
            ],
          },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [
          { from: "n1", to: "n2", kind: "if" },
          { from: "n1", to: "n2", kind: "flow" },
        ],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("modulo")));
});

test("lints undeclared variable in *set RHS in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create score 0",
      "*goto_scene intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*set score score + bonus",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.scene === "intro" && i.msg.includes("undeclared variable") && i.msg.includes("bonus")));
});

test("computeVariableUses counts reads in choice option bodies", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "" }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          {
            id: "n1", type: "choice", x: 0, y: 0, w: 300, title: "*choice",
            options: [
              { text: "Option A", to: "n2", body: "Score is ${score}." },
              { text: "Option B", to: "n2" },
            ],
          },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "choice" }],
      },
    },
    lints: [],
  };
  const uses = computeVariableUses(project);
  assert.ok((uses.get("score") ?? 0) > 0, "score should be counted as used in option body");
});

test("detects undeclared variable in @!{name} capitalized interpolation", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello, @!{hero_name}!" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "undef_var" && i.msg.includes("hero_name")));
});

test("does not flag @!{name} variable as unused when declared", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "hero_name", type: "string", initial: "Bilbo", desc: "", showInStats: false }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello, @!{hero_name}!" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("hero_name") && i.msg.includes("never read")));
});

test("lints *gosub scene with no *return node as warning", () => {
  const labelId = "n_label";
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
          { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label subroutine" },
          { id: "n3", type: "passage", x: 0, y: 320, w: 300, title: "sub body", body: "In subroutine." },
          { id: "n4", type: "gosub", x: 0, y: 480, w: 240, title: "*gosub subroutine" },
          { id: "n5", type: "finish", x: 0, y: 640, w: 240, title: "*finish" },
        ],
        edges: [
          { from: "n1", to: "n2", kind: "flow" },
          { from: "n2", to: "n3", kind: "flow" },
          { from: "n4", to: "n5", kind: "flow" },
        ],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.msg.includes("*gosub") && i.msg.includes("no *return")));
});

test("does not warn on *gosub scene that has a *return node", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
          { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label subroutine" },
          { id: "n3", type: "passage", x: 0, y: 320, w: 300, title: "sub body", body: "In subroutine." },
          { id: "n4", type: "return", x: 0, y: 480, w: 240, title: "*return" },
          { id: "n5", type: "gosub", x: 0, y: 640, w: 240, title: "*gosub subroutine" },
          { id: "n6", type: "finish", x: 0, y: 800, w: 240, title: "*finish" },
        ],
        edges: [
          { from: "n1", to: "n2", kind: "flow" },
          { from: "n2", to: "n3", kind: "flow" },
          { from: "n3", to: "n4", kind: "flow" },
          { from: "n5", to: "n6", kind: "flow" },
        ],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("*gosub") && i.msg.includes("no *return")));
});

test("lints *image node with unsupported extension as warning", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "image", x: 0, y: 0, w: 240, title: "*image hero.svg", target: "hero.svg" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.node === "n1" && i.msg.includes("unsupported extension")));
});

test("does not warn on *image node with supported extension", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "image", x: 0, y: 0, w: 240, title: "*image hero.png", target: "hero.png" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.node === "n1" && i.msg.includes("unsupported extension")));
});

test("lints *sound node with unsupported extension as warning", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "sound", x: 0, y: 0, w: 240, title: "*sound theme.flac", target: "theme.flac" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.node === "n1" && i.msg.includes("unsupported extension")));
});

test("lints global variable named with ChoiceScript reserved word as error", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "true", type: "boolean", initial: "true", desc: "" }],
    achievements: [],
    assets: [],
    sceneData: {
      intro: {
        nodes: [{ id: "n1", type: "finish", x: 0, y: 0, w: 240, title: "*finish" }],
        edges: [],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "error" && i.msg.includes("reserved word") && i.msg.includes("true")));
});

test("does not flag non-reserved global variable name", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "hero_name", type: "string", initial: "Bilbo", desc: "" }],
    achievements: [],
    assets: [],
    sceneData: {
      intro: {
        nodes: [{ id: "n1", type: "finish", x: 0, y: 0, w: 240, title: "*finish" }],
        edges: [],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("reserved word")));
});

test("lints *temp node named with ChoiceScript reserved word as error", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [],
    assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 240, title: "*temp not", inputVar: "not", body: "true" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "error" && i.node === "n1" && i.msg.includes("reserved word")));
});

test("lints set node with no assignments as warning", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [],
    assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "set", x: 0, y: 0, w: 240, title: "*set nothing", sets: [] },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.node === "n1" && i.msg.includes("no assignments")));
});

test("does not lint set node with assignments", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0" }],
    achievements: [],
    assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "set", x: 0, y: 0, w: 240, title: "*set score", sets: [{ var: "score", op: "=", val: "10" }] },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.node === "n1" && i.msg.includes("no assignments")));
});

test("computeVariableUses counts variable read in *set value expression in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create score 0",
      "*create result 0",
    ].join("\n")),
    textEntry("intro.txt", [
      "*set result score + 5",
      "*finish",
    ].join("\n")),
  ]);
  const uses = computeVariableUses(project);
  assert.ok((uses.get("score") ?? 0) > 0, "score should be counted as read in *set value expression");
});

test("lintUnusedVariables does not flag variable only read in *set value expression in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create score 0",
      "*create result 0",
    ].join("\n")),
    textEntry("intro.txt", [
      "*set result score + 5",
      "*finish",
    ].join("\n")),
  ]);
  project.variables.forEach((v) => { v.showInStats = false; });
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("never read") && i.msg.includes("score")));
});

test("lints *gosub_scene in preserved source calling a scene with no *return", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "  sub",
    ].join("\n")),
    textEntry("intro.txt", [
      "*gosub_scene sub",
      "*finish",
    ].join("\n")),
    textEntry("sub.txt", [
      "Sub content.",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.scene === "intro" && i.msg.includes("no *return")));
});

test("does not warn on *gosub_scene in preserved source when target has *return", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "  sub",
    ].join("\n")),
    textEntry("intro.txt", [
      "*gosub_scene sub",
      "*finish",
    ].join("\n")),
    textEntry("sub.txt", [
      "Sub content.",
      "*return",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.scene === "intro" && i.msg.includes("no *return")));
});

test("lints *create of fairmath variable with out-of-range initial value in preserved startup", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create courage 150",
    ].join("\n")),
    textEntry("intro.txt", "*finish"),
  ]);
  project.variables = [{ name: "courage", type: "number", initial: "150", desc: "", fairmath: true, uses: 0 }];
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "fairmath_range" && i.msg.includes("courage")));
});

test("does not warn on *create of fairmath variable with in-range initial value in preserved startup", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create courage 50",
    ].join("\n")),
    textEntry("intro.txt", "*finish"),
  ]);
  project.variables = [{ name: "courage", type: "number", initial: "50", desc: "", fairmath: true, uses: 0 }];
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "fairmath_range" && i.msg.includes("courage")));
});

test("lints *image with invalid alignment in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*image hero.png center",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "warning" && i.scene === "intro" && i.msg.includes("invalid alignment")));
});

test("does not warn on *image with valid alignment in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*image hero.png left",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.scene === "intro" && i.msg.includes("invalid alignment")));
});

test("lints *rand with same min and max as warning in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create roll 0",
    ].join("\n")),
    textEntry("intro.txt", [
      "*rand roll 5 5",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "rand_same_bounds" && i.scene === "intro"));
});

test("lints *temp that shadows a global variable in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "*create score 0",
    ].join("\n")),
    textEntry("intro.txt", [
      "*temp score 5",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "temp_shadows" && i.msg.includes("score") && i.scene === "intro"));
});

test("lints *params that shadows a global variable in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
      "  sub",
      "*create score 0",
    ].join("\n")),
    textEntry("intro.txt", "*gosub_scene sub\n*finish"),
    textEntry("sub.txt", [
      "*params score",
      "*return",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "temp_shadows" && i.msg.includes("score") && i.scene === "sub"));
});

test("lints *temp declared but never read in preserved source as info", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*temp hero Billy",
      "You explore.",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.key === "unused_temp" && i.msg.includes("hero") && i.scene === "intro"));
});

test("does not flag *temp as unused when read in prose in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*temp hero Billy",
      "Hello, ${hero}!",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp" && i.msg.includes("hero")));
});

test("does not flag *temp as unused when read in *if condition in preserved source", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", [
      "*title Test",
      "*author A",
      "*scene_list",
      "  intro",
    ].join("\n")),
    textEntry("intro.txt", [
      "*temp shield false",
      "*if (shield)",
      "  Protected!",
      "*finish",
    ].join("\n")),
  ]);
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp" && i.msg.includes("shield")));
});

test("lints *set node with empty value expression as error", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "set", x: 0, y: 0, w: 240, title: "*set score", sets: [{ var: "score", op: "=", val: "" }] },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.level === "error" && i.msg.includes("empty value") && i.msg.includes("score")));
});

test("does not flag uppercase ChoiceScript reserved words as undeclared variables in expressions", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          {
            id: "n1", type: "if", x: 0, y: 0, w: 300, title: "*if",
            branches: [{ kind: "if", expr: "score MODULO 2 = 0 AND NOT score = 0", to: "n2" }],
          },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "if" }, { from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("MODULO") || i.msg.includes("AND") || i.msg.includes("NOT")));
});

test("variable read only in *selectable_if condition in preserved source is not flagged as unused", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0, showInStats: false }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [], edges: [],
        sourceText: "*choice\n  *selectable_if (score > 5) #Try harder\n    You try.\n    *finish",
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes('"score"') && i.msg.includes("never read")), "score should not be flagged as unused when read in *selectable_if condition");
});

test("computeVariableUses counts variable used in *selectable_if condition in preserved source", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [], edges: [],
        sourceText: "*choice\n  *selectable_if (score > 5) #Try harder\n    You try.\n    *finish",
      },
    },
    lints: [],
  };
  const uses = computeVariableUses(project);
  assert.ok((uses.get("score") ?? 0) > 0, "score should have a use count from *selectable_if condition");
});

test("*gosub_scene pointing to missing scene in graph emits gosub_scene_missing key", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [
      { id: "intro", name: "intro", words: 0, nodes: 0, current: true },
    ],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 300, title: "*gosub_scene", target: "ghost_scene" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_scene_missing" && i.params?.name === "ghost_scene");
  assert.ok(issue, "expected gosub_scene_missing key on *gosub_scene to unknown scene in graph");
});

test("*gosub_scene pointing to missing scene in preserved source emits gosub_scene_missing key", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*gosub_scene ghost_scene" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_scene_missing" && i.params?.name === "ghost_scene");
  assert.ok(issue, "expected gosub_scene_missing key on *gosub_scene to unknown scene in preserved source");
});

test("undeclared variable in *if condition emits undef_var key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          {
            id: "n1", type: "if", x: 0, y: 0, w: 300, title: "*if",
            branches: [{ kind: "if", expr: "ghost_var > 0", to: "n2" }],
          },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "if" }, { from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "undef_var" && i.params?.name === "ghost_var");
  assert.ok(issue, "expected undef_var key on undeclared variable in *if condition");
});

test("undeclared variable in *set value expression emits undef_var key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "set", x: 0, y: 0, w: 300, title: "*set", sets: [{ var: "score", op: "=", val: "ghost_var" }] },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "undef_var" && i.params?.name === "ghost_var");
  assert.ok(issue, "expected undef_var key on undeclared variable in *set value expression");
});

test("lintUnusedTempVars does not flag temp as unused when read in *selectable_if in sourceText", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 300, title: "*temp flag", inputVar: "flag", body: "false" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
        sourceText: "*choice\n  *selectable_if (flag) #Try\n    *finish",
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp" && i.params?.name === "flag"), "flag temp used in *selectable_if must not be flagged as unused");
});

test("lintUnusedTempVars does not flag temp as unused when read in *set value in sourceText", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 300, title: "*temp bonus", inputVar: "bonus", body: "10" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
        sourceText: "*set score + bonus",
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "unused_temp" && i.params?.name === "bonus"), "bonus temp used in *set value must not be flagged as unused");
});

test("lintSet does not flag *set on a temp variable as undeclared", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "temp", x: 0, y: 0, w: 300, title: "*temp counter", inputVar: "counter", body: "0" },
          { id: "n2", type: "set", x: 0, y: 160, w: 300, title: "*set", sets: [{ var: "counter", op: "+", val: "1" }] },
          { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }, { from: "n2", to: "n3", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("undeclared") && i.msg.includes("counter")), "counter is a temp variable and must not be flagged as undeclared");
});

test("variable used as rand bound in a graph node is not flagged as unused", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [
      { name: "result", type: "number", initial: "0", desc: "", uses: 0, showInStats: false },
      { name: "min_val", type: "number", initial: "1", desc: "", uses: 0, showInStats: false },
      { name: "max_val", type: "number", initial: "10", desc: "", uses: 0, showInStats: false },
    ],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "rand", x: 0, y: 0, w: 300, title: "*rand", inputVar: "result", inputMin: "min_val", inputMax: "max_val" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.msg.includes("min_val") && i.msg.includes("never read")), "min_val used as rand bound must not be flagged as unused");
  assert.ok(!issues.some((i) => i.msg.includes("max_val") && i.msg.includes("never read")), "max_val used as rand bound must not be flagged as unused");
});

test("computeVariableUses counts variables used as rand bounds", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [
      { name: "result", type: "number", initial: "0", desc: "", uses: 0 },
      { name: "lo", type: "number", initial: "1", desc: "", uses: 0 },
      { name: "hi", type: "number", initial: "10", desc: "", uses: 0 },
    ],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "rand", x: 0, y: 0, w: 300, title: "*rand", inputVar: "result", inputMin: "lo", inputMax: "hi" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const uses = computeVariableUses(project);
  assert.ok((uses.get("lo") ?? 0) > 0, "lo used as rand min bound should have a use count");
  assert.ok((uses.get("hi") ?? 0) > 0, "hi used as rand max bound should have a use count");
});

test("image alignment in inputMin does not trigger false unused-variable warning for variable named left", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "left", type: "string", initial: "\"x\"", desc: "", uses: 0, showInStats: false }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "image", x: 0, y: 0, w: 300, title: "*image", target: "hero.jpg", inputMin: "left" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(issues.some((i) => i.msg.includes('"left"') && i.msg.includes("never read")), "variable named left should still be flagged as unused when it is not a rand/input_number bound");
});

test("subtraction expression in preserved source does not falsely flag operand as undeclared", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*if score-5 > 0\n  *finish\n*finish" } },
    lints: [],
  };
  const issues = lintProject(project);
  assert.ok(!issues.some((i) => i.key === "undef_var" && i.params?.name === "score_5"), "score-5 should not be normalized to score_5 and flagged as undeclared");
  assert.ok(!issues.some((i) => i.key === "undef_var" && i.params?.name === "score"), "score should not be flagged as undeclared in score-5 expression");
});

test("*temp with no initial value in preserved source emits a warning not an error", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*temp counter\n*finish" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.msg.includes("counter") && i.msg.includes("initial value"));
  assert.ok(issue, "expected a lint about counter missing initial value");
  assert.equal(issue!.level, "warning", "*temp with no initial value should be warning not error");
});

test("*params shadow in graph linter emits temp_shadows key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [{ name: "score", type: "number", initial: "0", desc: "", uses: 0 }],
    achievements: [], assets: [],
    sceneData: {
      intro: {
        nodes: [
          { id: "n1", type: "params", x: 0, y: 0, w: 300, title: "*params", body: "score" },
          { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
        ],
        edges: [{ from: "n1", to: "n2", kind: "flow" }],
      },
    },
    lints: [],
  };
  const issues = lintProject(project);
  const shadow = issues.find((i) => i.key === "temp_shadows" && i.params?.name === "score");
  assert.ok(shadow, "expected temp_shadows key on *params shadow");
});

test("*achieve in preserved source emits undef_ach key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*achieve mystery_award" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "undef_ach" && i.params?.name === "mystery_award");
  assert.ok(issue, "expected undef_ach key on *achieve for unknown id in preserved source");
});

test("*goto_scene in preserved source emits goto_scene_missing key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*goto_scene ghost_scene" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "goto_scene_missing" && i.params?.name === "ghost_scene");
  assert.ok(issue, "expected goto_scene_missing key on *goto_scene for unknown scene in preserved source");
});

test("duplicate *label in preserved source emits duplicate_label key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*label loop\n*goto loop\n*label loop" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "duplicate_label" && i.params?.name === "loop");
  assert.ok(issue, "expected duplicate_label key on repeated *label in preserved source");
});

test("*goto missing label in preserved source emits goto_missing_label key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*goto nowhere" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "goto_missing_label" && i.params?.name === "nowhere");
  assert.ok(issue, "expected goto_missing_label key on *goto to undefined label in preserved source");
});

test("*gosub missing label in preserved source emits gosub_missing_label key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*gosub nowhere" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_missing_label" && i.params?.name === "nowhere");
  assert.ok(issue, "expected gosub_missing_label key on *gosub to undefined label in preserved source");
});

test("unused hidden global variable emits unused_var key and name param", () => {
  const graph: SceneGraph = {
    nodes: [{ id: "n1", type: "finish", x: 0, y: 0, w: 240, title: "*finish" }],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 1 }],
    variables: [{ name: "hidden_flag", type: "boolean" as const, initial: "false", desc: "", showInStats: false }],
    achievements: [], assets: [],
    sceneData: { intro: graph },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "unused_var" && i.params?.name === "hidden_flag");
  assert.ok(issue, "expected unused_var key on hidden global variable that is never read");
});

test("passage exceeding 600 words emits passage_too_long key with name and wc params", () => {
  const longBody = Array(601).fill("word").join(" ");
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "long_passage", body: longBody },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const project = { ...minimalProject(), sceneData: { intro: graph } };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "passage_too_long" && i.params?.name === "long_passage");
  assert.ok(issue, "expected passage_too_long key on passage exceeding 600 words");
  assert.equal(issue?.params?.wc, "601");
});

test("gosub_scene graph node pointing to scene without *return emits gosub_scene_no_return key", () => {
  const callerGraph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub_scene", x: 0, y: 0, w: 280, title: "*gosub_scene helper", target: "helper" },
      { id: "n2", type: "finish", x: 0, y: 160, w: 240, title: "*finish" },
    ],
    edges: [{ from: "n1", to: "n2", kind: "flow" }],
  };
  const helperGraph: SceneGraph = {
    nodes: [{ id: "n1", type: "passage", x: 0, y: 0, w: 240, title: "body", body: "Helper text." }],
    edges: [],
  };
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    scenes: [
      { id: "startup", name: "startup", words: 0, nodes: 0, isStart: true },
      { id: "intro", name: "intro", words: 0, nodes: 2, current: true },
      { id: "helper", name: "helper", words: 0, nodes: 1 },
      { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
    ],
    sceneData: { intro: callerGraph, helper: helperGraph },
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_scene_no_return" && i.params?.name === "helper");
  assert.ok(issue, "expected gosub_scene_no_return key when target scene has no *return");
});

test("gosub_scene in preserved source pointing to scene without *return emits gosub_scene_no_return key", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [
      { id: "intro", name: "intro", words: 0, nodes: 0, current: true },
      { id: "helper", name: "helper", words: 0, nodes: 0 },
    ],
    variables: [], achievements: [], assets: [],
    sceneData: {
      intro: { nodes: [], edges: [], sourceText: "*gosub_scene helper" },
      helper: { nodes: [{ id: "n1", type: "passage", x: 0, y: 0, w: 240, title: "body", body: "Text." }], edges: [] },
    },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_scene_no_return" && i.params?.name === "helper");
  assert.ok(issue, "expected gosub_scene_no_return key in preserved source when target scene has no *return");
});

test("unreferenced *label graph node emits unreferenced_label key and name param", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "passage", x: 0, y: 0, w: 300, title: "start", body: "Hello." },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label dead_end_label" },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n2", kind: "flow" },
      { from: "n2", to: "n3", kind: "flow" },
    ],
  };
  const project = { ...minimalProject(), sceneData: { intro: graph } };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "unreferenced_label" && i.params?.name === "dead_end_label");
  assert.ok(issue, "expected unreferenced_label key on *label node never targeted by *goto or *gosub");
});

test("unreferenced *label in preserved source emits unreferenced_label key and name param", () => {
  const project: ChoiceForgeProject = {
    title: "T", author: "A", sceneTitle: "intro", sceneSubtitle: "intro.txt",
    scenes: [{ id: "intro", name: "intro", words: 0, nodes: 0, current: true }],
    variables: [], achievements: [], assets: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText: "*label orphan_sub\n*finish" } },
    lints: [],
  };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "unreferenced_label" && i.params?.name === "orphan_sub");
  assert.ok(issue, "expected unreferenced_label key on *label in preserved source never targeted");
});

test("scene with *gosub node but no *return node emits gosub_no_return key and scene name param", () => {
  const graph: SceneGraph = {
    nodes: [
      { id: "n1", type: "gosub", x: 0, y: 0, w: 240, title: "*gosub sub" },
      { id: "n2", type: "label", x: 0, y: 160, w: 240, title: "*label sub" },
      { id: "n3", type: "finish", x: 0, y: 320, w: 240, title: "*finish" },
    ],
    edges: [
      { from: "n1", to: "n3", kind: "flow" },
      { from: "n1", to: "n2", kind: "goto" },
      { from: "n2", to: "n3", kind: "flow" },
    ],
  };
  const project = { ...minimalProject(), sceneData: { intro: graph } };
  const issues = lintProject(project);
  const issue = issues.find((i) => i.key === "gosub_no_return" && i.params?.name === "intro");
  assert.ok(issue, "expected gosub_no_return key when scene has *gosub node but no *return node");
});

test("empty *title in preserved startup emits startup_empty_title key", () => {
  const project = { ...minimalProject(), startupSource: "*title\n*author Author\n*scene_list\n  intro" };
  const issue = lintProject(project).find((i) => i.key === "startup_empty_title");
  assert.ok(issue, "expected startup_empty_title key");
  assert.equal(issue!.scene, "startup");
  assert.equal(issue!.level, "error");
});

test("empty *author in preserved startup emits startup_empty_author key", () => {
  const project = { ...minimalProject(), startupSource: "*title Test\n*author\n*scene_list\n  intro" };
  const issue = lintProject(project).find((i) => i.key === "startup_empty_author");
  assert.ok(issue, "expected startup_empty_author key");
  assert.equal(issue!.scene, "startup");
  assert.equal(issue!.level, "error");
});

test("missing *scene_list in preserved startup emits startup_needs_scene_list key", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*goto_scene intro" };
  const issue = lintProject(project).find((i) => i.key === "startup_needs_scene_list");
  assert.ok(issue, "expected startup_needs_scene_list key");
  assert.equal(issue!.scene, "startup");
  assert.equal(issue!.level, "error");
});

test("invalid scene id in *scene_list emits scene_list_invalid_id key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  bad-scene" };
  const issue = lintProject(project).find((i) => i.key === "scene_list_invalid_id");
  assert.ok(issue, "expected scene_list_invalid_id key");
  assert.equal(issue!.params?.name, "bad-scene");
});

test("duplicate scene in *scene_list emits scene_list_repeat key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n  intro" };
  const issue = lintProject(project).find((i) => i.key === "scene_list_repeat");
  assert.ok(issue, "expected scene_list_repeat key");
  assert.equal(issue!.params?.name, "intro");
});

test("missing scene in *scene_list emits scene_list_missing_scene key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  noexist" };
  const issue = lintProject(project).find((i) => i.key === "scene_list_missing_scene");
  assert.ok(issue, "expected scene_list_missing_scene key");
  assert.equal(issue!.params?.name, "noexist");
});

test("*scene_list omitting a project scene emits scene_list_omits_scene key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n" };
  const issue = lintProject(project).find((i) => i.key === "scene_list_omits_scene");
  assert.ok(issue, "expected scene_list_omits_scene key");
  assert.equal(issue!.params?.name, "intro");
});

test("preserved startup omitting a project variable emits startup_omits_var key and name param", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    variables: [{ name: "score", type: "number", initial: "0", desc: "Score", fairmath: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro",
  };
  const issue = lintProject(project).find((i) => i.key === "startup_omits_var");
  assert.ok(issue, "expected startup_omits_var key");
  assert.equal(issue!.params?.name, "score");
});

test("preserved startup omitting a project achievement emits startup_omits_ach key and name param", () => {
  const project: ChoiceForgeProject = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "Desc", points: 10, hidden: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro",
  };
  const issue = lintProject(project).find((i) => i.key === "startup_omits_ach");
  assert.ok(issue, "expected startup_omits_ach key");
  assert.equal(issue!.params?.name, "hero");
});

test("invalid *create identifier emits create_invalid_id key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*create bad-name 0" };
  const issue = lintProject(project).find((i) => i.key === "create_invalid_id");
  assert.ok(issue, "expected create_invalid_id key");
  assert.equal(issue!.params?.name, "bad-name");
});

test("*create with reserved word emits create_reserved key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*create modulo 0" };
  const issue = lintProject(project).find((i) => i.key === "create_reserved");
  assert.ok(issue, "expected create_reserved key");
  assert.equal(issue!.params?.name, "modulo");
});

test("*create with empty initial value emits create_empty_value key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*create score" };
  const issue = lintProject(project).find((i) => i.key === "create_empty_value");
  assert.ok(issue, "expected create_empty_value key");
  assert.equal(issue!.params?.name, "score");
});

test("repeated *create variable emits create_repeat key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*create score 0\n*create score 1" };
  const issue = lintProject(project).find((i) => i.key === "create_repeat");
  assert.ok(issue, "expected create_repeat key");
  assert.equal(issue!.params?.name, "score");
});

test("*create for variable absent from project metadata emits create_extra_var key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*create ghost 0" };
  const issue = lintProject(project).find((i) => i.key === "create_extra_var");
  assert.ok(issue, "expected create_extra_var key");
  assert.equal(issue!.params?.name, "ghost");
});

test("invalid *achievement identifier emits ach_src_invalid_id key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement bad-id visible 10 Title" };
  const issue = lintProject(project).find((i) => i.key === "ach_src_invalid_id");
  assert.ok(issue, "expected ach_src_invalid_id key");
  assert.equal(issue!.params?.name, "bad-id");
});

test("*achievement with invalid visibility emits ach_invalid_vis key and value param", () => {
  const project = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "Desc", points: 10, hidden: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement hero secret 10 Hero",
  };
  const issue = lintProject(project).find((i) => i.key === "ach_invalid_vis");
  assert.ok(issue, "expected ach_invalid_vis key");
  assert.equal(issue!.params?.value, "secret");
});

test("*achievement with invalid points emits ach_invalid_points_src key and value param", () => {
  const project = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "Desc", points: 10, hidden: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement hero visible -5 Hero",
  };
  const issue = lintProject(project).find((i) => i.key === "ach_invalid_points_src");
  assert.ok(issue, "expected ach_invalid_points_src key");
  assert.equal(issue!.params?.value, "-5");
});

test("*achievement with empty title emits ach_src_empty_title key and name param", () => {
  const project = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "Desc", points: 10, hidden: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement hero visible 10",
  };
  const issue = lintProject(project).find((i) => i.key === "ach_src_empty_title");
  assert.ok(issue, "expected ach_src_empty_title key");
  assert.equal(issue!.params?.name, "hero");
});

test("repeated *achievement emits ach_src_repeat key and name param", () => {
  const project = {
    ...minimalProject(),
    achievements: [{ id: "hero", title: "Hero", desc: "Desc", points: 10, hidden: false }],
    startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement hero visible 10 Hero\n*achievement hero visible 10 Hero",
  };
  const issue = lintProject(project).find((i) => i.key === "ach_src_repeat");
  assert.ok(issue, "expected ach_src_repeat key");
  assert.equal(issue!.params?.name, "hero");
});

test("*achievement absent from project metadata emits ach_src_extra key and name param", () => {
  const project = { ...minimalProject(), startupSource: "*title T\n*author A\n*scene_list\n  intro\n*achievement ghost visible 10 Ghost" };
  const issue = lintProject(project).find((i) => i.key === "ach_src_extra");
  assert.ok(issue, "expected ach_src_extra key");
  assert.equal(issue!.params?.name, "ghost");
});

test("empty *if condition in preserved source emits cond_empty key and command param", () => {
  const project = importChoiceScriptArchive([
    textEntry("startup.txt", "*title T\n*author A\n*scene_list\n  ch1"),
    textEntry("ch1.txt", "*if \n  Yes\n*else\n  No\n*ending"),
  ]);
  const issue = lintProject(project).find((i) => i.key === "cond_empty");
  assert.ok(issue, "expected cond_empty key");
  assert.equal(issue!.params?.command, "if");
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
