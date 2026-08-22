import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { LmsService } from '../../core/services/lms.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { CertificatePdfService } from '../../core/services/certificate-pdf.service';
import { Certificate } from '../../core/interfaces/Certificate';
import {
  buildCertificateSerial,
  computeDurationWeeks,
  evaluateCertificateEligibility,
} from '../../core/utils/certificate.utils';
import {
  StudentAttendanceRecord,
  StudentCourse,
  StudentDetails,
} from '../../core/interfaces/StudentDetails';
import { StudentSessionSummary } from '../../core/interfaces/SessionSyllabus';

type Tab = 'progress' | 'attendance' | 'classes';

/** A course as this page shows it: the record, plus what it earns. */
interface CourseRow {
  course: StudentCourse;
  groupName: string;
  instructorName: string;
  done: number;
  percent: number;
  attendanceRate: number;
  /** Whether the certificate can be taken now, and why not when it cannot. */
  earned: boolean;
  blockedBy: string[];
}

/**
 * Everything a student has done, in one place: how far through the course they
 * are, whether they have been turning up, and what each class covered.
 *
 * All of it is read-only and scoped by the token, never by an id in the URL.
 * The certificate is built here in the browser from the same rules staff use,
 * so a student can take a copy of one they have earned without an admin having
 * to print it for them.
 */
@Component({
  selector: 'app-my-learning',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-learning.component.html',
  styleUrl: './my-learning.component.scss',
})
export class MyLearningComponent implements OnInit {
  private lms = inject(LmsService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private pdf = inject(CertificatePdfService);

  readonly tab = signal<Tab>('progress');
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly record = signal<StudentDetails | null>(null);
  readonly summaries = signal<StudentSessionSummary[]>([]);

  readonly group = computed(() => this.record()?.currentGroup ?? null);

  // ── Progress ─────────────────────────────────────────────────────────────

  /**
   * Every course the group has been assigned, finished or not, judged by the
   * same rules staff see. A course that is complete but poorly attended shows
   * why the certificate is not available rather than quietly omitting it.
   */
  readonly courses = computed<CourseRow[]>(() => {
    const group = this.group();
    if (!group) return [];

    const attendance = this.record()?.attendanceHistory ?? [];

    return group.courses.map((course) => {
      const eligibility = evaluateCertificateEligibility(
        attendance,
        course.title,
        group.groupName,
        course.totalSessions,
        course.isCompleted
      );

      const done = course.isCompleted
        ? course.totalSessions
        : Math.max(0, course.currentSessionNumber - 1);

      return {
        course,
        groupName: group.groupName,
        instructorName: group.instructorName ?? 'your instructor',
        done,
        percent: course.totalSessions
          ? Math.min(100, Math.round((done / course.totalSessions) * 100))
          : 0,
        attendanceRate: eligibility.attendanceRate,
        earned: eligibility.eligible,
        blockedBy: eligibility.reasons,
      };
    });
  });

  // ── Attendance ───────────────────────────────────────────────────────────

  /** Cancelled classes are nobody's absence, so they are shown but not counted. */
  readonly attendance = computed(() =>
    [...(this.record()?.attendanceHistory ?? [])].sort(
      (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    )
  );

  private readonly counted = computed(() =>
    this.attendance().filter((a) => !a.sessionStatus.toLowerCase().includes('cancel'))
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

  readonly lateCount = computed(
    () => this.counted().filter((a) => a.attendanceStatus === 'Late').length
  );

  // ── Classes ──────────────────────────────────────────────────────────────

  readonly writtenUp = computed(() =>
    this.summaries()
      .filter((s) => s.hasSummary && (s.parentSummary || s.content))
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
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

  /**
   * Builds the certificate and downloads it.
   *
   * Nothing is bypassed here: a student may only take one they have actually
   * earned. Where a cohort predates the system and legitimately fails a check,
   * that stays an operations decision made from the student's record.
   */
  downloadCertificate(row: CourseRow): void {
    const record = this.record();
    const group = this.group();
    if (!record || !group || !row.earned) return;

    const level = Number(row.course.level) || row.course.level;

    // Eight sessions once a week is eight weeks; twice a week is four. The
    // group's weekly slots are the only thing that says which.
    const weeks = computeDurationWeeks(row.course.totalSessions, group.sessionsPerWeek);

    const certificate: Certificate = {
      key: `${group.groupId}-${row.course.groupCourseId}`,
      serial: buildCertificateSerial({
        studentId: record.id,
        groupId: group.groupId,
        courseTitle: row.course.title,
        topic: row.course.topic,
        level,
      }),
      studentId: record.id,
      studentName: record.name,
      studentEmail: record.email,
      manual: false,
      groupId: group.groupId,
      groupName: group.groupName,
      courseTitle: row.course.title,
      topic: row.course.topic,
      level,
      instructorName: row.instructorName,
      completedAt: row.course.completedAt,
      durationWeeks: weeks,
      eligibility: {
        eligible: true,
        failedChecks: [],
        reasons: [],
        courseCompleted: true,
        attendanceRate: row.attendanceRate,
        attendedSessions: 0,
        recordedSessions: 0,
        courseTotalSessions: row.course.totalSessions,
      },
      issuedAt: new Date().toISOString(),
      issuedBy: record.name,
      printedDate: row.course.completedAt ?? new Date().toISOString(),
      printedDurationWeeks: weeks,
      supervisorName: 'Course Supervisor',
      bypassedChecks: [],
    };

    this.saving.set(true);
    this.pdf
      .save([certificate])
      .then(() => this.notify.showSuccess('Your certificate has been downloaded.'))
      .catch(() => this.notify.showError('The certificate could not be built.'))
      .finally(() => this.saving.set(false));
  }

  statusClass(record: StudentAttendanceRecord): string {
    if (record.sessionStatus.toLowerCase().includes('cancel')) return 'tag--off';
    return (
      {
        Present: 'tag--good',
        Late: 'tag--warn',
        Absent: 'tag--bad',
        Excused: 'tag--off',
      }[record.attendanceStatus] ?? 'tag--off'
    );
  }

  statusLabel(record: StudentAttendanceRecord): string {
    if (record.sessionStatus.toLowerCase().includes('cancel')) return 'Cancelled';
    return record.attendanceStatus;
  }

  dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
