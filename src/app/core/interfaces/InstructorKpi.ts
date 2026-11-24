/**
 * Instructor KPIs, as the server sends them. The contract, with the rules each
 * figure is worked out by, is docs/instructor-kpis.api.md.
 *
 * Every percentage is the server's: the screens, the PDF and the CSV only show
 * them, so they cannot disagree with one another.
 */

export type KpiIndicatorKey = 'reports' | 'registers' | 'cancellations';
export type KpiBand = 'Excellent' | 'Good' | 'NeedsAttention';
export type KpiMonthStatus = 'Open' | 'Approved';

export interface KpiWeights {
  reports: number;
  registers: number;
  cancellations: number;
}

export interface KpiSettings {
  /** Whole numbers adding up to 100. */
  weights: KpiWeights;
  /** Cut-offs for the bands, 0-100, excellent above good. */
  bands: { excellent: number; good: number };
  /** Where "Send to owner" goes. */
  ownerEmail: string | null;
}

export interface KpiOverride {
  value: number;
  reason: string;
  byName: string;
  at: string;
}

export interface KpiIndicator<TDetail> {
  /** What the system worked out; null when there was nothing to measure. */
  calculated: number | null;
  override: KpiOverride | null;
  /** The figure that counts: the override's, or else the calculated one. */
  value: number | null;
  detail: TDetail;
}

export interface ReportsDetail {
  due: number;
  onTime: number;
  late: number;
  missing: number;
}

export interface RegistersDetail {
  taught: number;
  onTime: number;
  late: number;
  recordedByAdmin: number;
  never: number;
}

export interface CancellationsDetail {
  assigned: number;
  cancelledByThem: number;
}

export interface InstructorKpi {
  instructorId: number;
  instructorName: string;
  /** YYYY-MM */
  month: string;
  reports: KpiIndicator<ReportsDetail>;
  registers: KpiIndicator<RegistersDetail>;
  cancellations: KpiIndicator<CancellationsDetail>;
  overall: number | null;
  band: KpiBand | null;
}

export interface KpiMonthEvent {
  action: 'Approved' | 'Reopened';
  byName: string;
  at: string;
  reason: string | null;
}

export interface KpiMonth {
  month: string;
  status: KpiMonthStatus;
  /** In force for the month; frozen with it once approved. */
  settings: KpiSettings;
  /** Oldest first. */
  events: KpiMonthEvent[];
  instructors: InstructorKpi[];
}

export interface KpiHistoryPoint {
  month: string;
  status: KpiMonthStatus;
  reports: number | null;
  registers: number | null;
  cancellations: number | null;
  overall: number | null;
  band: KpiBand | null;
}

/** The three indicators, in the order they are always shown. */
export const KPI_INDICATORS: { key: KpiIndicatorKey; label: string; short: string }[] = [
  { key: 'reports', label: 'Monthly reports on time', short: 'Reports' },
  { key: 'registers', label: 'Registers on time', short: 'Registers' },
  { key: 'cancellations', label: 'Classes kept', short: 'Kept' },
];

export const KPI_BAND_LABELS: Record<KpiBand, string> = {
  Excellent: 'Excellent',
  Good: 'Good',
  NeedsAttention: 'Needs attention',
};
