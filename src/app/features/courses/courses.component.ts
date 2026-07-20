import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LmsService, Course } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressSpinnerModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
            Course Catalog
          </h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">
            Explore and manage the curriculum levels and session counts
          </p>
        </div>

        <!-- Search input -->
        <div class="relative w-full md:w-80">
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search courses..."
            class="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)] transition-all duration-200"
          />
          <i
            class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          ></i>
        </div>
      </div>

      <!-- Loading State -->
      @if (loading()) {
        <div class="flex justify-center items-center py-20">
          <p-progressSpinner styleClass="w-12 h-12" strokeWidth="4" />
        </div>
      } @else {
        <!-- Courses Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (course of filteredCourses(); track course.id) {
            <div
              class="course-card p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-secondary)] hover:shadow-[0_8px_24px_rgba(62,109,181,0.08)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div class="flex items-center justify-between gap-4 mb-4">
                  <span
                    class="inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    [ngClass]="getTopicBadgeClass(course.topic)"
                  >
                    {{ course.topic }}
                  </span>
                  <span class="text-xs text-[var(--color-text-muted)] font-bold">
                    {{ course.sessionCount }} Sessions
                  </span>
                </div>
                <h3 class="text-lg font-bold text-[var(--color-text-primary)] mb-2">
                  {{ course.title }}
                </h3>
                <p class="text-sm text-[var(--color-text-secondary)] line-clamp-3 mb-6">
                  {{ course.description }}
                </p>
              </div>

              <div
                class="flex items-center justify-between border-t border-[var(--color-border)] pt-4 mt-auto gap-2 flex-wrap"
              >
                <span class="text-xs text-[var(--color-text-muted)] font-semibold">
                  Level {{ course.level }}
                </span>
                <div class="flex items-center gap-3">
                  <span
                    class="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]"
                  >
                    <i class="pi pi-users text-[var(--color-secondary)]"></i>
                    {{ course.groupCount }} group{{ course.groupCount !== 1 ? 's' : '' }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]"
                  >
                    <i class="pi pi-user text-[var(--color-secondary)]"></i>
                    {{ course.studentCount }} student{{ course.studentCount !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>
            </div>
          } @empty {
            <div
              class="col-span-full text-center py-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl"
            >
              <i class="pi pi-book text-4xl text-[var(--color-text-muted)] mb-3"></i>
              <p class="text-[var(--color-text-secondary)] font-medium">
                No courses found matching your criteria
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .topic-py-badge {
      background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
      color: var(--color-secondary);
    }
    .topic-ma-badge {
      background: color-mix(in srgb, var(--color-warning) 10%, transparent);
      color: var(--color-warning);
    }
    .topic-wd-badge {
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
      color: var(--color-success);
    }
    .topic-ai-badge {
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      color: var(--color-accent);
    }
    .topic-default-badge {
      background: color-mix(in srgb, var(--color-text-muted) 10%, transparent);
      color: var(--color-text-muted);
    }
    .course-card {
      position: relative;
      overflow: hidden;
    }
  `,
})
export class CoursesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  courses = signal<Course[]>([]);
  loading = signal(true);
  searchQuery = signal('');

  filteredCourses = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.courses();
    return this.courses().filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.topic.toLowerCase().includes(query) ||
        c.level.toLowerCase().includes(query) ||
        c.groupCount.toString().includes(query) ||
        c.studentCount.toString().includes(query) ||
        c.sessionCount.toString().includes(query) ||
        c.description.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.loading.set(true);
    this.lmsService.getCourses().subscribe({
      next: (data) => {
        this.courses.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses: ${err.message || 'Server error'}`);
        this.loading.set(false);
      },
    });
  }

  getTopicBadgeClass(topic: string): string {
    const t = (topic || '').toLowerCase();
    if (t.includes('python') || t === 'py') return 'topic-py-badge';
    if (t.includes('math') || t.includes('statistics') || t.includes('algebra')) return 'topic-ma-badge';
    if (t.includes('web') || t.includes('html') || t.includes('css') || t.includes('frontend')) return 'topic-wd-badge';
    if (t.includes('ai') || t.includes('machine learning') || t.includes('deep learning') || t.includes('neural')) return 'topic-ai-badge';
    return 'topic-default-badge';
  }
}
