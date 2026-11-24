import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Role } from '../../../../core/interfaces/Role';
import { User } from '../../../../core/interfaces/User';
import { AuthService } from '../../../../core/services/auth.service';
import { InstructorAvailabilityMatrixComponent } from './instructor-availability-matrix.component';

const someoneElse = { id: 2, name: 'Ali', role: Role.Instructor } as User;
const me = { id: 7, name: 'Mona', role: Role.Instructor } as User;

describe('InstructorAvailabilityMatrixComponent', () => {
  function create(canPick: boolean) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: signal(me) } }],
    });
    const fixture = TestBed.createComponent(InstructorAvailabilityMatrixComponent);
    fixture.componentRef.setInput('instructors', [someoneElse, me]);
    fixture.componentRef.setInput('canPickInstructor', canPick);
    return fixture.componentInstance;
  }

  it('shows an instructor their own week, not the first one in the list', () => {
    expect(create(false).selectedInstructor()?.id).toBe(7);
  });

  it('lets someone who can pick start from the list', () => {
    expect(create(true).selectedInstructor()?.id).toBe(2);
  });
});
