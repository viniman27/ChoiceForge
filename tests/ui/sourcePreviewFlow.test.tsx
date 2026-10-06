import { fireEvent, render, renderHook, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, test, beforeEach, vi } from "vitest";
import { generateSceneChoiceScript } from "../../src/domain/choicescript.ts";
import type { ChoiceForgeProject } from "../../src/domain/types.ts";
import { GeneratedDocumentView } from "../../src/components/GeneratedDocumentView.tsx";
import { useProjectStore } from "../../src/state/projectStore.ts";

beforeEach(() => {
  window.localStorage.clear();
});

function projectWithPreservedScene(sourceText: string): ChoiceForgeProject {
  return {
    title: "Preview Test",
    author: "Tester",
    sceneTitle: "intro",
    sceneSubtitle: "intro.txt",
    scenes: [
      { id: "startup", name: "startup", isStart: true, words: 0, nodes: 0 },
      { id: "intro", name: "intro", current: true, words: 0, nodes: 0 },
      { id: "choicescript_stats", name: "choicescript_stats", special: true, words: 0, nodes: 0 },
    ],
    variables: [],
    achievements: [],
    assets: [],
    nodes: [],
    edges: [],
    sceneData: { intro: { nodes: [], edges: [], sourceText } },
    lints: [],
  };
}

describe("source-to-graph preview flow", () => {
  test("previewCurrentScene builds graph nodes while preserving source export and supports undo", async () => {
    const source = "*label start\nOriginal text.\n*choice\n  #Stay\n    *finish\n  #Leave\n    *finish\n";
    const { result } = renderHook(() => useProjectStore());

    act(() => result.current.actions.setProject(projectWithPreservedScene(source)));
    expect(result.current.project.nodes).toHaveLength(0);

    await act(async () => {
      await result.current.actions.previewCurrentScene();
    });

    expect(result.current.project.nodes.length).toBeGreaterThan(1);
    expect(result.current.project.sceneData?.intro.sourceText).toBe(source);
    expect(generateSceneChoiceScript(result.current.project, "intro")).toBe(source.trimEnd());
    expect(result.current.actions.canUndo).toBe(true);

    act(() => result.current.actions.undo());
    expect(result.current.project.sceneData?.intro.sourceText).toBe(source);
    expect(result.current.project.nodes).toHaveLength(0);
  });

  test("convertCurrentSceneToVisual tracks undo and removes source only from the converted state", async () => {
    const source = "Converted text.\n*finish\n";
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.setProject(projectWithPreservedScene(source)));

    await act(async () => {
      await result.current.actions.convertCurrentSceneToVisual();
    });

    expect(result.current.project.nodes.length).toBeGreaterThan(0);
    expect(result.current.project.sceneData?.intro.sourceText).toBeUndefined();
    expect(generateSceneChoiceScript(result.current.project, "intro")).not.toBe(source.trimEnd());

    act(() => result.current.actions.undo());
    expect(result.current.project.sceneData?.intro.sourceText).toBe(source);
    expect(generateSceneChoiceScript(result.current.project, "intro")).toBe(source.trimEnd());
  });

  test("a stale preview result does not overwrite a newer scene edit", async () => {
    let releaseParse: ((graph: import("../../src/domain/types.ts").SceneGraph) => void) | undefined;
    const parser = vi.fn(() => new Promise<import("../../src/domain/types.ts").SceneGraph>((resolve) => { releaseParse = resolve; }));
    const source = "Old text.\n*finish\n";
    const newer = "Newer text.\n*ending\n";
    const { result } = renderHook(() => useProjectStore({ parseSceneSource: parser }));
    act(() => result.current.actions.setProject(projectWithPreservedScene(source)));

    const previewPromise = result.current.actions.previewCurrentScene();
    await waitFor(() => expect(parser).toHaveBeenCalled());

    act(() => result.current.actions.replaceCurrentSceneText(newer));
    releaseParse?.({ nodes: [{ id: "stale", type: "passage", x: 0, y: 0, w: 300, title: "stale", body: "stale" }], edges: [], sourceText: source });
    await act(async () => {
      await previewPromise;
    });

    expect(result.current.project.sceneData?.intro.sourceText).toBe(newer);
    expect(result.current.project.nodes.some((node) => node.id === "stale")).toBe(false);
  });

  test("preview errors are exposed and leave preserved source untouched", async () => {
    const source = "Too difficult.\n*finish\n";
    const parser = vi.fn().mockRejectedValue(new Error("Preview limit hit"));
    const { result } = renderHook(() => useProjectStore({ parseSceneSource: parser }));
    act(() => result.current.actions.setProject(projectWithPreservedScene(source)));

    await act(async () => {
      await result.current.actions.previewCurrentScene();
    });

    expect(result.current.sceneConversionError).toBe("Preview limit hit");
    expect(result.current.project.sceneData?.intro.sourceText).toBe(source);
    expect(result.current.project.nodes).toHaveLength(0);
  });

  test("GeneratedDocumentView exposes a safe preview button and reports preserved-source status", async () => {
    const onPreviewSource = vi.fn().mockResolvedValue(undefined);
    render(
      <GeneratedDocumentView
        title="intro.txt"
        path="scenes/intro.txt"
        description="Imported scene"
        content="Original text.\n*finish\n"
        editable
        sourcePreserved
        onPreviewSource={onPreviewSource}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show graph preview" }));
    await waitFor(() => expect(onPreviewSource).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Graph preview updated. Source text is still preserved for export.")).toBeInTheDocument();
  });
});
