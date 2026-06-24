import { describe, it, expect, vi } from "vitest";
import { makeTableResizable } from "../src/resizer/resizer";

describe("makeTableResizable", () => {
  it("adds one resizer handle per visible column edge using data-col", () => {
    const plugin = {
      settings: { minWidth: 50, maxWidth: 500, defaultWidth: 150 },
    } as any;

    const tableEl = document.createElement("table");
    document.body.appendChild(tableEl);

    const colgroup = document.createElement("colgroup");
    tableEl.appendChild(colgroup);
    for (let i = 0; i < 3; i++) {
      colgroup.appendChild(document.createElement("col"));
    }

    const tr = document.createElement("tr");
    tableEl.appendChild(tr);
    const td0 = document.createElement("td");
    td0.setAttribute("data-col", "0");
    tr.appendChild(td0);
    const td1 = document.createElement("td");
    td1.setAttribute("data-col", "1");
    tr.appendChild(td1);
    const td2 = document.createElement("td");
    td2.setAttribute("data-col", "2");
    tr.appendChild(td2);

    const save = vi.fn();
    makeTableResizable(plugin, tableEl, save);

    expect(tableEl.querySelectorAll(".sheet-extend-resizer").length).toBe(2);
  });

  it("places resize handles on the right edge of merged cells", () => {
    const plugin = {
      settings: { minWidth: 50, maxWidth: 500, defaultWidth: 150 },
    } as any;

    const tableEl = document.createElement("table");
    document.body.appendChild(tableEl);

    const colgroup = document.createElement("colgroup");
    tableEl.appendChild(colgroup);
    for (let i = 0; i < 3; i++) {
      colgroup.appendChild(document.createElement("col"));
    }

    const tr = document.createElement("tr");
    tableEl.appendChild(tr);
    const merged = document.createElement("td");
    merged.setAttribute("data-col", "0");
    merged.colSpan = 2;
    tr.appendChild(merged);
    const last = document.createElement("td");
    last.setAttribute("data-col", "2");
    tr.appendChild(last);

    const save = vi.fn();
    makeTableResizable(plugin, tableEl, save);

    const handle = merged.querySelector(".sheet-extend-resizer") as HTMLElement;
    expect(handle).not.toBeNull();

    Object.defineProperty(colgroup.children[1], "offsetWidth", { value: 90, configurable: true });
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 130 }));
    document.dispatchEvent(new MouseEvent("mouseup"));

    expect((colgroup.children[1] as HTMLElement).style.width).toBe("120px");
  });

  it("notifies resize start and persists final widths on mouseup", () => {
    const plugin = {
      settings: { minWidth: 50, maxWidth: 500, defaultWidth: 150 },
    } as any;

    const tableEl = document.createElement("table");
    document.body.appendChild(tableEl);

    const colgroup = document.createElement("colgroup");
    tableEl.appendChild(colgroup);
    for (let i = 0; i < 2; i++) {
      colgroup.appendChild(document.createElement("col"));
    }

    const tr = document.createElement("tr");
    tableEl.appendChild(tr);
    const td0 = document.createElement("td");
    td0.setAttribute("data-col", "0");
    tr.appendChild(td0);
    const td1 = document.createElement("td");
    td1.setAttribute("data-col", "1");
    tr.appendChild(td1);

    const onResizeStart = vi.fn();
    const onResizeEnd = vi.fn();
    makeTableResizable(plugin, tableEl, { onResizeStart, onResizeEnd });

    const handle = td0.querySelector(".sheet-extend-resizer") as HTMLElement;
    Object.defineProperty(colgroup.children[0], "offsetWidth", { value: 100, configurable: true });
    handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }));
    document.dispatchEvent(new MouseEvent("mouseup"));

    expect(onResizeStart).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenCalledWith([150, null]);
  });
});
