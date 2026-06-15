import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("settings", () => {
  it("includes nativeProcessing and width bounds", () => {
    expect(DEFAULT_SETTINGS.nativeProcessing).toBe(true);
    expect(DEFAULT_SETTINGS.widthPersistence).toBe("plugin");
    expect(DEFAULT_SETTINGS.pixelsPerDash).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.enableFormulas).toBe(true);
    expect(DEFAULT_SETTINGS.minWidth).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.maxWidth).toBeGreaterThan(DEFAULT_SETTINGS.minWidth);
  });
});
