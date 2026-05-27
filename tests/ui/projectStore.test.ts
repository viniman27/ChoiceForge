import { describe, test, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectStore } from "../../src/state/projectStore.ts";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useProjectStore — initial state", () => {
  test("loads the EN sample project when localStorage is empty", () => {
    const { result } = renderHook(() => useProjectStore());
    expect(result.current.project.title).toBeTruthy();
    expect(result.current.project.scenes.length).toBeGreaterThan(0);
    expect(result.current.project.scenes.find((s) => s.isStart)).toBeDefined();
  });
});

describe("useProjectStore — updateMetadata preserves startup source on unrelated changes", () => {
  test("wordGoal change keeps preserved startupSource intact", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => {
      result.current.actions.setProject({
        ...result.current.project,
        startupSource: "*title Imported Title\n*author Test\n*scene_list\n  intro\n",
      });
    });
    expect(result.current.project.startupSource).toContain("Imported Title");

    act(() => result.current.actions.updateMetadata({ wordGoal: 5000 }));

    expect(result.current.project.wordGoal).toBe(5000);
    expect(result.current.project.startupSource).toContain("Imported Title");
  });

  test("title change clears preserved startupSource (so the next export regenerates it)", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => {
      result.current.actions.setProject({
        ...result.current.project,
        startupSource: "*title Imported Title\n*author Test\n*scene_list\n  intro\n",
      });
    });
    expect(result.current.project.startupSource).toBeDefined();

    act(() => result.current.actions.updateMetadata({ title: "New Title" }));

    expect(result.current.project.title).toBe("New Title");
    expect(result.current.project.startupSource).toBeUndefined();
  });

  test("author change clears preserved startupSource", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => {
      result.current.actions.setProject({
        ...result.current.project,
        startupSource: "*title T\n*author Old\n*scene_list\n  intro\n",
      });
    });

    act(() => result.current.actions.updateMetadata({ author: "New Author" }));

    expect(result.current.project.author).toBe("New Author");
    expect(result.current.project.startupSource).toBeUndefined();
  });
});

describe("useProjectStore — addNode respects language defaults", () => {
  test("addNode(en) seeds English prose for passage body", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("passage", "n_test_en", { x: 100, y: 100 }, "en"));
    const node = result.current.project.nodes.find((n) => n.id === "n_test_en");
    expect(node?.body).toBe("New narrative passage.");
  });

  test("addNode(pt) seeds Portuguese prose", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("passage", "n_test_pt", { x: 100, y: 100 }, "pt"));
    const node = result.current.project.nodes.find((n) => n.id === "n_test_pt");
    expect(node?.body).toBe("Nova passagem narrativa.");
  });

  test("addNode(es) seeds Spanish prose", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("passage", "n_test_es", { x: 100, y: 100 }, "es"));
    const node = result.current.project.nodes.find((n) => n.id === "n_test_es");
    expect(node?.body).toBe("Nuevo pasaje narrativo.");
  });

  test("addNode without lang falls back to English", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("passage", "n_test_default", { x: 100, y: 100 }));
    const node = result.current.project.nodes.find((n) => n.id === "n_test_default");
    expect(node?.body).toBe("New narrative passage.");
  });

  test("addNode(pt) seeds Portuguese fake_choice prompt and option text", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("fake_choice", "n_fc_pt", { x: 0, y: 0 }, "pt"));
    const node = result.current.project.nodes.find((n) => n.id === "n_fc_pt");
    expect(node?.prompt).toBe("O que voce observa?");
    expect(node?.fakeOptions?.[0]?.text).toBe("Olhar mais de perto.");
  });
});

describe("useProjectStore — duplicateNode positions clones below source by height, not width", () => {
  test("duplicateNode places clone Y at source Y + estimated height + 24, not source Y + width", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("passage", "n_wide", { x: 100, y: 100 }, "en"));
    const original = result.current.project.nodes.find((n) => n.id === "n_wide")!;
    const w = original.w;
    const idsBefore = new Set(result.current.project.nodes.map((n) => n.id));

    act(() => { result.current.actions.duplicateNode("n_wide"); });

    const clone = result.current.project.nodes.find((n) => !idsBefore.has(n.id));
    expect(clone).toBeDefined();
    expect(clone!.y).not.toBe(original.y + w + 24);
    expect(clone!.y).toBeGreaterThanOrEqual(original.y + 100);
    expect(clone!.y).toBeLessThanOrEqual(original.y + 500);
  });
});

describe("useProjectStore — variable lifecycle", () => {
  test("addVariable adds a new variable with a unique default name", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    const before = result.current.project.variables.length;
    act(() => result.current.actions.addVariable());
    expect(result.current.project.variables.length).toBe(before + 1);
  });

  test("updateVariable rename propagates to *set references in node options", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addVariable());
    const oldName = result.current.project.variables[0].name;

    act(() => result.current.actions.addNode("set", "n_set", { x: 0, y: 0 }, "en"));
    const setNode = result.current.project.nodes.find((n) => n.id === "n_set");
    expect(setNode?.sets?.[0]?.var).toBe(oldName);

    act(() => result.current.actions.updateVariable(oldName, { name: "renamed_var" }));

    const updatedSetNode = result.current.project.nodes.find((n) => n.id === "n_set");
    expect(updatedSetNode?.sets?.[0]?.var).toBe("renamed_var");
    expect(result.current.project.variables.some((v) => v.name === "renamed_var")).toBe(true);
    expect(result.current.project.variables.some((v) => v.name === oldName)).toBe(false);
  });

  test("deleteVariable removes the variable from the project", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addVariable());
    const target = result.current.project.variables[0].name;
    act(() => result.current.actions.deleteVariable(target));
    expect(result.current.project.variables.some((v) => v.name === target)).toBe(false);
  });
});

describe("useProjectStore — scene lifecycle", () => {
  test("addScene inserts new scene before the special stats scene (not after)", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    const before = result.current.project.scenes.length;
    const lastSpecialIdxBefore = result.current.project.scenes.findIndex((s) => s.special);
    expect(lastSpecialIdxBefore).toBeGreaterThanOrEqual(0);

    act(() => result.current.actions.addScene());

    expect(result.current.project.scenes.length).toBe(before + 1);
    const newScene = result.current.project.scenes.find((s) => s.current);
    expect(newScene).toBeDefined();
    expect(newScene?.special).toBeFalsy();
    expect(newScene?.isStart).toBeFalsy();
    const newSceneIdx = result.current.project.scenes.findIndex((s) => s.id === newScene!.id);
    const newSpecialIdx = result.current.project.scenes.findIndex((s) => s.special);
    expect(newSceneIdx).toBeLessThan(newSpecialIdx);
  });

  test("duplicateScene inserts the copy before the special stats scene", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    const playable = result.current.project.scenes.find((s) => !s.isStart && !s.special)!;
    act(() => result.current.actions.duplicateScene(playable.id));

    const copy = result.current.project.scenes.find((s) => s.name.endsWith("_copy"));
    expect(copy).toBeDefined();
    const copyIdx = result.current.project.scenes.findIndex((s) => s.id === copy!.id);
    const specialIdx = result.current.project.scenes.findIndex((s) => s.special);
    expect(copyIdx).toBeLessThan(specialIdx);
  });

  test("deleteScene refuses to delete the only playable scene", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    const playable = result.current.project.scenes.find((s) => !s.isStart && !s.special)!;
    const before = result.current.project.scenes.length;
    act(() => result.current.actions.deleteScene(playable.id));
    expect(result.current.project.scenes.length).toBe(before);
  });
});

describe("useProjectStore — undo/redo", () => {
  test("undo restores the previous state and redo re-applies it", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    const initialTitle = result.current.project.title;
    act(() => result.current.actions.updateMetadata({ title: "Changed Title" }));
    expect(result.current.project.title).toBe("Changed Title");
    expect(result.current.actions.canUndo).toBe(true);

    act(() => result.current.actions.undo());
    expect(result.current.project.title).toBe(initialTitle);
    expect(result.current.actions.canRedo).toBe(true);

    act(() => result.current.actions.redo());
    expect(result.current.project.title).toBe("Changed Title");
  });
});

describe("useProjectStore — connectNodes default option text", () => {
  test("connecting choice→target uses target.title as the option text (not 'Go to ...')", () => {
    const { result } = renderHook(() => useProjectStore());
    act(() => result.current.actions.newBlankProject("Test", "Author"));
    act(() => result.current.actions.addNode("choice", "n_choice", { x: 0, y: 0 }, "en"));
    act(() => result.current.actions.addNode("passage", "n_target", { x: 200, y: 0 }, "en"));
    const target = result.current.project.nodes.find((n) => n.id === "n_target")!;

    act(() => result.current.actions.connectNodes("n_choice", "n_target"));

    const choiceNode = result.current.project.nodes.find((n) => n.id === "n_choice");
    expect(choiceNode?.options?.length).toBe(1);
    expect(choiceNode?.options?.[0]?.text).toBe(target.title);
    expect(choiceNode?.options?.[0]?.text.startsWith("Go to ")).toBe(false);
  });
});
