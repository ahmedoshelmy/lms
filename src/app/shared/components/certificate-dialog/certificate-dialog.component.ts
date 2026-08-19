import {
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../../core/services/auth.service';
import { CertificateService } from '../../../core/services/certificate.service';
import { CertificatePdfService } from '../../../core/services/certificate-pdf.service';
import {
  CERTIFICATE_ATTENDANCE_THRESHOLD,
  Certificate,
  CertificateCandidate,
  CertificateCourseOption,
  CertificateStudentRef,
} from '../../../core/interfaces/Certificate';
import { User } from '../../../core/interfaces/User';

/**
 * Fixed name on the supervisor signature line, matching the original template.
 * The academy branding itself lives in the background artwork, not in markup.
 */
export const CERTIFICATE_SUPERVISOR_NAME = 'Mahmoud Khalaf';

/** Fields the user can change on a single certificate before saving. */
interface CertificateOverride {
  studentName?: string;
  instructorName?: string;
}

/** Sentinel for the "every student" option in the manual student picker. */
const ALL_STUDENTS = 0;

/**
 * Turns a `YYYY-MM-DD` value from a date input into an ISO timestamp anchored at
 * local noon. Parsing the string directly would read it as UTC midnight and shift
 * the printed day backwards for anyone east of Greenwich.
 */
function localDateInputToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

@Component({
  selector: 'app-certificate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ProgressSpinnerModule],
  templateUrl: './certificate-dialog.component.html',
  styleUrl: './certificate-dialog.component.scss',
})
export class CertificateDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly certificateService = inject(CertificateService);
  private readonly pdfService = inject(CertificatePdfService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly visible = model<boolean>(false);
  /** Candidates derived from actual enrolments. */
  readonly candidates = input<CertificateCandidate[]>([]);
  /** Who a manually added course can be issued to. */
  readonly students = input<CertificateStudentRef[]>([]);
  readonly loading = input<boolean>(false);
  /** Shown in the dialog subtitle, e.g. a student or group name. */
  readonly contextLabel = input<string>('');

  readonly supervisorName = CERTIFICATE_SUPERVISOR_NAME;
  readonly threshold = CERTIFICATE_ATTENDANCE_THRESHOLD;
  readonly allStudents = ALL_STUDENTS;

  /**
   * Lifts every validation — enrolment, completion and attendance — so
   * certificates can be issued for cohorts whose records predate the system.
   */
  readonly bypassValidation = signal<boolean>(false);
  /** Optional `YYYY-MM-DD` completion date printed instead of the recorded one. */
  readonly completionDateOverride = signal<string>('');
  /** Optional duration in weeks for records the schedule cannot supply. */
  readonly durationOverride = signal<string>('');
  readonly instructors = signal<User[]>([]);
  readonly instructorsLoading = signal<boolean>(false);
  /**
   * Plain field, not a signal: this guard is read inside the reset effect, and
   * a signal read there would re-run the whole reset when the list arrives.
   */
  private instructorsRequested = false;
  readonly saving = signal<boolean>(false);
  /** "3 of 12" while a multi-file run is in flight. */
  readonly savingProgress = signal<string>('');
  private readonly selectedKeys = signal<ReadonlySet<string>>(new Set<string>());
  /**
   * Per-certificate edits, keyed by candidate key. Held here rather than on the
   * candidates themselves so the inputs coming from the hosts stay immutable,
   * and so a mixed batch can carry a different instructor on every page.
   */
  private readonly overrides = signal<Record<string, CertificateOverride>>({});

  // ── Manual course entry ─────────────────────────────────────────────────
  readonly showManualPanel = signal<boolean>(false);
  readonly catalog = signal<CertificateCourseOption[]>([]);
  readonly catalogLoading = signal<boolean>(false);
  readonly manualStudentId = signal<number>(ALL_STUDENTS);
  readonly manualCourseId = signal<number | null>(null);
  readonly manualHint = signal<string>('');
  private readonly manualCandidates = signal<CertificateCandidate[]>([]);

  /** Enrolment-derived candidates plus anything added by hand. */
  readonly allCandidates = computed(() => [...this.candidates(), ...this.manualCandidates()]);

  /** Passing candidates first, so the common case sits at the top of the list. */
  readonly sortedCandidates = computed(() =>
    [...this.allCandidates()].sort((a, b) => {
      if (a.eligibility.eligible !== b.eligibility.eligible) {
        return a.eligibility.eligible ? -1 : 1;
      }
      return a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
    })
  );

  readonly eligibleCandidates = computed(() =>
    this.allCandidates().filter((candidate) => candidate.eligibility.eligible)
  );
  /** Enrolment-derived candidates that a bypass would be needed to issue. */
  readonly blockedCandidates = computed(() =>
    this.allCandidates().filter((candidate) => !candidate.manual && !candidate.eligibility.eligible)
  );

  /** Candidates the user is currently permitted to tick. */
  readonly selectableCandidates = computed(() =>
    this.allCandidates().filter((candidate) => this.isSelectable(candidate))
  );

  readonly selectedCandidates = computed(() => {
    const keys = this.selectedKeys();
    return this.sortedCandidates().filter(
      (candidate) => keys.has(candidate.key) && this.isSelectable(candidate)
    );
  });

  readonly selectedCount = computed(() => this.selectedCandidates().length);

  readonly allSelected = computed(() => {
    const selectable = this.selectableCandidates();
    return selectable.length > 0 && this.selectedCount() === selectable.length;
  });

  /** Which students a manual addition would apply to. */
  readonly manualTargets = computed(() => {
    const roster = this.students();
    const chosen = this.manualStudentId();
    if (roster.length <= 1 || chosen === ALL_STUDENTS) return roster;
    return roster.filter((student) => student.id === chosen);
  });

  /** The selected candidates stamped with issuance metadata, ready to render. */
  readonly certificates = computed<Certificate[]>(() => {
    const issuedBy = this.auth.currentUser()?.name || 'Administrator';
    const issuedAt = this.issuedAt();
    const overrideDate = localDateInputToIso(this.completionDateOverride());
    const overrideWeeks = Number.parseInt(this.durationOverride(), 10);
    const weeks = Number.isFinite(overrideWeeks) && overrideWeeks > 0 ? overrideWeeks : null;

    const overrides = this.overrides();

    return this.selectedCandidates().map((candidate) => {
      const override = overrides[candidate.key] ?? {};
      return {
        ...candidate,
        studentName: (override.studentName ?? '').trim() || candidate.studentName,
        instructorName: override.instructorName ?? candidate.instructorName,
        issuedAt,
        issuedBy,
        printedDate: overrideDate || candidate.completedAt || issuedAt,
        printedDurationWeeks: weeks ?? candidate.durationWeeks,
        supervisorName: CERTIFICATE_SUPERVISOR_NAME,
        bypassedChecks: candidate.eligibility.failedChecks,
      };
    });
  });

  readonly bypassedCount = computed(
    () => this.certificates().filter((certificate) => certificate.bypassedChecks.length > 0).length
  );

  /**
   * Issue date, resolved once per dialog opening rather than on every read so
   * the printed date cannot change midway through a print job.
   */
  private readonly issuedAt = signal<string>('');

  constructor() {
    // Reset whenever the dialog opens or the candidate list changes, so one
    // student's ticks, bypass and manual additions never carry over.
    effect(() => {
      this.candidates();
      const isOpen = this.visible();
      this.selectedKeys.set(new Set<string>());
      this.bypassValidation.set(false);
      this.completionDateOverride.set('');
      this.durationOverride.set('');
      this.overrides.set({});
      this.manualCandidates.set([]);
      this.showManualPanel.set(false);
      this.manualCourseId.set(null);
      this.manualStudentId.set(ALL_STUDENTS);
      this.manualHint.set('');
      if (isOpen) {
        this.issuedAt.set(new Date().toISOString());
        this.ensureInstructors();
      }
    });
  }

  /** Name that will be printed, which may be an edited one. */
  printedStudentName(candidate: CertificateCandidate): string {
    return this.overrides()[candidate.key]?.studentName ?? candidate.studentName;
  }

  /** Instructor that will be printed; empty means the signature line stays blank. */
  printedInstructor(candidate: CertificateCandidate): string {
    return this.overrides()[candidate.key]?.instructorName ?? candidate.instructorName;
  }

  setStudentName(candidate: CertificateCandidate, value: string): void {
    this.patchOverride(candidate.key, { studentName: value });
  }

  setInstructor(candidate: CertificateCandidate, value: string): void {
    this.patchOverride(candidate.key, { instructorName: value });
  }

  private patchOverride(key: string, patch: CertificateOverride): void {
    this.overrides.update((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
  }

  isSelected(candidate: CertificateCandidate): boolean {
    return this.selectedKeys().has(candidate.key);
  }

  /**
   * Manual entries are always selectable: adding one by hand is itself the
   * deliberate override, so requiring the bypass as well would be a dead end.
   * The bypass governs only enrolment-derived candidates that failed a check.
   */
  isSelectable(candidate: CertificateCandidate): boolean {
    return candidate.manual || candidate.eligibility.eligible || this.bypassValidation();
  }

  toggleCandidate(candidate: CertificateCandidate): void {
    if (!this.isSelectable(candidate)) return;
    const next = new Set(this.selectedKeys());
    if (next.has(candidate.key)) {
      next.delete(candidate.key);
    } else {
      next.add(candidate.key);
    }
    this.selectedKeys.set(next);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedKeys.set(new Set<string>());
      return;
    }
    this.selectedKeys.set(new Set(this.selectableCandidates().map((c) => c.key)));
  }

  onBypassChange(bypass: boolean): void {
    this.bypassValidation.set(bypass);
    if (bypass) return;
    // Withdrawing the bypass must also withdraw any ticks it enabled.
    const stillEligible = new Set(this.eligibleCandidates().map((c) => c.key));
    this.selectedKeys.set(
      new Set([...this.selectedKeys()].filter((key) => stillEligible.has(key)))
    );
    this.completionDateOverride.set('');
  }

  /** Loads the instructor roster once per component instance. */
  private ensureInstructors(): void {
    if (this.instructorsRequested) return;
    this.instructorsRequested = true;
    this.instructorsLoading.set(true);

    this.certificateService.getInstructorOptions().subscribe({
      next: (instructors) => {
        this.instructors.set(instructors);
        this.instructorsLoading.set(false);
      },
      error: () => {
        this.instructorsLoading.set(false);
      },
    });
  }

  /** Reveals the manual picker, loading the course catalog on first use. */
  openManualPanel(): void {
    this.showManualPanel.set(true);
    if (this.catalog().length > 0 || this.catalogLoading()) return;

    this.catalogLoading.set(true);
    this.certificateService.getCourseCatalog().subscribe({
      next: (courses) => {
        this.catalog.set(courses);
        this.catalogLoading.set(false);
      },
      error: () => {
        // errorInterceptor already surfaces the failure to the user.
        this.catalogLoading.set(false);
      },
    });
  }

  /**
   * Adds the chosen catalog course for the chosen student(s). Issuing still
   * needs the bypass, since a manual entry fails the enrolment check by design.
   */
  addManualCourse(): void {
    const courseId = this.manualCourseId();
    const course = this.catalog().find((option) => option.id === courseId);
    const targets = this.manualTargets();

    if (!course) {
      this.manualHint.set('Pick a course level first.');
      return;
    }

    if (targets.length === 0) {
      this.manualHint.set('No student is available to issue this to.');
      return;
    }

    const existingKeys = new Set(this.allCandidates().map((candidate) => candidate.key));
    const additions = targets
      .map((student) => this.certificateService.buildManualCandidate(student, course))
      .filter((candidate) => !existingKeys.has(candidate.key));

    if (additions.length === 0) {
      this.manualHint.set(`${course.title} is already listed for the selected student(s).`);
      return;
    }

    this.manualCandidates.update((list) => [...list, ...additions]);
    this.selectedKeys.update((keys) => {
      const next = new Set(keys);
      additions.forEach((candidate) => next.add(candidate.key));
      return next;
    });
    this.manualCourseId.set(null);
    this.manualHint.set(`Added ${course.title} for ${additions.length} student(s).`);
  }

  removeManualCourse(candidate: CertificateCandidate): void {
    this.manualCandidates.update((list) => list.filter((item) => item.key !== candidate.key));
    const next = new Set(this.selectedKeys());
    next.delete(candidate.key);
    this.selectedKeys.set(next);
    this.manualHint.set('');
  }

  close(): void {
    this.visible.set(false);
  }

  /**
   * Generates and downloads one PDF per selected certificate. Nothing goes
   * through the browser print dialog — each page is drawn straight into its
   * document, so the text stays real text rather than a screenshot.
   */
  async saveAsPdf(): Promise<void> {
    if (this.selectedCount() === 0 || this.saving()) return;

    this.saving.set(true);
    this.savingProgress.set('');
    try {
      await this.pdfService.save(this.certificates(), (done, total) => {
        this.savingProgress.set(total > 1 ? `${done} of ${total}` : '');
      });
    } finally {
      this.saving.set(false);
      this.savingProgress.set('');
    }
  }
}
