import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectModal } from "../../src/components/NewProjectModal.tsx";
import { i18n } from "../../src/data/sampleProject.ts";

describe("NewProjectModal", () => {
  test("renders title and respects current language labels", () => {
    render(
      <NewProjectModal
        labels={i18n.en}
        onBlank={vi.fn()}
        onExample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.en.newProject)).toBeInTheDocument();
    expect(screen.getByText(i18n.en.loadExample)).toBeInTheDocument();
    expect(screen.getByText(i18n.en.startBlank)).toBeInTheDocument();
  });

  test("renders Portuguese labels when lang=pt", () => {
    render(
      <NewProjectModal
        labels={i18n.pt}
        onBlank={vi.fn()}
        onExample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(i18n.pt.newProject)).toBeInTheDocument();
    expect(screen.getByText(i18n.pt.startBlank)).toBeInTheDocument();
  });

  test("calls onBlank with typed title and author when Start blank clicked", async () => {
    const onBlank = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        labels={i18n.en}
        onBlank={onBlank}
        onExample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "Lighthouse Mystery");
    await user.type(inputs[1], "Vinicius");
    await user.click(screen.getByText(i18n.en.startBlank));
    expect(onBlank).toHaveBeenCalledWith("Lighthouse Mystery", "Vinicius");
  });

  test("calls onClose when × button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        labels={i18n.en}
        onBlank={vi.fn()}
        onExample={vi.fn()}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("Enter inside title field submits blank project", async () => {
    const onBlank = vi.fn();
    const user = userEvent.setup();
    render(
      <NewProjectModal
        labels={i18n.en}
        onBlank={onBlank}
        onExample={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "Quick{Enter}");
    expect(onBlank).toHaveBeenCalledWith("Quick", "");
  });
});
