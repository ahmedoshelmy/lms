import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Role } from '../interfaces/Role';
import { AttendanceStatus } from '../enums/AttendanceStatus';
import { LoginRequest, LoginResponse } from '../interfaces/Login';
import { CreateUserPayload, UpdateUserPayload, User } from '../interfaces/User';
import { StudentDetails } from '../interfaces/StudentDetails';
import { InstructorDetails, InstructorStats } from '../interfaces/InstructorDetails';
import {
  CreateAttendanceDto,
  AttendanceResponseDto,
  UpdateAttendanceDto,
  AttendanceSummaryDto,
} from '../interfaces/Attendance';

import { Course, CreateCoursePayload, UpdateCoursePayload } from '../interfaces/Course';
import { Group, CreateGroupPayload, UpdateGroupPayload, UpdateGroupSchedulePayload, GenerateCustomSessionsPayload } from '../interfaces/Group';
import { GroupCourse } from '../interfaces/GroupCourse';
import { ScheduleSession, UpdateSessionPayload } from '../interfaces/ScheduleSession';
import {
  GroupHistory,
  PromoteGroupNextLevelPayload,
  CancelSessionPayload,
  SessionHistoryFilter,
} from '../interfaces/History';

export interface BulkAttendanceItem {
  studentId: number;
  status: AttendanceStatus;
}

@Injectable({
  providedIn: 'root',
})
export class LmsService {
  private http = inject(HttpClient);

  private defaultApiUrl = 'https://mv-api.inite.tech/api';
  private apiUrlSubject = new BehaviorSubject<string>(
    (typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null) ||
      this.defaultApiUrl
  );

  apiUrl$ = this.apiUrlSubject.asObservable();

  getApiUrl(): string {
    return this.apiUrlSubject.value;
  }

  setApiUrl(url: string): void {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('lms_api_url', cleanUrl);
    }
    this.apiUrlSubject.next(cleanUrl);
  }

  resetApiUrl(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lms_api_url');
    }
    this.apiUrlSubject.next(this.defaultApiUrl);
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.getApiUrl()}/auth/login`, payload, {
      withCredentials: true,
    });
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.getApiUrl()}/auth/logout`,
      {},
      {
        withCredentials: true,
      }
    );
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  // getUsers(): Observable<User[]> {
  //   return this.http.get<User[]>(`${this.getApiUrl()}/users`);
  // }

  getStudents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/students`);
  }

  getInstructors(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/instructors`);
  }

  createUser(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(`${this.getApiUrl()}/users`, payload);
  }

  updateUser(id: number, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<User>(`${this.getApiUrl()}/users/${id}`, payload);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/users/${id}`);
  }

  getStudentDetails(id: number): Observable<StudentDetails> {
    return this.http.get<StudentDetails>(`${this.getApiUrl()}/students/${id}/details`);
  }

  getInstructorDetails(id: number): Observable<InstructorDetails> {
    return this.http.get<InstructorDetails>(`${this.getApiUrl()}/instructors/${id}/details`);
  }

  getInstructorStats(id: number): Observable<InstructorStats> {
    return this.http.get<InstructorStats>(`${this.getApiUrl()}/instructors/${id}/stats`);
  }

  // ─── Courses ─────────────────────────────────────────────────────────────

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.getApiUrl()}/courses`);
  }

  createCourse(payload: CreateCoursePayload): Observable<Course> {
    return this.http.post<Course>(`${this.getApiUrl()}/courses`, payload);
  }

  updateCourse(id: number, payload: UpdateCoursePayload): Observable<Course> {
    return this.http.put<Course>(`${this.getApiUrl()}/courses/${id}`, payload);
  }

  deleteCourse(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/courses/${id}`);
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.getApiUrl()}/groups`);
  }

  getGroup(id: number): Observable<Group> {
    return this.http.get<Group>(`${this.getApiUrl()}/groups/${id}`);
  }

  createGroup(payload: CreateGroupPayload): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups`, payload);
  }

  updateGroup(id: number, payload: UpdateGroupPayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${id}`, payload);
  }

  deleteGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/groups/${id}`);
  }

  removeStudentFromGroup(groupId: number, studentId: number): Observable<Group> {
    return this.http.delete<Group>(`${this.getApiUrl()}/groups/${groupId}/students/${studentId}`);
  }

  addCourseToGroup(groupId: number, courseId: number): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/courses`, { courseId });
  }

  generateGroupCourseSessions(groupCourseId: number): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/schedule/generate-sessions/${groupCourseId}`, {});
  }

  removeCourseFromGroup(groupId: number, courseId: number, confirmDeleteSessions = false): Observable<Group> {
    let url = `${this.getApiUrl()}/groups/${groupId}/courses/${courseId}`;
    if (confirmDeleteSessions) {
      url += `?confirmDeleteSessions=true`;
    }
    return this.http.delete<Group>(url);
  }

  updateGroupCourseSessions(groupId: number, groupCourseId: number, totalSessions: number): Observable<Group> {
    return this.http.put<Group>(
      `${this.getApiUrl()}/groups/${groupId}/courses/${groupCourseId}/sessions`,
      { totalSessions }
    );
  }

  updateGroupSchedule(groupId: number, payload: UpdateGroupSchedulePayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${groupId}/schedule`, payload);
  }

  generateCustomSessions(payload: GenerateCustomSessionsPayload): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/schedule/generate-custom`, payload);
  }

  // ─── Schedule ────────────────────────────────────────────────────────────

  getSchedule(from?: Date, to?: Date): Observable<ScheduleSession[]> {
    let url = `${this.getApiUrl()}/schedule`;
    const params: string[] = [];
    if (from) {
      params.push(`from=${from.toISOString()}`);
    }
    if (to) {
      params.push(`to=${to.toISOString()}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<ScheduleSession[]>(url);
  }

  updateSession(id: number, payload: UpdateSessionPayload): Observable<ScheduleSession> {
    return this.http.put<ScheduleSession>(`${this.getApiUrl()}/Schedule/sessions/${id}`, payload);
  }

  getSessionDetails(id: number): Observable<ScheduleSession> {
    return this.http.get<ScheduleSession>(`${this.getApiUrl()}/Schedule/sessions/${id}`);
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  getSessionAttendance(sessionId: number): Observable<AttendanceResponseDto[]> {
    return this.http.get<AttendanceResponseDto[]>(
      `${this.getApiUrl()}/Attendance/session/${sessionId}`
    );
  }

  createAttendance(payload: CreateAttendanceDto): Observable<AttendanceResponseDto> {
    return this.http.post<AttendanceResponseDto>(`${this.getApiUrl()}/Attendance`, payload);
  }

  updateAttendance(id: number, payload: UpdateAttendanceDto): Observable<AttendanceResponseDto> {
    return this.http.put<AttendanceResponseDto>(`${this.getApiUrl()}/Attendance/${id}`, payload);
  }

  saveBulkAttendance(sessionId: number, records: BulkAttendanceItem[]): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/Attendance/session/${sessionId}`, records);
  }

  getAttendanceSummary(): Observable<AttendanceSummaryDto> {
    return this.http.get<AttendanceSummaryDto>(`${this.getApiUrl()}/Attendance/summary`);
  }

  // ─── Group Promotion & History ─────────────────────────────────────────────

  promoteGroupNextLevel(groupId: number, payload: PromoteGroupNextLevelPayload): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups/${groupId}/promote`, payload);
  }

  getGroupHistory(groupId: number): Observable<GroupHistory> {
    return this.http.get<GroupHistory>(`${this.getApiUrl()}/groups/${groupId}/history`);
  }

  getAllGroupsHistory(): Observable<GroupHistory[]> {
    return this.http.get<GroupHistory[]>(`${this.getApiUrl()}/groups/history`);
  }

  cancelAndShiftSession(
    sessionId: number,
    payload: CancelSessionPayload
  ): Observable<ScheduleSession> {
    return this.http.post<ScheduleSession>(
      `${this.getApiUrl()}/Schedule/sessions/${sessionId}/cancel`,
      payload
    );
  }

  getSessionHistory(filter?: SessionHistoryFilter): Observable<ScheduleSession[]> {
    let url = `${this.getApiUrl()}/Schedule/history`;
    const params: string[] = [];
    if (filter) {
      if (filter.groupId) params.push(`groupId=${filter.groupId}`);
      if (filter.instructorId) params.push(`instructorId=${filter.instructorId}`);
      if (filter.status) params.push(`status=${filter.status}`);
      if (filter.from) params.push(`from=${filter.from}`);
      if (filter.to) params.push(`to=${filter.to}`);
    }
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }
    return this.http.get<ScheduleSession[]>(url);
  }
}
