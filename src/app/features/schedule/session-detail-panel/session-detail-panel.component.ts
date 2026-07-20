import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ScheduleSession } from '../../../core/services/lms.service';

@Component({
  selector: 'app-session-detail-panel',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [visible]="!!session()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [dismissableMask]="true"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="session-detail-dialog"
      [style]="{ width: '500px', maxWidth: '95vw' }"
    >
      <ng-template pTemplate="header">
        <div class="flex items-center gap-3">
          <div class="detail-icon-badge">
            <i class="pi pi-calendar-clock"></i>
          </div>
          <div>
            <h2 class="text-base font-bold text-[var(--color-text-primary)] leading-tight">
              Session Details
            </h2>
            <p class="text-xs text-[var(--color-text-muted)]">
              {{ session()?.courseTitle }}
            </p>
          </div>
        </div>
      </ng-template>

      @if (session(); as s) {
        <div class="flex flex-col gap-5 py-2">
          <!-- Status + Session Number row -->
          <div class="flex items-center gap-3 flex-wrap">
            <span
              class="inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              [ngClass]="statusBadgeClass()"
            >
              {{ s.status }}
            </span>
            <span
              class="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]"
            >
              Session {{ s.currentSessionNumber }} of {{ s.totalSessions }}
            </span>
          </div>

          <!-- Topic -->
          <div class="detail-section">
            <p class="detail-label">Topic</p>
            <p class="detail-value text-lg font-extrabold">{{ s.topic }}</p>
          </div>

          <!-- Course & Group -->
          <div class="grid grid-cols-2 gap-4">
            <div class="detail-section">
              <p class="detail-label">Course</p>
              <p class="detail-value">{{ s.courseTitle }}</p>
            </div>
            <div class="detail-section">
              <p class="detail-label">Group / Cohort</p>
              <p class="detail-value">{{ s.groupName }}</p>
            </div>
          </div>

          <!-- Time -->
          <div class="detail-section">
            <p class="detail-label">Time</p>
            <div class="flex items-center gap-2 mt-1">
              <i class="pi pi-clock text-[var(--color-secondary)]"></i>
              <p class="detail-value">
                {{ formatTime(s.startsAt) }} – {{ formatTime(s.endsAt) }}
                <span class="text-[var(--color-text-muted)] text-xs font-normal ml-1">
                  ({{ s.durationMinutes }} min)
                </span>
              </p>
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ formatDate(s.startsAt) }}</p>
          </div>

          <!-- Instructor -->
          <div class="detail-section">
            <p class="detail-label">Instructor</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="avatar-sm">{{ instructorInitials() }}</span>
              <p class="detail-value text-[var(--color-secondary)] font-semibold">
                {{ s.instructorName }}
              </p>
            </div>
          </div>

          <!-- Location -->
          @if (s.location) {
            <div class="detail-section">
              <p class="detail-label">Location</p>
              <div class="flex items-center gap-2 mt-1">
                <i class="pi pi-map-marker text-[var(--color-secondary)]"></i>
                <p class="detail-value">{{ s.location }}</p>
              </div>
            </div>
          }
        </div>
      }

      <ng-template pTemplate="footer">
        <button
          pButton
          type="button"
          label="Close"
          icon="pi pi-times"
          class="p-button-outlined p-button-secondary cursor-pointer"
          (click)="closed.emit()"
        ></button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    :host ::ng-deep {
      .session-detail-dialog .p-dialog-header {
        padding: 20px 24px 12px;
        border-bottom: 1px solid var(--color-border);
      }
      .session-detail-dialog .p-dialog-content {
        padding: 16px 24px;
        background: var(--color-surface);
      }
      .session-detail-dialog .p-dialog-footer {
        padding: 12px 24px 20px;
        border-top: 1px solid var(--color-border);
      }
    }

    .detail-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary-content);
      font-size: 18px;
      flex-shrink: 0;
    }

    .detail-section {
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-border);
    }
    .detail-section:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .detail-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--color-text-muted);
      margin: 0 0 4px;
    }

    .detail-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0;
    }

    .avatar-sm {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-avatar-from) 0%, var(--color-avatar-to) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .status-scheduled-badge {
      background-color: rgba(26, 43, 76, 0.08);
      color: var(--color-primary);
    }
    .status-ongoing-badge {
      background-color: rgba(245, 158, 11, 0.08);
      color: var(--color-warning);
    }
    .status-completed-badge {
      background-color: rgba(16, 185, 129, 0.08);
      color: var(--color-success);
    }
    .status-cancelled-badge {
      background-color: rgba(239, 68, 68, 0.08);
      color: var(--color-error);
    }
  `,
})
export class SessionDetailPanelComponent {
  session = input<ScheduleSession | null>(null);
  closed = output<void>();

  statusBadgeClass = computed(() => {
    const normStatus = (this.session()?.status ?? '').toLowerCase();
    if (normStatus.includes('ongoing')) return 'status-ongoing-badge';
    if (normStatus.includes('completed')) return 'status-completed-badge';
    if (normStatus.includes('cancel')) return 'status-cancelled-badge';
    return 'status-scheduled-badge';
  });

  instructorInitials = computed(() => {
    const name = this.session()?.instructorName ?? 'U';
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  onVisibleChange(visible: boolean): void {
    if (!visible) this.closed.emit();
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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
