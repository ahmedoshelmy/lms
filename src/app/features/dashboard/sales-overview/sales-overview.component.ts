import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import {
  CANDIDATE_STATUS_LABELS,
  Candidate,
  CandidateStatus,
  SlotHold,
} from '../../../core/interfaces/Sales';

/**
 * What a salesperson lands on.
 *
 * Sales used to arrive at the operations overview: sessions taught this month,
 * cancellation rates, counts of instructors. All true, none of it theirs. The
 * things that decide a salesperson's day are which holds are about to lapse and
 * which people are waiting on a call, so those are what this shows.
 */
@Component({
  selector: 'app-sales-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sales-overview.component.html',
  styleUrl: './sales-overview.component.scss',
})
export class SalesOverviewComponent implements OnInit {
  private lms = inject(LmsService);
  private auth = inject(AuthService);

  readonly loading = signal(true);
  readonly holds = signal<SlotHold[]>([]);
  readonly candidates = signal<Candidate[]>([]);

  /** Admin sees the whole desk; a salesperson sees their own. */
  private readonly mineOnly = !this.auth.hasRole(Role.Admin);

  readonly firstName = computed(() => (this.auth.currentUser()?.name ?? '').split(' ')[0] || '');

  // ── Holds ────────────────────────────────────────────────────────────────

  readonly liveHolds = computed(() => this.holds().filter((h) => h.status === 'Held'));

  /**
   * Ordered by how little time is left. A hold that lapses gives the hour back
   * to whoever asks for it next, so this is the list that decides the morning.
   */
  readonly expiringHolds = computed(() =>
    this.liveHolds()
      .filter((h) => h.daysUntilExpiry <= 3)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  );

  /** Enough people committed that operations can turn it into a group. */
  readonly readyHolds = computed(() => this.liveHolds().filter((h) => h.committedCount > 0));

  readonly seatsCommitted = computed(() =>
    this.liveHolds().reduce((n, h) => n + h.committedCount, 0)
  );

  // ── People ───────────────────────────────────────────────────────────────

  readonly openCandidates = computed(() =>
    this.candidates().filter((c) => c.status !== 'Enrolled' && c.status !== 'Lost')
  );

  readonly byStatus = computed(() => {
    const counts = new Map<CandidateStatus, number>();
    for (const candidate of this.candidates()) {
      counts.set(candidate.status, (counts.get(candidate.status) ?? 0) + 1);
    }
    return (['New', 'Contacted', 'TrialBooked', 'Committed'] as CandidateStatus[])
      .filter((status) => counts.has(status))
      .map((status) => ({
        status,
        label: CANDIDATE_STATUS_LABELS[status],
        count: counts.get(status)!,
      }));
  });

  /**
   * People the system cannot move on by itself. A trial that has been sat and
   * not followed up is the most expensive thing on this page: the instructor
   * has already been paid for the hour.
   */
  readonly needsAStep = computed(() =>
    this.candidates()
      .filter(
        (c) =>
          (c.status === 'TrialBooked' && c.trialAttended === true) ||
          (c.status === 'New' && !c.slotHoldId)
      )
      .slice(0, 8)
  );

  reason(candidate: Candidate): string {
    return candidate.status === 'New'
      ? 'No hold yet, so nothing is reserved for them'
      : 'Sat the trial and has not been asked yet';
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.lms
      .getSlotHolds({ mineOnly: this.mineOnly })
      .pipe(catchError(() => of([] as SlotHold[])))
      .subscribe((holds) => {
        this.holds.set(holds);
        this.loading.set(false);
      });

    this.lms
      .getCandidates({ mineOnly: this.mineOnly })
      .pipe(catchError(() => of([] as Candidate[])))
      .subscribe((candidates) => this.candidates.set(candidates));
  }

  /** "in 2 days", "today", "3 days ago" — a countdown reads better than a date. */
  expiryLabel(days: number): string {
    if (days < 0) return `lapsed ${Math.abs(days)}d ago`;
    if (days === 0) return 'lapses today';
    return `${days}d left`;
  }

  dayList(hold: SlotHold): string {
    return hold.schedules.map((s) => `${s.dayOfWeek} ${s.startTime.slice(0, 5)}`).join(', ');
  }
}
