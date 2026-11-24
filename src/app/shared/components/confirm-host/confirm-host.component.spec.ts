import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ConfirmHostComponent } from './confirm-host.component';

function buttons(): HTMLButtonElement[] {
  // The dialog is appended to the body, outside the host element.
  return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.confirm__btn'));
}

describe('ConfirmHostComponent', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  async function show(danger = false) {
    const fixture = TestBed.createComponent(ConfirmHostComponent);
    const confirm = TestBed.inject(ConfirmService);
    const answer = confirm.ask({
      header: 'Remove candidate',
      message: 'Remove Omar from the pipeline?',
      acceptLabel: 'Remove candidate',
      danger,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, answer };
  }

  it('shows the question with the safe button first', async () => {
    await show(true);

    expect(document.body.textContent).toContain('Remove Omar from the pipeline?');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Keep it', 'Remove candidate']);
    expect(buttons()[1].classList).toContain('confirm__btn--danger');
  });

  it('answers no from the safe button and yes from the other', async () => {
    const first = await show();
    buttons()[0].click();
    await expect(first.answer).resolves.toBe(false);

    document.body.innerHTML = '';
    const second = await show();
    buttons()[1].click();
    await expect(second.answer).resolves.toBe(true);
  });
});
