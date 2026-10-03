/** Calendar arithmetic is deliberately UTC-based and shared by browser and server. */
export type TravelDate = string | Date;
export type TravelRange = { startAt: TravelDate; endAt?: TravelDate | null };
const DAY = 86_400_000;

export function utcDay(value: TravelDate): number {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Ungültiges Datum.');
  return Math.floor(date.getTime() / DAY);
}

export function inclusiveDays(startAt: TravelDate, endAt: TravelDate = startAt): number {
  return Math.max(0, utcDay(endAt) - utcDay(startAt) + 1);
}

export function rangeContains(parent: TravelRange, child: TravelRange): boolean {
  const start = utcDay(child.startAt), end = utcDay(child.endAt ?? child.startAt);
  return start <= end && start >= utcDay(parent.startAt) && end <= utcDay(parent.endAt ?? parent.startAt);
}

/** Inclusive union, optionally clipped to a calendar window. Overlaps count once. */
export function unionDays(ranges: readonly TravelRange[], within?: TravelRange): number {
  const lower = within ? utcDay(within.startAt) : -Infinity;
  const upper = within ? utcDay(within.endAt ?? within.startAt) : Infinity;
  const spans = ranges.map(r => [Math.max(lower, utcDay(r.startAt)), Math.min(upper, utcDay(r.endAt ?? r.startAt))])
    .filter(([start, end]) => end >= start).sort((a, b) => a[0] - b[0]);
  let days = 0, currentEnd = -Infinity;
  for (const [start, end] of spans) {
    days += Math.max(0, end - Math.max(start, currentEnd + 1) + 1);
    currentEnd = Math.max(currentEnd, end);
  }
  return days;
}

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (n: number) => n * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude), lng = radians(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lng / 2) ** 2;
  return Math.round(6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))) * 10) / 10;
}

type StatsTrip = TravelRange & { id: string; holidayPeriodId?: string | null };
type StatsLeg = { id: string; departureAt: TravelDate; distanceKm: number; tripId?: string | null; holidayPeriodId?: string | null };

export function travelStats(trips: readonly StatsTrip[], legs: readonly StatsLeg[] = [], within?: TravelRange) {
  const uniqueTrips = [...new Map(trips.map(t => [t.id, t])).values()].filter(t => !within || unionDays([t], within) > 0);
  const uniqueLegs = [...new Map(legs.map(l => [l.id, l])).values()].filter(l => !within || rangeContains(within, { startAt: l.departureAt }));
  return {
    daysAway: unionDays(uniqueTrips, within),
    distanceKm: Math.round(uniqueLegs.reduce((sum, l) => sum + (Number.isFinite(l.distanceKm) && l.distanceKm >= 0 ? l.distanceKm : 0), 0) * 10) / 10,
    tripCount: uniqueTrips.length,
    legCount: uniqueLegs.length,
  };
}

/** Only trips assigned to this period count as away; direct and trip-linked legs are deduplicated. */
export function holidayStats(period: TravelRange & { id: string }, trips: readonly StatsTrip[], legs: readonly StatsLeg[] = []) {
  const assigned = trips.filter(t => t.holidayPeriodId === period.id);
  const tripIds = new Set(assigned.map(t => t.id));
  const stats = travelStats(assigned, legs.filter(l => l.holidayPeriodId === period.id || (l.tripId != null && tripIds.has(l.tripId))), period);
  const periodDays = inclusiveDays(period.startAt, period.endAt ?? period.startAt);
  return {
    ...stats,
    periodDays,
    daysHome: Math.max(0, periodDays - stats.daysAway),
    awayPercent: periodDays ? Math.round(stats.daysAway / periodDays * 1000) / 10 : 0,
  };
}
