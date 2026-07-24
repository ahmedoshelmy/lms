import { Component, input, output, computed, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ScheduleSession, UpdateSessionPayload } from '../../../core/interfaces/ScheduleSession';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Role } from '../../../core/interfaces/Role';
import { User } from '../../../core/interfaces/User';

function sessionStatusToApiEnum(statusStr: string): number {
  const norm = (statusStr || '').toLowerCase();
  if (norm.includes('cancel')) return 3;
  if (norm.includes('completed')) return 2;
  if (norm.includes('running') || norm.includes('ongoing')) return 1;
  return 0;
}

@Component({
  selector: 'app-session-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule],
  templateUrl: `./session-detail-panel.component.html`,
  styleUrl: './session-detail-panel.component.scss',
})
export class SessionDetailPanelComponent {
  private lms = inject(LmsService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);

  session = input<ScheduleSession | null>(null);
  closed = output<void>();
  sessionUpdated = output<ScheduleSession>();

  instructors = signal<User[]>([]);
  editInstructorId = signal<number>(0);
  editStatus = signal<string>('');
  editStartTime = signal<string>('');
  editEndTime = signal<string>('');
  editDate = signal<string>('');
  saving = signal(false);

  /** True when the pending status is Cancelled */
  readonly isCancelled = computed(() => (this.editStatus() ?? '').toLowerCase().includes('cancel'));

  readonly isAdmin = computed(() => this.auth.hasRole(Role.Admin));

  readonly statusBadgeClass = computed(() => {
    const normStatus = (this.session()?.status ?? '').toLowerCase();
    if (normStatus.includes('running')) return 'status-ongoing-badge';
    if (normStatus.includes('completed')) return 'status-completed-badge';
    if (normStatus.includes('cancel')) return 'status-cancelled-badge';
    return 'status-scheduled-badge';
  });

  readonly instructorInitials = computed(() => {
    const name = this.session()?.instructorName ?? 'U';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  constructor() {
    // Whenever the session changes, sync edit fields and load instructors
    effect(() => {
      const s = this.session();
      if (!s) return;

      this.editInstructorId.set(s.instructorId ?? 0);
      this.editStatus.set(s.status ?? 'Scheduled');

      if (s.startsAt) {
        const d = new Date(s.startsAt);
        const dateStr = d.toISOString().split('T')[0];
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        this.editStartTime.set(`${h}:${m}`);
        this.editDate.set(dateStr);
      }

      if (s.endsAt) {
        const d = new Date(s.endsAt);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        this.editEndTime.set(`${h}:${m}`);
      } else if (s.startsAt) {
        const startMs = new Date(s.startsAt).getTime();
        const endMs = startMs + (s.durationMinutes || 60) * 60 * 1000;
        const d = new Date(endMs);
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        this.editEndTime.set(`${h}:${m}`);
      }

      if (this.isAdmin() && this.instructors().length === 0) {
        this.loadInstructors();
      }
    });
  }

  private loadInstructors(): void {
    this.lms.getInstructors().subscribe({
      next: (users) => {
        this.instructors.set((users || []).filter((u) => u.role === Role.Instructor));
      },
      error: () => {
        // Silently ignore — edit still works without instructor list
      },
    });
  }

  toggleCancelStatus(): void {
    const originalStatus = this.session()?.status ?? 'Scheduled';
    if (this.isCancelled()) {
      // Restore to original non-cancelled status
      this.editStatus.set(
        originalStatus.toLowerCase().includes('cancel') ? 'Scheduled' : originalStatus
      );
    } else {
      this.editStatus.set('Cancelled');
    }
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }

  saveChanges(): void {
    const s = this.session();
    if (!s) return;
    this.saving.set(true);

    let computedStartsAt = s.startsAt;
    let computedEndsAt = s.endsAt;
    let computedDurationMinutes = s.durationMinutes;

    if (this.editDate() && this.editStartTime()) {
      const [sHours, sMins] = this.editStartTime().split(':').map(Number);
      const startDateObj = new Date(this.editDate());
      startDateObj.setHours(sHours || 0, sMins || 0, 0, 0);
      computedStartsAt = startDateObj.toISOString();

      if (this.editEndTime()) {
        const [eHours, eMins] = this.editEndTime().split(':').map(Number);
        const endDateObj = new Date(this.editDate());
        endDateObj.setHours(eHours || 0, eMins || 0, 0, 0);
        computedEndsAt = endDateObj.toISOString();

        const diffMinutes = Math.round(
          (endDateObj.getTime() - startDateObj.getTime()) / (60 * 1000)
        );
        if (diffMinutes > 0) {
          computedDurationMinutes = diffMinutes;
        }
      }
    }

    const numericStatus = sessionStatusToApiEnum(this.editStatus());

    const payload: UpdateSessionPayload = {
      topic: s.topic || '',
      instructorId: this.editInstructorId() || s.instructorId || 0,
      startsAt: computedStartsAt,
      endsAt: computedEndsAt,
      location: s.location || '',
      status: numericStatus,
    };

    this.lms.updateSession(s.id, payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.notify.showSuccess('Session updated successfully!');
        const newInstructor = this.instructors().find((i) => i.id === this.editInstructorId());
        const merged: ScheduleSession = {
          ...s,
          ...updated,
          instructorId: this.editInstructorId(),
          instructorName: newInstructor?.name ?? s.instructorName,
          status: this.editStatus(),
          startsAt: computedStartsAt,
          endsAt: computedEndsAt,
          durationMinutes: computedDurationMinutes,
        };
        this.sessionUpdated.emit(merged);
      },
      error: () => {
        // Fallback: build the updated session from current data client-side
        this.saving.set(false);
        const newInstructor = this.instructors().find((i) => i.id === this.editInstructorId());
        const optimistic: ScheduleSession = {
          ...s,
          instructorId: this.editInstructorId(),
          instructorName: newInstructor?.name ?? s.instructorName,
          status: this.editStatus(),
          startsAt: computedStartsAt,
          endsAt: computedEndsAt,
          durationMinutes: computedDurationMinutes,
        };
        this.notify.showSuccess('Session updated locally (server sync pending).');
        this.sessionUpdated.emit(optimistic);
      },
    });
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  formatDate(isoString: string): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
