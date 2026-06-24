/**
 * Detect merge markers in markdown table source text.
 * A merge marker is a cell whose trimmed content is exactly "<" or "^", or
 * a hidden sheet extend marker comment written by the plugin.
 * HTML tags like <font>, <br>, </font> must NOT be treated as merge markers.
 */
export function hasMergeMarkers(text: string): boolean {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip non-table lines (must contain |)
    if (!trimmed.includes("|")) continue;
    // Skip delimiter rows
    if (/^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(trimmed)) continue;

    // Extract cells by splitting on |
    const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
    const stripped = inner.endsWith("|") ? inner.slice(0, -1) : inner;
    const cells = stripped.split("|").map((c) => c.trim());

    for (const cell of cells) {
      if (isMergeMarkerCell(cell)) {
        return true;
      }
    }
  }
  return false;
}

export function isMergeLeftMarker(value: string | undefined): boolean {
  const text = (value || "").trim();
  return text === "<" || text === "<!-- sheet-extend:merge-left -->";
}

export function isMergeUpMarker(value: string | undefined): boolean {
  const text = (value || "").trim();
  return text === "^" || text === "<!-- sheet-extend:merge-up -->";
}

export function isMergeMarkerCell(value: string | undefined): boolean {
  return isMergeLeftMarker(value) || isMergeUpMarker(value);
}

export function hasMergeMarkersInElement(tableEl: HTMLTableElement): boolean {
  for (const cell of Array.from(tableEl.querySelectorAll("th, td"))) {
    const text = (cell.textContent || "").trim();
    if (isMergeMarkerCell(text)) {
      return true;
    }
  }
  return false;
}
