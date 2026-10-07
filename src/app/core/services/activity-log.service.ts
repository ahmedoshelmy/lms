import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LmsService } from './lms.service';
import {
  ActivityFilterOptions,
  ActivityLog,
  ActivityLogQuery,
  ActivityStats,
  PagedResult,
} from '../interfaces/activity-log.interface';

/**
 * The record of what everybody did.
 *
 * It answers questions like "who deleted that class" and "when did this child
 * change group", so it never invents anything: a page of worked examples shown
 * because the server could not be reached would be read as the real record,
 * which is worse than an empty page and an error.
 */
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
    if (query.role) params = params.set('role', query.role);
    if (query.method) params = params.set('method', query.method);
    if (query.entityType) params = params.set('entityType', query.entityType);
    if (query.entityId) params = params.set('entityId', query.entityId.toString());
    if (query.failedOnly) params = params.set('failedOnly', 'true');

    return this.http.get<PagedResult<ActivityLog>>(url, { params });
  }

  getActivityStats(): Observable<ActivityStats> {
    return this.http.get<ActivityStats>(`${this.lmsService.getApiUrl()}/activity-logs/stats`);
  }

  /** The actions, people and roles the log actually holds, for the filters. */
  getFilterOptions(): Observable<ActivityFilterOptions> {
    return this.http.get<ActivityFilterOptions>(
      `${this.lmsService.getApiUrl()}/activity-logs/filters`
    );
  }
}
