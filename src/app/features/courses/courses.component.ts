import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

const FEATURE_STUB_STYLES = `
  :host { display: block; width: 100%; }

  .feature-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 420px;
    border-radius: 24px;
    border: 2px dashed var(--color-border);
    background: var(--color-surface);
    padding: 60px 24px;
  }

  .empty-icon-ring {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--color-info-background);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 12px var(--color-info-background), 0 0 0 24px color-mix(in srgb, var(--color-info-background) 50%, transparent);
  }

  .coming-soon-badge {
    display: inline-flex;
    align-items: center;
    padding: 8px 20px;
    border-radius: 99px;
    background: var(--color-surface-secondary);
    color: var(--color-text-muted);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--color-border);
  }
`;

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Courses</h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">Browse and manage your course catalog</p>
        </div>
        <!-- Search bar placeholder -->
        <div class="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 w-full md:w-72 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
          <i class="pi pi-search text-[var(--color-text-muted)] text-sm"></i>
          <input
            type="search"
            placeholder="Search courses…"
            class="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            aria-label="Search courses"
          />
        </div>
      </div>

      <!-- Empty state -->
      <div class="feature-empty-state">
        <div class="empty-icon-ring">
          <i class="pi pi-book text-4xl text-[var(--color-secondary)]"></i>
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mt-5">No courses yet</h2>
        <p class="text-sm text-[var(--color-text-muted)] mt-2 max-w-xs text-center">
          Courses will appear here once they are created and assigned to you by an administrator.
        </p>
        <div class="coming-soon-badge mt-6">
          <i class="pi pi-clock mr-2"></i> Coming soon
        </div>
      </div>
    </div>
  `,
  styles: FEATURE_STUB_STYLES,
})
export class CoursesComponent {}
