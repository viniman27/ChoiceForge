import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
