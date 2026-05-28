import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "../domain/choicescript";
import type { ChoiceForgeProject } from "../domain/types";

type Tab = "quicktest" | "randomtest";

interface Props {
  project: ChoiceForgeProject;
  onClose: () => void;
}

interface SceneContent {
  [filename: string]: string;
}

function buildSceneContent(project: ChoiceForgeProject): SceneContent {
  const map: SceneContent = {};
  map["startup.txt"] = project.startupSource !== undefined
    ? generateStartupChoiceScript(project)
    : generateStartupChoiceScript(project);
  map["choicescript_stats.txt"] = generateStatsChoiceScript(project);
  for (const scene of project.scenes) {
    if (scene.isStart || scene.special) continue;
    map[`${scene.name}.txt`] = generateSceneChoiceScript(project, scene.name);
  }
  return map;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function buildQuicktestSrcdoc(sceneContent: SceneContent, startupSceneList: string[]): string {
  const base = window.location.origin;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Quicktest</title>
<style>
  body { font-family: ui-monospace, monospace; padding: 16px; margin: 0; background: #fff; color: #111; font-size: 12px; line-height: 1.5; }
  #status { padding: 8px 12px; background: #eef; border: 1px solid #99c; border-radius: 4px; margin-bottom: 12px; font-weight: 600; }
  #status.ok { background: #efe; border-color: #6c6; color: #163; }
  #status.fail { background: #fee; border-color: #c66; color: #611; }
  #status.run { background: #ffe; border-color: #cb6; color: #642; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
  .line { padding: 2px 0; }
  .err { color: #c00; font-weight: 600; }
  .warn { color: #b60; }
  .info { color: #555; }
  .ok { color: #060; }
  .scene-header { color: #246; font-weight: 600; margin-top: 8px; }
</style>
</head>
<body>
<div id="status" class="run">Running quicktest…</div>
<div id="log"></div>
<script src="${base}/play/util.js"></script>
<script src="${base}/play/scene.js"></script>
<script src="${base}/play/navigator.js"></script>
<script>
  // Stubs replicated from the official quicktest.html so the engine
  // can execute scenes without a UI.
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
</script>
<script src="${base}/test/embeddable-autotester.js"></script>
<script>
(function(){
  var sceneContent = ${safeJson(sceneContent)};
  var sceneFiles = Object.keys(sceneContent);
  var knownSceneNames = sceneFiles.map(function(n){return n.replace(/\\.txt$/,"");});
  var sceneList = ${safeJson(startupSceneList)};
  var logEl = document.getElementById("log");
  var statusEl = document.getElementById("status");
  var errorCount = 0;
  var warningCount = 0;
  var lineCount = 0;
  var MAX_LINES = 5000;

  function appendLine(msg, cls) {
    if (lineCount > MAX_LINES) {
      if (lineCount === MAX_LINES + 1) {
        var d = document.createElement("div");
        d.className = "line warn";
        d.textContent = "(log truncated at " + MAX_LINES + " lines)";
        logEl.appendChild(d);
      }
      lineCount++;
      return;
    }
    var div = document.createElement("div");
    div.className = "line " + (cls || "");
    div.textContent = msg;
    logEl.appendChild(div);
    lineCount++;
  }

  window.knownScenes = sceneFiles;
  window.knownImages = {};
  window.warnings = [];

  // Permissive verifies — every scene we generated is "known"; images
  // are exported as binaries in the .zip but not present here.
  Scene.prototype.verifySceneFile = function(name) {
    if (knownSceneNames.indexOf(name) < 0) {
      throw new Error("Scene referenced but not defined: " + name);
    }
  };
  Scene.prototype.verifyImage = function(){};
  // Tracking: capture every Scene.warning the engine emits.
  Scene.prototype.warning = function(message) {
    warningCount++;
    appendLine((this.lineMsg ? this.lineMsg() : "") + "WARNING " + message, "warn");
  };

  // Capture all console.log output during autotest.
  var origLog = console.log;
  console.log = function(){
    var msg = Array.prototype.slice.call(arguments).map(function(a){return typeof a === "string" ? a : String(a);}).join(" ");
    var isErr = /error|cannot|undefined|missing|not declared|invalid|line \\d+:/i.test(msg);
    if (isErr) errorCount++;
    appendLine(msg, isErr ? "err" : "info");
    origLog.apply(console, arguments);
  };

  // First pass: scan scenes for *goto_scene / *gosub_scene targets and
  // build gotoSceneLabels — mirrors the loop in quicktest.html lines 332-372.
  for (var i = 0; i < sceneFiles.length; i++) {
    var sn = knownSceneNames[i];
    var lines = sceneContent[sceneFiles[i]].split("\\n");
    for (var j = 0; j < lines.length; j++) {
      var m = /^\\s*\\*(\\w+)(.*)/.exec(lines[j]);
      if (!m) continue;
      var cmd = m[1].toLowerCase();
      if (cmd === "goto_scene" || cmd === "gosub_scene") {
        var data = (m[2] || "").trim();
        var parts = /(\\S+)\\s*(\\S*)/.exec(data);
        if (parts && parts[2]) {
          if (!window.gotoSceneLabels[parts[1]]) window.gotoSceneLabels[parts[1]] = [];
          window.gotoSceneLabels[parts[1]].push({ origin: sn, originLine: j, label: parts[2] });
        }
      }
    }
  }

  // Set up nav with the scene_list ordering so *finish knows what's next.
  window.nav = new SceneNavigator(sceneList);
  window.stats = {};

  // Run autotester per scene — exhaustive DFS over every *choice path.
  for (var k = 0; k < sceneFiles.length; k++) {
    var sceneName = knownSceneNames[k];
    if (sceneName === "choicescript_stats") continue; // not exercised by autotest
    appendLine("scene: " + sceneName, "scene-header");
    var sceneText = sceneContent[sceneFiles[k]];
    try {
      autotester(sceneText, window.nav, sceneName, window.gotoSceneLabels[sceneName]);
    } catch (err) {
      errorCount++;
      appendLine("[" + sceneName + "] " + (err && err.message ? err.message : err), "err");
    }
  }

  var ok = errorCount === 0;
  statusEl.className = ok ? "ok" : "fail";
  statusEl.textContent = ok
    ? "Quicktest passed. " + sceneFiles.length + " scenes, no errors."
    : "Quicktest failed: " + errorCount + " error(s)" + (warningCount ? ", " + warningCount + " warning(s)" : "") + ".";

  parent.postMessage({ type: "quicktest:done", ok: ok, errorCount: errorCount, warningCount: warningCount }, "*");
})();
</script>
</body>
</html>`;
}

function buildRandomtestSrcdoc(sceneContent: SceneContent, iterations: number, seed: number, sceneList: string[], initialStats: Record<string, string | number | boolean>): string {
  const base = window.location.origin;
  // Inject nav + stats setup before randomtest.js runs (in normal flow this
  // comes from web/mygame/mygame.js which we don't have).
  const mygameShim = `
nav = new SceneNavigator(${safeJson(sceneList)});
stats = ${safeJson(initialStats)};
`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Randomtest</title>
<style>
  body { font-family: ui-monospace, monospace; padding: 16px; margin: 0; background: #fff; color: #111; font-size: 12px; line-height: 1.5; }
  #status { padding: 8px 12px; background: #eef; border: 1px solid #99c; border-radius: 4px; margin-bottom: 12px; font-weight: 600; }
  #status.ok { background: #efe; border-color: #6c6; color: #163; }
  #status.fail { background: #fee; border-color: #c66; color: #611; }
  #status.run { background: #ffe; border-color: #cb6; color: #642; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
  .line { padding: 1px 0; }
  .err { color: #c00; font-weight: 600; }
  .ok { color: #060; }
</style>
</head>
<body>
<div id="status" class="run">Starting randomtest (${iterations} iterations, seed ${seed})…</div>
<div id="log"></div>
<script>
(function(){
  var sceneContent = ${safeJson(sceneContent)};
  var logEl = document.getElementById("log");
  var statusEl = document.getElementById("status");
  var errorCount = 0;
  var lineCount = 0;
  var MAX_LINES = 5000;
  var doneIterations = 0;
  var totalIterations = ${iterations};

  function appendLine(msg, cls) {
    if (lineCount > MAX_LINES) {
      if (lineCount === MAX_LINES + 1) {
        var d = document.createElement("div");
        d.className = "line";
        d.textContent = "(log truncated at " + MAX_LINES + " lines — open browser devtools to see all)";
        logEl.appendChild(d);
      }
      lineCount++;
      return;
    }
    var div = document.createElement("div");
    div.className = "line " + (cls || "");
    div.textContent = msg;
    logEl.appendChild(div);
    lineCount++;
  }

  function finish(ok, fatal) {
    statusEl.className = ok ? "ok" : "fail";
    statusEl.textContent = ok
      ? "Randomtest passed (" + totalIterations + " iterations, no errors)."
      : "Randomtest finished with " + errorCount + " error event(s)" + (fatal ? " (fatal)" : "") + ".";
    parent.postMessage({ type: "randomtest:done", ok: ok, errorCount: errorCount, fatal: !!fatal }, "*");
  }

  Promise.all([
    fetch("${base}/play/util.js").then(function(r){ return r.text(); }),
    fetch("${base}/play/scene.js").then(function(r){ return r.text(); }),
    fetch("${base}/play/navigator.js").then(function(r){ return r.text(); }),
    fetch("${base}/test/seedrandom.js").then(function(r){ return r.text(); }),
    fetch("${base}/test/randomtest.js").then(function(r){ return r.text(); }),
  ]).then(function(parts){
    var combined = [parts[0], parts[1], parts[2], parts[3], ${safeJson(mygameShim)}, parts[4]].join("\\n;\\n");
    var worker = new Worker(URL.createObjectURL(new Blob([combined], { type: "text/javascript" })));
    var settled = false;

    var passed = null; // null = unknown, true = passed, false = failed
    worker.onmessage = function(e) {
      var msg = (e.data && typeof e.data.msg === "string") ? e.data.msg : String(e.data);
      var isFailLine = /^RANDOMTEST FAILED/.test(msg) || /^ERROR:/.test(msg) || /^WARNING /.test(msg);
      if (isFailLine) errorCount++;
      appendLine(msg, isFailLine ? "err" : "");

      // Progress: each iteration prints "*****Seed N".
      var im = msg.match(/^\\*{5}Seed\\s+(\\d+)/);
      if (im) {
        doneIterations = parseInt(im[1], 10) + 1;
        if (statusEl.classList.contains("run")) {
          statusEl.textContent = "Iteration " + doneIterations + " / " + totalIterations + "…";
        }
      }

      if (passed === null && /^RANDOMTEST PASSED/.test(msg)) passed = true;
      if (passed === null && /^RANDOMTEST FAILED/.test(msg)) passed = false;

      // randomtest emits "Time: Xs" only on the PASSED path. On a fatal error
      // it sets processExit=true and skips the closing block, so we have to
      // settle on RANDOMTEST FAILED itself or the UI hangs at "Running…".
      if (!settled && (/^Time:/.test(msg) || /^RANDOMTEST FAILED/.test(msg))) {
        settled = true;
        finish(passed === true && errorCount === 0, false);
      }
    };

    worker.onerror = function(err) {
      if (settled) return;
      settled = true;
      errorCount++;
      appendLine("Worker error: " + (err.message || err), "err");
      finish(false, true);
    };

    worker.postMessage({
      iterations: totalIterations,
      randomSeed: ${seed},
      showText: false,
      showCoverage: false,
      highlightGenderPronouns: false,
      showChoices: false,
      avoidUsedOptions: true,
      recordBalance: false,
      sceneContent: sceneContent
    });
  }).catch(function(err){
    appendLine("Failed to load test runner: " + err.message, "err");
    finish(false, true);
  });
})();
</script>
</body>
</html>`;
}

export function ValidationView({ project, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("quicktest");
  const [iterations, setIterations] = useState(1000);
  const [seed, setSeed] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; errorCount: number; warningCount?: number; fatal?: boolean } | null>(null);
  const [srcdoc, setSrcdoc] = useState<string>("");
  const [iframeKey, setIframeKey] = useState(0);

  const sceneContent = useMemo(() => buildSceneContent(project), [project]);
  const startupSceneList = useMemo(() => {
    const playable = project.scenes.filter((s) => !s.isStart && !s.special).map((s) => s.name);
    return ["startup", ...playable];
  }, [project]);
  const initialStats = useMemo(() => {
    const stats: Record<string, string | number | boolean> = {};
    for (const v of project.variables) {
      const raw = v.initial;
      if (v.type === "number") {
        const n = Number(raw);
        stats[v.name] = Number.isFinite(n) ? n : 0;
      } else if (v.type === "boolean") {
        stats[v.name] = raw === "true";
      } else {
        stats[v.name] = raw ?? "";
      }
    }
    return stats;
  }, [project]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "quicktest:done" || data.type === "randomtest:done") {
        setRunning(false);
        setResult({ ok: !!data.ok, errorCount: data.errorCount | 0, warningCount: data.warningCount, fatal: !!data.fatal });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const runTest = useCallback(() => {
    setResult(null);
    setRunning(true);
    if (tab === "quicktest") {
      setSrcdoc(buildQuicktestSrcdoc(sceneContent, startupSceneList));
    } else {
      setSrcdoc(buildRandomtestSrcdoc(sceneContent, iterations, seed, startupSceneList, initialStats));
    }
    setIframeKey((k) => k + 1);
  }, [tab, sceneContent, startupSceneList, initialStats, iterations, seed]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSrcdoc("");
    setResult(null);
    setRunning(false);
  };

  return (
    <div className="official-play validation-view">
      <div className="official-play-head">
        <h1>Validate for submission</h1>
        <div className="validation-tabs">
          <button className={`validation-tab ${tab === "quicktest" ? "is-active" : ""}`} onClick={() => switchTab("quicktest")}>Quicktest</button>
          <button className={`validation-tab ${tab === "randomtest" ? "is-active" : ""}`} onClick={() => switchTab("randomtest")}>Randomtest</button>
        </div>
        <div className="official-play-actions">
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      <div className="validation-controls">
        {tab === "quicktest" ? (
          <p className="validation-hint">
            <strong>Quicktest</strong> walks every possible path through every scene exhaustively. Catches missing labels, undefined variables, runtime errors. Choice of Games requires this to pass with zero errors before submission.
          </p>
        ) : (
          <>
            <p className="validation-hint">
              <strong>Randomtest</strong> plays the game N times randomly. Catches errors in rare paths and reports line coverage. Choice of Games typically requires <strong>≥ 10 000 iterations</strong> with zero errors.
            </p>
            <label className="validation-field">
              <span>Iterations</span>
              <input type="number" min={10} max={100000} step={100} value={iterations} disabled={running} onChange={(e) => setIterations(Math.max(10, Math.min(100000, parseInt(e.target.value, 10) || 1000)))} />
            </label>
            <label className="validation-field">
              <span>Seed</span>
              <input type="number" value={seed} disabled={running} onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)} />
            </label>
          </>
        )}
        <button className="ghost-btn validation-run-btn" onClick={runTest} disabled={running}>
          {running ? "Running…" : `Run ${tab}`}
        </button>
        {result && (
          <span className={`validation-result-pill ${result.ok ? "ok" : "fail"}`}>
            {result.ok ? "✓ passed" : `✗ ${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}${result.fatal ? " (fatal)" : ""}`}
          </span>
        )}
      </div>
      {srcdoc ? (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          className="official-play-iframe validation-iframe"
          srcDoc={srcdoc}
          title={tab === "quicktest" ? "Quicktest results" : "Randomtest results"}
        />
      ) : (
        <div className="validation-empty">
          <p>Click <strong>Run {tab}</strong> above to start. Results appear here.</p>
        </div>
      )}
    </div>
  );
}
