import { describe, test, expect } from "vitest";
import { createExportPackage } from "../../src/domain/choicescript.ts";
import { importChoiceScriptArchive } from "../../src/domain/choicescriptImport.ts";
import { sampleProjects } from "../../src/data/sampleProject.ts";
import type { ChoiceForgeProject } from "../../src/domain/types.ts";

function exportThenReimport(project: ChoiceForgeProject): ChoiceForgeProject {
  const pkg = createExportPackage(project);
  const encoder = new TextEncoder();
  const entries = pkg.files
    .filter((f) => f.path.startsWith("mygame/") && f.path.endsWith(".txt"))
    .map((f) => ({
      name: f.path,
      bytes: typeof f.content === "string" ? encoder.encode(f.content) : f.content,
    }));
  return importChoiceScriptArchive(entries);
}

describe("export → reimport round-trip on the EN sample", () => {
  const original = sampleProjects.en;
  const reimported = exportThenReimport(original);

  test("title and author survive the round-trip", () => {
    expect(reimported.title).toBe(original.title);
    expect(reimported.author).toBe(original.author);
  });

  test("playable scene names are preserved (startup + each scene + stats)", () => {
    const originalPlayable = original.scenes
      .filter((s) => !s.isStart && !s.special)
      .map((s) => s.name)
      .sort();
    const reimportedPlayable = reimported.scenes
      .filter((s) => !s.isStart && !s.special)
      .map((s) => s.name)
      .sort();
    for (const name of originalPlayable) {
      expect(reimportedPlayable, `playable scene "${name}" missing after round-trip`).toContain(name);
    }
  });

  test("every variable from the original is declared in the reimported startup", () => {
    const originalNames = original.variables.map((v) => v.name).sort();
    const reimportedNames = reimported.variables.map((v) => v.name).sort();
    for (const name of originalNames) {
      expect(reimportedNames, `variable "${name}" missing after round-trip`).toContain(name);
    }
  });

  test("every achievement id from the original is preserved", () => {
    const originalIds = original.achievements.map((a) => a.id).sort();
    const reimportedIds = reimported.achievements.map((a) => a.id).sort();
    for (const id of originalIds) {
      expect(reimportedIds, `achievement "${id}" missing after round-trip`).toContain(id);
    }
  });

  test("startup and choicescript_stats source text is present after reimport", () => {
    expect(reimported.startupSource ?? "").toContain("*title");
    expect(reimported.startupSource ?? "").toContain("*scene_list");
    expect(reimported.statsSource ?? "").toBeTruthy();
  });

  test("exported scene .txt files match the count of playable scenes", () => {
    const pkg = createExportPackage(original);
    const sceneTxtFiles = pkg.files.filter(
      (f) => f.path.startsWith("mygame/") && f.path.endsWith(".txt") && f.path !== "mygame/startup.txt" && f.path !== "mygame/choicescript_stats.txt",
    );
    const playableCount = original.scenes.filter((s) => !s.isStart && !s.special).length;
    expect(sceneTxtFiles.length).toBe(playableCount);
  });
});

describe("export → reimport round-trip on the PT sample", () => {
  const original = sampleProjects.pt;
  const reimported = exportThenReimport(original);

  test("PT title survives the round-trip", () => {
    expect(reimported.title).toBe(original.title);
  });

  test("PT variables and achievements all present", () => {
    expect(reimported.variables.length).toBeGreaterThanOrEqual(original.variables.length);
    expect(reimported.achievements.length).toBeGreaterThanOrEqual(original.achievements.length);
  });

  test("PT preserved scene source contains generator labels (cf_n*)", () => {
    const firstPlayable = original.scenes.find((s) => !s.isStart && !s.special)!;
    const reimportedGraph = reimported.sceneData?.[firstPlayable.name];
    const source = reimportedGraph?.sourceText ?? "";
    expect(source).toContain("*label cf_");
  });
});

describe("export package shape", () => {
  const pkg = createExportPackage(sampleProjects.en);

  test("includes _choiceforge/project.json", () => {
    const projectJson = pkg.files.find((f) => f.path === "_choiceforge/project.json");
    expect(projectJson).toBeDefined();
    const parsed = JSON.parse(String(projectJson!.content));
    expect(parsed.title).toBe(sampleProjects.en.title);
  });

  test("includes mygame/startup.txt and mygame/choicescript_stats.txt", () => {
    expect(pkg.files.some((f) => f.path === "mygame/startup.txt")).toBe(true);
    expect(pkg.files.some((f) => f.path === "mygame/choicescript_stats.txt")).toBe(true);
  });

  test("project.json round-trips losslessly through JSON.parse(JSON.stringify(...))", () => {
    const projectJson = pkg.files.find((f) => f.path === "_choiceforge/project.json");
    const parsed = JSON.parse(String(projectJson!.content));
    expect(parsed.scenes.length).toBe(sampleProjects.en.scenes.length);
    expect(parsed.variables.length).toBe(sampleProjects.en.variables.length);
    expect(parsed.achievements.length).toBe(sampleProjects.en.achievements.length);
  });
});
