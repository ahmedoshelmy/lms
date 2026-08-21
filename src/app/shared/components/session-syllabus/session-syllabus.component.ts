import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { SessionSyllabus } from '../../../core/interfaces/SessionSyllabus';

/**
 * Shows what a session covers, in five parts: STEM, Content, Projects, Task and
 * All links — plus a separate view of what parents are told.
 *
 * Works two ways so both surfaces share one template:
 *  - pass `sessionId` and it fetches the syllabus for that scheduled session;
 *  - pass `syllabus` directly when the caller already has it, as the course
 *    level list does.
 *
 * A scheduled session that belongs to no curriculum (standalone trial or
 * makeup) has no syllabus. That is not an error, so a failed fetch hides the
 * panel rather than reporting anything.
 */
@Component({
  selector: 'app-session-syllabus',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-syllabus.component.html',
  styleUrl: './session-syllabus.component.scss',
})
export class SessionSyllabusComponent {
  private readonly lms = inject(LmsService);
  private readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthService);

  /** Scheduled session to fetch the syllabus for. Omit when passing `syllabus`. */
  readonly sessionId = input<number | null>(null);

  /** Already-loaded syllabus. Takes precedence over `sessionId`. */
  readonly syllabus = input<SessionSyllabus | null>(null);

  /** Hides the header and tab strip when the parent component supplies its own. */
  readonly compact = input<boolean>(false);

  private readonly fetched = signal<SessionSyllabus | null>(null);
  readonly loading = signal<boolean>(false);

  /** Whichever source is in play. */
  readonly data = computed(() => this.syllabus() ?? this.fetched());

  readonly isStaff = computed(
    () => this.auth.hasRole(Role.Admin) || this.auth.hasRole(Role.Instructor)
  );

  readonly hasParentCopy = computed(() => !!this.data()?.parentSummary);

  readonly copied = signal<boolean>(false);

  /** Staff switch between the internal view and what a parent is told. */
  readonly tab = signal<'content' | 'parents'>('content');

  /**
   * Material, STEAM videos and the quiz gathered into one list, so links live
   * in a single place rather than scattered through the sections.
   */
  readonly allLinks = computed(() => {
    const s = this.data();
    if (!s) return [];
    const links: { url: string; label: string; icon: string }[] = [];
    if (s.materialUrl) {
      links.push({ url: s.materialUrl, label: 'Session material', icon: 'pi-file-pdf' });
    }
    (s.steamVideoUrls ?? []).forEach((url, i) =>
      links.push({
        url,
        label: s.steamVideoUrls.length > 1 ? `Video ${i + 1}` : 'STEM video',
        icon: 'pi-youtube',
      })
    );
    if (s.kahootUrl) {
      links.push({ url: s.kahootUrl, label: 'Kahoot quiz', icon: 'pi-question-circle' });
    }
    return links;
  });

  constructor() {
    effect(() => {
      // Nothing to fetch when the caller already has the syllabus.
      if (this.syllabus()) return;
      const id = this.sessionId();
      if (!id) return;
      this.load(id);
    });
  }

  private load(sessionId: number): void {
    this.loading.set(true);
    this.fetched.set(null);
    this.tab.set('content');

    this.lms.getSessionSyllabus(sessionId).subscribe({
      next: (syllabus) => {
        this.fetched.set(syllabus);
        this.loading.set(false);
      },
      error: () => {
        // Normal for standalone sessions and for levels with no material yet.
        this.loading.set(false);
      },
    });
  }

  /**
   * Puts the parent summary on the clipboard so staff can paste it wherever
   * they message families. There is no parent login yet, so copy-and-send is
   * the delivery mechanism.
   */
  async copyParentSummary(): Promise<void> {
    const s = this.data();
    if (!s?.parentSummary) return;

    const parts = [s.title, '', s.parentSummary];
    if (s.activities.length) {
      parts.push('', 'What they made:', ...s.activities.map((a) => `- ${a}`));
    }
    if (s.task) {
      parts.push('', `Task: ${s.task}`);
    }
    if (s.parentHomeActivity) {
      parts.push('', `At home: ${s.parentHomeActivity}`);
    }

    try {
      await navigator.clipboard.writeText(parts.join('\n'));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.notify.showError('Could not copy to the clipboard.');
    }
  }
}
