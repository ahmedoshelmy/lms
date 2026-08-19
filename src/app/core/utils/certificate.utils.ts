import { StudentAttendanceRecord } from '../interfaces/StudentDetails';
import {
  CERTIFICATE_ATTENDANCE_THRESHOLD,
  CertificateCheck,
  CertificateEligibility,
} from '../interfaces/Certificate';
import { getSessionBaseCode } from './session-code.utils';

/** Attendance statuses that count as the student having attended the session. */
const ATTENDED_STATUSES = ['present', 'late'];

/**
 * Deterministic 4-character check token. The same certificate always produces
 * the same serial, so re-issuing a lost copy does not mint a new number.
 */
function hashToken(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0').slice(-4);
}

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Builds the printed serial, e.g. `MV-PY-L2-G12-S45-3F9A`. A manual certificate
 * has no group, so its serial carries `M` in that slot: `MV-PY-L2-M-S45-3F9A`.
 * Reuses the topic/level code scheme already used for session codes so the
 * certificate number is recognisable next to a session code. The same student,
 * group and course always produce the same serial, so re-issuing a lost copy
 * does not mint a new number.
 */
export function buildCertificateSerial(input: {
  studentId: number;
  /** Null for a manual certificate, which is stamped `M` instead of a group id. */
  groupId: number | null;
  courseTitle: string;
  topic: string;
  level: number | string;
}): string {
  const baseCode = getSessionBaseCode({
    topic: input.topic,
    courseTitle: input.courseTitle,
    level: typeof input.level === 'string' ? parseInt(input.level, 10) : input.level,
  });
  const groupSegment = input.groupId === null ? 'M' : `G${input.groupId}`;
  // Deliberately excludes the completion date: the group flow can build a
  // candidate before the history carrying `completedAt` has loaded, and the
  // serial must come out identical either way.
  const token = hashToken([input.studentId, groupSegment, normalize(input.courseTitle)].join('|'));
  return `MV-${baseCode}-${groupSegment}-S${input.studentId}-${token}`;
}

/**
 * Scores one student against one course level.
 *
 * Two validations run: the group must be recorded as having completed the level,
 * and the student must have attended at least CERTIFICATE_ATTENDANCE_THRESHOLD
 * of its sessions. Failures are reported rather than thrown away — cohorts that
 * predate the LMS legitimately fail both, and the dialog lets staff bypass them.
 *
 * Attendance records are joined to the course by `courseTitle` + `groupName`,
 * which is the only key `StudentDetails` exposes — there is no groupCourseId on
 * `StudentAttendanceRecord`. Keep that join in this one function so it can be
 * swapped for an id comparison if the API starts returning one.
 *
 * Cancelled sessions are ignored entirely. The rate matches the formula already
 * shown on the student detail page — (Present + Late) / all recorded sessions —
 * so the two never disagree. Excused absences therefore count against the rate;
 * add 'excused' to ATTENDED_STATUSES if that policy changes.
 */
export function evaluateCertificateEligibility(
  attendance: StudentAttendanceRecord[],
  courseTitle: string,
  groupName: string,
  courseTotalSessions: number,
  courseCompleted: boolean
): CertificateEligibility {
  const wantedCourse = normalize(courseTitle);
  const wantedGroup = normalize(groupName);

  const relevant = (attendance || []).filter((record) => {
    if (normalize(record.sessionStatus).includes('cancel')) return false;
    if (normalize(record.courseTitle) !== wantedCourse) return false;
    // Older records may omit the group name; fall back to the course match alone.
    return !record.groupName || normalize(record.groupName) === wantedGroup;
  });

  const recordedSessions = relevant.length;
  const attendedSessions = relevant.filter((record) =>
    ATTENDED_STATUSES.includes(normalize(record.attendanceStatus))
  ).length;
  const attendanceRate =
    recordedSessions === 0 ? 0 : Math.round((attendedSessions / recordedSessions) * 100);

  const failedChecks: CertificateCheck[] = [];
  const reasons: string[] = [];

  if (!courseCompleted) {
    failedChecks.push('completion');
    reasons.push('This course level is not marked complete for the group');
  }

  if (recordedSessions === 0) {
    failedChecks.push('attendance');
    reasons.push('No attendance records exist for this course level');
  } else if (attendanceRate < CERTIFICATE_ATTENDANCE_THRESHOLD) {
    failedChecks.push('attendance');
    reasons.push(
      `Attendance ${attendanceRate}% is below the ${CERTIFICATE_ATTENDANCE_THRESHOLD}% requirement`
    );
  }

  return {
    eligible: failedChecks.length === 0,
    failedChecks,
    reasons,
    courseCompleted,
    attendanceRate,
    attendedSessions,
    recordedSessions,
    courseTotalSessions,
  };
}

/**
 * How many weeks a course level runs for.
 *
 * Duration is not stored directly — it falls out of the course's session count
 * and how many sessions the group sits per week, which is the number of weekly
 * schedule slots. An 8-session course meeting once a week runs 8 weeks; the
 * same course meeting twice a week runs 4.
 *
 * Returns null when the session count is unknown, so the caller can drop the
 * duration clause rather than print "0 weeks".
 */
export function computeDurationWeeks(
  totalSessions: number | null | undefined,
  sessionsPerWeek: number | null | undefined = 1
): number | null {
  if (!totalSessions || totalSessions <= 0) return null;
  const perWeek = sessionsPerWeek && sessionsPerWeek > 0 ? sessionsPerWeek : 1;
  return Math.max(1, Math.ceil(totalSessions / perWeek));
}
