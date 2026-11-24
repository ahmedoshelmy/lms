import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { KpiService } from '../../core/services/kpi.service';
import { kpiRow } from '../../core/utils/kpi-test-data';
import { KpiOverrideDialogComponent } from './kpi-override-dialog.component';
import { KpiSettingsDialogComponent } from './kpi-settings-dialog.component';

/** The dialogs' submit, as their forms call it. */
const submit = (dialog: object) => (dialog as { submit(): void }).submit();

describe('KpiOverrideDialogComponent', () => {
  function open() {
    const fixture = TestBed.createComponent(KpiOverrideDialogComponent);
    fixture.componentRef.setInput('target', { kpi: kpiRow(), indicator: 'reports' });
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    return { dialog: fixture.componentInstance, saved };
  }

  it('wants a real reason: spaces do not count', () => {
    const { dialog, saved } = open();
    dialog.form.setValue({ value: 90, reason: '            ' });

    submit(dialog);

    expect(saved).not.toHaveBeenCalled();
  });

  it('keeps the figure between 0 and 100, to one decimal', () => {
    const { dialog, saved } = open();
    dialog.form.setValue({ value: 120, reason: 'A proper reason here' });
    submit(dialog);
    expect(saved).not.toHaveBeenCalled();

    dialog.form.setValue({ value: 92.46, reason: '  A proper reason here  ' });
    submit(dialog);
    expect(saved).toHaveBeenCalledWith({ value: 92.5, reason: 'A proper reason here' });
  });
});

describe('KpiSettingsDialogComponent', () => {
  it('will not save weights that miss 100, or bands out of order', () => {
    const saveSettings = vi.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KpiService,
          useValue: {
            getSettings: () =>
              of({
                weights: { reports: 40, registers: 40, cancellations: 20 },
                bands: { excellent: 90, good: 75 },
                ownerEmail: null,
              }),
            saveSettings,
          },
        },
      ],
    });
    const dialog = TestBed.createComponent(KpiSettingsDialogComponent).componentInstance;

    dialog.form.controls.weights.setValue({ reports: 40, registers: 40, cancellations: 10 });
    submit(dialog);
    expect(saveSettings).not.toHaveBeenCalled();

    dialog.form.controls.weights.setValue({ reports: 50, registers: 30, cancellations: 20 });
    dialog.form.controls.bands.setValue({ excellent: 70, good: 80 });
    submit(dialog);
    expect(saveSettings).not.toHaveBeenCalled();

    dialog.form.controls.bands.setValue({ excellent: 90, good: 75 });
    submit(dialog);
    expect(saveSettings).toHaveBeenCalledWith({
      weights: { reports: 50, registers: 30, cancellations: 20 },
      bands: { excellent: 90, good: 75 },
      ownerEmail: null,
    });
  });
});
