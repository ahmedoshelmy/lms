/**
 * What a cancelled class has to say for itself.
 *
 * The cause and the written reason answer different questions and are kept
 * apart on the server for that reason: the cause says whose doing it was and
 * can be counted, the words say what happened that day and cannot. So they are
 * shown side by side rather than run together.
 *
 * A holiday is its own reason and is stored with the word "Holiday" as its
 * text, which read straight out would say "Holiday — Holiday".
 */
export interface CancellationNote {
  /** Whose doing it was, as a person reads it. Null when nobody recorded one. */
  cause: string | null;

  /** What happened, in whoever's words. Null when the cause says it all. */
  reason: string | null;
}

const CAUSES: Record<string, string> = {
  Instructor: 'Instructor',
  Parents: 'Family',
  Holiday: 'Holiday',
};

/**
 * The note to show against a cancelled class, or null when it was cancelled
 * before anybody was asked why — the older classes, from before cancelling
 * asked.
 */
export function cancellationNote(
  cause?: string | null,
  reason?: string | null
): CancellationNote | null {
  const label = cause ? (CAUSES[cause] ?? cause) : null;
  const text = reason?.trim() || null;

  const detail = text && label && text.toLowerCase() === label.toLowerCase() ? null : text;

  return label || detail ? { cause: label, reason: detail } : null;
}
