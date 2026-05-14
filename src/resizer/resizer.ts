import { Plugin } from "obsidian";

export function makeTableResizable(
  plugin: Plugin,
  tableEl: HTMLTableElement,
  onWidthsChanged: (widths: (number | null)[]) => void
): void {
  if (tableEl.hasAttribute("data-resizable")) return;
  tableEl.setAttribute("data-resizable", "true");

  const settings = (plugin as any).settings as {
    minWidth: number;
    maxWidth: number;
    defaultWidth: number;
  };

  const cols = Array.from(tableEl.querySelectorAll("colgroup col")) as HTMLTableColElement[];
  if (cols.length === 0) return;

  const cells = Array.from(tableEl.querySelectorAll("th, td")) as HTMLTableCellElement[];
  for (const cell of cells) {
    const index = Number(cell.getAttribute("data-col") ?? cell.cellIndex);
    if (Number.isNaN(index) || index >= cols.length - 1) continue;

    cell.style.position = "relative";

    const handle = document.createElement("div");
    handle.className = "sheet-extend-resizer";
    cell.appendChild(handle);

    let startX = 0;
    let startWidth = 0;

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startWidth = cols[index].offsetWidth || cols[index].getBoundingClientRect().width;
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
      cols[index].style.width = newWidth + "px";
      cols[index].style.minWidth = newWidth + "px";
      cols[index].style.maxWidth = newWidth + "px";
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      tableEl.removeAttribute("data-resizing");
      document.body.classList.remove("sheet-extend-resizing");

      const widths = cols.map((col) =>
        col.style.width ? parseInt(col.style.width) : null
      );
      onWidthsChanged(widths);
    };
  }
}
