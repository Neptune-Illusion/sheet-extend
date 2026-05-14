import { describe, it, expect, afterEach } from "vitest";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("test environment", () => {
  it("runs in jsdom", () => {
    expect(typeof document).toBe("object");
  });
});
