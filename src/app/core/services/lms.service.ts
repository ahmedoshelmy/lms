import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class LmsService {
  private http = inject(HttpClient);
  
  private defaultApiUrl = 'https://mindvalley-uhf4n.ondigitalocean.app/api';
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

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.getApiUrl()}/users`);
  }

  createUser(user: { name: string; email: string; role: number }): Observable<User> {
    return this.http.post<User>(`${this.getApiUrl()}/users`, user);
  }

  getCourses(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.getApiUrl()}/courses`);
  }

  createCourse(course: { title: string; description: string; instructorId: string }): Observable<Course> {
    return this.http.post<Course>(`${this.getApiUrl()}/courses`, course);
  }

  getCourseEnrollments(courseId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(`${this.getApiUrl()}/courses/${courseId}/enrollments`);
  }

  enrollStudent(courseId: string, studentId: string): Observable<Enrollment> {
    // Backend API takes raw studentId Guid in body as JSON string
    return this.http.post<Enrollment>(
      `${this.getApiUrl()}/courses/${courseId}/enroll`,
      JSON.stringify(studentId),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
