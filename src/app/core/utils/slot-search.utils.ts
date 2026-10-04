import { SlotSearch } from '../interfaces/Sales';

/**
 * The question the slot finder is asked, as a query string.
 *
 * Built apart from the call so it can be tested. A field that never makes it
 * into the query is invisible on the way out: the page shows the filter set,
 * the server never hears about it, and the answer looks like a broken search
 * rather than a question nobody asked. That is how the start time went
 * missing -- the one filter the sales desk uses most.
 */
export function slotSearchQuery(search: SlotSearch): string {
  const params: string[] = [];
  const add = (key: string, value: string | number | boolean): void => {
    params.push(`${key}=${encodeURIComponent(value)}`);
  };

  if (search.fromDate) add('fromDate', search.fromDate);
  if (search.weeks) add('weeks', search.weeks);
  if (search.instructorId) add('instructorId', search.instructorId);

  // Sunday is nought, so this one is asked about rather than tested for truth.
  if (search.dayOfWeek !== undefined && search.dayOfWeek !== null) {
    add('dayOfWeek', search.dayOfWeek);
  }

  if (search.roomId) add('roomId', search.roomId);

  if (search.maxBlockedWeeks !== undefined && search.maxBlockedWeeks !== null) {
    add('maxBlockedWeeks', search.maxBlockedWeeks);
  }

  if (search.startTime) add('startTime', search.startTime);
  if (search.allStartTimes) add('allStartTimes', true);

  return params.length ? `?${params.join('&')}` : '';
}
