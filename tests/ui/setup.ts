import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

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
