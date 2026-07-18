import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, User } from '../../core/services/lms.service';
import { ROLE_LABELS, Role } from '../../core/interfaces/Role';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Users & Staff</h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">All registered accounts in the system</p>
        </div>
        <!-- Search -->
        <div class="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 w-full md:w-72">
          <i class="pi pi-search text-[var(--color-text-muted)] text-sm"></i>
          <input
            type="search"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search users…"
            class="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            aria-label="Search users"
          />
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center gap-3 text-[var(--color-text-muted)] text-sm py-10">
          <i class="pi pi-spinner pi-spin"></i> Loading users…
        </div>
      } @else if (filteredUsers().length === 0 && users().length === 0) {
        <div class="empty-state">
          <i class="pi pi-users text-4xl mb-3 opacity-40"></i>
          <p class="font-semibold">No users found</p>
        </div>
      } @else {
        <!-- Summary chips -->
        <div class="flex gap-3 mb-6 flex-wrap">
          @for (chip of roleChips(); track chip.role) {
            <span class="role-chip" [style.--chip-color]="chip.color">
              <i [class]="chip.icon + ' mr-1.5'"></i>
              {{ chip.count }} {{ chip.label }}{{ chip.count !== 1 ? 's' : '' }}
            </span>
          }
        </div>

        <!-- Table -->
        <div class="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                <th class="th-cell">Name</th>
                <th class="th-cell">Email</th>
                <th class="th-cell">Role</th>
                <th class="th-cell hidden md:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filteredUsers(); track user.id) {
                <tr class="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td class="td-cell">
                    <div class="flex items-center gap-3">
                      <span class="user-avatar">{{ initials(user.name) }}</span>
                      <span class="font-semibold text-sm text-[var(--color-text-primary)]">{{ user.name }}</span>
                    </div>
                  </td>
                  <td class="td-cell text-sm text-[var(--color-text-muted)]">{{ user.email }}</td>
                  <td class="td-cell">
                    <span class="role-badge-sm" [class]="roleBadgeClass(user.role)">
                      {{ roleLabel(user.role) }}
                    </span>
                  </td>
                  <td class="td-cell hidden md:table-cell text-xs text-[var(--color-text-muted)]">
                    {{ formatDate(user.createdAt) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }

    .th-cell {
      padding: 12px 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-muted);
      text-align: left;
    }
    .td-cell {
      padding: 14px 20px;
      vertical-align: middle;
    }

    .user-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, var(--color-avatar-from) 0%, var(--color-avatar-to) 100%);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }

    .role-badge-sm {
      display: inline-flex; padding: 3px 10px; border-radius: 99px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .badge-admin { background: rgba(26,43,76,0.08); color: var(--color-primary); }
    .badge-instructor { background: rgba(62,109,181,0.08); color: var(--color-secondary); }
    .badge-student { background: rgba(16,185,129,0.08); color: var(--color-success); }

    .role-chip {
      display: inline-flex; align-items: center; padding: 6px 14px;
      border-radius: 99px; font-size: 12px; font-weight: 600;
      background: var(--color-surface-secondary); color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 300px; border-radius: 16px; border: 1px dashed var(--color-border);
      color: var(--color-text-muted); text-align: center;
    }
  `,
})
export class UsersComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);

  users = signal<User[]>([]);
  loading = signal(false);
  searchQuery = signal('');

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.users().filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q)
    );
  });

  roleChips = computed(() => {
    const all = this.users();
    return [
      { role: Role.Admin, label: 'Admin', count: all.filter((u) => u.role === Role.Admin).length, icon: 'pi pi-shield', color: 'var(--color-primary)' },
      { role: Role.Instructor, label: 'Instructor', count: all.filter((u) => u.role === Role.Instructor).length, icon: 'pi pi-user', color: 'var(--color-secondary)' },
      { role: Role.Student, label: 'Student', count: all.filter((u) => u.role === Role.Student).length, icon: 'pi pi-graduation-cap', color: 'var(--color-success)' },
    ].filter((c) => c.count > 0);
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.lms.getUsers().subscribe({
      next: (users) => { this.users.set(users || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  initials(name: string): string {
    return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  }

  roleLabel(role: Role): string { return ROLE_LABELS[role] ?? 'Unknown'; }

  roleBadgeClass(role: Role): string {
    if (role === Role.Admin) return 'badge-admin';
    if (role === Role.Instructor) return 'badge-instructor';
    return 'badge-student';
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
