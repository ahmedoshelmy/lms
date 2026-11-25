import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { StudentsComponent } from './students.component';

/**
 * Every student created here used to be given the password "pass2word",
 * because the form never asked for one. Anyone who knew it could sign in as
 * any of them.
 */
describe('StudentsComponent creating a student', () => {
  let lms: {
    createUser: ReturnType<typeof vi.fn>;
    getStudents: () => unknown;
    getGroups: () => unknown;
  };
  let notify: { showWarn: ReturnType<typeof vi.fn>; showSuccess: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    lms = {
      createUser: vi.fn(() => of({})),
      getStudents: () => of([]),
      getGroups: () => of([]),
    };
    notify = { showWarn: vi.fn(), showSuccess: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: lms },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  function openNewStudentForm() {
    const component = TestBed.createComponent(StudentsComponent).componentInstance;
    component.openCreateModal();
    component.formName.set('Sara Ahmed');
    return component;
  }

  it('refuses to create a student without a password', () => {
    const component = openNewStudentForm();

    component.saveStudent();

    expect(lms.createUser).not.toHaveBeenCalled();
    expect(notify.showWarn).toHaveBeenCalled();
  });

  it('sends the password that was typed, never a default', () => {
    const component = openNewStudentForm();
    component.formPassword.set('a-real-secret');

    component.saveStudent();

    expect(lms.createUser).toHaveBeenCalledTimes(1);
    expect(lms.createUser.mock.calls[0][0].password).toBe('a-real-secret');
  });

  it('deletes only the selected students the filters show, and keeps failures selected', () => {
    const component = TestBed.createComponent(StudentsComponent).componentInstance;
    const deleted: number[] = [];
    Object.assign(lms, {
      deleteUser: (id: number) => {
        deleted.push(id);
        return id === 2 ? throwError(() => new Error('refused')) : of(null);
      },
    });
    component.students.set([
      { id: 1, name: 'Sara' },
      { id: 2, name: 'Omar' },
      { id: 3, name: 'Laila' },
    ] as never);
    component.selectedStudentIds.set(new Set([1, 2, 3]));
    // "ar" shows Sara and Omar; Laila is selected but out of view.
    component.searchQuery.set('ar');

    component.confirmBulkDelete();

    expect(deleted.sort()).toEqual([1, 2]);
    // Omar's deletion was refused: he stays selected to try again. Laila was
    // never touched, so she stays selected too, for when the filter shows her.
    expect([...component.selectedStudentIds()].sort()).toEqual([2, 3]);
    expect(notify.showWarn).toHaveBeenCalled();
  });
});

describe('StudentsComponent table headers', () => {
  it('say which column is sorted and which way, and sort from the keyboard', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LmsService,
          useValue: {
            getStudents: () => of([{ id: 4, name: 'Sara Ahmed', email: 's@example.test' }]),
            getGroups: () => of([]),
          },
        },
        { provide: NotificationService, useValue: { showWarn: vi.fn(), showSuccess: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(StudentsComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const header = (label: string) =>
      [...el.querySelectorAll('th')].find((th) => th.textContent?.trim() === label)!;

    expect(header('Student').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Email').hasAttribute('aria-sort')).toBe(false);

    // A real button: reachable by Tab, pressed with Enter or Space.
    const sortByName = header('Student').querySelector('button')!;
    expect(sortByName.type).toBe('button');
    sortByName.click();
    await fixture.whenStable();
    expect(header('Student').getAttribute('aria-sort')).toBe('descending');

    // The student's name is a link to their page.
    const link = el.querySelector<HTMLAnchorElement>('td a[href="/students/4"]:not([tabindex])');
    expect(link?.textContent?.trim()).toBe('Sara Ahmed');
  });
});

describe('StudentsComponent editing a student', () => {
  it('clears an emptied phone with null: the server keeps a field left out', () => {
    const updateUser = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LmsService,
          useValue: { updateUser, getStudents: () => of([]), getGroups: () => of([]) },
        },
        { provide: NotificationService, useValue: { showWarn: vi.fn(), showSuccess: vi.fn() } },
      ],
    });
    const page = TestBed.createComponent(StudentsComponent).componentInstance;
    page.openEditModal({
      id: 4,
      name: 'Sara Ahmed',
      email: 'sara@example.test',
      phone: '0100',
      role: 1,
    } as never);
    page.formPhone.set('');

    page.saveStudent();

    const sent = (updateUser.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(sent['phone']).toBeNull();
    expect(sent['email']).toBe('sara@example.test');
  });
});
