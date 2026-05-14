import { describe, it, expect, afterEach } from "vitest";

HTMLElement.prototype.empty = function () {
  this.innerHTML = "";
};

HTMLElement.prototype.createEl = function (
  tag: string,
  _attrs?: any,
  _text?: string
): HTMLElement {
  const el = document.createElement(tag);
  this.appendChild(el);
  return el;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("test environment", () => {
  it("runs in jsdom", () => {
    expect(typeof document).toBe("object");
  });
});
