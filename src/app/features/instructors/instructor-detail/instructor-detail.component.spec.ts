import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { LmsService } from '../../../core/services/lms.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InstructorDetailComponent } from './instructor-detail.component';

/** A failed load used to leave the page blank. */
describe('InstructorDetailComponent when the load fails', () => {
  it('says so and loads again on request', () => {
    const getInstructorDetails = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '3' })) },
        },
        {
          provide: LmsService,
          useValue: { getInstructorDetails, getInstructorStats: () => of(null) },
        },
        { provide: NotificationService, useValue: {} },
        { provide: AuthService, useValue: { hasRole: () => true, getUserId: () => 1 } },
      ],
    });

    const fixture = TestBed.createComponent(InstructorDetailComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('This instructor could not be loaded');

    page.querySelector<HTMLButtonElement>('.load-error__retry')!.click();
    expect(getInstructorDetails).toHaveBeenCalledTimes(2);
    expect(getInstructorDetails).toHaveBeenLastCalledWith(3);
  });
});
