import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  StudentCourse,
  StudentDetails,
  StudentUpcomingSession,
} from '../../../core/interfaces/StudentDetails';
import { StudentSessionSummary } from '../../../core/interfaces/SessionSyllabus';
import { ClockFormatService } from '../../../core/services/clock-format.service';
import { sessionsTaught } from '../../../core/utils/course-progress.utils';

/**
 * What a student lands on.
 *
 * They used to arrive at the operations overview: sessions taught this month
 * across the whole school, cancellation rates, a bar chart per instructor.
 * A student wants four things — when is my next class, how far through am I,
 * have I been turning up, and what did we do last time.
 */
@Component({
  selector: 'app-student-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink],
  templateUrl: './student-home.component.html',
  styleUrl: './student-home.component.scss',
})
export class StudentHomeComponent implements OnInit {
  /** Times read as 16:30 or 4:30 pm, whichever the reader chose. */
  protected readonly clock = inject(ClockFormatService);

  private lms = inject(LmsService);
  private auth = inject(AuthService);

  readonly loading = signal(true);
  readonly record = signal<StudentDetails | null>(null);
  readonly summaries = signal<StudentSessionSummary[]>([]);

  readonly firstName = computed(() => (this.auth.currentUser()?.name ?? '').split(' ')[0] || '');

  /** The groups they are in now: a child may be learning two things at once. */
  readonly groups = computed(() => (this.record()?.groupHistory ?? []).filter((g) => !g.leftAt));

  /** The one this page leads with, and the one the progress bar describes. */
  readonly group = computed(() => this.groups()[0] ?? null);

  /**
   * The course each group is working through now, rather than one finished.
   * One per group: a child learning two things used to see only the first.
   */
  readonly activeCourses = computed(() =>
    this.groups()
      .map((group) => {
        const courses = group.courses ?? [];
        const course = courses.find((c) => !c.isCompleted) ?? courses[courses.length - 1] ?? null;
        return course ? { groupId: group.groupId, course } : null;
      })
      .filter((item): item is { groupId: number; course: StudentCourse } => !!item)
  );

  /** "Python L1 – Sat · taught by Mona and Robotics L2 · taught by Ali". */
  readonly groupsLine = computed(() =>
    this.groups()
      .map((g) =>
        g.instructorName ? `${g.groupName} · taught by ${g.instructorName}` : g.groupName
      )
      .join(' and ')
  );

  readonly nextSession = computed<StudentUpcomingSession | null>(
    () => this.record()?.upcomingSessions?.[0] ?? null
  );

  // ── Progress ─────────────────────────────────────────────────────────────

  /**
   * Sessions behind them, counted from where the course has got to. The
   * progress number is the next session owed, so one fewer has been taught.
   */
  sessionsDone(course: StudentCourse): number {
    return sessionsTaught(course);
  }

  progressPercent(course: StudentCourse): number {
    if (!course.totalSessions) return 0;
    return Math.min(100, Math.round((this.sessionsDone(course) / course.totalSessions) * 100));
  }

  // ── Attendance ───────────────────────────────────────────────────────────

  /** Cancelled classes are nobody's absence, so they are left out of the sum. */
  readonly counted = computed(() =>
    (this.record()?.attendanceHistory ?? []).filter(
      (a) => !a.sessionStatus.toLowerCase().includes('cancel')
    )
  );

  readonly attendedCount = computed(
    () => this.counted().filter((a) => ['Present', 'Late'].includes(a.attendanceStatus)).length
  );

  readonly attendanceRate = computed(() => {
    const total = this.counted().length;
    return total ? Math.round((this.attendedCount() / total) * 100) : null;
  });

  readonly missedCount = computed(
    () => this.counted().filter((a) => a.attendanceStatus === 'Absent').length
  );

  // ── Last class ───────────────────────────────────────────────────────────

  /**
   * The most recent class with something written about it. A summary nobody
   * has filled in yet would be an empty card, so it is skipped rather than
   * shown blank.
   */
  readonly lastSummary = computed(
    () =>
      this.summaries()
        .filter((s) => s.hasSummary && (s.parentSummary || s.content))
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0] ?? null
  );

  /** The student's record could not be loaded; said, not shown as "no group". */
  readonly loadFailed = signal(false);

  ngOnInit(): void {
    this.lms
      .getMyStudentRecord()
      .pipe(
        // A failure used to read as "You are not in a group yet".
        catchError(() => {
          this.loadFailed.set(true);
          return of(null);
        })
      )
      .subscribe((record) => {
        this.record.set(record);
        this.loading.set(false);
      });

    const id = this.auth.getUserId();
    if (id) {
      this.lms
        .getStudentSessionSummaries(id)
        .pipe(catchError(() => of([] as StudentSessionSummary[])))
        .subscribe((summaries) => this.summaries.set(summaries));
    }
  }

  /** "Tomorrow, 4:30 pm" reads better to a child than a date stamp. */
  whenLabel(iso: string): string {
    const when = new Date(iso);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const days = Math.floor((when.getTime() - midnight.getTime()) / 86_400_000);

    const time = this.clock.time(when);
    if (days === 0) return `Today, ${time}`;
    if (days === 1) return `Tomorrow, ${time}`;

    const weekday = when.toLocaleDateString('en-GB', { weekday: 'long' });
    if (days < 7) return `${weekday}, ${time}`;

    return `${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
  }

  dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
