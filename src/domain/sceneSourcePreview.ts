import { importChoiceScriptSceneText } from "./choicescriptImport.ts";
import { layoutSceneGraph } from "./graphLayout.ts";
import type { SceneGraph } from "./types.ts";

export const SOURCE_PREVIEW_MAX_LINES = 8_000;
export const SOURCE_PREVIEW_MAX_CHARS = 750_000;

export function assertSourcePreviewWithinLimits(sourceText: string) {
  if (sourceText.length > SOURCE_PREVIEW_MAX_CHARS) {
    throw new Error(`Scene source is too large to preview safely (${sourceText.length.toLocaleString()} characters, limit ${SOURCE_PREVIEW_MAX_CHARS.toLocaleString()}).`);
  }
  const lineCount = sourceText.split(/\r?\n/).length;
  if (lineCount > SOURCE_PREVIEW_MAX_LINES) {
    throw new Error(`Scene source has too many lines to preview safely (${lineCount.toLocaleString()} lines, limit ${SOURCE_PREVIEW_MAX_LINES.toLocaleString()}).`);
  }
}

export function parseSceneSourcePreview(sceneName: string, sourceText: string, currentGraph?: SceneGraph): SceneGraph {
  assertSourcePreviewWithinLimits(sourceText);
  const parsed = importChoiceScriptSceneText(sceneName, sourceText, currentGraph);
  const laidOut = layoutSceneGraph(parsed);
  return { ...laidOut, sourceText };
}
