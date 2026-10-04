import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { MonthlyReportPdfService } from '../../../core/services/monthly-report-pdf.service';
import {
  EVALUATION_SECTIONS,
  EvaluationMetric,
  MonthlyEvaluation,
  RECOMMENDATION_SUGGESTIONS,
} from '../../../core/interfaces/MonthlyEvaluation';

/**
 * One child's month, filled in as far as the school can fill it.
 *
 * The page opens with the facts already written: which classes ran, how the
 * child was marked, what was covered. Every one of them can be typed over, and
 * the page says which ones were, because the instructor was in the room and
 * the register was not always taken.
 */
@Component({
  selector: 'app-evaluation-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './evaluation-detail.component.html',
  styleUrl: './evaluation-detail.component.scss',
})
export class EvaluationDetailComponent implements OnInit {
  private lms = inject(LmsService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pdf = inject(MonthlyReportPdfService);

  protected readonly sections = EVALUATION_SECTIONS;
  protected readonly suggestions = RECOMMENDATION_SUGGESTIONS;
  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  protected loading = signal(true);
  protected saving = signal(false);
  protected downloading = signal(false);
  protected report = signal<MonthlyEvaluation | null>(null);

  // What the instructor has in front of them, kept apart from what was loaded
  // so "counted" and "typed over" stay distinguishable.
  protected overview = signal('');
  protected attendanceRate = signal(0);
  protected tasksRate = signal(0);
  protected assignmentsRate = signal(0);
  protected recommendations = signal('');
  protected ratings = signal<Record<string, number>>({});
  protected included = signal<Record<number, boolean>>({});

  protected readonly monthLabel = computed(() => {
    const month = this.report()?.month;
    return month
      ? new Date(`${month.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  /** A released report is a parent's copy; only operations may reopen it. */
  protected readonly locked = computed(
    () => this.report()?.status === 'Released' && !this.isAdmin()
  );

  protected readonly ratedCount = computed(
    () => Object.values(this.ratings()).filter((stars) => stars >= 1).length
  );

  protected readonly allRated = computed(
    () => this.ratedCount() === this.sections.reduce((n, s) => n + s.metrics.length, 0)
  );

  /** What the registers say, for the line under each rate. */
  protected readonly counted = computed(() => {
    const a = this.report()?.attendance;
    if (!a) return null;

    return {
      attendance: share(a.present + a.late, a.classesHeld),
      tasks: share(a.tasksDone, a.tasksAsked),
      assignments: share(a.assignmentsDone, a.assignmentsAsked),
      attendanceNote: `${a.present + a.late} of ${a.classesHeld} classes${
        a.notMarked ? `, ${a.notMarked} with no register` : ''
      }`,
      tasksNote: a.tasksAsked
        ? `${a.tasksDone} of ${a.tasksAsked} recorded`
        : 'Nothing recorded in the register',
      assignmentsNote: a.assignmentsAsked
        ? `${a.assignmentsDone} of ${a.assignmentsAsked} recorded`
        : 'Nothing recorded in the register',
    };
  });

  ngOnInit(): void {
    const studentId = Number(this.route.snapshot.paramMap.get('studentId'));
    const groupId = Number(this.route.snapshot.paramMap.get('groupId'));
    const month = this.route.snapshot.queryParamMap.get('month') ?? firstOfLastMonth();

    this.lms.getEvaluation(studentId, groupId, month).subscribe({
      next: (report) => {
        this.apply(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private apply(report: MonthlyEvaluation): void {
    this.report.set(report);
    this.overview.set(report.technicalOverview ?? '');
    this.attendanceRate.set(report.attendanceRate);
    this.tasksRate.set(report.tasksRate);
    this.assignmentsRate.set(report.assignmentsRate);
    this.recommendations.set(report.recommendations ?? '');
    this.ratings.set(Object.fromEntries(report.ratings.map((r) => [r.metric, r.stars])));
    this.included.set(Object.fromEntries(report.sessions.map((s) => [s.sessionId, s.included])));
  }

  protected starsFor(metric: EvaluationMetric): number {
    return this.ratings()[metric] ?? 0;
  }

  protected setStars(metric: EvaluationMetric, stars: number): void {
    if (this.locked()) return;
    // Clicking the star already given takes it back, which is the only way to
    // undo a misclick without a second control.
    const next = this.starsFor(metric) === stars ? 0 : stars;
    this.ratings.update((all) => ({ ...all, [metric]: next }));
  }

  protected toggleSession(sessionId: number): void {
    if (this.locked()) return;
    this.included.update((all) => ({ ...all, [sessionId]: !all[sessionId] }));
  }

  /**
   * Rewrites the overview from whichever classes are ticked now, throwing away
   * any edits. Offered as a button rather than done automatically, because
   * silently replacing somebody's writing is worse than making them ask.
   */
  protected rewriteOverview(): void {
    const report = this.report();
    if (!report || this.locked()) return;

    const text = report.sessions
      .filter((s) => this.included()[s.sessionId])
      .map((s) =>
        s.parentSummary?.trim()
          ? `Session ${s.sessionNumber} — ${s.title}: ${s.parentSummary.trim()}`
          : `Session ${s.sessionNumber} — ${s.title}.`
      )
      .join('\n\n');

    this.overview.set(text);
  }

  protected addSuggestion(line: string): void {
    if (this.locked()) return;
    const current = this.recommendations().trim();
    if (current.split('\n').some((existing) => existing.trim() === line)) return;
    this.recommendations.set(current ? `${current}\n${line}` : line);
  }

  protected save(submit: boolean): void {
    const report = this.report();
    if (!report) return;

    if (submit && !this.allRated()) {
      this.notify.showWarn('Every rating needs a score before this can go to operations.');
      return;
    }

    this.saving.set(true);
    this.lms
      .saveEvaluation({
        studentId: report.studentId,
        groupId: report.groupId,
        month: report.month,
        technicalOverview: this.overview().trim() || null,
        attendanceRate: this.attendanceRate(),
        tasksRate: this.tasksRate(),
        assignmentsRate: this.assignmentsRate(),
        recommendations: this.recommendations().trim() || null,
        ratings: Object.entries(this.ratings()).map(([metric, stars]) => ({
          metric: metric as EvaluationMetric,
          stars,
        })),
        sessionIds: Object.entries(this.included())
          .filter(([, on]) => on)
          .map(([id]) => Number(id)),
        submit,
      })
      .subscribe({
        next: (saved) => {
          this.apply(saved);
          this.saving.set(false);
          this.notify.showSuccess(
            submit
              ? `${saved.studentName}'s report is with operations.`
              : 'Saved. Nobody sees it until you send it on.'
          );
        },
        error: () => this.saving.set(false),
      });
  }

  protected release(): void {
    const id = this.report()?.id;
    if (!id) return;

    this.saving.set(true);
    this.lms.releaseEvaluation(id).subscribe({
      next: (saved) => {
        this.apply(saved);
        this.saving.set(false);
        this.notify.showSuccess('Released. This is the copy the parents get.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected async download(): Promise<void> {
    const report = this.report();
    if (!report) return;

    this.downloading.set(true);
    try {
      await this.pdf.save(report);
    } finally {
      this.downloading.set(false);
    }
  }

  protected back(): void {
    this.router.navigate(['/evaluations']);
  }
}

function share(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

function firstOfLastMonth(): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}
