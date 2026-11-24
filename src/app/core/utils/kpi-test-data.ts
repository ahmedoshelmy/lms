import { InstructorKpi, KpiMonth } from '../interfaces/InstructorKpi';

/** Test data for the KPI specs: one instructor's month, adjustable per test. */
export function kpiRow(overrides: Partial<InstructorKpi> = {}): InstructorKpi {
  return {
    instructorId: 7,
    instructorName: 'Mona Adel',
    month: '2026-11',
    reports: {
      calculated: 80,
      override: null,
      value: 80,
      detail: { due: 10, onTime: 8, late: 1, missing: 1 },
    },
    registers: {
      calculated: 95,
      override: null,
      value: 95,
      detail: { taught: 20, onTime: 19, late: 1, recordedByAdmin: 0, never: 0 },
    },
    cancellations: {
      calculated: 100,
      override: null,
      value: 100,
      detail: { assigned: 20, cancelledByThem: 0 },
    },
    overall: 90,
    band: 'Excellent',
    ...overrides,
  };
}

export function kpiMonth(overrides: Partial<KpiMonth> = {}): KpiMonth {
  return {
    month: '2026-11',
    status: 'Open',
    settings: {
      weights: { reports: 40, registers: 40, cancellations: 20 },
      bands: { excellent: 90, good: 75 },
      ownerEmail: 'owner@example.test',
    },
    events: [],
    instructors: [kpiRow()],
    ...overrides,
  };
}
