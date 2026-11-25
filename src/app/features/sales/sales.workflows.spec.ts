import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toDayNumber } from '../../core/interfaces/Availability';
import { AvailableSlot, Candidate, SlotHold } from '../../core/interfaces/Sales';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { LmsService } from '../../core/services/lms.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalesComponent } from './sales.component';

const SLOT: AvailableSlot = {
  instructorId: 3,
  instructorName: 'Mona',
  dayOfWeek: 'Saturday',
  startTime: '10:00',
  endTime: '11:30',
  roomId: 4,
  roomName: 'Room 4',
  firstDate: '2026-12-05',
  weeksFree: 12,
  weeksChecked: 12,
  blockers: [],
};

/**
 * Sales' everyday jobs, ahead of splitting the component (F-09): holding an
 * hour, turning a hold into a group, and keeping the pipeline of families.
 */
describe('SalesComponent workflows', () => {
  let lms: Record<string, ReturnType<typeof vi.fn>>;
  let notify: Record<string, ReturnType<typeof vi.fn>>;
  let page: SalesComponent;

  beforeEach(() => {
    lms = {
      createSlotHold: vi.fn(() => of({})),
      convertSlotHold: vi.fn(() => of({})),
      createCandidate: vi.fn(() => of({})),
      updateCandidate: vi.fn(() => of({})),
    };
    notify = { showSuccess: vi.fn(), showError: vi.fn(), showWarn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: LmsService, useValue: lms },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: { hasRole: () => false, getUserId: () => 1 } },
        { provide: ConfirmService, useValue: { ask: vi.fn(), askText: vi.fn() } },
      ],
    });
    page = TestBed.createComponent(SalesComponent).componentInstance;
    // The reloads after each change are not under test.
    page.loadHolds = () => undefined;
    page.loadCandidates = () => undefined;
    page.runSearch = () => undefined;
  });

  describe('holding an hour', () => {
    beforeEach(() => {
      page.openHoldDialog(SLOT);
      page.holdForm.set({ ...page.holdForm(), topicId: 2, courseLevelId: 7, notes: '  ' });
    });

    it('holds the hour found, for the course chosen', () => {
      page.submitHold();

      expect(lms['createSlotHold']).toHaveBeenCalledWith(
        expect.objectContaining({
          instructorId: 3,
          topicId: 2,
          courseLevelId: 7,
          roomId: 4,
          proposedStartDate: '2026-12-05',
          schedules: [{ dayOfWeek: toDayNumber('Saturday'), startTime: '10:00', endTime: '11:30' }],
          notes: null,
        })
      );
      expect(page.showHoldDialog()).toBe(false);
      expect(page.tab()).toBe('holds');
    });

    it('keeps the dialog open on a full room, with the reason, to decide on', () => {
      lms['createSlotHold'].mockReturnValue(
        throwError(() => ({ status: 409, error: { message: 'Room 4 seats 6 and has 6.' } }))
      );

      page.submitHold();

      expect(page.showHoldDialog()).toBe(true);
      expect(page.roomFullMessage()).toBe('Room 4 seats 6 and has 6.');
    });

    it('needs a course before it holds anything', () => {
      page.holdForm.set({ ...page.holdForm(), topicId: 0 });
      page.submitHold();
      expect(lms['createSlotHold']).not.toHaveBeenCalled();
    });
  });

  describe('turning a hold into a group', () => {
    const HOLD = { id: 9, courseLevelId: null } as unknown as SlotHold;

    it('asks for a level when the hold never settled one', () => {
      page.openConvertDialog(HOLD);
      page.submitConvert();

      expect(lms['convertSlotHold']).not.toHaveBeenCalled();
      expect(notify['showError']).toHaveBeenCalled();
    });

    it('sends the name and level, leaving out what was left blank', () => {
      page.openConvertDialog(HOLD);
      page.convertForm.set({ groupName: '  ', courseLevelId: 7, note: ' Sat morning ' });

      page.submitConvert();

      expect(lms['convertSlotHold']).toHaveBeenCalledWith(9, {
        groupName: null,
        courseLevelId: 7,
        note: 'Sat morning',
      });
    });
  });

  describe('the pipeline', () => {
    it('adds a family to a hold, with blanks sent as nothing', () => {
      page.openCandidateDialog(undefined, 9);
      page.candidateForm.set({ ...page.candidateForm(), name: ' Yara ', phone: ' 0100 ' });

      page.submitCandidate();

      expect(lms['createCandidate']).toHaveBeenCalledWith({
        name: 'Yara',
        parentName: null,
        phone: '0100',
        email: null,
        source: null,
        notes: null,
        slotHoldId: 9,
        status: 'New',
      });
    });

    it('wants a name of two letters or more', () => {
      page.openCandidateDialog();
      page.candidateForm.set({ ...page.candidateForm(), name: 'Y' });
      page.submitCandidate();
      expect(lms['createCandidate']).not.toHaveBeenCalled();
    });

    it('edits the one opened rather than adding another', () => {
      page.openCandidateDialog({ id: 12, name: 'Yara', status: 'Contacted' } as Candidate);
      page.submitCandidate();

      expect(lms['createCandidate']).not.toHaveBeenCalled();
      expect(lms['updateCandidate']).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ name: 'Yara', status: 'Contacted' })
      );
    });
  });
});
