import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
});
