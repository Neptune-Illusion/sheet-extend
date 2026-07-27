export interface SourceViewLike {
  file?: { path?: string } | null;
}

export interface SourceLeafLike {
  view?: SourceViewLike;
}

/** Select the view containing sourcePath, even when it is not the active pane. */
export function selectSourceView<T extends SourceViewLike>(
  active: T | null | undefined,
  leaves: Array<SourceLeafLike & { view?: T }>,
  sourcePath: string
): T | null {
  if (!sourcePath || active?.file?.path === sourcePath) return active || null;
  return leaves.find((leaf) => leaf.view?.file?.path === sourcePath)?.view || null;
}
