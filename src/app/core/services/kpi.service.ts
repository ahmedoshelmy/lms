import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  InstructorKpi,
  KpiHistoryPoint,
  KpiIndicatorKey,
  KpiMonth,
  KpiSettings,
} from '../interfaces/InstructorKpi';
import { LmsService, query } from './lms.service';

/**
 * Instructor KPIs. The endpoints and the rules behind every figure are in
 * docs/instructor-kpis.api.md; the feature stays switched off
 * (environment.features.instructorKpis) until the server has them.
 */
@Injectable({ providedIn: 'root' })
export class KpiService {
  private readonly http = inject(HttpClient);
  private readonly lms = inject(LmsService);

  private get base(): string {
    return `${this.lms.getApiUrl()}/kpis`;
  }

  getMonth(month: string): Observable<KpiMonth> {
    return this.http.get<KpiMonth>(`${this.base}/months/${month}`);
  }

  setOverride(
    month: string,
    instructorId: number,
    indicator: KpiIndicatorKey,
    change: { value: number; reason: string }
  ): Observable<InstructorKpi> {
    return this.http.put<InstructorKpi>(this.overrideUrl(month, instructorId, indicator), change);
  }

  clearOverride(
    month: string,
    instructorId: number,
    indicator: KpiIndicatorKey
  ): Observable<InstructorKpi> {
    return this.http.delete<InstructorKpi>(this.overrideUrl(month, instructorId, indicator));
  }

  approve(month: string): Observable<KpiMonth> {
    return this.http.post<KpiMonth>(`${this.base}/months/${month}/approve`, {});
  }

  reopen(month: string, reason: string): Observable<KpiMonth> {
    return this.http.post<KpiMonth>(`${this.base}/months/${month}/reopen`, { reason });
  }

  getHistory(instructorId: number, from: string, to: string): Observable<KpiHistoryPoint[]> {
    return this.http.get<KpiHistoryPoint[]>(`${this.base}/instructors/${instructorId}/history`, {
      params: query({ from, to }),
    });
  }

  getSettings(): Observable<KpiSettings> {
    return this.http.get<KpiSettings>(`${this.base}/settings`);
  }

  saveSettings(settings: KpiSettings): Observable<KpiSettings> {
    return this.http.put<KpiSettings>(`${this.base}/settings`, settings);
  }

  /** Emails the PDF to the owner address in the settings; answers with that address. */
  sendToOwner(month: string, pdf: Blob, fileName: string, instructorId?: number) {
    const form = new FormData();
    form.append('file', pdf, fileName);
    if (instructorId !== undefined) form.append('instructorId', String(instructorId));
    return this.http.post<{ sentTo: string }>(`${this.base}/months/${month}/send`, form);
  }

  /** An instructor's own approved months. */
  getMine(from: string, to: string): Observable<InstructorKpi[]> {
    return this.http.get<InstructorKpi[]>(`${this.base}/me`, { params: query({ from, to }) });
  }

  private overrideUrl(month: string, instructorId: number, indicator: KpiIndicatorKey): string {
    return `${this.base}/months/${month}/instructors/${instructorId}/overrides/${indicator}`;
  }
}
