import { describe, test, expect, beforeEach } from "vitest";
import { isNewer, isUpdateCheckOptedOut, setUpdateCheckOptOut, isDismissed, dismissUpdate } from "../../src/platform/updateCheck.ts";

beforeEach(() => {
  window.localStorage.clear();
});

describe("isNewer — semver-ish comparison", () => {
  test("0.2.0 > 0.1.0", () => {
    expect(isNewer("0.2.0", "0.1.0")).toBe(true);
  });

  test("0.1.1 > 0.1.0", () => {
    expect(isNewer("0.1.1", "0.1.0")).toBe(true);
  });

  test("1.0.0 > 0.99.99", () => {
    expect(isNewer("1.0.0", "0.99.99")).toBe(true);
  });

  test("0.1.0 == 0.1.0 is not newer", () => {
    expect(isNewer("0.1.0", "0.1.0")).toBe(false);
  });

  test("0.1.0 < 0.2.0 is not newer (older fed as latest)", () => {
    expect(isNewer("0.1.0", "0.2.0")).toBe(false);
  });

  test("strips leading 'v' prefix on either side", () => {
    expect(isNewer("v0.2.0", "v0.1.0")).toBe(true);
    expect(isNewer("0.2.0", "v0.1.0")).toBe(true);
  });

  test("handles missing patch segment", () => {
    expect(isNewer("0.2", "0.1.9")).toBe(true);
    expect(isNewer("0.1", "0.1.0")).toBe(false);
  });

  test("non-numeric segments treated as 0", () => {
    expect(isNewer("0.2.0-beta", "0.1.0")).toBe(true);
  });
});

describe("opt-out and dismiss persistence", () => {
  test("opt-out is off by default", () => {
    expect(isUpdateCheckOptedOut()).toBe(false);
  });

  test("setUpdateCheckOptOut(true) persists in localStorage", () => {
    setUpdateCheckOptOut(true);
    expect(isUpdateCheckOptedOut()).toBe(true);
  });

  test("setUpdateCheckOptOut(false) clears the opt-out", () => {
    setUpdateCheckOptOut(true);
    setUpdateCheckOptOut(false);
    expect(isUpdateCheckOptedOut()).toBe(false);
  });

  test("dismissUpdate marks a version as dismissed", () => {
    expect(isDismissed("0.2.0")).toBe(false);
    dismissUpdate("0.2.0");
    expect(isDismissed("0.2.0")).toBe(true);
  });

  test("dismissed version is per-version (a new release re-shows the banner)", () => {
    dismissUpdate("0.2.0");
    expect(isDismissed("0.3.0")).toBe(false);
  });
});
