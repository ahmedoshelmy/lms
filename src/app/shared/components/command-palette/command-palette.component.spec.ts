import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '../../../core/interfaces/Role';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { CommandPaletteComponent } from './command-palette.component';

describe('CommandPaletteComponent', () => {
  it('fetches students, groups and courses on first open, not at sign-in', () => {
    const lms = {
      getStudents: vi.fn(() => of([{ id: 4, name: 'Sara Ahmed', email: 's@x' }])),
      getGroups: vi.fn(() => of([])),
      getCourses: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LmsService, useValue: lms },
        {
          provide: AuthService,
          useValue: { canAccess: () => true, currentRole: () => Role.Admin },
        },
      ],
    });
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    fixture.detectChanges();
    const palette = fixture.componentInstance;

    // The pages are there at once, without asking the server for anything.
    expect(palette.allItems().some((i) => i.category === 'Navigation')).toBe(true);
    expect(lms.getStudents).not.toHaveBeenCalled();
    expect(lms.getGroups).not.toHaveBeenCalled();
    expect(lms.getCourses).not.toHaveBeenCalled();

    palette.open();
    palette.close();
    palette.open();

    // Once, however often it is opened.
    expect(lms.getStudents).toHaveBeenCalledTimes(1);
    expect(lms.getGroups).toHaveBeenCalledTimes(1);
    expect(lms.getCourses).toHaveBeenCalledTimes(1);
    expect(palette.allItems().some((i) => i.label === 'Sara Ahmed')).toBe(true);
  });
});
