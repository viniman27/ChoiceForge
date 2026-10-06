import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { sampleProjects, i18n } from "../../src/data/sampleProject";
import { TopBar } from "../../src/components/TopBar";
import type { TopBarProps } from "../../src/components/TopBar";

const noop = () => {};

function props(overrides: Partial<TopBarProps> = {}): TopBarProps {
  return {
    data: sampleProjects.en,
    lang: "en",
    labels: i18n.en,
    theme: "light",
    density: "medium",
    view: "editor",
    selectedNodeTitle: undefined,
    onLangChange: noop,
    onThemeChange: noop,
    onDensityChange: noop,
    onViewChange: noop,
    onMetadataChange: noop,
    canUndo: true,
    canRedo: true,
    textModeActive: false,
    onUndo: noop,
    onRedo: noop,
    onSave: noop,
    saveStatus: "",
    onTextMode: noop,
    onPlay: noop,
    onValidate: noop,
    onImport: noop,
    onExport: noop,
    onExportDot: noop,
    onExportGame: noop,
    onSaveProjectFile: noop,
    onNewProject: noop,
    onSnapshots: noop,
    onHelp: noop,
    currentFilePath: null,
    ...overrides,
  };
}

describe("TopBar menus", () => {
  test("removes standalone duplicate file actions while preserving frequent quick actions", () => {
    render(<TopBar {...props()} />);
    const toolbar = screen.getByRole("banner");

    for (const name of ["New", "Open", "Import", "Folder", "Export", ".dot graph", "Snapshots", "Save As..."]) {
      expect(within(toolbar).queryByRole("button", { name, exact: true })).toBeNull();
    }

    for (const name of ["File", "Interface", "Text", "Undo", "Redo", "Save", /Validate/i, "Play", "?"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  test("file menu has visible dropdown affordance and restores focus on Escape", async () => {
    render(<TopBar {...props()} />);
    const file = screen.getByRole("button", { name: /File/ });
    expect(file).toHaveAttribute("aria-haspopup", "menu");
    expect(file).toHaveAttribute("aria-controls");
    expect(within(file).getByText("⌄")).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(file, { key: "ArrowDown" });
    expect(screen.getByRole("menu", { name: "File" })).toBeVisible();
    await waitFor(() => expect(screen.getByRole("menuitem", { name: /New project/ })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("menu", { name: "File" }), { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "File" })).toBeNull();
    await waitFor(() => expect(file).toHaveFocus());
  });

  test("native recent files live inside File menu and call native callbacks", () => {
    const onNativeOpen = vi.fn();
    const onOpenRecent = vi.fn();
    const onClearRecent = vi.fn();
    render(<TopBar {...props({
      onNativeOpen,
      recentFiles: [{ path: "C:/stories/alpha.choiceforge.json", lastOpened: 10 }],
      onOpenRecent,
      onClearRecent,
    })} />);

    fireEvent.click(screen.getByRole("button", { name: /File/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open project/ }));
    expect(onNativeOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /File/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /alpha\.choiceforge\.json/ }));
    expect(onOpenRecent).toHaveBeenCalledWith("C:/stories/alpha.choiceforge.json");

    fireEvent.click(screen.getByRole("button", { name: /File/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Clear list/ }));
    expect(onClearRecent).toHaveBeenCalledTimes(1);
  });
});
