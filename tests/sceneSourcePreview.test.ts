import test from "node:test";
import assert from "node:assert/strict";
import { parseSceneSourcePreview, SOURCE_PREVIEW_MAX_LINES } from "../src/domain/sceneSourcePreview.ts";

test("parseSceneSourcePreview handles 6000-line scenes within explicit limits", () => {
  const sourceText = [...Array.from({ length: 5999 }, (_, index) => `Line ${index + 1}.`), "*finish"].join("\n");
  const graph = parseSceneSourcePreview("large_scene", sourceText);
  assert.equal(graph.sourceText, sourceText);
  assert.ok(graph.nodes.length > 0);
});

test("parseSceneSourcePreview rejects scenes beyond the explicit line limit", () => {
  const sourceText = Array.from({ length: SOURCE_PREVIEW_MAX_LINES + 1 }, () => "Line.").join("\n");
  assert.throws(
    () => parseSceneSourcePreview("too_large", sourceText),
    /too many lines to preview safely/,
  );
});
