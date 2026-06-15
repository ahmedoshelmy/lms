import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LmsService, User } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
  ],
  template: `
    <div class="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-[#1e293b] tracking-tight">Users & Directory</h1>
          <p class="text-sm text-[#64748b] mt-1">Manage platform members, students and course staff</p>
        </div>
        <div>
          <button 
            pButton 
            type="button" 
            label="Add User" 
            icon="pi pi-user-plus" 
            class="p-button-primary cursor-pointer w-full sm:w-auto"
            (click)="openCreateDialog()">
          </button>
        </div>
      </div>

      <!-- Search Filter -->
      <div class="mb-8 max-w-md">
        <span class="p-input-icon-left w-full relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"></i>
          <input 
            pInputText 
            type="text" 
            [(ngModel)]="searchQuery" 
            placeholder="Search users by name or email..." 
            class="w-full pl-9 pr-4 py-2.5 rounded-xl border-[#cbd5e1] hover:border-violet-500 focus:border-violet-500" />
        </span>
      </div>

      <!-- Split Columns Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Instructors Directory -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col">
          <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-5">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-600 font-bold text-xs border border-rose-100">
              <i class="pi pi-users text-[10px]"></i> Instructors
            </span>
            <span class="text-xs font-semibold text-[#94a3b8]">{{ filteredInstructors.length }} active</span>
          </div>

          <div class="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
            @for (inst of filteredInstructors; track inst.id) {
              <div class="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-xl hover:border-rose-400 hover:bg-[#fffbfb] transition-all duration-200">
                <div class="flex items-center gap-3.5">
                  <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-sm shrink-0">
                    {{ getInitials(inst.name) }}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-[#1e293b] truncate">{{ inst.name }}</span>
                    <span class="text-xs text-[#64748b] truncate mt-0.5">{{ inst.email }}</span>
                  </div>
                </div>
                <div class="text-[10px] text-[#94a3b8] text-right font-medium shrink-0 pl-2">
                  Since {{ inst.createdAt | date:'MMM yyyy' }}
                </div>
              </div>
            } @empty {
              <p class="text-center text-sm text-[#94a3b8] py-8">No instructors found.</p>
            }
          </div>
        </div>

        <!-- Students Directory -->
        <div class="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col">
          <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-5">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 text-cyan-600 font-bold text-xs border border-cyan-100">
              <i class="pi pi-user-plus text-[10px]"></i> Students
            </span>
            <span class="text-xs font-semibold text-[#94a3b8]">{{ filteredStudents.length }} active</span>
          </div>

          <div class="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
            @for (stud of filteredStudents; track stud.id) {
              <div class="flex items-center justify-between p-4 border border-[#e2e8f0] rounded-xl hover:border-cyan-400 hover:bg-[#fbfefe] transition-all duration-200">
                <div class="flex items-center gap-3.5">
                  <div class="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 font-bold flex items-center justify-center text-sm shrink-0">
                    {{ getInitials(stud.name) }}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-[#1e293b] truncate">{{ stud.name }}</span>
                    <span class="text-xs text-[#64748b] truncate mt-0.5">{{ stud.email }}</span>
                  </div>
                </div>
                <div class="text-[10px] text-[#94a3b8] text-right font-medium shrink-0 pl-2">
                  Since {{ stud.createdAt | date:'MMM yyyy' }}
                </div>
              </div>
            } @empty {
              <p class="text-center text-sm text-[#94a3b8] py-8">No students found.</p>
            }
          </div>
        </div>
      </div>

      <!-- Dialog: Create User -->
      <p-dialog 
        header="Add New Platform Member" 
        [(visible)]="showCreateDialog" 
        [modal]="true" 
        [style]="{ width: '450px' }" 
        [draggable]="false" 
        [resizable]="false">
        <form (submit)="createUser($event)" class="flex flex-col gap-4 py-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Full Name</label>
            <input 
              pInputText 
              type="text" 
              [(ngModel)]="newUser.name" 
              name="name" 
              placeholder="e.g. Dr. Ada Lovelace" 
              required 
              class="w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Email Address</label>
            <input 
              pInputText 
              type="email" 
              [(ngModel)]="newUser.email" 
              name="email" 
              placeholder="e.g. ada@inite.tech" 
              required 
              class="w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#64748b]">Assign Role</label>
            <p-select 
              [options]="roles" 
              [(ngModel)]="newUser.role" 
              name="role"
              optionLabel="label" 
              optionValue="value" 
              placeholder="Choose Platform Role" 
              styleClass="w-full">
            </p-select>
          </div>

          <div class="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9] mt-3">
            <button pButton type="button" label="Cancel" class="p-button-text p-button-secondary cursor-pointer" (click)="showCreateDialog = false"></button>
            <button pButton type="submit" label="Add User" class="p-button-primary cursor-pointer" [disabled]="!newUser.name || !newUser.email || !newUser.role"></button>
          </div>
        </form>
      </p-dialog>
    </div>
  `,
  styles: `
    :host ::ng-deep {
      .p-select {
        border-radius: 10px;
        border-color: #cbd5e1;
      }
      .p-button {
        border-radius: 10px;
        font-weight: 600;
      }
      .p-dialog {
        border-radius: 16px;
      }
    }
  `
})
export class UsersComponent implements OnInit {
  private lmsService = inject(LmsService);
  private notify = inject(NotificationService);

  users: User[] = [];
  searchQuery = '';
  showCreateDialog = false;

  roles = [
    { label: 'Instructor', value: 2 },
    { label: 'Student', value: 1 }
  ];

  newUser = {
    name: '',
    email: '',
    role: null as number | null
  };

  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData(): void {
    this.lmsService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
      },
      error: (err) => {
        this.notify.showError(`Failed to load directory: ${err.message}`);
      }
    });
  }

  get filteredInstructors(): User[] {
    return this.filterUsers(2);
  }

  get filteredStudents(): User[] {
    return this.filterUsers(1);
  }

  private filterUsers(role: number): User[] {
    const roleUsers = this.users.filter(u => u.role === role);
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return roleUsers;

    return roleUsers.filter(u => 
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  openCreateDialog(): void {
    this.newUser = { name: '', email: '', role: null };
    this.showCreateDialog = true;
  }

  createUser(event: Event): void {
    event.preventDefault();
    if (!this.newUser.name || !this.newUser.email || this.newUser.role === null) return;

    this.lmsService.createUser(this.newUser as any).subscribe({
      next: (user) => {
        this.notify.showSuccess(`User "${user.name}" registered successfully!`);
        this.showCreateDialog = false;
        this.loadData();
      },
      error: (err) => {
        this.notify.showError(`Failed to add user: ${err.message}`);
      }
    });
  }
}
