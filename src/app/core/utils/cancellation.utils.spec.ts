import { describe, it, expect } from 'vitest';
import { cancellationNote } from './cancellation.utils';

/**
 * A cancelled class carries two separate things — whose doing it was, and what
 * happened — and the detail views show both. The cases that matter are the
 * ones where showing both would read badly or say nothing.
 */
describe('cancellationNote', () => {
  it('keeps the cause and the words apart', () => {
    expect(cancellationNote('Instructor', 'Salma is travelling on Friday')).toEqual({
      cause: 'Instructor',
      reason: 'Salma is travelling on Friday',
    });
  });

  it('calls a cancellation by the parents a family one', () => {
    expect(cancellationNote('Parents', 'Away for the week')?.cause).toBe('Family');
  });

  it('does not say holiday twice', () => {
    // A holiday writes its own reason, so the stored text is the cause again.
    expect(cancellationNote('Holiday', 'Holiday')).toEqual({ cause: 'Holiday', reason: null });
  });

  it('keeps what somebody wrote about a holiday that is not just the word', () => {
    expect(cancellationNote('Holiday', 'Eid, school closed')?.reason).toBe('Eid, school closed');
  });

  it('shows the words alone when no cause was recorded', () => {
    expect(cancellationNote(null, 'Cancelled by admin')).toEqual({
      cause: null,
      reason: 'Cancelled by admin',
    });
  });

  it('shows the cause alone when nobody wrote anything', () => {
    expect(cancellationNote('Instructor', '   ')).toEqual({ cause: 'Instructor', reason: null });
  });

  it('has nothing to show for a class cancelled before anybody was asked why', () => {
    expect(cancellationNote(null, null)).toBeNull();
    expect(cancellationNote(undefined, undefined)).toBeNull();
  });

  it('passes through a cause it does not recognise rather than hiding it', () => {
    expect(cancellationNote('Weather', 'Storm')?.cause).toBe('Weather');
  });
});
