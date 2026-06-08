import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectModal } from "../../src/components/NewProjectModal.tsx";
import { availableSamples, i18n } from "../../src/data/sampleProject.ts";

describe("NewProjectModal", () => {
  test("renders title and respects current language labels", () => {
    render(
      <NewProjectModal
        lang="en"
        labels={i18n.en}
        onBlank={vi.fn()}
        onSample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.en.newProject)).toBeInTheDocument();
    expect(screen.getByText(i18n.en.startBlank)).toBeInTheDocument();
    // First sample label should also render.
    expect(screen.getByText(availableSamples[0].label.en)).toBeInTheDocument();
  });

  test("renders Portuguese labels when lang=pt", () => {
    render(
      <NewProjectModal
        lang="pt"
        labels={i18n.pt}
        onBlank={vi.fn()}
        onSample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.pt.newProject)).toBeInTheDocument();
    expect(screen.getByText(i18n.pt.startBlank)).toBeInTheDocument();
    expect(screen.getByText(availableSamples[0].label.pt)).toBeInTheDocument();
  });

  test("calls onBlank with typed title and author when blank card is clicked", async () => {
    const onBlank = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        lang="en"
        labels={i18n.en}
        onBlank={onBlank}
        onSample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "Lighthouse Mystery");
    await user.type(inputs[1], "Vinicius");
    await user.click(screen.getByText(i18n.en.startBlank));
    expect(onBlank).toHaveBeenCalledWith("Lighthouse Mystery", "Vinicius");
  });

  test("calls onSample with the right id when a sample card is clicked", async () => {
    const onSample = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        lang="en"
        labels={i18n.en}
        onBlank={vi.fn()}
        onSample={onSample}
        onClose={vi.fn()}
      />,
    );
    const sample = availableSamples[0];
    await user.click(screen.getByText(sample.label.en));
    expect(onSample).toHaveBeenCalledWith(sample.id);
  });

  test("calls onClose when × button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        lang="en"
        labels={i18n.en}
        onBlank={vi.fn()}
        onSample={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
