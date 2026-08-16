import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  HostListener,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LmsService } from '../../../core/services/lms.service';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/interfaces/Role';
import { User } from '../../../core/interfaces/User';
import { Group } from '../../../core/interfaces/Group';
import { Course } from '../../../core/interfaces/Course';

export interface CommandItem {
  id: string | number;
  label: string;
  category: 'Navigation' | 'Student' | 'Instructor' | 'Group' | 'Course';
  detail?: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        (click)="close()"
      >
        <div
          class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden relative"
          (click)="$event.stopPropagation()"
        >
          <!-- Search Input Bar -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)]">
            <i class="pi pi-search text-lg text-[var(--color-secondary)] font-bold"></i>
            <input
              #searchInput
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="onSearchChange($event)"
              (keydown)="onKeyDown($event)"
              placeholder="Type to search students, groups, courses, or jump to page... (Esc to close)"
              class="w-full bg-transparent text-sm sm:text-base font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
            />
            <span
              class="hidden sm:inline-block px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
            >
              Esc
            </span>
          </div>

          <!-- Results List -->
          <div class="max-h-[380px] overflow-y-auto p-2 space-y-1 no-scrollbar">
            @for (item of filteredItems(); track item.id + '-' + item.category; let idx = $index) {
              <button
                type="button"
                (click)="selectItem(item)"
                (mouseenter)="selectedIndex.set(idx)"
                class="w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left"
                [class.bg-[var(--color-surface-secondary)]]="selectedIndex() === idx"
                [class.text-[var(--color-secondary)]]="selectedIndex() === idx"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    [ngClass]="{
                      'bg-[var(--color-primary)]/10 text-[var(--color-primary)]': item.category === 'Navigation',
                      'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]': item.category === 'Student',
                      'bg-[var(--color-warning)]/10 text-[var(--color-warning-foreground)]': item.category === 'Instructor',
                      'bg-[var(--color-success)]/10 text-[var(--color-success-foreground)]': item.category === 'Group',
                      'bg-purple-500/10 text-purple-600': item.category === 'Course'
                    }"
                  >
                    <i [class]="'pi ' + item.icon + ' text-sm'"></i>
                  </div>
                  <div class="min-w-0">
                    <p class="font-extrabold text-xs sm:text-sm text-[var(--color-text-primary)] truncate">
                      {{ item.label }}
                    </p>
                    @if (item.detail) {
                      <p class="text-[11px] text-[var(--color-text-muted)] truncate">
                        {{ item.detail }}
                      </p>
                    }
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border border-[var(--color-border)]"
                    [ngClass]="{
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]': item.category === 'Navigation',
                      'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]': item.category === 'Student',
                      'bg-[var(--color-warning-background)] text-[var(--color-warning-foreground)]': item.category === 'Instructor',
                      'bg-[var(--color-success-background)] text-[var(--color-success-foreground)]': item.category === 'Group',
                      'bg-purple-500/10 text-purple-600': item.category === 'Course'
                    }"
                  >
                    {{ item.category }}
                  </span>
                  <i class="pi pi-arrow-right text-xs opacity-50"></i>
                </div>
              </button>
            } @empty {
              <div class="text-center py-10 text-[var(--color-text-muted)]">
                <i class="pi pi-search text-2xl mb-2 block opacity-40"></i>
                <p class="text-xs font-semibold">No matching pages, students, or courses found.</p>
              </div>
            }
          </div>

          <!-- Footer Tips -->
          <div
            class="px-5 py-2.5 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border)] flex items-center justify-between text-[11px] font-semibold text-[var(--color-text-muted)]"
          >
            <div class="flex items-center gap-3">
              <span><strong class="text-[var(--color-text-primary)]">↑↓</strong> Navigate</span>
              <span><strong class="text-[var(--color-text-primary)]">↵</strong> Select</span>
            </div>
            <span>Antigravity LMS Search</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `,
})
export class CommandPaletteComponent implements OnInit {
  private router = inject(Router);
  private lms = inject(LmsService);
  private auth = inject(AuthService);

  private get isAdmin(): boolean {
    return this.auth.hasRole(Role.Admin);
  }

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  isOpen = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedIndex = signal<number>(0);

  allItems = signal<CommandItem[]>([]);

  readonly staticNavItems: CommandItem[] = [
    { id: 'dashboard', label: 'Dashboard', category: 'Navigation', icon: 'pi-th-large', route: ['/dashboard'] },
    { id: 'schedule', label: 'Schedule & Calendar', category: 'Navigation', icon: 'pi-calendar', route: ['/schedule'] },
    { id: 'attendance', label: 'Attendance Management', category: 'Navigation', icon: 'pi-check-square', route: ['/attendance'] },
    { id: 'courses', label: 'Course Catalog', category: 'Navigation', icon: 'pi-book', route: ['/courses'] },
    { id: 'groups', label: 'Cohort Groups', category: 'Navigation', icon: 'pi-users', route: ['/groups'] },
    { id: 'students', label: 'Student Directory', category: 'Navigation', icon: 'pi-user', route: ['/students'], adminOnly: true },
    { id: 'instructors', label: 'Instructor Roster', category: 'Navigation', icon: 'pi-user-edit', route: ['/instructors'], adminOnly: true },
    { id: 'profile', label: 'My Profile Settings', category: 'Navigation', icon: 'pi-id-card', route: ['/profile'] },
    { id: 'settings', label: 'System Settings & Diagnostics', category: 'Navigation', icon: 'pi-cog', route: ['/settings'], adminOnly: true },
  ] as (CommandItem & { adminOnly?: boolean })[];

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.allItems();
    if (!q) return list.slice(0, 10);
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.detail && item.detail.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    ).slice(0, 15);
  });

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.toggle();
    }
  }

  ngOnInit(): void {
    this.loadCatalogData();
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.searchQuery.set('');
    this.selectedIndex.set(0);
    this.isOpen.set(true);
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 50);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.selectedIndex.set(0);
  }

  onKeyDown(event: KeyboardEvent): void {
    const list = this.filteredItems();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.set((this.selectedIndex() + 1) % Math.max(1, list.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.set(
        (this.selectedIndex() - 1 + list.length) % Math.max(1, list.length)
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = list[this.selectedIndex()];
      if (selected) {
        this.selectItem(selected);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  selectItem(item: CommandItem): void {
    this.close();
    this.router.navigate(item.route);
  }

  private loadCatalogData(): void {
    // Only include admin-only nav items when the user is an admin
    const navItems = (this.staticNavItems as (CommandItem & { adminOnly?: boolean })[]).filter(
      (item) => !item.adminOnly || this.isAdmin
    );
    const catalog: CommandItem[] = [...navItems];

    // Load Students — admin only (instructors get 403)
    if (this.isAdmin) {
      this.lms.getStudents().subscribe({
        next: (students) => {
          (students || []).forEach((s) => {
            catalog.push({
              id: `student-${s.id}`,
              label: s.name,
              detail: s.email,
              category: 'Student',
              icon: 'pi-user',
              route: ['/students'],
            });
          });
          this.allItems.set([...catalog]);
        },
      });
    } else {
      this.allItems.set([...catalog]);
    }

    // Load Groups
    this.lms.getGroups().subscribe({
      next: (groups) => {
        (groups || []).forEach((g) => {
          catalog.push({
            id: `group-${g.id}`,
            label: g.name,
            detail: g.status ? `Status: ${g.status}` : 'Cohort Group',
            category: 'Group',
            icon: 'pi-users',
            route: ['/groups', g.id.toString()],
          });
        });
        this.allItems.set([...catalog]);
      },
    });

    // Load Courses
    this.lms.getCourses().subscribe({
      next: (courses) => {
        (courses || []).forEach((c) => {
          catalog.push({
            id: `course-${c.id}`,
            label: c.title,
            detail: c.topic ? `${c.level} • ${c.topic}` : 'Course Catalog',
            category: 'Course',
            icon: 'pi-book',
            route: ['/courses'],
          });
        });
        this.allItems.set([...catalog]);
      },
    });
  }
}
