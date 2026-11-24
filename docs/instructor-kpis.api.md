# Instructor KPIs — API contract

The frontend for instructor KPIs is built against this contract. It stays switched off
(`features.instructorKpis` in `src/environments/`) until these endpoints exist. Nothing is
stored in the browser instead.

The server is the single source of every figure. It computes each indicator, the overall
score and the band. The screens only display them, so a PDF, the CSV and the page can
never disagree.

## Concepts

- **Month:** a calendar month, written `YYYY-MM`, in the school's time zone.
- **Indicators:** three per instructor per month, each a percentage from 0 to 100 with one
  decimal place, or `null` when there is nothing to measure.
  - **`reports`:** monthly reports submitted by the deadline.
  - **`registers`:** registers taken on time.
  - **`cancellations`:** classes not cancelled because of the instructor.
- **Override:** an admin may replace an indicator's value for one instructor and month. A
  reason is required. The calculated value is always kept and returned alongside.
- **Approval:** a month is `Open` until an admin approves it, after which its figures are
  frozen. An admin may reopen it, with a reason. Both actions are logged.
- **Phases** (shown by the frontend; the server enforces the adjusting and approval windows):
  - **Live:** from the 1st to the 28th.
  - **Review:** from the 29th to the last day. Overrides are allowed from here on, until the month is approved.
  - **Closed:** from the 1st of the next month. Approval becomes possible; the server
    refuses it any earlier.

## Calculation rules

All counts cover classes and reports whose date falls inside the month.

### `reports` — monthly reports submitted on time

- **`due`:** the monthly reports expected from this instructor for the month. That is one
  per student per group they taught that month. These are the rows `GET /evaluations`
  already returns for the month and instructor, excluding rows for students who left
  before the month began.
- **`onTime`:** of those, the ones submitted (`submittedAt`) on or before 23:59:59 on the
  last day of the month.
- **`late`:** submitted after that.
- **`missing`:** not submitted yet.
- **`calculated`:** `onTime / due × 100`. `null` when `due` is 0.

### `registers` — registers taken on time

These are the same figures as `GET /Attendance/compliance?from=…&to=…` for the month.

- **`taught`:** classes taught, cancellations excluded.
- **`onTime`:** registers taken within the 24-hour window.
- **`late`:** taken after the window.
- **`recordedByAdmin`:** of the late ones, those written by somebody else.
- **`never`:** still empty after the window closed.
- **`calculated`:** `onTime / taught × 100`. `null` when `taught` is 0.

### `cancellations` — classes kept

- **`assigned`:** classes on the instructor's timetable for the month, cancelled ones
  included.
- **`cancelledByThem`:** cancelled with the cause `Instructor`. Cancellations for
  `Parents` or `Holiday` do not count.
- **`calculated`:** `100 − cancelledByThem / assigned × 100`. `null` when `assigned` is 0.

### Overall and band

- **`value`** of an indicator: `override.value` when there is an override, otherwise
  `calculated`.
- **`overall`:** the weighted mean of the indicators whose `value` is not `null`. The
  weights are taken from the settings and re-scaled over the indicators that have a
  value. `null` when none has a value. Rounded to one decimal place.
- **`band`:**
  - `Excellent` when `overall ≥ settings.bands.excellent`;
  - `Good` when `overall ≥ settings.bands.good`;
  - `NeedsAttention` otherwise;
  - `null` when `overall` is `null`.

## Types

```ts
type KpiIndicatorKey = 'reports' | 'registers' | 'cancellations';
type KpiBand = 'Excellent' | 'Good' | 'NeedsAttention';

interface KpiSettings {
  weights: { reports: number; registers: number; cancellations: number }; // integers, sum 100
  bands: { excellent: number; good: number }; // 0–100, excellent > good
  ownerEmail: string | null; // where "Send to owner" goes
}

interface KpiOverride {
  value: number; // 0–100, one decimal
  reason: string; // at least 10 characters
  byName: string;
  at: string; // ISO date-time
}

interface KpiIndicator<TDetail> {
  calculated: number | null;
  override: KpiOverride | null;
  value: number | null; // override?.value ?? calculated
  detail: TDetail;
}

interface ReportsDetail {
  due: number;
  onTime: number;
  late: number;
  missing: number;
}
interface RegistersDetail {
  taught: number;
  onTime: number;
  late: number;
  recordedByAdmin: number;
  never: number;
}
interface CancellationsDetail {
  assigned: number;
  cancelledByThem: number;
}

interface InstructorKpi {
  instructorId: number;
  instructorName: string;
  month: string; // YYYY-MM
  reports: KpiIndicator<ReportsDetail>;
  registers: KpiIndicator<RegistersDetail>;
  cancellations: KpiIndicator<CancellationsDetail>;
  overall: number | null;
  band: KpiBand | null;
}

interface KpiMonthEvent {
  action: 'Approved' | 'Reopened';
  byName: string;
  at: string;
  reason: string | null; // required for Reopened
}

interface KpiMonth {
  month: string;
  status: 'Open' | 'Approved';
  settings: KpiSettings; // the settings in force; frozen with the month when approved
  events: KpiMonthEvent[]; // oldest first
  instructors: InstructorKpi[]; // every active instructor, by name
}

interface KpiHistoryPoint {
  month: string;
  status: 'Open' | 'Approved';
  reports: number | null; // values (override or calculated)
  registers: number | null;
  cancellations: number | null;
  overall: number | null;
  band: KpiBand | null;
}
```

## Endpoints

Unless noted, every endpoint is admin only.

| Method | Path                                                                    | Body                                               | Returns              | Errors                                                        |
| ------ | ----------------------------------------------------------------------- | -------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| GET    | `/kpis/months/{month}`                                                  | –                                                  | `KpiMonth`           | 400 bad month; 404 for a month in the future                  |
| PUT    | `/kpis/months/{month}/instructors/{instructorId}/overrides/{indicator}` | `{ value, reason }`                                | `InstructorKpi`      | 400 validation; 409 month approved or before the 29th         |
| DELETE | `/kpis/months/{month}/instructors/{instructorId}/overrides/{indicator}` | –                                                  | `InstructorKpi`      | 409 month approved or before the 29th                         |
| POST   | `/kpis/months/{month}/approve`                                          | –                                                  | `KpiMonth`           | 409 before the month has ended, or already approved           |
| POST   | `/kpis/months/{month}/reopen`                                           | `{ reason }`                                       | `KpiMonth`           | 400 no reason; 409 not approved                               |
| GET    | `/kpis/instructors/{instructorId}/history?from=YYYY-MM&to=YYYY-MM`      | –                                                  | `KpiHistoryPoint[]`  | 400 range over 24 months                                      |
| GET    | `/kpis/settings`                                                        | –                                                  | `KpiSettings`        | –                                                             |
| PUT    | `/kpis/settings`                                                        | `KpiSettings`                                      | `KpiSettings`        | 400 weights not summing to 100, bands out of order, bad email |
| POST   | `/kpis/months/{month}/send`                                             | multipart: `file` (PDF), `instructorId` (optional) | `{ sentTo: string }` | 409 no owner email set; 413 file over 5 MB                    |
| GET    | `/kpis/me?from=YYYY-MM&to=YYYY-MM`                                      | –                                                  | `InstructorKpi[]`    | **Instructor only.** Their own **approved** months only.      |

Notes for the server:

- **Settings changes** apply to open months only. An approved month keeps the settings it
  was approved with.
- **Approving** stores a snapshot of every `InstructorKpi` in the month, so later changes
  (a late report, a corrected register) do not change an approved month. Reopening
  recalculates from current data; existing overrides are kept.
- **`send`** emails the attached PDF to `settings.ownerEmail`. The subject should name the
  month, and the instructor when `instructorId` is given. It returns the address it was
  sent to, so the screen can confirm it.
- **Audit:** log each override, approval, reopening and send in the activity log, with
  who did it.
- **Optional:** on the 29th of each month, a notification to admins that the month's KPI
  review is open.
