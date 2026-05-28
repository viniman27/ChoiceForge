import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { sampleProjects } from "../../src/data/sampleProject.ts";
import { lintProject } from "../../src/domain/choicescript.ts";
import type { ChoiceForgeProject } from "../../src/domain/types.ts";
import { ValidationView } from "../../src/components/ValidationView.tsx";

function lintedSample(): ChoiceForgeProject {
  const base = sampleProjects.pt;
  return { ...base, lints: lintProject(base) };
}

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(_data: unknown) {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}
// @ts-expect-error — jsdom polyfill
globalThis.Worker = MockWorker;

beforeEach(() => {
  window.localStorage.clear();
});

describe("ValidationView v0.5.0 lifecycle", () => {
  test("clicking Run quicktest from quicktest tab mounts an iframe with srcdoc", async () => {
    const project = lintedSample();
    const onClose = vi.fn();

    render(<ValidationView project={project} onClose={onClose} />);

    // Ready tab is default. Switch to Quicktest.
    fireEvent.click(screen.getByRole("button", { name: "Quicktest" }));

    // Now we should see the run button.
    const runBtn = await screen.findByRole("button", { name: /run quicktest/i });
    expect(runBtn).toBeInTheDocument();

    // Click Run.
    fireEvent.click(runBtn);

    // After clicking, the button text should say "Running…".
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /running/i })).toBeInTheDocument();
    });

    // The iframe should be present with srcDoc populated.
    const iframe = document.querySelector("iframe.validation-iframe") as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("srcdoc")).toBeTruthy();
    const src = iframe!.getAttribute("srcdoc")!;
    expect(src).toContain("quicktest:done");
    expect(src).toContain("allLines.join");
  });

  test("posting quicktest:done to window unsets running and shows pass pill", async () => {
    const project = lintedSample();
    const onClose = vi.fn();

    render(<ValidationView project={project} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Quicktest" }));
    fireEvent.click(await screen.findByRole("button", { name: /run quicktest/i }));

    // Wait for "Running…"
    await waitFor(() => screen.getByRole("button", { name: /running/i }));

    // Simulate the iframe completing.
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "quicktest:done", ok: true, errorCount: 0, warningCount: 0, log: "test log content" },
      }));
    });

    // Running button should turn back into Run quicktest.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /run quicktest/i })).toBeInTheDocument();
    });

    // Result pill should show ✓ passed.
    expect(screen.getByText(/✓ passed/i)).toBeInTheDocument();

    // Download log button should be visible.
    expect(screen.getByRole("button", { name: /download log/i })).toBeInTheDocument();
  });

  test("clicking Run from Ready tab switches to quicktest tab and triggers a run", async () => {
    const project = lintedSample();
    const onClose = vi.fn();

    render(<ValidationView project={project} onClose={onClose} />);

    // We start on Ready tab. Find the quicktest Run button in the Ready panel.
    const readyRunBtns = screen.getAllByRole("button", { name: /^Run$/i });
    expect(readyRunBtns.length).toBeGreaterThan(0);

    fireEvent.click(readyRunBtns[0]); // first Run (quicktest)

    // Should auto-switch to quicktest tab with srcdoc set.
    await waitFor(() => {
      const iframe = document.querySelector("iframe.validation-iframe");
      expect(iframe).not.toBeNull();
    });

    // Should show Running… since the iframe was just spawned.
    expect(screen.getByRole("button", { name: /running/i })).toBeInTheDocument();
  });
});
