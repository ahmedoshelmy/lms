import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LmsService } from './lms.service';
import { AuthService } from './auth.service';
import {
  CancellationCauseName,
  OperationsRota,
  OutstandingWork,
  SessionClaim,
  WeekDay,
} from '../interfaces/Operations';

/**
 * The work the school has to get out of somebody before they carry on.
 *
 * Held here rather than in the window that shows it, because the answer has to
 * survive moving between pages: somebody sent off to mark a register comes back
 * to the same list one item shorter, and a component that reloaded from nothing
 * each time would flash an empty box on the way.
 */
@Injectable({ providedIn: 'root' })
export class OperationsService {
  private http = inject(HttpClient);
  private lms = inject(LmsService);
  private auth = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  /** What is outstanding, or null before anybody has asked. */
  readonly work = signal<OutstandingWork | null>(null);

  /**
   * The class they have been sent off to deal with.
   *
   * The window is in the way on purpose, but the way out of it leads to a page
   * it would otherwise cover. While this is set the window stands aside; it is
   * cleared the moment they navigate anywhere else, and the list is asked for
   * again, so finishing the job is what makes the item go away.
   */
  readonly workingOn = signal<number | null>(null);

  /**
   * Set when somebody closes the window while everything left in it is out
   * of their hands -- late registers only operations can now fill in. Lasts
   * until the page is reloaded or they sign out; new work they can do brings
   * the window straight back.
   */
  readonly snoozed = signal(false);

  private get base(): string {
    return `${this.lms.getApiUrl()}/operations`;
  }

  /**
   * Asks what is outstanding. Quiet about failure: a network blip must not put
   * an error toast in front of somebody every time they change page, and the
   * worst case is that the window does not appear until the next navigation.
   */
  refresh(): void {
    if (!isPlatformBrowser(this.platformId) || !this.auth.isLoggedIn()) {
      return;
    }

    this.http.get<OutstandingWork>(`${this.base}/outstanding`).subscribe({
      next: (work) => this.work.set(work),
      error: () => this.work.set(null),
    });
  }

  /** Stand aside while they go and do one of them. */
  startWorkingOn(sessionId: number): void {
    this.workingOn.set(sessionId);
  }

  /** They have gone somewhere else, so ask again. */
  doneWorking(): void {
    if (this.workingOn() !== null) {
      this.workingOn.set(null);
    }
    this.refresh();
  }

  clear(): void {
    this.work.set(null);
    this.workingOn.set(null);
    this.snoozed.set(false);
  }

  snooze(): void {
    this.snoozed.set(true);
  }

  /** An instructor saying a class did not happen. */
  raiseClaim(sessionId: number, reason: string): Observable<SessionClaim> {
    return this.http
      .post<SessionClaim>(`${this.base}/claims`, { sessionId, reason })
      .pipe(tap(() => this.refresh()));
  }

  /** Operations cancelling the class an instructor reported. */
  acceptClaim(
    id: number,
    cause: CancellationCauseName,
    shiftUpcomingSchedule = false
  ): Observable<SessionClaim> {
    return this.http
      .post<SessionClaim>(`${this.base}/claims/${id}/resolve`, {
        accept: true,
        cause,
        shiftUpcomingSchedule,
      })
      .pipe(tap(() => this.refresh()));
  }

  /** Operations sending it back, which puts the register back on the instructor. */
  rejectClaim(id: number, note: string): Observable<SessionClaim> {
    return this.http
      .post<SessionClaim>(`${this.base}/claims/${id}/resolve`, { accept: false, note })
      .pipe(tap(() => this.refresh()));
  }

  getRota(): Observable<OperationsRota> {
    return this.http.get<OperationsRota>(`${this.base}/rota`);
  }

  saveRota(admins: { userId: number; days: WeekDay[] }[]): Observable<OperationsRota> {
    return this.http
      .put<OperationsRota>(`${this.base}/rota`, { admins })
      .pipe(tap(() => this.refresh()));
  }
}
