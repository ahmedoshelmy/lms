import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ConfirmService } from './confirm.service';

const QUESTION = { header: 'Remove', message: 'Remove it?', acceptLabel: 'Remove' };

describe('ConfirmService', () => {
  it('answers with what the person chose, and clears the question', async () => {
    const confirm = TestBed.inject(ConfirmService);

    const answer = confirm.ask(QUESTION);
    expect(confirm.pending()?.header).toBe('Remove');

    confirm.pending()!.answer(true);

    await expect(answer).resolves.toBe(true);
    expect(confirm.pending()).toBeNull();
  });

  it('treats a question replaced by another as a "no"', async () => {
    const confirm = TestBed.inject(ConfirmService);

    const first = confirm.ask(QUESTION);
    const second = confirm.ask({ ...QUESTION, header: 'Second' });

    await expect(first).resolves.toBe(false);
    expect(confirm.pending()?.header).toBe('Second');

    confirm.pending()!.answer(false);
    await expect(second).resolves.toBe(false);
  });
});
