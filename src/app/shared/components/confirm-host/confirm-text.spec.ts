import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ConfirmHostComponent } from './confirm-host.component';

describe('ConfirmHostComponent with a text box', () => {
  afterEach(() => (document.body.innerHTML = ''));

  async function open(required: boolean) {
    const fixture = TestBed.createComponent(ConfirmHostComponent);
    const answer = TestBed.inject(ConfirmService).askText({
      header: 'Release this slot',
      message: 'The hour goes back on the market.',
      acceptLabel: 'Release slot',
      input: { label: 'Why?', required },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const box = document.body.querySelector<HTMLTextAreaElement>('#confirm-input')!;
    const go = [...document.body.querySelectorAll<HTMLButtonElement>('.confirm__btn')].at(-1)!;
    return { fixture, answer, box, go };
  }

  it('returns what was typed', async () => {
    const { fixture, answer, box, go } = await open(false);
    box.value = '  The family chose Tuesday.  ';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    go.click();

    await expect(answer).resolves.toBe('The family chose Tuesday.');
  });

  it('keeps the go-ahead disabled until a required reason is typed', async () => {
    const { fixture, box, go } = await open(true);
    expect(go.disabled).toBe(true);

    box.value = 'Moving away';
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(go.disabled).toBe(false);
  });

  it('labels the text box for screen readers', async () => {
    const { box } = await open(false);

    expect(document.body.querySelector(`label[for="${box.id}"]`)?.textContent).toContain('Why?');
  });
});
