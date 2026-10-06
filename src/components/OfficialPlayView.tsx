import { useCallback, useRef, useState } from "react";
import type { ChoiceForgeProject } from "../domain/types";
import { buildOfficialPlaySrcdoc } from "../platform/playableExport";

interface Props {
  project: ChoiceForgeProject;
  onClose: () => void;
}

function buildSrcdoc(project: ChoiceForgeProject, forcedScene: string): string {
  return buildOfficialPlaySrcdoc(project, forcedScene, `${window.location.origin}/play`);
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
