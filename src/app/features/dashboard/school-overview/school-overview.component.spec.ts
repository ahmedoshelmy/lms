import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LmsService } from '../../../core/services/lms.service';
import { SchoolOverviewComponent } from './school-overview.component';

describe('SchoolOverviewComponent', () => {
  it('says the figures failed and offers to try again', () => {
    const getDashboardOverview = vi.fn(() => throwError(() => new Error('down')));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LmsService, useValue: { getDashboardOverview } }],
    });
    const fixture = TestBed.createComponent(SchoolOverviewComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.textContent).toContain('The figures could not be loaded');
    const retry = [...page.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Try again')
    );
    retry!.click();

    expect(getDashboardOverview).toHaveBeenCalledTimes(2);
  });
});
