export type SortDirection = 'asc' | 'desc';

/**
 * The `aria-sort` of a sortable column header: which way it is sorted, or
 * nothing when the table is sorted by another column. The arrow icon said this
 * to the eye only.
 */
export function ariaSortFor(
  column: string,
  sortedBy: string | null | undefined,
  direction: SortDirection
): 'ascending' | 'descending' | null {
  if (column !== sortedBy) return null;
  return direction === 'asc' ? 'ascending' : 'descending';
}
