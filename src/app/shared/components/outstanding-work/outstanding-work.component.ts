import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { OperationsService } from '../../../core/services/operations.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CancellationCauseName,
  OutstandingSession,
  SessionClaim,
} from '../../../core/interfaces/Operations';

/**
 * The window that will not go away until the work is done.
 *
 * It exists because a reminder that can be ignored was being ignored: 112
 * classes stand with no register, and the month's report for every child in
 * them is written from one. Being in somebody's way is a strong thing to do to
 * a person, so two rules hold it in check.
 *
 * The first is that everything it asks for is something the person it stops
 * can actually do. The server decides that -- a class nobody is left on the
 * roll for never appears here, because no register could ever be written for
 * it and the window could never be closed.
 *
 * The second is that there is always a way out that is not lying. Somebody
 * whose class genuinely did not happen says so, in their own words, and it
 * goes to the person who answers for that day. They are not left choosing
 * between marking a register for a class that never ran and being stuck.
 */
@Component({
  selector: 'app-outstanding-work',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './outstanding-work.component.html',
  styleUrl: './outstanding-work.component.scss',
})
export class OutstandingWorkComponent implements OnInit {
  private operations = inject(OperationsService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  protected readonly work = this.operations.work;

  /** Which class is having its "it did not happen" written, if any. */
  protected claiming = signal<OutstandingSession | null>(null);
  protected claimReason = signal('');

  /** Which claim operations is answering, and how. */
  protected answering = signal<SessionClaim | null>(null);
  protected answerCause = signal<CancellationCauseName>('Instructor');
  protected rejecting = signal(false);
  protected rejectNote = signal('');

  protected busy = signal(false);

  protected readonly causes: CancellationCauseName[] = ['Instructor', 'Parents', 'Holiday'];

  /**
   * Whether to stand in the way at all.
   *
   * Not while they are off dealing with one of these, and not before the first
   * answer has come back -- a window that appears and vanishes on a slow
   * connection is worse than one that appears a moment late.
   */
  protected readonly showing = computed(() => {
    const work = this.work();
    return !!work && work.any && this.operations.workingOn() === null && this.auth.isLoggedIn();
  });

  protected readonly mine = computed(() => this.work()?.myRegisters ?? []);
  protected readonly claims = computed(() => this.work()?.claimsToAnswer ?? []);
  protected readonly onMyDays = computed(() => this.work()?.registersOnMyDays ?? []);

  /** What the window is for, in one line, so it does not read as a punishment. */
  protected readonly heading = computed(() => {
    const mine = this.mine().length;
    const claims = this.claims().length;
    const days = this.onMyDays().length;

    if (mine > 0) {
      return mine === 1
        ? 'One of your classes has no register'
        : `${mine} of your classes have no register`;
    }

    if (claims > 0 && days > 0) {
      return 'There is work waiting on you';
    }

    if (claims > 0) {
      return claims === 1
        ? 'An instructor says a class did not happen'
        : `${claims} instructors say a class did not happen`;
    }

    return days === 1
      ? 'A class on your day has no register'
      : `${days} classes on your days have no register`;
  });

  ngOnInit(): void {
    this.operations.refresh();

    // Asked again whenever they land somewhere new, which is what makes an
    // item disappear once it has been dealt with: the way out of this window
    // is a page, and coming back from it is a navigation.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        // Except the navigation that takes them to the very class they were
        // sent to deal with. Treating that one as "finished" would put this
        // window straight back over the page it just opened.
        const workingOn = this.operations.workingOn();
        const path = event.urlAfterRedirects.split('?')[0];

        if (workingOn !== null && path === `/sessions/${workingOn}`) {
          return;
        }

        this.operations.doneWorking();
      });
  }

  // ── Taking the register ──────────────────────────────────────────────────

  protected markRegister(session: OutstandingSession): void {
    this.operations.startWorkingOn(session.sessionId);
    this.router.navigate(['/sessions', session.sessionId]);
  }

  // ── Saying it did not happen ─────────────────────────────────────────────

  protected startClaim(session: OutstandingSession): void {
    this.claiming.set(session);
    this.claimReason.set('');
  }

  protected cancelClaim(): void {
    this.claiming.set(null);
    this.claimReason.set('');
  }

  protected get claimTooShort(): boolean {
    return this.claimReason().trim().length < 10;
  }

  protected submitClaim(): void {
    const session = this.claiming();
    if (!session || this.claimTooShort || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.operations.raiseClaim(session.sessionId, this.claimReason().trim()).subscribe({
      next: () => {
        this.notify.showSuccess('Operations have it. You will be told what they decide.');
        this.busy.set(false);
        this.cancelClaim();
      },
      error: () => this.busy.set(false),
    });
  }

  // ── Answering one ────────────────────────────────────────────────────────

  protected startAnswer(claim: SessionClaim, reject: boolean): void {
    this.answering.set(claim);
    this.rejecting.set(reject);
    this.answerCause.set('Instructor');
    this.rejectNote.set('');
  }

  protected cancelAnswer(): void {
    this.answering.set(null);
    this.rejecting.set(false);
    this.rejectNote.set('');
  }

  protected get noteTooShort(): boolean {
    return this.rejectNote().trim().length < 3;
  }

  protected submitAnswer(): void {
    const claim = this.answering();
    if (!claim || this.busy()) {
      return;
    }

    this.busy.set(true);

    if (this.rejecting()) {
      if (this.noteTooShort) {
        this.busy.set(false);
        return;
      }

      this.operations.rejectClaim(claim.id, this.rejectNote().trim()).subscribe({
        next: () => {
          this.notify.showSuccess('Sent back. The register is theirs again.');
          this.busy.set(false);
          this.cancelAnswer();
        },
        error: () => this.busy.set(false),
      });
      return;
    }

    this.operations.acceptClaim(claim.id, this.answerCause()).subscribe({
      next: () => {
        this.notify.showSuccess('The class is cancelled, with the reason on it.');
        this.busy.set(false);
        this.cancelAnswer();
      },
      error: () => this.busy.set(false),
    });
  }

  /** Where to send somebody who wants to see the class itself. */
  protected openSession(sessionId: number): void {
    this.operations.startWorkingOn(sessionId);
    this.router.navigate(['/sessions', sessionId]);
  }
}
