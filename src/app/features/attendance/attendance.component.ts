import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

const STUB_STYLES = `
  :host { display: block; width: 100%; }
  .feature-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 420px; border-radius: 24px; border: 2px dashed var(--color-border);
    background: var(--color-surface); padding: 60px 24px;
  }
  .empty-icon-ring {
    width: 96px; height: 96px; border-radius: 50%;
    background: var(--color-warning-background);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 12px var(--color-warning-background), 0 0 0 24px color-mix(in srgb, var(--color-warning-background) 50%, transparent);
  }
  .coming-soon-badge {
    display: inline-flex; align-items: center; padding: 8px 20px;
    border-radius: 99px; background: var(--color-surface-secondary);
    color: var(--color-text-muted); font-size: 13px; font-weight: 600;
    border: 1px solid var(--color-border);
  }
`;

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <div class="mb-8">
        <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Attendance</h1>
        <p class="text-sm text-[var(--color-text-muted)] mt-1">Mark and review session attendance records</p>
      </div>
      <div class="feature-empty-state">
        <div class="empty-icon-ring">
          <i class="pi pi-calendar-check text-4xl text-[var(--color-warning)]"></i>
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mt-5">No attendance records</h2>
        <p class="text-sm text-[var(--color-text-muted)] mt-2 max-w-xs text-center">
          Attendance tracking will be available once sessions are linked to attendance sheets.
        </p>
        <div class="coming-soon-badge mt-6"><i class="pi pi-clock mr-2"></i> Coming soon</div>
      </div>
    </div>
  `,
  styles: STUB_STYLES,
})
export class AttendanceComponent {}
