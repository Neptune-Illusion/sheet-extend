import { Plugin } from "obsidian";

export function getTableId(tableEl: HTMLTableElement): string {
  const text = tableEl.textContent || "";
  const hash = text.slice(0, 100).replace(/\s+/g, " ").trim();
  return `table-${hash.length}-${hash.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
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
  for (const row of Array.from(tableEl.querySelectorAll("tr"))) {
    for (let i = 0; i < row.children.length && i < widths.length; i++) {
      const w = widths[i];
      if (w !== null) {
        const el = row.children[i] as HTMLElement;
        el.style.width = w + "px";
        el.style.minWidth = w + "px";
        el.style.maxWidth = w + "px";
      }
    }
  }
}
