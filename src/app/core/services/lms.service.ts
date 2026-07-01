import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, of, catchError } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: number; // 1: Student, 2: Instructor
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  instructorName?: string;
  createdAt: string;
  enrollments?: Enrollment[];
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
  present: boolean;
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

@Injectable({
  providedIn: 'root',
})
export class LmsService {
  private http = inject(HttpClient);

  private defaultApiUrl = 'https://mv-api.inite.tech/api';
  private apiUrlSubject = new BehaviorSubject<string>(
    (typeof window !== 'undefined' ? localStorage.getItem('lms_api_url') : null) || this.defaultApiUrl
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

  // ─── Users ───────────────────────────────────────────────────────────────

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/users`);
  }

  createUser(user: { name: string; email: string; role: number }): Observable<User> {
    return this.http.post<User>(`${this.getApiUrl()}/users`, user);
  }

  updateUser(id: string, user: Partial<{ name: string; email: string; role: number }>): Observable<User> {
    return this.http.put<User>(`${this.getApiUrl()}/users/${id}`, user);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/users/${id}`);
  }

  getStudentEnrollments(studentId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(`${this.getApiUrl()}/users/${studentId}/enrollments`).pipe(
      catchError(() => of([]))
    );
  }

  // ─── Courses ─────────────────────────────────────────────────────────────

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.getApiUrl()}/courses`);
  }

  createCourse(course: { title: string; description: string; instructorId: string }): Observable<Course> {
    return this.http.post<Course>(`${this.getApiUrl()}/courses`, course);
  }

  updateCourse(id: string, course: Partial<{ title: string; description: string; instructorId: string }>): Observable<Course> {
    return this.http.put<Course>(`${this.getApiUrl()}/courses/${id}`, course);
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.getApiUrl()}/courses/${id}`);
  }

  getCourseEnrollments(courseId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(`${this.getApiUrl()}/courses/${courseId}/enrollments`);
  }

  enrollStudent(courseId: string, studentId: string): Observable<Enrollment> {
    return this.http.post<Enrollment>(
      `${this.getApiUrl()}/courses/${courseId}/enroll`,
      JSON.stringify(studentId),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // ─── Attendance (localStorage fallback) ──────────────────────────────────

  private readonly ATTENDANCE_KEY = 'lms_attendance_sessions';

  getAttendanceSessions(): AttendanceSession[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.ATTENDANCE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  saveAttendanceSessions(sessions: AttendanceSession[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.ATTENDANCE_KEY, JSON.stringify(sessions));
  }

  createAttendanceSession(session: Omit<AttendanceSession, 'id'>): AttendanceSession {
    const sessions = this.getAttendanceSessions();
    const newSession: AttendanceSession = {
      ...session,
      id: crypto.randomUUID(),
    };
    sessions.unshift(newSession);
    this.saveAttendanceSessions(sessions);
    return newSession;
  }

  updateAttendanceSession(session: AttendanceSession): void {
    const sessions = this.getAttendanceSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx !== -1) {
      sessions[idx] = session;
      this.saveAttendanceSessions(sessions);
    }
  }

  deleteAttendanceSession(id: string): void {
    const sessions = this.getAttendanceSessions().filter(s => s.id !== id);
    this.saveAttendanceSessions(sessions);
  }

  // ─── Resources (localStorage fallback) ───────────────────────────────────

  private readonly RESOURCES_KEY = 'lms_resources';

  getResources(): Resource[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.RESOURCES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  saveResources(resources: Resource[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.RESOURCES_KEY, JSON.stringify(resources));
  }

  createResource(resource: Omit<Resource, 'id' | 'addedAt'>): Resource {
    const resources = this.getResources();
    const newResource: Resource = {
      ...resource,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    resources.unshift(newResource);
    this.saveResources(resources);
    return newResource;
  }

  deleteResource(id: string): void {
    const resources = this.getResources().filter(r => r.id !== id);
    this.saveResources(resources);
  }
}
