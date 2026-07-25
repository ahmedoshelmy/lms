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
