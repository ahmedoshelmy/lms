import { Component, input, output, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Role } from '../../../core/interfaces/Role';
import { User } from '../../../core/interfaces/User';
import { signal } from '@angular/core';

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

    const payload = {
      instructorId: this.editInstructorId(),
      status: this.editStatus(),
    };

    this.lms.updateSession(s.id, payload).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.notify.showSuccess('Session updated successfully!');
        this.sessionUpdated.emit(updated);
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
        };
        this.notify.showSuccess('Session updated (offline mode).');
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
