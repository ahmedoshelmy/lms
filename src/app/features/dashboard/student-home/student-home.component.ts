import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './student-home.component.html',
  styleUrl: './student-home.component.scss',
})
export class StudentHomeComponent implements OnInit {
  private lms = inject(LmsService);
  private auth = inject(AuthService);

  readonly loading = signal(true);
  readonly record = signal<StudentDetails | null>(null);
  readonly summaries = signal<StudentSessionSummary[]>([]);

  readonly firstName = computed(() => (this.auth.currentUser()?.name ?? '').split(' ')[0] || '');

  readonly group = computed(() => this.record()?.currentGroup ?? null);

  /** The class they are working through now, rather than one they have finished. */
  readonly activeCourse = computed<StudentCourse | null>(() => {
    const courses = this.group()?.courses ?? [];
    return courses.find((c) => !c.isCompleted) ?? courses[courses.length - 1] ?? null;
  });

  readonly nextSession = computed<StudentUpcomingSession | null>(
    () => this.record()?.upcomingSessions?.[0] ?? null
  );

  // ── Progress ─────────────────────────────────────────────────────────────

  /**
   * Sessions behind them, counted from where the course has got to. The
   * progress number is the next session owed, so one fewer has been taught.
   */
  readonly sessionsDone = computed(() => {
    const course = this.activeCourse();
    if (!course) return 0;
    return course.isCompleted ? course.totalSessions : Math.max(0, course.currentSessionNumber - 1);
  });

  readonly progressPercent = computed(() => {
    const course = this.activeCourse();
    if (!course?.totalSessions) return 0;
    return Math.min(100, Math.round((this.sessionsDone() / course.totalSessions) * 100));
  });

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

  ngOnInit(): void {
    this.lms
      .getMyStudentRecord()
      .pipe(catchError(() => of(null)))
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

    const time = when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
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
