/**
 * Detect merge markers (< or ^) in markdown table source text.
 * A merge marker is a cell whose trimmed content is exactly "<" or "^".
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
      // A merge marker is exactly "<" or "^" as the sole cell content
      if (cell === "<" || cell === "^") {
        return true;
      }
    }
  }
  return false;
}
