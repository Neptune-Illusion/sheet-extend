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
});
