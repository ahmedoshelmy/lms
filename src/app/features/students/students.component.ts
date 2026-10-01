import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { forkJoin } from 'rxjs';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { Role } from '../../core/interfaces/Role';
import { Group, seatsOverBy, toGroupOptions } from '../../core/interfaces/Group';
import { StudentMembership, User } from '../../core/interfaces/User';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent implements OnInit {
  private lms = inject(LmsService);
  private notify = inject(NotificationService);
  private router = inject(Router);

  /** Groups arranged for choosing between, searchable by name or instructor. */
  readonly groupOptions = computed(() => toGroupOptions(this.groups(), true));

  /** The same list, behind the two choices the filter row needs first. */
  readonly groupFilterOptions = computed(() => [
    { id: -1, name: 'All', label: 'All Groups', running: true },
    { id: -2, name: 'Unassigned', label: 'Without a group', running: true },
    ...toGroupOptions(this.groups()),
  ]);

  students = signal<User[]>([]);
  groups = signal<Group[]>([]);
  loading = signal(false);
  saving = signal(false);
  searchQuery = signal('');

  // Group Filter: 'All' | 'Unassigned' | groupName
  groupFilter = signal<string>('All');
  riskFilter = signal<'All' | 'At-Risk' | 'Low-Risk'>('All');
  renewalFilter = signal<'All' | 'Needed' | 'Handled'>('All');
  savingRenewalFor = signal<number | null>(null);

  // Persistent Selected Student IDs across searches and filters
  selectedStudentIds = signal<Set<number>>(new Set());

  // Dialog control
  showStudentModal = signal(false);
  showDeleteModal = signal(false);
  showBulkModal = signal(false);
  editingStudent = signal<User | null>(null);
  deletingStudent = signal<User | null>(null);

  // Bulk assign & delete controls
  bulkTargetGroupId = signal<number>(0);
  bulkAssigning = signal(false);
  showBulkDeleteModal = signal(false);
  bulkDeleting = signal(false);

  // Form fields
  formName = signal('');
  formEmail = signal('');
  formPhone = signal('');
  formPassword = signal('');
  formGroupId = signal<number>(0);

  // Sorting state
  sortColumn = signal<string>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  toggleSort(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(col: string): string {
    if (this.sortColumn() !== col) return 'pi-sort-alt text-[var(--color-text-muted)] opacity-40';
    return this.sortDirection() === 'asc'
      ? 'pi-sort-amount-up-alt text-[var(--color-secondary)] font-bold'
      : 'pi-sort-amount-down text-[var(--color-secondary)] font-bold';
  }

  /**
   * Say a renewal is dealt with, or put it back on the list. Only the mark is
   * stored: whether the renewal is due is read from the course, so this lapses
   * by itself when the group starts its next one.
   *
   * A child in two groups has a renewal question per group, so the mark is
   * made against the place it was asked about.
   */
  toggleRenewalHandled(student: User, place: StudentMembership): void {
    const handled = !place.renewalHandled;
    this.savingRenewalFor.set(student.id);

    this.lms.setRenewalHandled(place.groupId, student.id, handled).subscribe({
      next: () => {
        this.students.update((list) =>
          list.map((s) =>
            s.id === student.id ? this.withRenewalMark(s, place.groupId, handled) : s
          )
        );
        this.savingRenewalFor.set(null);
        this.notify.showSuccess(
          handled
            ? `${student.name}'s renewal in ${place.groupName} is marked as handled.`
            : `${student.name} is back on the renewal list for ${place.groupName}.`
        );
      },
      error: () => {
        this.savingRenewalFor.set(null);
        this.notify.showError('Could not update the renewal.');
      },
    });
  }

  /**
   * The account's own renewal flag follows its places: it is due while any one
   * of them is, and handled only once every one of them has been.
   */
  private withRenewalMark(student: User, groupId: number, handled: boolean): User {
    const groups = (student.groups ?? []).map((g) =>
      g.groupId === groupId
        ? { ...g, renewalHandled: handled, renewalHandledAt: new Date().toISOString() }
        : g
    );

    const due = groups.filter((g) => g.renewalDue);

    return {
      ...student,
      groups,
      renewalHandled: due.length > 0 && due.every((g) => g.renewalHandled),
    };
  }

  /** The places that still need somebody to ask about carrying on. */
  renewalPlaces(student: User): StudentMembership[] {
    return (student.groups ?? []).filter((g) => g.renewalDue);
  }

  /** Nobody has put them in a group, so nothing is being taught to them. */
  isStudentAtRisk(s: User): boolean {
    return (s.groups ?? []).length === 0;
  }

  readonly atRiskCount = computed(() => {
    return this.students().filter((s) => this.isStudentAtRisk(s)).length;
  });

  /**
   * Their course is nearly out and nobody has said they have dealt with it.
   * The server decides whether a renewal is due -- it reads the course each
   * time, so this list empties itself as groups move up a level.
   */
  needsRenewal(s: User): boolean {
    return !!s.renewalDue && !s.renewalHandled;
  }

  readonly renewalCount = computed(
    () => this.students().filter((s) => this.needsRenewal(s)).length
  );

  readonly renewalHandledCount = computed(
    () => this.students().filter((s) => s.renewalDue && s.renewalHandled).length
  );

  /** What a group chip says on hover: where they are in that group's course. */
  placeLabel(place: StudentMembership): string {
    const where = `${place.groupName} — ${this.classesLeft(place.sessionsRemaining)}`;
    if (!place.renewalDue) return where;
    return place.renewalHandled
      ? `${where}. Renewal handled${
          place.renewalHandledByName ? ' by ' + place.renewalHandledByName : ''
        }.`
      : `${where}. Somebody should ask about carrying on.`;
  }

  private classesLeft(left: number | null | undefined): string {
    if (left === null || left === undefined) return 'No course running';
    if (left <= 0) return 'Course finished';
    return left === 1 ? 'Last class' : `${left} classes left`;
  }

  filteredStudents = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const gFilter = this.groupFilter();
    const rFilter = this.riskFilter();
    const renewal = this.renewalFilter();

    const list = this.students().filter((s) => {
      const places = s.groups ?? [];

      let matchesGroup = true;
      if (gFilter === 'Unassigned') {
        matchesGroup = places.length === 0;
      } else if (gFilter !== 'All') {
        matchesGroup = places.some(
          (g) => g.groupName === gFilter || g.groupId.toString() === gFilter
        );
      }

      let matchesRisk = true;
      if (rFilter === 'At-Risk') {
        matchesRisk = this.isStudentAtRisk(s);
      } else if (rFilter === 'Low-Risk') {
        matchesRisk = !this.isStudentAtRisk(s);
      }

      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        places.some((g) => g.groupName.toLowerCase().includes(q));

      let matchesRenewal = true;
      if (renewal === 'Needed') {
        matchesRenewal = this.needsRenewal(s);
      } else if (renewal === 'Handled') {
        matchesRenewal = !!s.renewalDue && !!s.renewalHandled;
      }

      return matchesGroup && matchesRisk && matchesRenewal && matchesSearch;
    });

    const col = this.sortColumn();
    const dir = this.sortDirection();

    return list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (col === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (col === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (col === 'group') {
        valA = this.groupNames(a);
        valB = this.groupNames(b);
      } else if (col === 'joined') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return dir === 'asc' ? valA - valB : valB - valA;
      }
      const comp = valA
        .toString()
        .localeCompare(valB.toString(), undefined, { numeric: true, sensitivity: 'base' });
      return dir === 'asc' ? comp : -comp;
    });
  });

  unassignedCount = computed(
    () => this.students().filter((s) => (s.groups ?? []).length === 0).length
  );

  /** Their groups as one string, for sorting and for a tooltip. */
  groupNames(s: User): string {
    return (s.groups ?? []).map((g) => g.groupName).join(', ');
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.lms.getStudents().subscribe({
      next: (data) => {
        this.students.set(data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    this.lms.getGroups().subscribe({
      next: (groups) => {
        this.groups.set(groups || []);
      },
      error: () => {},
    });
  }

  /**
   * What to say when the group somebody has picked will not seat everyone.
   * Nothing here refuses the assignment: a class of thirteen in a room of
   * twelve is a chair to find, not a sale to turn away. It should just not be
   * a surprise on the morning.
   */
  roomWarning(groupId: number | string, joining: number): string | null {
    const group = this.groups().find((g) => g.id === Number(groupId));
    if (!group || group.roomStudentCapacity == null) return null;

    const over = group.studentCount + joining - group.roomStudentCapacity;
    if (over <= 0) return null;

    const already = seatsOverBy(group);
    const lead = already
      ? `${group.name} is already ${already} over`
      : `This would put ${group.name} ${over} over`;

    return `${lead} what ${group.roomName} seats (${group.roomStudentCapacity}). Allowed, but somebody has to find the chairs.`;
  }

  // Selection Helpers
  isSelected(studentId: number): boolean {
    return this.selectedStudentIds().has(studentId);
  }

  toggleSelection(studentId: number): void {
    const current = new Set(this.selectedStudentIds());
    if (current.has(studentId)) {
      current.delete(studentId);
    } else {
      current.add(studentId);
    }
    this.selectedStudentIds.set(current);
  }

  toggleSelectAllVisible(): void {
    const visible = this.filteredStudents();
    const current = new Set(this.selectedStudentIds());
    const allVisibleSelected = visible.length > 0 && visible.every((s) => current.has(s.id));

    if (allVisibleSelected) {
      visible.forEach((s) => current.delete(s.id));
    } else {
      visible.forEach((s) => current.add(s.id));
    }
    this.selectedStudentIds.set(current);
  }

  clearSelection(): void {
    this.selectedStudentIds.set(new Set());
  }

  isAllVisibleSelected(): boolean {
    const visible = this.filteredStudents();
    if (visible.length === 0) return false;
    return visible.every((s) => this.selectedStudentIds().has(s.id));
  }

  // Bulk Assign Modal & Execution
  openBulkAssignModal(): void {
    if (this.selectedStudentIds().size === 0) {
      this.notify.showWarn('Please select at least one student.');
      return;
    }
    this.bulkTargetGroupId.set(0);
    this.showBulkModal.set(true);
  }

  executeBulkAssign(): void {
    const selectedIds = Array.from(this.selectedStudentIds());
    if (selectedIds.length === 0) return;

    const targetGroupId = this.bulkTargetGroupId() || undefined;
    this.bulkAssigning.set(true);

    const requests = selectedIds.map((id) => {
      const student = this.students().find((s) => s.id === id);
      return this.lms.updateUser(id, {
        name: student?.name || '',
        email: student?.email || '',
        role: Role.Student,
        groupId: targetGroupId,
      });
    });

    forkJoin(requests).subscribe({
      next: () => {
        const targetGroupObj = this.groups().find((g) => g.id === targetGroupId);
        const groupNameStr = targetGroupObj ? targetGroupObj.name : 'Unassigned';
        this.notify.showSuccess(
          `Successfully assigned ${selectedIds.length} student${selectedIds.length !== 1 ? 's' : ''} to ${groupNameStr}.`
        );
        this.bulkAssigning.set(false);
        this.showBulkModal.set(false);
        this.clearSelection();
        this.loadData();
      },
      error: () => {
        this.bulkAssigning.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.editingStudent.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPassword.set('');
    this.formGroupId.set(0);
    this.showStudentModal.set(true);
  }

  openEditModal(student: User): void {
    this.editingStudent.set(student);
    this.formName.set(student.name);
    this.formEmail.set(student.email || '');
    this.formPhone.set(student.phone || '');
    this.formPassword.set('');
    // Blank, because picking one here adds a place rather than replacing
    // whatever they already hold. Leaving a group is its own action.
    this.formGroupId.set(0);
    this.showStudentModal.set(true);
  }

  openDeleteModal(student: User): void {
    this.deletingStudent.set(student);
    this.showDeleteModal.set(true);
  }

  saveStudent(): void {
    const name = this.formName().trim();
    const email = this.formEmail().trim();
    const phone = this.formPhone().trim();
    const password = this.formPassword().trim();
    const groupId = this.formGroupId() || undefined;

    if (!name) {
      this.notify.showWarn('Please enter student name.');
      return;
    }

    this.saving.set(true);

    if (this.editingStudent()) {
      const studentId = this.editingStudent()!.id;
      this.lms
        .updateUser(studentId, {
          name,
          email: email || undefined,
          phone: phone || undefined,
          role: Role.Student,
          password: password || undefined,
          groupId: groupId || undefined,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Student updated successfully.');
            this.saving.set(false);
            this.showStudentModal.set(false);
            this.loadData();
          },
          error: () => {
            this.saving.set(false);
          },
        });
    } else {
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const dummyEmail = email || `${cleanName || 'student'}.${randomId}@lms.local`;
      const dummyPassword = password || 'pass2word';

      this.lms
        .createUser({
          name,
          email: dummyEmail,
          phone: phone || undefined,
          password: dummyPassword,
          role: Role.Student,
          groupId: groupId || undefined,
        })
        .subscribe({
          next: () => {
            this.notify.showSuccess('Student created successfully.');
            this.saving.set(false);
            this.showStudentModal.set(false);
            this.loadData();
          },
          error: () => {
            this.saving.set(false);
          },
        });
    }
  }

  openBulkDeleteModal(): void {
    if (this.selectedStudentIds().size === 0) return;
    this.showBulkDeleteModal.set(true);
  }

  confirmBulkDelete(): void {
    const selectedIds = Array.from(this.selectedStudentIds());
    if (selectedIds.length === 0) return;

    this.bulkDeleting.set(true);
    const requests = selectedIds.map((id) => this.lms.deleteUser(id));

    forkJoin(requests).subscribe({
      next: () => {
        this.notify.showSuccess(
          `Successfully deleted ${selectedIds.length} student${selectedIds.length !== 1 ? 's' : ''}.`
        );
        this.bulkDeleting.set(false);
        this.showBulkDeleteModal.set(false);
        this.clearSelection();
        this.loadData();
      },
      error: () => {
        this.bulkDeleting.set(false);
      },
    });
  }

  confirmDelete(): void {
    const student = this.deletingStudent();
    if (!student) return;

    this.saving.set(true);
    this.lms.deleteUser(student.id).subscribe({
      next: () => {
        this.notify.showSuccess(`Student ${student.name} deleted.`);
        this.saving.set(false);
        this.showDeleteModal.set(false);
        this.deletingStudent.set(null);

        // Remove from selection if present
        const currentSet = new Set(this.selectedStudentIds());
        if (currentSet.has(student.id)) {
          currentSet.delete(student.id);
          this.selectedStudentIds.set(currentSet);
        }

        this.loadData();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  viewStudent(student: User): void {
    this.router.navigate(['/students', student.id]);
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
