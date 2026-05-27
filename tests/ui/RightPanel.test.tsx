import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightPanel } from "../../src/components/RightPanel.tsx";
import { sampleProjects, i18n } from "../../src/data/sampleProject.ts";
import type { ChoiceForgeProject, Language, StoryNode } from "../../src/domain/types.ts";

const noop = vi.fn();

function setupProps(lang: Language, nodeOverride?: StoryNode) {
  const data: ChoiceForgeProject = JSON.parse(JSON.stringify(sampleProjects[lang]));
  data.lints = [];
  const node = nodeOverride ?? data.nodes[0];
  return {
    node,
    project: data,
    labels: i18n[lang],
    onUpdateNode: vi.fn(),
    onAddFlowEdge: vi.fn(),
    onDeleteFlowEdge: vi.fn(),
    onSelectNode: vi.fn(),
    onSelectScene: vi.fn(),
  };
}

beforeEach(() => {
  noop.mockClear();
});

describe("RightPanel — empty state respects the editor language", () => {
  test("EN renders the English empty-state hint when no node is selected", () => {
    render(<RightPanel {...setupProps("en")} node={null} />);
    expect(screen.getByText(i18n.en.inspectorEmpty)).toBeInTheDocument();
  });

  test("PT renders the Portuguese empty-state hint", () => {
    render(<RightPanel {...setupProps("pt")} node={null} />);
    expect(screen.getByText(i18n.pt.inspectorEmpty)).toBeInTheDocument();
  });

  test("ES renders the Spanish empty-state hint", () => {
    render(<RightPanel {...setupProps("es")} node={null} />);
    expect(screen.getByText(i18n.es.inspectorEmpty)).toBeInTheDocument();
  });
});

describe("RightPanel — source-preserved banner is localized", () => {
  test("EN: Convert button text is 'Convert'", () => {
    render(<RightPanel {...setupProps("en")} sourcePreserved onConvertSource={noop} />);
    expect(screen.getByText(i18n.en.convert)).toBeInTheDocument();
    expect(screen.getByText(i18n.en.sourcePreservedNotice)).toBeInTheDocument();
  });

  test("PT: Convert button text is 'Converter'", () => {
    render(<RightPanel {...setupProps("pt")} sourcePreserved onConvertSource={noop} />);
    expect(screen.getByText(i18n.pt.convert)).toBeInTheDocument();
    expect(screen.getByText(i18n.pt.sourcePreservedNotice)).toBeInTheDocument();
  });

  test("ES: Convert button text is 'Convertir'", () => {
    render(<RightPanel {...setupProps("es")} sourcePreserved onConvertSource={noop} />);
    expect(screen.getByText(i18n.es.convert)).toBeInTheDocument();
    expect(screen.getByText(i18n.es.sourcePreservedNotice)).toBeInTheDocument();
  });

  test("Convert button calls onConvertSource when clicked", async () => {
    const onConvertSource = vi.fn();
    const user = userEvent.setup();
    render(<RightPanel {...setupProps("en")} sourcePreserved onConvertSource={onConvertSource} />);
    await user.click(screen.getByText(i18n.en.convert));
    expect(onConvertSource).toHaveBeenCalledOnce();
  });
});

describe("RightPanel — private notes label and placeholder are localized", () => {
  test("EN: private notes label", () => {
    render(<RightPanel {...setupProps("en")} />);
    expect(screen.getByText((text) => text.includes(i18n.en.privateNotes))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.en.privateNotesPlaceholder)).toBeInTheDocument();
  });

  test("PT: notas privadas", () => {
    render(<RightPanel {...setupProps("pt")} />);
    expect(screen.getByText((text) => text.includes(i18n.pt.privateNotes))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.pt.privateNotesPlaceholder)).toBeInTheDocument();
  });

  test("ES: notas privadas", () => {
    render(<RightPanel {...setupProps("es")} />);
    expect(screen.getByText((text) => text.includes(i18n.es.privateNotes))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.es.privateNotesPlaceholder)).toBeInTheDocument();
  });
});

describe("RightPanel — disable inspector when source is preserved", () => {
  test("title input is disabled in sourcePreserved mode", () => {
    render(<RightPanel {...setupProps("en")} sourcePreserved />);
    const titleInput = screen.getByDisplayValue(setupProps("en").project.nodes[0].title);
    expect(titleInput).toBeDisabled();
  });
});

describe("RightPanel — passage body editing flows the onUpdateNode callback", () => {
  test("typing in the title input fires onUpdateNode with the new title", async () => {
    const user = userEvent.setup();
    const props = setupProps("en");
    render(<RightPanel {...props} />);
    const titleInput = screen.getByDisplayValue(props.node!.title);
    await user.clear(titleInput);
    await user.type(titleInput, "newtitle");
    expect(props.onUpdateNode).toHaveBeenCalledWith(props.node!.id, expect.objectContaining({ title: expect.any(String) }));
  });
});
