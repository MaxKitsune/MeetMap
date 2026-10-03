import { z } from 'zod';
import { rangeContains, type TravelRange } from './travel';

export const travelDateSchema = z.preprocess(v => v instanceof Date ? v.toISOString().slice(0, 10) : v,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein Datum im Format JJJJ-MM-TT eingeben.')
    .refine(v => { const d = new Date(v); return Number(v.slice(0, 4)) >= 1 && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Das Datum ist ungültig.')
    .transform(v => new Date(`${v}T00:00:00.000Z`)));
export const travelIdSchema = z.string().trim().min(1).max(64);
const nullableId = z.union([travelIdSchema, z.literal(''), z.null()]).optional().transform(v => v || null);
const ordered = (v: { startAt: Date; endAt: Date }) => v.endAt >= v.startAt;
const orderMessage = { message: 'Das Enddatum darf nicht vor dem Startdatum liegen.', path: ['endAt'] };
export const holidayPeriodSchema = z.object({
  name: z.string().trim().min(1, 'Bitte benenne den Ferienzeitraum.').max(160),
  description: z.string().max(20000).default(''),
  startAt: travelDateSchema,
  endAt: travelDateSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Bitte eine gültige Farbe auswählen.').default('#6d8d81'),
}).refine(ordered, orderMessage);
export const tripSchema = z.object({
  title: z.string().trim().min(1, 'Bitte gib der Reise einen Titel.').max(160),
  description: z.string().max(20000).default(''),
  startAt: travelDateSchema,
  endAt: travelDateSchema,
  holidayPeriodId: nullableId,
  placeId: nullableId,
  personIds: z.array(travelIdSchema).max(100).default([]).transform(v => [...new Set(v)]),
}).refine(ordered, orderMessage);
export const travelModes = ['car', 'train', 'flight', 'bus', 'bike', 'walk', 'ferry', 'other'] as const;
export const travelLegSchema = z.object({
  tripId: nullableId,
  holidayPeriodId: nullableId,
  fromPlaceId: travelIdSchema,
  toPlaceId: travelIdSchema,
  departureAt: travelDateSchema,
  mode: z.enum(travelModes).default('car'),
  distanceKm: z.number().finite().min(0).max(1000000).optional(),
  distanceSource: z.enum(['airline', 'manual']).default('airline'),
  notes: z.string().max(20000).default(''),
}).refine(v => v.fromPlaceId !== v.toPlaceId, { message: 'Start und Ziel müssen verschiedene Orte sein.', path: ['toPlaceId'] })
  .refine(v => v.distanceSource !== 'manual' || v.distanceKm !== undefined, { message: 'Bitte gib die zurückgelegten Kilometer ein.', path: ['distanceKm'] });

export function dateRangeProblem(parent: TravelRange, child: TravelRange, label = 'Der Eintrag'): string | null {
  return rangeContains(parent, child) ? null : `${label} muss vollständig im zugeordneten Zeitraum liegen.`;
}
