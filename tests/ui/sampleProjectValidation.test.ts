import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { availableSamples, sampleProjects } from "../../src/data/sampleProject.ts";
import { generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript, lintProject } from "../../src/domain/choicescript.ts";
import type { ChoiceForgeProject } from "../../src/domain/types.ts";

const root = resolve(__dirname, "../..");

function buildSceneContent(project: ChoiceForgeProject): Record<string, string> {
  const map: Record<string, string> = {};
  map["startup.txt"] = generateStartupChoiceScript(project);
  map["choicescript_stats.txt"] = generateStatsChoiceScript(project);
  for (const scene of project.scenes) {
    if (scene.isStart || scene.special) continue;
    map[`${scene.name}.txt`] = generateSceneChoiceScript(project, scene.name);
  }
  return map;
}

interface QuicktestResult {
  errors: string[];
  warnings: string[];
}

function runQuicktest(project: ChoiceForgeProject): QuicktestResult {
  const sceneContent = buildSceneContent(project);
  const playable = project.scenes.filter((s) => !s.isStart && !s.special).map((s) => s.name);
  const sceneList = ["startup", ...playable];

  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { runScripts: "outside-only", url: "https://localhost/" });
  const w: any = dom.window;
  const errors: string[] = [];
  const warnings: string[] = [];

  w.eval(`
    window.printFooter = function(){};
    window.printShareLinks = function(){};
    window.printLink = function(){};
    window.printButton = function(){};
    window.printImage = function(){};
    window.showPassword = function(){};
    window.achieve = function(){};
    window.loginForm = function(){};
    window.printDiscount = function(){};
    window.isRegistered = function(){return false;};
    window.isRegisterAllowed = function(){return false;};
    window.isRestorePurchasesSupported = function(){return false;};
    window.isFullScreenAdvertisingSupported = function(){return false;};
    window.areSaveSlotsSupported = function(){return false;};
    window.isAdvertisingSupported = function(){return false;};
    window.isPrerelease = function(){return false;};
    window.showFullScreenAdvertisementButton = function(m, cb){cb();};
    window.initStore = function(){return false;};
    window.safeCall = function(obj, fn){ return obj ? fn.call(obj) : fn.call(); };
    window.clearScreen = function(code){ if (typeof code === "function") code.call(); };
    window.saveCookie = function(cb){ if (cb) cb.call(); };
    window.doneLoading = function(){};
    window.changeTitle = function(){};
    window.printBody = function(){};
    window.println = function(){};
    window.gotoSceneLabels = {};
    window.uncoveredScenes = [];
    window.success = true;
    window.knownImages = {};
    window.warnings = [];
    window.sceneList = ${JSON.stringify(sceneList)};
    window.knownScenes = ${JSON.stringify(Object.keys(sceneContent))};
  `);

  w.eval(readFileSync(resolve(root, "public/play/util.js"), "utf8"));
  w.eval(readFileSync(resolve(root, "public/play/navigator.js"), "utf8"));
  w.eval(readFileSync(resolve(root, "public/play/scene.js"), "utf8"));

  const knownSceneNames = Object.keys(sceneContent).map((n) => n.replace(/\.txt$/, ""));
  w.eval(`
    var __knownSceneNames = ${JSON.stringify(knownSceneNames)};
    Scene.prototype.verifySceneFile = function(name){
      if (__knownSceneNames.indexOf(name) < 0) {
        throw new Error("Scene referenced but not defined: " + name);
      }
    };
    Scene.prototype.verifyImage = function(){};
    Scene.prototype.warning = function(message){
      window.warnings.push((this.lineMsg ? this.lineMsg() : "") + "WARNING " + message);
    };
  `);

  // Capture console.log as the autotester's error channel.
  const origLog = w.console.log;
  w.console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    if (/error|cannot|undefined|missing|not declared|invalid|line \d+:/i.test(msg)) {
      errors.push(msg);
    }
    origLog(msg);
  };

  w.eval(readFileSync(resolve(root, "public/test/embeddable-autotester.js"), "utf8"));

  // gotoSceneLabels scan (mirrors quicktest.html lines 332-372)
  for (const file of Object.keys(sceneContent)) {
    const sn = file.replace(/\.txt$/, "");
    const lines = sceneContent[file].split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /^\s*\*(\w+)(.*)/.exec(lines[i]);
      if (!m) continue;
      const cmd = m[1].toLowerCase();
      if (cmd === "goto_scene" || cmd === "gosub_scene") {
        const parts = /(\S+)\s*(\S*)/.exec((m[2] || "").trim());
        if (parts && parts[2]) {
          if (!w.gotoSceneLabels[parts[1]]) w.gotoSceneLabels[parts[1]] = [];
          w.gotoSceneLabels[parts[1]].push({ origin: sn, originLine: i, label: parts[2] });
        }
      }
    }
  }

  w.eval(`
    window.nav = new SceneNavigator(${JSON.stringify(sceneList)});
    window.stats = {};
  `);

  for (const file of Object.keys(sceneContent)) {
    const sceneName = file.replace(/\.txt$/, "");
    if (sceneName === "choicescript_stats") continue;
    const sceneText = sceneContent[file];
    try {
      w.eval(`autotester(${JSON.stringify(sceneText)}, window.nav, ${JSON.stringify(sceneName)}, window.gotoSceneLabels[${JSON.stringify(sceneName)}]);`);
    } catch (err) {
      errors.push(`[${sceneName}] ${(err as Error).message}`);
    }
  }

  // Collected warnings from Scene.prototype.warning
  for (const wn of w.warnings) warnings.push(String(wn));

  return { errors, warnings };
}

describe("sample project passes quicktest", () => {
  for (const lang of ["pt", "en", "es"] as const) {
    test(`${lang} sample: lintProject returns 0 errors`, () => {
      const issues = lintProject(sampleProjects[lang]);
      const errs = issues.filter((i) => i.level === "error");
      if (errs.length) {
        console.error("Lint errors:", errs.map((e) => `[${e.scene ?? "?"}] ${e.key}: ${e.msg}`));
      }
      expect(errs).toEqual([]);
    });

    test(`${lang} sample: quicktest passes with no errors`, () => {
      const result = runQuicktest(sampleProjects[lang]);
      if (result.errors.length) {
        console.error("Quicktest errors:", result.errors);
      }
      expect(result.errors).toEqual([]);
    });
  }
});

describe("every registered sample passes lint+quicktest in every language", () => {
  for (const sample of availableSamples) {
    for (const lang of ["pt", "en", "es"] as const) {
      test(`${sample.id} [${lang}]: lintProject returns 0 errors`, () => {
        const issues = lintProject(sample.projects[lang]);
        const errs = issues.filter((i) => i.level === "error");
        if (errs.length) {
          console.error(`Lint errors in ${sample.id} [${lang}]:`, errs.map((e) => `[${e.scene ?? "?"}] ${e.key}: ${e.msg}`));
        }
        expect(errs).toEqual([]);
      });

      test(`${sample.id} [${lang}]: quicktest passes with no errors`, () => {
        const result = runQuicktest(sample.projects[lang]);
        if (result.errors.length) {
          console.error(`Quicktest errors in ${sample.id} [${lang}]:`, result.errors);
        }
        expect(result.errors).toEqual([]);
      });
    }
  }
});
