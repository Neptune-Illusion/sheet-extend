export function hasMergeMarkers(text: string): boolean {
  return /(^|[|]\s*)(<|\^)\s*([|]|$)/m.test(text);
}
