import { describe, test, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeftPanel } from "../../src/components/LeftPanel.tsx";
import { sampleProjects, i18n } from "../../src/data/sampleProject.ts";
import type { ChoiceForgeProject, Language } from "../../src/domain/types.ts";

const noop = vi.fn();
const replaceReturn = vi.fn().mockReturnValue(0);

function setupProps(lang: Language = "en") {
  const data: ChoiceForgeProject = JSON.parse(JSON.stringify(sampleProjects[lang]));
  data.lints = [];
  return {
    data,
    activeTab: "scenes",
    setActiveTab: noop,
    activeSceneId: data.scenes.find((s) => !s.isStart && !s.special)?.id ?? "",
    labels: i18n[lang],
    onAddScene: noop,
    onSelectScene: noop,
    onUpdateScene: noop,
    onMoveScene: noop,
    onMoveSceneBefore: noop,
    onDuplicateScene: noop,
    onDeleteScene: noop,
    onAddVariable: noop,
    onUpdateVariable: noop,
    onDeleteVariable: noop,
    onMoveVariable: noop,
    onAddAchievement: noop,
    onUpdateAchievement: noop,
    onDeleteAchievement: noop,
    onMoveAchievement: noop,
    onAddAsset: noop,
    onUpdateAsset: noop,
    onDeleteAsset: noop,
    onSelectNode: noop,
    onReplace: replaceReturn,
  } as const;
}

beforeEach(() => {
  noop.mockClear();
  replaceReturn.mockClear();
  replaceReturn.mockReturnValue(0);
});

describe("LeftPanel — i18n: search results respect the editor language", () => {
  test("EN sample: typing a query that matches nothing shows 'no results' in English", async () => {
    const user = userEvent.setup();
    render(<LeftPanel {...setupProps("en")} />);
    await user.type(screen.getByPlaceholderText(i18n.en.search), "zzzznonexistent_query_zzzz");
    expect(screen.getByText("no results")).toBeInTheDocument();
  });

  test("PT sample: same query shows 'nenhum resultado' in Portuguese", async () => {
    const user = userEvent.setup();
    render(<LeftPanel {...setupProps("pt")} />);
    await user.type(screen.getByPlaceholderText(i18n.pt.search), "zzzznonexistent_query_zzzz");
    expect(screen.getByText("nenhum resultado")).toBeInTheDocument();
  });

  test("ES sample: same query shows 'sin resultados' in Spanish (previously broken — fell back to PT)", async () => {
    const user = userEvent.setup();
    render(<LeftPanel {...setupProps("es")} />);
    await user.type(screen.getByPlaceholderText(i18n.es.search), "zzzznonexistent_query_zzzz");
    expect(screen.getByText("sin resultados")).toBeInTheDocument();
  });
});

describe("LeftPanel — search results title is properly localized", () => {
  test("EN renders 'results' as the section title", async () => {
    const user = userEvent.setup();
    render(<LeftPanel {...setupProps("en")} />);
    await user.type(screen.getByPlaceholderText(i18n.en.search), "scene");
    expect(screen.getByText("results")).toBeInTheDocument();
  });

  test("ES renders 'resultados' (not 'resultados' via the Portuguese path)", async () => {
    const user = userEvent.setup();
    render(<LeftPanel {...setupProps("es")} />);
    await user.type(screen.getByPlaceholderText(i18n.es.search), "scene");
    expect(screen.getByText("resultados")).toBeInTheDocument();
  });
});

describe("LeftPanel — VariablesList renders without React key warning", () => {
  test("rendering the variables tab does not trigger 'Each child in a list should have a unique key' warning", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const props = { ...setupProps("en"), activeTab: "variables" as const };
    render(<LeftPanel {...props} />);
    const keyWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0] ?? "").includes("unique \"key\" prop")
      || String(call[0] ?? "").includes("Each child in a list"),
    );
    expect(keyWarnings).toHaveLength(0);
    consoleError.mockRestore();
  });
});

describe("LeftPanel — scene selection is reliable", () => {
  test("clicking a scene name field opens that scene on the first click", async () => {
    const user = userEvent.setup();
    const onSelectScene = vi.fn();
    render(<LeftPanel {...setupProps("pt")} activeSceneId="intro" onSelectScene={onSelectScene} />);

    await user.click(screen.getByDisplayValue("sala_maquinas"));

    expect(onSelectScene).toHaveBeenCalledTimes(1);
    expect(onSelectScene).toHaveBeenCalledWith("sala_maquinas");
  });

  test("scene name editing still renames the scene without bubbling duplicate/delete controls", async () => {
    const user = userEvent.setup();
    const onSelectScene = vi.fn();
    const onUpdateScene = vi.fn();
    const onDuplicateScene = vi.fn();
    const onDeleteScene = vi.fn();
    render(
      <LeftPanel
        {...setupProps("pt")}
        activeSceneId="intro"
        onSelectScene={onSelectScene}
        onUpdateScene={onUpdateScene}
        onDuplicateScene={onDuplicateScene}
        onDeleteScene={onDeleteScene}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("sala_maquinas"), { target: { value: "Nova Cena!" } });
    expect(onUpdateScene).toHaveBeenCalledWith("sala_maquinas", { name: "nova_cena_" });

    await user.click(screen.getByRole("button", { name: `${i18n.pt.miniDup} sala_maquinas` }));
    await user.click(screen.getByRole("button", { name: `${i18n.pt.miniDel} sala_maquinas` }));

    expect(onDuplicateScene).toHaveBeenCalledWith("sala_maquinas");
    expect(onDeleteScene).toHaveBeenCalledWith("sala_maquinas");
    expect(onSelectScene).not.toHaveBeenCalled();
  });
});

describe("LeftPanel — imported startup scenes are not deceptive duplicates", () => {
  test("startup.txt with preserved source and a narrative graph appears as one scene entry with source and graph actions", async () => {
    const user = userEvent.setup();
    const onSelectScene = vi.fn();
    const props = setupProps("en");
    const data: ChoiceForgeProject = {
      ...props.data,
      startupSource: "*title Imported\n*author Writer\n*scene_list\n  startup\nOpening.\n*finish",
      sceneTitle: "startup",
      nodes: [{ id: "n1", type: "passage", title: "startup_text_1", body: "Opening.", x: 0, y: 0, w: 260 }],
      edges: [],
      sceneData: {
        startup: {
          nodes: [{ id: "n1", type: "passage", title: "startup_text_1", body: "Opening.", x: 0, y: 0, w: 260 }],
          edges: [],
          sourceText: "Opening.\n*finish",
        },
      },
      scenes: [
        { id: "startup", name: "startup", words: 6, nodes: 0, isStart: true },
        { id: "scene_startup", name: "startup", words: 2, nodes: 1, current: true },
        { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
      ],
    };

    render(<LeftPanel {...props} data={data} onSelectScene={onSelectScene} activeSceneId="scene_startup" />);

    expect(screen.getAllByText("startup.txt")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /open startup.txt source/i }));
    await user.click(screen.getByRole("button", { name: /open startup.txt graph/i }));

    expect(onSelectScene).toHaveBeenCalledWith("startup");
    expect(onSelectScene).toHaveBeenCalledWith("scene_startup");
  });

  test("metadata-only startup remains available as the preserved startup source", () => {
    const props = setupProps("en");
    const data: ChoiceForgeProject = {
      ...props.data,
      startupSource: "*title Imported\n*author Writer\n*scene_list\n  chapter_one",
      scenes: [
        { id: "startup", name: "startup", words: 5, nodes: 0, isStart: true },
        { id: "chapter_one", name: "chapter_one", words: 2, nodes: 1, current: true },
        { id: "stats", name: "choicescript_stats", words: 0, nodes: 0, special: true },
      ],
    };

    render(<LeftPanel {...props} data={data} activeSceneId="chapter_one" />);

    expect(screen.getAllByText("startup.txt")).toHaveLength(1);
    expect(screen.getByText("start")).toBeInTheDocument();
    expect(screen.getByText("source")).toBeInTheDocument();
  });
});

describe("LeftPanel — replace status uses i18n keys", () => {
  test("0-match replace in EN shows 'no matches'", async () => {
    const user = userEvent.setup();
    replaceReturn.mockReturnValue(0);
    render(<LeftPanel {...setupProps("en")} />);
    await user.type(screen.getByPlaceholderText(i18n.en.search), "anything");
    await user.click(screen.getByTitle("find & replace (Ctrl H)"));
    await user.click(screen.getByText("scene"));
    expect(screen.getByText("no matches")).toBeInTheDocument();
  });

  test("0-match replace in ES shows 'sin coincidencias'", async () => {
    const user = userEvent.setup();
    replaceReturn.mockReturnValue(0);
    render(<LeftPanel {...setupProps("es")} />);
    await user.type(screen.getByPlaceholderText(i18n.es.search), "anything");
    await user.click(screen.getByTitle("find & replace (Ctrl H)"));
    await user.click(screen.getByText("scene"));
    expect(screen.getByText("sin coincidencias")).toBeInTheDocument();
  });

  test("non-zero replace count substitutes {count} placeholder correctly", async () => {
    const user = userEvent.setup();
    replaceReturn.mockReturnValue(7);
    render(<LeftPanel {...setupProps("en")} />);
    await user.type(screen.getByPlaceholderText(i18n.en.search), "anything");
    await user.click(screen.getByTitle("find & replace (Ctrl H)"));
    await user.click(screen.getByText("scene"));
    expect(screen.getByText("7 replaced in scene")).toBeInTheDocument();
  });
});
