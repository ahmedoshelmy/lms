import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Role } from '../interfaces/Role';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
  groupId?: string;
  groupName?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  groupId?: string;
}

export interface UpdateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: Role;
  groupId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  topic: string;
  level: string;
  sessionCount: string;
  createdAt: string;
  groupCount: number;
  studentCount: number;
}

export interface GroupCourse {
  courseId: string;
  title: string;
  topic: string;
  level: string;
  sessionCount: string;
  orderIndex: number;
  currentSessionNumber: number;
}

export interface Group {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  location?: string;
  defaultInstructorId: string;
  defaultInstructorName: string;
  studentCount: number;
  courses: GroupCourse[];
}

export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle?: string;
  studentId: string;
  studentName?: string;
  enrollmentDate: string;
  progressPercentage: number;
}

export enum AttendanceStatus {
  Absent = 0,
  Present = 1,
  Late = 2,
  Excused = 3,
}

export interface CreateAttendanceDto {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

export interface UpdateAttendanceDto {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
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

export interface Resource {
  id: string;
  courseId: string;
  courseTitle?: string;
  title: string;
  url: string;
  type: 'link' | 'video' | 'document' | 'other';
  addedAt: string;
  addedBy?: string;
}

export interface ScheduleSession {
  id: string;
  courseTitle: string;
  groupName: string;
  groupId: string;
  topic: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  instructorId: string;
  instructorName: string;
  location?: string;
  status: string;
  orderIndex: number;
  currentSessionNumber: number;
  totalSessions: number;
  type: string;
}

export interface CreateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: string;
  status?: number;
  location?: string;
  courseIds?: string[];
}

export interface UpdateGroupPayload {
  name: string;
  startDate: string;
  endDate: string;
  defaultInstructorId: string;
  status: number;
  location?: string;
}

export interface BulkAttendanceItem {
  studentId: string;
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

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/users`);
  }

  getStudents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/students`);
  }

  getInstructors(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/instructors`);
  }

  createUser(payload: CreateUserPayload): Observable<User> {
    return this.http.post<User>(`${this.getApiUrl()}/users`, payload);
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.put<User>(`${this.getApiUrl()}/users/${id}`, payload);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/users/${id}`);
  }

  // ─── Courses ─────────────────────────────────────────────────────────────

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.getApiUrl()}/courses`);
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.getApiUrl()}/groups`);
  }

  getGroup(id: string): Observable<Group> {
    return this.http.get<Group>(`${this.getApiUrl()}/groups/${id}`);
  }

  createGroup(payload: CreateGroupPayload): Observable<Group> {
    return this.http.post<Group>(`${this.getApiUrl()}/groups`, payload);
  }

  updateGroup(id: string, payload: UpdateGroupPayload): Observable<Group> {
    return this.http.put<Group>(`${this.getApiUrl()}/groups/${id}`, payload);
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/groups/${id}`);
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

  // ─── Attendance ───────────────────────────────────────────────────────────

  createAttendance(payload: CreateAttendanceDto): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/Attendance`, payload);
  }

  updateAttendance(id: string, payload: UpdateAttendanceDto): Observable<any> {
    return this.http.put(`${this.getApiUrl()}/Attendance/${id}`, payload);
  }

  saveBulkAttendance(sessionId: string, records: BulkAttendanceItem[]): Observable<any> {
    return this.http.post(`${this.getApiUrl()}/Attendance/session/${sessionId}`, records);
  }
}
