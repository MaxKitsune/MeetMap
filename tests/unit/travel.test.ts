import { describe, expect, it } from 'vitest';
import { inclusiveDays, unionDays, rangeContains, haversineKm, travelStats, holidayStats, utcDay } from '../../lib/travel';
import { holidayPeriodSchema, tripSchema, travelLegSchema, dateRangeProblem } from '../../lib/travel-validation';
import { memorySchema, settingsSchema } from '../../lib/validation';

describe('travel calendar arithmetic', () => {
  it('counts both boundaries, leap days and year changes', () => {
    expect(inclusiveDays('2024-02-28', '2024-03-01')).toBe(3);
    expect(inclusiveDays('2026-12-31', '2027-01-01')).toBe(2);
    expect(inclusiveDays('2026-09-12')).toBe(1);
    expect(inclusiveDays('2026-09-13', '2026-09-12')).toBe(0);
  });
  it('uses UTC days even around daylight saving changes and offset timestamps', () => {
    expect(inclusiveDays('2026-03-28', '2026-03-30')).toBe(3);
    expect(utcDay('2026-09-12T23:30:00-02:00')).toBe(utcDay('2026-09-13'));
    expect(() => utcDay('not-a-date')).toThrow(RangeError);
  });
  it('unions overlapping, identical and adjacent trips without double counting', () => {
    const ranges = [
      { startAt: '2026-07-05', endAt: '2026-07-10' },
      { startAt: '2026-07-01', endAt: '2026-07-06' },
      { startAt: '2026-07-01', endAt: '2026-07-06' },
      { startAt: '2026-07-11', endAt: '2026-07-11' },
    ];
    expect(unionDays(ranges)).toBe(11);
    expect(unionDays(ranges, { startAt: '2026-07-04', endAt: '2026-07-08' })).toBe(5);
    expect(unionDays(ranges, { startAt: '2026-08-01', endAt: '2026-08-31' })).toBe(0);
    expect(unionDays([])).toBe(0);
  });
  it('accepts the last-day photo and refuses a next-day child', () => {
    const parent = { startAt: '2026-07-01', endAt: '2026-07-10' };
    expect(rangeContains(parent, { startAt: '2026-07-10T23:59:59Z' })).toBe(true);
    expect(rangeContains(parent, { startAt: '2026-07-11T00:00:00Z' })).toBe(false);
    expect(dateRangeProblem(parent, { startAt: '2026-06-30' }, 'Die Erinnerung')).toContain('Die Erinnerung');
    expect(dateRangeProblem(parent, { startAt: '2026-07-03', endAt: '2026-07-02' })).not.toBeNull();
  });
});

describe('travel statistics', () => {
  const period = { id: 'summer', startAt: '2026-07-01', endAt: '2026-07-10' };
  const trips = [
    { id: 'one', holidayPeriodId: 'summer', startAt: '2026-07-02', endAt: '2026-07-05' },
    { id: 'two', holidayPeriodId: 'summer', startAt: '2026-07-04', endAt: '2026-07-07' },
    { id: 'other', holidayPeriodId: 'winter', startAt: '2026-07-01', endAt: '2026-07-10' },
  ];
  const leg = { id: 'leg', tripId: 'one', holidayPeriodId: 'summer', departureAt: '2026-07-02', distanceKm: 150.5 };
  it('computes holiday away percentage from the assigned trip union', () => {
    expect(holidayStats(period, trips, [leg, leg])).toEqual({ periodDays: 10, daysAway: 6, daysHome: 4, awayPercent: 60, tripCount: 2, legCount: 1, distanceKm: 150.5 });
  });
  it('deduplicates distance by leg id, never by matching endpoints or amounts', () => {
    expect(travelStats([], [leg, leg, { ...leg, id: 'return' }]).distanceKm).toBe(301);
  });
  it('clips a year-filtered overview and excludes out-of-window legs', () => {
    const result = travelStats([{ id: 'cross-year', startAt: '2026-12-30', endAt: '2027-01-03' }], [leg], { startAt: '2027-01-01', endAt: '2027-12-31' });
    expect(result).toEqual({ daysAway: 3, distanceKm: 0, tripCount: 1, legCount: 0 });
  });
  it('handles holidays at home without NaN percentages', () => {
    expect(holidayStats(period, [], []).awayPercent).toBe(0);
    expect(holidayStats(period, [], []).daysHome).toBe(10);
  });
  it('estimates a geographic distance symmetrically and handles coincident points', () => {
    const munich = { latitude: 48.137, longitude: 11.576 }, berlin = { latitude: 52.52, longitude: 13.405 };
    expect(haversineKm(munich, berlin)).toBeGreaterThan(500);
    expect(haversineKm(munich, berlin)).toBeLessThan(510);
    expect(haversineKm(munich, berlin)).toBe(haversineKm(berlin, munich));
    expect(haversineKm(munich, munich)).toBe(0);
  });
});

describe('travel write validation', () => {
  const dates = { startAt: '2026-07-01', endAt: '2026-07-10' };
  it('rejects impossible dates, reversed periods and unsafe colors', () => {
    expect(holidayPeriodSchema.safeParse({ name: 'Summer', ...dates, startAt: '2026-02-30' }).success).toBe(false);
    expect(tripSchema.safeParse({ title: 'Trip', ...dates, endAt: '2026-06-30' }).success).toBe(false);
    expect(tripSchema.safeParse({ title: 'Trip', startAt: '0000-01-01', endAt: '0000-01-02' }).success).toBe(false);
    expect(memorySchema.safeParse({ title: 'Memory', startAt: '0000-01-01' }).success).toBe(false);
    expect(holidayPeriodSchema.safeParse({ name: 'Summer', ...dates, color: 'url(https://evil)' }).success).toBe(false);
  });
  it('requires manual distance and accepts only known transport modes', () => {
    const base = { fromPlaceId: 'a', toPlaceId: 'b', departureAt: dates.startAt };
    expect(travelLegSchema.safeParse({ ...base, distanceSource: 'manual' }).success).toBe(false);
    expect(travelLegSchema.safeParse({ ...base, distanceKm: -1, distanceSource: 'manual' }).success).toBe(false);
    expect(travelLegSchema.safeParse({ ...base, mode: 'teleport' }).success).toBe(false);
    expect(travelLegSchema.parse({ ...base, distanceSource: 'airline' }).distanceKm).toBeUndefined();
  });
  it('preserves absent travel keys from old memory/settings clients', () => {
    expect(memorySchema.parse({ title: 'Old editor', startAt: dates.startAt }).tripId).toBeUndefined();
    expect(memorySchema.parse({ title: 'Detach', startAt: dates.startAt, tripId: '' }).tripId).toBeNull();
    const settings = settingsSchema.parse({ birthday: null, privacyRadius: 0, mapEnabled: false });
    expect(settings.homePlaceId).toBeUndefined();
    expect(settings.detectionMinDays).toBeUndefined();
    expect(settings.detectionRadiusKm).toBeUndefined();
    const travelOnly = settingsSchema.parse({ homePlaceId: 'home', detectionMinDays: 2, detectionRadiusKm: 50 });
    expect(travelOnly.birthday).toBeUndefined();
    expect(travelOnly.privacyRadius).toBeUndefined();
    expect(travelOnly.mapEnabled).toBeUndefined();
  });
  it('strips forged ownership and deduplicates people before relation validation', () => {
    const trip = tripSchema.parse({ title: 'Trip', ...dates, ownerId: 'other-owner', personIds: ['one', 'one'] });
    expect(trip).not.toHaveProperty('ownerId');
    expect(trip.personIds).toEqual(['one']);
  });
});
