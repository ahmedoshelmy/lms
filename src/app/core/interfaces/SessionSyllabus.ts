/**
 * The curriculum entry for one session of a course level — what is taught, the
 * take-home task, and the plain-language summary written for parents.
 *
 * Keyed on the course level rather than the scheduled session: the same
 * syllabus applies every time any group runs that level.
 *
 * `parentSummary` and `parentHomeActivity` arrive as null when the entry is not
 * published and the caller is not staff, so an unfinished summary can never
 * reach a parent.
 */
export interface SessionSyllabus {
  id: number;
  courseLevelId: number;
  sessionNumber: number;
  title: string;
  /** Readable description of what the session covers. */
  content?: string | null;
  /** Short topic tags. Shown alongside the description, not instead of it. */
  keyConcepts: string[];
  activities: string[];
  task?: string | null;
  steamTopic?: string | null;
  steamVideoUrls: string[];
  kahootUrl?: string | null;
  /** Link to the instructor's slides or PDF. */
  materialUrl?: string | null;
  parentSummary?: string | null;
  parentHomeActivity?: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

/** Fields an admin may change on a syllabus entry. */
export interface UpsertSessionSyllabusPayload {
  title: string;
  content?: string | null;
  keyConcepts: string[];
  activities: string[];
  task?: string | null;
  steamTopic?: string | null;
  steamVideoUrls: string[];
  kahootUrl?: string | null;
  materialUrl?: string | null;
  parentSummary?: string | null;
  parentHomeActivity?: string | null;
  isPublished: boolean;
}

/**
 * One session a student has sat, with the published summary of what it covered.
 *
 * This is the student-facing shape, and what a parent is shown. Only published
 * syllabus entries are filled in; `hasSummary` is false when the level has no
 * content written for that session yet, and the row still appears so the
 * history has no holes in it.
 */
export interface StudentSessionSummary {
  sessionId: number;
  sessionNumber: number;
  startsAt: string;
  courseTitle: string;
  groupName: string;
  instructorName: string;
  /** Present, Late, Absent or Excused. */
  attendanceStatus: string;

  title?: string | null;
  content?: string | null;
  projects: string[];
  task?: string | null;
  steamTopic?: string | null;
  parentSummary?: string | null;
  parentHomeActivity?: string | null;
  hasSummary: boolean;
}

/**
 * One session of the curriculum, carrying enough context to place it — topic,
 * level and course — so the whole catalogue can be listed and grouped from a
 * single call.
 */
export interface SessionCatalogueEntry {
  id: number;
  courseLevelId: number;
  sessionNumber: number;

  topicId: number;
  topicName: string;
  topicCode: string;
  level: number;
  courseTitle: string;

  title: string;
  content?: string | null;
  keyConcepts: string[];
  activities: string[];
  task?: string | null;
  steamTopic?: string | null;
  steamVideoUrls: string[];
  kahootUrl?: string | null;
  materialUrl?: string | null;
  parentSummary?: string | null;
  parentHomeActivity?: string | null;
  isPublished: boolean;
}
