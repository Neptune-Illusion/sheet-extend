import { Plugin } from "obsidian";

export function getTableId(tableEl: HTMLTableElement): string {
  const sourcePath = tableEl.getAttribute("data-source-path");
  const lineStart = tableEl.getAttribute("data-line-start");
  if (sourcePath && lineStart) {
    return `table-${sourcePath}-${lineStart}`;
  }
  const text = tableEl.textContent || "";
  const hash = text.slice(0, 100).replace(/\s+/g, " ").trim();
  return `table-fallback-${hash.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export interface WidthStore {
  [tableId: string]: (number | null)[];
}

export function saveWidths(
  plugin: Plugin,
  tableId: string,
  widths: (number | null)[]
): void {
  const store: WidthStore = (plugin as any).widthStore || {};
  const hasData = widths.some((w) => w !== null);
  if (hasData) {
    store[tableId] = widths;
  } else {
    delete store[tableId];
  }
  (plugin as any).widthStore = store;
  plugin.saveData({
    version: "1.1.0",
    settings: (plugin as any).settings,
    columnWidths: store,
  });
}

export function loadWidths(
  plugin: Plugin,
  tableId: string
): (number | null)[] | null {
  const store: WidthStore = (plugin as any).widthStore || {};
  return store[tableId] || null;
}

export function applySavedWidths(
  tableEl: HTMLTableElement,
  widths: (number | null)[]
): void {
  const cols = tableEl.querySelectorAll("colgroup col");
  for (let i = 0; i < cols.length && i < widths.length; i++) {
    const w = widths[i];
    if (w !== null) {
      const col = cols[i] as HTMLElement;
      col.style.width = w + "px";
      col.style.minWidth = w + "px";
      col.style.maxWidth = w + "px";
    }
  }
}
