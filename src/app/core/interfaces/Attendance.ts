import { AttendanceStatus } from "../enums/AttendanceStatus";

export interface CreateAttendanceDto {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

export interface UpdateAttendanceDto {
  status: AttendanceStatus;
}

export interface AttendanceResponseDto {
  id: string;
  sessionId: string;
  studentId: string;
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
  id: string;
  courseId: string;
  courseTitle?: string;
  date: string; // ISO date string
  records: AttendanceRecord[];
}

export interface AttendanceRecord {
  studentId: string;
  studentName?: string;
  status: AttendanceStatus;
  recordId?: string;
}
