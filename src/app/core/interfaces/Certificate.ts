/**
 * Minimum share of a course's recorded sessions a student must have attended
 * (Present or Late) before a certificate is issued without a bypass.
 */
export const CERTIFICATE_ATTENDANCE_THRESHOLD = 75;

/**
 * The validations a candidate can fail.
 *
 * All are bypassable: cohorts that ran before the LMS was in use often have no
 * attendance rows, were never flagged complete, and sometimes have no enrolment
 * record at all, so refusing to issue on any of these grounds would make
 * historical certificates impossible.
 */
export type CertificateCheck = 'enrollment' | 'completion' | 'attendance';

export interface CertificateEligibility {
  /** True when every validation passes, so no bypass is needed. */
  eligible: boolean;
  /** Which validations failed; empty when `eligible` is true. */
  failedChecks: CertificateCheck[];
  /** Human-readable explanation per failed check, in the same order. */
  reasons: string[];
  /** Whether the group is recorded as having finished this course level. */
  courseCompleted: boolean;
  /** Whole-number percentage of recorded sessions attended. */
  attendanceRate: number;
  /** Sessions counted as attended (Present or Late). */
  attendedSessions: number;
  /** Non-cancelled sessions this student has an attendance record for. */
  recordedSessions: number;
  /** Total sessions the course level is meant to run. */
  courseTotalSessions: number;
}

/** A student a manual certificate can be issued to. */
export interface CertificateStudentRef {
  id: number;
  name: string;
  email?: string;
}

/** A course level from the catalog, selectable for a manual certificate. */
export interface CertificateCourseOption {
  id: number;
  title: string;
  topic: string;
  level: number;
  sessionCount: number;
}

/** A course level a certificate could be issued for. */
export interface CertificateCandidate {
  /** Stable identity for tracking in @for loops and selection sets. */
  key: string;
  serial: string;
  studentId: number;
  studentName: string;
  studentEmail?: string;
  /**
   * Added by hand against the course catalog rather than derived from an
   * enrolment. Used for students who finished a course before the system
   * existed, so no group ever recorded them.
   */
  manual: boolean;
  /** Null for a manual candidate, which belongs to no group. */
  groupId: number | null;
  groupName: string;
  courseTitle: string;
  topic: string;
  level: number | string;
  instructorName: string;
  /** ISO timestamp the group finished the course level, when the API reports one. */
  completedAt: string | null;
  /** Whole weeks between the level starting and completing; null when unknown. */
  durationWeeks: number | null;
  eligibility: CertificateEligibility;
}

/** A candidate that has been selected for printing. */
export interface Certificate extends CertificateCandidate {
  issuedAt: string;
  issuedBy: string;
  /** ISO timestamp printed as the completion date. */
  printedDate: string;
  /** Weeks printed on the certificate; null hides the duration clause. */
  printedDurationWeeks: number | null;
  /** Fixed name on the supervisor signature line. */
  supervisorName: string;
  /** Validations that were bypassed to issue this certificate. */
  bypassedChecks: CertificateCheck[];
}
