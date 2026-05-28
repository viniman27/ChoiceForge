import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

beforeEach(() => {
  // Opt out of update check in tests by default so renders don't make network calls.
  window.localStorage.setItem("choiceforge.updateCheck.optout", "1");
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error — jsdom doesn't ship ResizeObserver
globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverStub;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
