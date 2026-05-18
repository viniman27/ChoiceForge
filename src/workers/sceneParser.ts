import { importChoiceScriptSceneText } from "../domain/choicescriptImport";
import { layoutSceneGraph } from "../domain/graphLayout";

self.onmessage = (event: MessageEvent<{ sceneName: string; sourceText: string }>) => {
  const { sceneName, sourceText } = event.data;
  try {
    const parsed = layoutSceneGraph({
      ...importChoiceScriptSceneText(sceneName, sourceText),
      sourceText,
    });
    self.postMessage({ ok: true, graph: parsed });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
