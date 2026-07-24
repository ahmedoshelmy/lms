import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ScheduleSession } from '../../../core/interfaces/ScheduleSession';

@Component({
  selector: 'app-session-detail-panel',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: `./session-detail-panel.component.html`,
  styleUrl: './session-detail-panel.component.scss',
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
