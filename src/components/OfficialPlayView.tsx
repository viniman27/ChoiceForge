import { useCallback, useRef, useState } from "react";
import { generateSceneChoiceScript, generateStartupChoiceScript, generateStatsChoiceScript } from "../domain/choicescript";
import type { ChoiceForgeProject } from "../domain/types";

interface Props {
  project: ChoiceForgeProject;
  onClose: () => void;
}

interface CompiledScene {
  crc: number;
  lines: string[];
  labels: Record<string, number>;
}

function compileScene(text: string): CompiledScene {
  const lines = text.replace(/\r/g, "").split("\n");
  const labels: Record<string, number> = {};
  const labelRe = /^(\s*)\*(\w+)(.*)/;
  for (let i = 0; i < lines.length; i++) {
    const m = labelRe.exec(lines[i]);
    if (!m) continue;
    if (m[2].toLowerCase() === "label") {
      const name = m[3].trim().toLowerCase();
      if (name && !Object.prototype.hasOwnProperty.call(labels, name)) labels[name] = i;
    }
  }
  return { crc: 0, lines, labels };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function buildInitJs(project: ChoiceForgeProject, forcedScene: string): string {
  const playableScenes = project.scenes.filter((s) => !s.isStart && !s.special);
  const firstScene = playableScenes[0]?.name ?? project.sceneTitle;

  const startupText = project.startupSource !== undefined
    ? generateStartupChoiceScript(project)
    : generateStartupChoiceScript({ ...project, sceneTitle: firstScene });

  const allScenes: Record<string, CompiledScene> = { startup: compileScene(startupText) };
  for (const scene of project.scenes) {
    if (!scene.isStart && !scene.special) {
      allScenes[scene.name] = compileScene(generateSceneChoiceScript(project, scene.name));
    }
  }
  allScenes["choicescript_stats"] = compileScene(generateStatsChoiceScript(project));

  const initialStats: Record<string, string | number | boolean> = {};
  for (const v of project.variables) {
    if (v.type === "number") {
      const n = Number(v.initial);
      initialStats[v.name] = isNaN(n) ? 0 : n;
    } else if (v.type === "boolean") {
      initialStats[v.name] = v.initial === "true";
    } else {
      initialStats[v.name] = v.initial;
    }
  }

  const achievements = project.achievements.map((a) => [
    a.id, !a.hidden, a.points, a.title, a.postDesc || a.desc, a.preDesc || a.desc,
  ]);

  // When jumping to a specific scene, initialize nav with the full scene chain so
  // *finish commands know which scene comes next. Override getStartupScene to skip
  // the startup scene entirely and go directly to the chosen scene.
  const navInit = forcedScene
    ? `new SceneNavigator(${safeJson(["startup", ...playableScenes.map((s) => s.name)])})`
    : `new SceneNavigator(["startup"])`;

  const forcedOverride = forcedScene
    ? `window.nav.getStartupScene=function(){return ${safeJson(forcedScene)};};`
    : "";

  return `(function(){
window.storeName=null;window.version="1.0";
window.knownProducts=[];window.purchases={};
window.achievements=${safeJson(achievements)};
window.nav=${navInit};
${forcedOverride}
window.stats=${safeJson(initialStats)};
window.allScenes=${safeJson(allScenes)};
})();`;
}

function buildSrcdoc(project: ChoiceForgeProject, forcedScene: string): string {
  const base = window.location.origin;
  const play = `${base}/play`;
  const initJs = buildInitJs(project, forcedScene);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script>window.version="UNKNOWN";</script>
<script src="${play}/persist.js"></script>
<script src="${play}/alertify.min.js"></script>
<script src="${play}/util.js"></script>
<link rel="stylesheet" href="${play}/style.css">
<style id="dynamic"></style>
<script src="${play}/ui.js"></script>
<script src="${play}/scene.js"></script>
<script src="${play}/navigator.js"></script>
<script>${initJs}</script>
<link rel="stylesheet" href="${play}/alertify.css">
<script>window.storeName=null;var rootDir="${base}/";</script>
</head>
<body>
<div id="container1" class="container">
  <div id="header">
    <div id="identity">
      <span id="title"></span>
      <span id="author"></span>
      <a id="email" href="#" style="display:none"></a>
      <a id="logout" href="#" style="display:none"></a>
    </div>
    <div id="headerLinks">
      <button id="statsButton" accesskey="q" onclick="showStats()">Show Stats</button>
      <button id="achievementsButton" style="display:none" onclick="showAchievements()">Achievements</button>
      <button id="restartButton" onclick="restartGame()">Restart</button>
      <button id="menuButton" accesskey="w" onclick="textOptionsMenu()">Menu</button>
      <button id="bugButton" style="display:none" onclick="reportBug()">Report Bug</button>
    </div>
  </div>
  <div id="main"><div id="text"></div></div>
  <div id="footer"><div id="back"></div></div>
</div>
</body>
</html>`;
}

export function OfficialPlayView({ project, onClose }: Props) {
  const [startScene, setStartScene] = useState("");
  const [srcdoc, setSrcdoc] = useState(() => buildSrcdoc(project, ""));
  const [iframeKey, setIframeKey] = useState(0);
  const projectRef = useRef(project);
  projectRef.current = project;

  const playFrom = useCallback((scene: string) => {
    setStartScene(scene);
    setSrcdoc(buildSrcdoc(projectRef.current, scene));
    setIframeKey((k) => k + 1);
  }, []);

  const handleReload = useCallback(() => {
    setSrcdoc(buildSrcdoc(projectRef.current, startScene));
    setIframeKey((k) => k + 1);
  }, [startScene]);

  const playableScenes = project.scenes.filter((s) => !s.isStart && !s.special);

  return (
    <div className="official-play">
      <div className="official-play-head">
        <h1>{project.title}</h1>
        <div className="official-play-actions">
          {playableScenes.length > 1 && (
            <select
              className="official-play-scene-select"
              value={startScene}
              onChange={(e) => playFrom(e.target.value)}
              title="Start from scene"
            >
              <option value="">from beginning</option>
              {playableScenes.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          )}
          <button className="icon-btn" onClick={handleReload} title="Reload game with latest changes">↺</button>
          <button className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>
      </div>
      <iframe
        key={iframeKey}
        className="official-play-iframe"
        srcDoc={srcdoc}
        title="ChoiceScript preview"
      />
    </div>
  );
}
