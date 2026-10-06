import { parseSceneSourcePreview } from "../domain/sceneSourcePreview";
import type { SceneGraph } from "../domain/types";

self.onmessage = (event: MessageEvent<{ sceneName: string; sourceText: string; currentGraph?: SceneGraph }>) => {
  const { sceneName, sourceText, currentGraph } = event.data;
  try {
    const parsed = parseSceneSourcePreview(sceneName, sourceText, currentGraph);
    self.postMessage({ ok: true, graph: parsed });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
