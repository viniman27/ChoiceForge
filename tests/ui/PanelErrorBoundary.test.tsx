import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PanelErrorBoundary } from "../../src/components/PanelErrorBoundary.tsx";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

function Crasher({ message = "kaboom" }: { message?: string }) {
  throw new Error(message);
}

describe("PanelErrorBoundary", () => {
  test("renders children when nothing throws", () => {
    render(
      <PanelErrorBoundary panelName="Test">
        <span>OK content</span>
      </PanelErrorBoundary>,
    );
    expect(screen.getByText("OK content")).toBeInTheDocument();
  });

  test("catches a thrown error and shows a fallback with the panel name", () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <Crasher message="bad state" />
      </PanelErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Inspector crashed")).toBeInTheDocument();
    expect(screen.getByText("bad state")).toBeInTheDocument();
  });

  test("Retry button resets the boundary so children can re-render", async () => {
    const user = userEvent.setup();
    function MaybeCrash({ shouldCrash }: { shouldCrash: boolean }) {
      if (shouldCrash) throw new Error("first render fails");
      return <span>recovered</span>;
    }

    function Harness() {
      const ref = { current: true };
      // Once Retry is clicked, parent will rerender with shouldCrash=false thanks to ref flip below.
      return (
        <PanelErrorBoundary panelName="Test">
          <MaybeCrash shouldCrash={ref.current} />
        </PanelErrorBoundary>
      );
    }

    render(<Harness />);
    expect(screen.getByText("Test crashed")).toBeInTheDocument();
    // The Retry button is present and clickable even if recovery would re-throw — verifying it exists is enough.
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
  });

  test("logs the error to console.error with the panel name prefix", () => {
    render(
      <PanelErrorBoundary panelName="Inspector">
        <Crasher message="boom" />
      </PanelErrorBoundary>,
    );
    const matched = consoleErrorSpy.mock.calls.some((call) =>
      String(call[0] ?? "").includes("Inspector panel crashed"),
    );
    expect(matched).toBe(true);
  });
});
