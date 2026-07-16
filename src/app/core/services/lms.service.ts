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
  currentLessonNumber: number;
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
}
