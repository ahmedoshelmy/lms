import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../services/notification.service';
import { AppErrorHandler } from './app-error-handler';
import { ErrorReporter } from './error-reporter.service';

describe('AppErrorHandler', () => {
  let showError: ReturnType<typeof vi.fn>;
  let report: ReturnType<typeof vi.fn>;
  let handler: AppErrorHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    showError = vi.fn();
    report = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        AppErrorHandler,
        { provide: NotificationService, useValue: { showError } },
        { provide: ErrorReporter, useValue: { report } },
      ],
    });
    handler = TestBed.inject(AppErrorHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('tells the person once about a burst of the same fault', () => {
    handler.handleError(new TypeError('x is undefined'));
    handler.handleError(new TypeError('x is undefined'));
    expect(showError).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(6_000);
    handler.handleError(new TypeError('x is undefined'));
    expect(showError).toHaveBeenCalledTimes(2);
  });

  it('leaves failed requests to the interceptor', () => {
    handler.handleError(new HttpErrorResponse({ status: 500 }));
    handler.handleError({ rejection: new HttpErrorResponse({ status: 500 }) });

    expect(showError).not.toHaveBeenCalled();
  });

  it('always logs', () => {
    handler.handleError(new Error('boom'));

    expect(console.error).toHaveBeenCalled();
  });

  it('reports what nobody caught, but not failed requests, which the server has', () => {
    const fault = new TypeError('x is undefined');
    handler.handleError(fault);
    handler.handleError(new HttpErrorResponse({ status: 500 }));

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(fault);
  });
});
