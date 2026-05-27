import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Worker globally — jsdom doesn't ship one and several modules new-up Workers.
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

describe("App smoke — renders without crashing and shows core chrome", () => {
  test("the EN sample loads with the left panel tabs visible", async () => {
    const { default: App } = await import("../../src/App.tsx");
    render(<App />);

    // Left panel tabs render with the EN sample's labels.
    expect(screen.getByRole("button", { name: "Scenes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Variables" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Achievements" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Media" })).toBeInTheDocument();
  });

  test("the Play button is visible on the top bar", async () => {
    const { default: App } = await import("../../src/App.tsx");
    render(<App />);
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });
});
