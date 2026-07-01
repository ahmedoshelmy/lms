import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, Course, Resource } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

const RESOURCE_TYPES = [
  { label: 'Link / Website', value: 'link', icon: 'pi pi-link', color: 'bg-violet-100 text-violet-700' },
  { label: 'Video', value: 'video', icon: 'pi pi-video', color: 'bg-rose-100 text-rose-600' },
  { label: 'Document / PDF', value: 'document', icon: 'pi pi-file-pdf', color: 'bg-cyan-100 text-cyan-700' },
  { label: 'Other', value: 'other', icon: 'pi pi-paperclip', color: 'bg-slate-100 text-slate-600' },
];

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TagModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Resources</h1>
          <p class="text-sm text-[#64748b] mt-1">Course-grouped learning materials, links, and documents</p>
        </div>
        <div class="flex gap-2">
          <button
            pButton
            type="button"
            icon="pi pi-plus"
            label="Add Resource"
            class="p-button-primary cursor-pointer"
            (click)="openAddDialog()">
          </button>
        </div>
      </div>

      <!-- Local-only notice -->
      <div class="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <i class="pi pi-info-circle text-amber-500 text-base mt-0.5 shrink-0"></i>
        <span>Resources are stored <strong>locally in your browser</strong> until a dedicated API endpoint is available.</span>
      </div>

      <!-- Search + Type filter -->
      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <span class="p-input-icon-left relative flex-1 max-w-sm">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
          <input
            pInputText
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search resources..."
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1]" />
        </span>
        <p-select
          [options]="typeFilterOptions"
          [(ngModel)]="typeFilter"
          optionLabel="label"
          optionValue="value"
          styleClass="rounded-xl min-w-[160px]">
        </p-select>
      </div>

      <!-- Loading Skeleton -->
      @if (loading) {
        <div class="flex flex-col gap-6">
          @for (i of [1,2]; track i) {
            <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
              <p-skeleton width="180px" height="18px" styleClass="mb-4" />
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (j of [1,2,3]; track j) {
                  <p-skeleton width="100%" height="80px" borderRadius="12px" />
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Resources grouped by course -->
      @if (!loading) {
        @if (groupedResources.length === 0) {
          <div class="bg-white border border-[#e2e8f0] rounded-2xl p-16 text-center text-sm text-[#94a3b8]">
            <i class="pi pi-folder-open text-4xl text-[#cbd5e1] mb-3 block"></i>
            No resources added yet. Click "Add Resource" to get started.
          </div>
        } @else {
          <div class="flex flex-col gap-8">
            @for (group of groupedResources; track group.courseId) {
              <div class="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <!-- Course header -->
                <div class="flex items-center justify-between p-5 border-b border-[#f1f5f9] bg-gradient-to-r from-violet-500/5 to-cyan-500/5">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                      <i class="pi pi-book text-sm"></i>
                    </div>
                    <div>
                      <p class="font-bold text-[#1e293b]">{{ group.courseTitle }}</p>
                      <p class="text-xs text-[#94a3b8]">{{ group.resources.length }} resource{{ group.resources.length !== 1 ? 's' : '' }}</p>
                    </div>
                  </div>
                </div>

                <!-- Resource cards grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  @for (res of group.resources; track res.id) {
                    <div class="flex flex-col gap-3 p-4 border border-[#e2e8f0] rounded-xl hover:border-violet-300 hover:shadow-[0_4px_16px_rgba(139,92,246,0.08)] transition-all duration-200 group">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                          <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm" [class]="getTypeColor(res.type)">
                            <i [class]="getTypeIcon(res.type)"></i>
                          </span>
                          <div>
                            <p class="text-sm font-bold text-[#1e293b] line-clamp-1">{{ res.title }}</p>
                            <p class="text-[10px] text-[#94a3b8] capitalize">{{ res.type }}</p>
                          </div>
                        </div>
                        <button
                          pButton
                          type="button"
                          icon="pi pi-trash"
                          class="p-button-text p-button-danger p-button-sm cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
                          (click)="deleteResource(res.id)">
                        </button>
                      </div>
                      <a
                        [href]="res.url"
                        target="_blank"
                        rel="noopener"
                        class="text-xs text-violet-600 hover:text-violet-800 truncate flex items-center gap-1.5 font-medium transition-colors duration-200">
                        <i class="pi pi-external-link text-[10px]"></i>
                        {{ res.url }}
                      </a>
                      <p class="text-[10px] text-[#94a3b8]">Added {{ res.addedAt | date:'mediumDate' }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      }

      <!-- Add Resource Dialog -->
      <p-dialog
        header="Add New Resource"
        [(visible)]="showAddDialog"
        [modal]="true"
        [style]="{ width: '480px', maxWidth: '95vw' }"
        [draggable]="false"
        [resizable]="false">
        <div class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Course</label>
            <p-select
              [options]="courses"
              [(ngModel)]="newResource.courseId"
              optionLabel="title"
              optionValue="id"
              placeholder="-- Choose Course --"
              styleClass="w-full"
              [filter]="true"
              filterBy="title">
            </p-select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Resource Title</label>
            <input
              pInputText
              type="text"
              [(ngModel)]="newResource.title"
              placeholder="e.g. Week 3 Lecture Slides"
              class="w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">URL</label>
            <input
              pInputText
              type="url"
              [(ngModel)]="newResource.url"
              placeholder="https://..."
              class="w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Type</label>
            <p-select
              [options]="resourceTypes"
              [(ngModel)]="newResource.type"
              optionLabel="label"
              optionValue="value"
              placeholder="-- Choose Type --"
              styleClass="w-full">
            </p-select>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showAddDialog = false"></button>
            <button
              pButton
              type="button"
              label="Add Resource"
              icon="pi pi-plus"
              class="p-button-primary cursor-pointer"
              [disabled]="!newResource.courseId || !newResource.title || !newResource.url || !newResource.type"
              (click)="addResource()">
            </button>
          </div>
        </div>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select { border-radius: 10px; border-color: #cbd5e1; }
      .p-button { border-radius: 10px; font-weight: 600; }
      .p-dialog { border-radius: 16px; overflow: hidden; }
    }
  `
})
export class ResourcesComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  loading = true;
  courses: Course[] = [];
  resources: Resource[] = [];
  searchQuery = '';
  typeFilter = 'all';
  showAddDialog = false;

  resourceTypes = RESOURCE_TYPES;

  typeFilterOptions = [
    { label: 'All Types', value: 'all' },
    ...RESOURCE_TYPES.map(t => ({ label: t.label, value: t.value }))
  ];

  newResource: {
    courseId: string;
    title: string;
    url: string;
    type: 'link' | 'video' | 'document' | 'other' | '';
  } = { courseId: '', title: '', url: '', type: '' };

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.loading = true;
    this.resources = this.lmsService.getResources();
    this.lmsService.getCourses().subscribe({
      next: (courses) => {
        this.courses = courses;
        // Back-fill courseTitle on stored resources
        this.resources = this.resources.map(r => ({
          ...r,
          courseTitle: r.courseTitle || courses.find(c => c.id === r.courseId)?.title,
        }));
        this.loading = false;
      },
      error: (err) => {
        this.notify.showError(`Failed to load courses: ${err.message}`);
        this.loading = false;
      }
    });
  }

  get groupedResources(): { courseId: string; courseTitle: string; resources: Resource[] }[] {
    const q = this.searchQuery.toLowerCase().trim();
    const type = this.typeFilter;

    let filtered = this.resources;
    if (type !== 'all') filtered = filtered.filter(r => r.type === type);
    if (q) filtered = filtered.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q)
    );

    // Group by course
    const map = new Map<string, { courseId: string; courseTitle: string; resources: Resource[] }>();
    for (const res of filtered) {
      const courseTitle = res.courseTitle || this.courses.find(c => c.id === res.courseId)?.title || 'Unknown Course';
      if (!map.has(res.courseId)) {
        map.set(res.courseId, { courseId: res.courseId, courseTitle, resources: [] });
      }
      map.get(res.courseId)!.resources.push(res);
    }
    return Array.from(map.values());
  }

  openAddDialog(): void {
    this.newResource = { courseId: '', title: '', url: '', type: '' };
    this.showAddDialog = true;
  }

  addResource(): void {
    if (!this.newResource.courseId || !this.newResource.title || !this.newResource.url || !this.newResource.type) return;
    const course = this.courses.find(c => c.id === this.newResource.courseId);
    const resource = this.lmsService.createResource({
      courseId: this.newResource.courseId,
      courseTitle: course?.title,
      title: this.newResource.title,
      url: this.newResource.url,
      type: this.newResource.type as Resource['type'],
    });
    this.resources = this.lmsService.getResources().map(r => ({
      ...r,
      courseTitle: r.courseTitle || this.courses.find(c => c.id === r.courseId)?.title,
    }));
    this.notify.showSuccess(`Resource "${resource.title}" added!`);
    this.showAddDialog = false;
  }

  deleteResource(id: string): void {
    this.lmsService.deleteResource(id);
    this.resources = this.lmsService.getResources().map(r => ({
      ...r,
      courseTitle: r.courseTitle || this.courses.find(c => c.id === r.courseId)?.title,
    }));
    this.notify.showSuccess('Resource removed.');
  }

  getTypeIcon(type: string): string {
    return RESOURCE_TYPES.find(t => t.value === type)?.icon || 'pi pi-paperclip';
  }

  getTypeColor(type: string): string {
    return RESOURCE_TYPES.find(t => t.value === type)?.color || 'bg-slate-100 text-slate-600';
  }
}
