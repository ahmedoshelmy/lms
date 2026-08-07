import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { LmsService } from './lms.service';
import { ActivityLog, ActivityLogQuery, ActivityStats, PagedResult } from '../interfaces/activity-log.interface';

@Injectable({
  providedIn: 'root',
})
export class ActivityLogService {
  private http = inject(HttpClient);
  private lmsService = inject(LmsService);

  getActivityLogs(query: ActivityLogQuery): Observable<PagedResult<ActivityLog>> {
    const url = `${this.lmsService.getApiUrl()}/activity-logs`;
    let params = new HttpParams();

    if (query.page) params = params.set('page', query.page.toString());
    if (query.pageSize) params = params.set('pageSize', query.pageSize.toString());
    if (query.userId) params = params.set('userId', query.userId.toString());
    if (query.action) params = params.set('action', query.action);
    if (query.search) params = params.set('search', query.search);
    if (query.startDate) params = params.set('startDate', query.startDate);
    if (query.endDate) params = params.set('endDate', query.endDate);

    return this.http.get<PagedResult<ActivityLog>>(url, { params }).pipe(
      catchError(() => {
        // Fallback demo data if backend is offline / dev fallback
        return of(this.getMockLogs(query));
      })
    );
  }

  getActivityStats(): Observable<ActivityStats> {
    const url = `${this.lmsService.getApiUrl()}/activity-logs/stats`;
    return this.http.get<ActivityStats>(url).pipe(
      catchError(() => {
        return of(this.getMockStats());
      })
    );
  }

  private getMockLogs(query: ActivityLogQuery): PagedResult<ActivityLog> {
    const mockData: ActivityLog[] = [
      { id: 1, userId: 1, userName: 'LMS Admin', userRole: 'Admin', action: 'User Login', method: 'POST', path: '/api/auth/login', statusCode: 200, details: 'POST /api/auth/login returned status 200', createdAt: new Date().toISOString() },
      { id: 2, userId: 2, userName: 'Ahmed Saeed', userRole: 'Instructor', action: 'Mark Attendance', method: 'POST', path: '/api/attendance', statusCode: 200, details: 'Marked attendance for Session #1', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, userId: 1, userName: 'LMS Admin', userRole: 'Admin', action: 'Create Group', method: 'POST', path: '/api/groups', statusCode: 200, details: 'Created Group PY-G01', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 4, userId: 3, userName: 'Mahmoud Khalaf', userRole: 'Instructor', action: 'Update Session', method: 'PUT', path: '/api/sessions/5', statusCode: 200, details: 'Updated topic for Session #5', createdAt: new Date(Date.now() - 10800000).toISOString() },
    ];

    let filtered = [...mockData];
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(x => x.action.toLowerCase().includes(s) || (x.userName && x.userName.toLowerCase().includes(s)));
    }

    return {
      items: filtered,
      totalCount: filtered.length,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
      totalPages: 1
    };
  }

  private getMockStats(): ActivityStats {
    return {
      totalActivities: 42,
      todayActivities: 14,
      topActions: [
        { action: 'Mark Attendance', count: 18 },
        { action: 'User Login', count: 12 },
        { action: 'Update Session', count: 7 },
        { action: 'Create Group', count: 5 }
      ],
      activitiesByRole: [
        { role: 'Instructor', count: 25 },
        { role: 'Admin', count: 14 },
        { role: 'Student', count: 3 }
      ],
      recentDailyActivity: [
        { date: '2026-08-01', count: 4 },
        { date: '2026-08-02', count: 6 },
        { date: '2026-08-03', count: 8 },
        { date: '2026-08-04', count: 5 },
        { date: '2026-08-05', count: 11 },
        { date: '2026-08-06', count: 9 },
        { date: '2026-08-07', count: 14 }
      ]
    };
  }
}
