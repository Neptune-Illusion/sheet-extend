import { Plugin } from "obsidian";

export function makeTableResizable(
  plugin: Plugin,
  tableEl: HTMLTableElement,
  onWidthsChanged: (widths: (number | null)[]) => void
): void {
  if (tableEl.hasAttribute("data-resizable")) return;
  tableEl.setAttribute("data-resizable", "true");

  const firstRow = tableEl.querySelector("tr");
  if (!firstRow) return;
  const colCount = firstRow.children.length;

  const settings = (plugin as any).settings as {
    minWidth: number;
    maxWidth: number;
    defaultWidth: number;
  };

  for (const cell of Array.from(tableEl.querySelectorAll("th, td"))) {
    const cellIndex = cell.getAttribute("data-col");
    if (cellIndex && parseInt(cellIndex) >= colCount - 1) continue;
    if (!cellIndex && (cell as HTMLTableCellElement).cellIndex >= colCount - 1) continue;

    (cell as HTMLElement).style.position = "relative";

    const handle = document.createElement("div");
    handle.className = "sheet-extend-resizer";
    (cell as HTMLElement).appendChild(handle);

    let startX = 0;
    let startWidth = 0;

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rows = Array.from(tableEl.querySelectorAll("tr"));
      if (rows.length === 0) return;

      const idx = cellIndex
        ? parseInt(cellIndex)
        : (cell as HTMLTableCellElement).cellIndex;
      if (idx === 0) return;

      const firstCell = rows[0].children[idx];
      startWidth = (firstCell as HTMLElement).offsetWidth;
      startX = e.clientX;

      tableEl.setAttribute("data-resizing", "true");
      document.body.classList.add("sheet-extend-resizing");

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(
        settings.minWidth,
        Math.min(settings.maxWidth, startWidth + diff)
      );

      const idx = cellIndex
        ? parseInt(cellIndex)
        : (cell as HTMLTableCellElement).cellIndex;

      for (const row of Array.from(tableEl.querySelectorAll("tr"))) {
        const target = row.children[idx] as HTMLElement;
        if (target) {
          target.style.width = newWidth + "px";
          target.style.minWidth = newWidth + "px";
          target.style.maxWidth = newWidth + "px";
        }
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      tableEl.removeAttribute("data-resizing");
      document.body.classList.remove("sheet-extend-resizing");

      const widths: (number | null)[] = [];
      const firstRow = tableEl.querySelector("tr");
      if (firstRow) {
        for (let i = 0; i < firstRow.children.length; i++) {
          const el = firstRow.children[i] as HTMLElement;
          widths.push(el.style.width ? parseInt(el.style.width) : null);
        }
      }
      onWidthsChanged(widths);
    };
  }
}
