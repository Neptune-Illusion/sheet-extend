import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings";

describe("settings", () => {
  it("includes nativeProcessing and width bounds", () => {
    expect(DEFAULT_SETTINGS.nativeProcessing).toBe(true);
    expect(DEFAULT_SETTINGS.widthPersistence).toBe("plugin");
    expect(DEFAULT_SETTINGS.pixelsPerDash).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.minWidth).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.maxWidth).toBeGreaterThan(DEFAULT_SETTINGS.minWidth);
  });

  it("drops deprecated enableFormulas from old loaded data", () => {
    const loaded = sanitizeSettings({
      minWidth: 70,
      widthPersistence: "markdown",
      enableFormulas: true,
    });
    expect("enableFormulas" in loaded).toBe(false);
    expect(loaded.minWidth).toBe(70);
    expect(loaded.widthPersistence).toBe("markdown");
  });

  it("merges sanitized settings over defaults without leaking stale keys", () => {
    const raw = { enableFormulas: false };
    const merged = Object.assign({}, DEFAULT_SETTINGS, sanitizeSettings(raw));
    expect("enableFormulas" in merged).toBe(false);
    expect(merged.nativeProcessing).toBe(true);
    expect(merged.maxWidth).toBe(500);
  });

  it("returns empty partial for non-object input", () => {
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings("x")).toEqual({});
  });
});
