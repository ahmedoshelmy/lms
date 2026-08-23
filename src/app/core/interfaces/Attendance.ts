import { AttendanceStatus } from '../enums/AttendanceStatus';

export interface CreateAttendanceDto {
  sessionId: number;
  studentId: number;
  status: string | AttendanceStatus;
}

export interface UpdateAttendanceDto {
  status: string | AttendanceStatus;
}

export interface AttendanceResponseDto {
  id: number;
  sessionId: number;
  studentId: number;
  studentName?: string;
  studentEmail?: string;
  status: string | AttendanceStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  modifiedBy?: string | null;
  modifiedByName?: string | null;
  modifiedAt?: string | null;
}

export interface AttendanceSession {
  id: number;
  courseId: number;
  courseTitle?: string;
  date: string; // ISO date string
  records: AttendanceRecord[];
}

export interface AttendanceRecord {
  studentId: number;
  studentName?: string;
  status: AttendanceStatus;
  recordId?: number;
}

export interface BulkAttendanceItem {
  studentId: number;
  status: number;
}

export interface PendingAttendanceSessionDto {
  id: number;
  topic: string;
  courseTitle: string;
  groupName: string;
  instructorId: number;
  instructorName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  hasAttendance: boolean;
}

export interface AttendanceSummaryDto {
  attendedToday: number;
  attendedThisWeek: number;
  sessionsUpdatedTodayCount: number;
  pendingAttendanceSessionsCount: number;
  sessionsUpdatedToday: PendingAttendanceSessionDto[];
  pendingAttendanceSessions: PendingAttendanceSessionDto[];
}

/**
 * How one instructor kept their registers over a period.
 *
 * Derived from the attendance rows themselves — who wrote each one and when —
 * rather than counted as it happens, so it answers for months that passed
 * before anybody thought to measure it.
 */
export interface RegisterCompliance {
  instructorId: number;
  instructorName: string;
  /** Classes taught in the period, cancellations excluded. */
  sessionsTaught: number;
  onTime: number;
  /** Registered, but after the 24-hour window had closed. */
  late: number;
  /** Of the late ones, those somebody else had to write. */
  recordedByAdmin: number;
  /** Still empty, with the window long closed. */
  neverRegistered: number;
  onTimeRate: number;
}
