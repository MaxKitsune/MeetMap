import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';
import { ApiError, jsonBody } from './security';
import { tripInclude, travelLegInclude } from './data';
import { holidayPeriodSchema, tripSchema, travelLegSchema, dateRangeProblem } from './travel-validation';
import { haversineKm, type TravelRange } from './travel';

type Tx = Prisma.TransactionClient;
const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const objectBody = z.record(z.string(), z.unknown());
const inRange = (parent: TravelRange, child: TravelRange, label: string) => {
  const problem = dateRangeProblem(parent, child, label);
  if (problem) throw new ApiError(400, problem);
};
const audit = (tx: Tx, ownerId: string, action: string, entityId: string) => tx.auditLog.create({ data: { ownerId, action, entityId } });
async function ownedHoliday(tx: Tx, ownerId: string, id: string) {
  const value = await tx.holidayPeriod.findFirst({ where: { id, ownerId } });
  if (!value) throw new ApiError(400, 'Der Ferienzeitraum ist nicht verfügbar.');
  return value;
}
async function ownedTrip(tx: Tx, ownerId: string, id: string) {
  const value = await tx.trip.findFirst({ where: { id, ownerId } });
  if (!value) throw new ApiError(400, 'Die zugeordnete Reise ist nicht verfügbar.');
  return value;
}
async function ownedPlace(tx: Tx, ownerId: string, id: string) {
  const value = await tx.place.findFirst({ where: { id, ownerId } });
  if (!value) throw new ApiError(400, 'Ein ausgewählter Ort ist nicht verfügbar.');
  return value;
}

/** Called inside the memory write transaction, including when legacy clients omit tripId. */
export async function validateMemoryTrip(tx: Tx, ownerId: string, input: { tripId?: string | null; startAt: Date; endAt?: Date | null }, memoryId?: string) {
  let tripId = input.tripId;
  let previousTripId: string | null = null;
  if (memoryId) {
    const existing = await tx.memory.findFirst({ where: { id: memoryId, ownerId }, select: { tripId: true } });
    if (!existing) throw new ApiError(404, 'Erinnerung nicht gefunden.');
    previousTripId = existing.tripId;
    if (tripId === undefined) tripId = existing.tripId;
  }
  const trip = tripId ? await ownedTrip(tx, ownerId, tripId) : null;
  if (trip) inRange(trip, input, 'Die Erinnerung');
  return { tripId: tripId ?? null, previousTripId, trip };
}

/** Keep a memory and its photos in the same trip, without stealing independent trip photos. */
export async function synchronizeMemoryPhotos(tx: Tx, ownerId: string, context: Awaited<ReturnType<typeof validateMemoryTrip>>, attachmentIds: string[], memoryId?: string) {
  const ids = [...new Set(attachmentIds)];
  if (!ids.length) return;
  const availability = { ownerId, id: { in: ids }, OR: [{ memoryId: null }, ...(memoryId ? [{ memoryId }] : [])] };
  const photos = await tx.attachment.findMany({ where: availability, select: { id: true, name: true, tripId: true, memoryId: true, capturedAt: true } });
  if (photos.length !== ids.length) throw new ApiError(400, 'Ein ausgewähltes Foto ist nicht verfügbar.');
  for (const photo of photos) {
    const followsExistingMemory = Boolean(memoryId && photo.memoryId === memoryId && photo.tripId === context.previousTripId);
    if (photo.tripId && photo.tripId !== context.tripId && !followsExistingMemory)
      throw new ApiError(409, `Das Foto „${photo.name}“ gehört bereits zu einer anderen Reise. Wähle dieselbe Reise für die Erinnerung oder löse zuerst die Fotozuordnung.`);
    if (context.trip && photo.capturedAt) inRange(context.trip, { startAt: photo.capturedAt }, `Das Foto „${photo.name}“`);
  }
  const updated = await tx.attachment.updateMany({ where: availability, data: { tripId: context.tripId } });
  if (updated.count !== ids.length) throw new ApiError(409, 'Ein Foto wurde gleichzeitig neu zugeordnet. Bitte lade die Erinnerung neu.');
}

async function checkTripChildren(tx: Tx, ownerId: string, id: string, range: { startAt: Date; endAt: Date }) {
  const [memory, leg, photo] = await Promise.all([
    tx.memory.findFirst({ where: { ownerId, tripId: id, OR: [{ startAt: { lt: range.startAt } }, { startAt: { gt: range.endAt } }, { endAt: { gt: range.endAt } }] }, select: { id: true } }),
    tx.travelLeg.findFirst({ where: { ownerId, tripId: id, OR: [{ departureAt: { lt: range.startAt } }, { departureAt: { gt: range.endAt } }] }, select: { id: true } }),
    tx.attachment.findFirst({ where: { ownerId, tripId: id, OR: [{ capturedAt: { lt: range.startAt } }, { capturedAt: { gte: new Date(range.endAt.getTime() + 86400000) } }] }, select: { id: true } }),
  ]);
  if (memory || leg || photo) throw new ApiError(400, 'Der neue Reisezeitraum würde zugeordnete Erinnerungen, Etappen oder Fotos ausschließen. Passe diese zuerst an oder löse ihre Zuordnung.');
}

/** Caller must authenticate and check mutation Origin before dispatching here. */
export async function handleTravelApi(request: Request, path: string[], ownerId: string): Promise<Response | null> {
  const [route, id] = path;
  if (!['holiday-periods', 'trips', 'travel-legs'].includes(route)) return null;
  if (path.length > 2) throw new ApiError(404, 'Diese Reiseseite wurde nicht gefunden.');
  const method = request.method;
  if (method === 'GET') {
    if (route === 'holiday-periods') {
      const result = id ? await db.holidayPeriod.findFirst({ where: { id, ownerId } }) : await db.holidayPeriod.findMany({ where: { ownerId }, orderBy: { startAt: 'desc' } });
      if (!result) throw new ApiError(404, 'Ferienzeitraum nicht gefunden.');
      return respond(result);
    }
    if (route === 'trips') {
      const result = id ? await db.trip.findFirst({ where: { id, ownerId }, include: tripInclude }) : await db.trip.findMany({ where: { ownerId }, include: tripInclude, orderBy: { startAt: 'desc' } });
      if (!result) throw new ApiError(404, 'Reise nicht gefunden.');
      return respond(result);
    }
    const result = id ? await db.travelLeg.findFirst({ where: { id, ownerId }, include: travelLegInclude }) : await db.travelLeg.findMany({ where: { ownerId }, include: travelLegInclude, orderBy: { departureAt: 'asc' } });
    if (!result) throw new ApiError(404, 'Etappe nicht gefunden.');
    return respond(result);
  }
  if (method === 'DELETE' && id) {
    await db.$transaction(async tx => {
      // SetNull relations retain trips, legs, memories and photos when a parent is removed.
      const result = route === 'holiday-periods' ? await tx.holidayPeriod.deleteMany({ where: { id, ownerId } })
        : route === 'trips' ? await tx.trip.deleteMany({ where: { id, ownerId } })
          : await tx.travelLeg.deleteMany({ where: { id, ownerId } });
      if (!result.count) throw new ApiError(404, 'Der Eintrag wurde nicht gefunden.');
      await audit(tx, ownerId, route === 'trips' ? 'TRIP_DELETED' : route === 'holiday-periods' ? 'HOLIDAY_PERIOD_DELETED' : 'TRAVEL_LEG_DELETED', id);
    }, { isolationLevel: 'Serializable' });
    return respond({ ok: true });
  }
  if (!((method === 'POST' && !id) || (method === 'PATCH' && id))) throw new ApiError(405, 'Diese Methode ist hier nicht verfügbar.');
  const raw = objectBody.parse(await jsonBody(request));
  const result = await db.$transaction(async tx => {
    if (route === 'holiday-periods') {
      const existing = id ? await tx.holidayPeriod.findFirst({ where: { id, ownerId } }) : null;
      if (id && !existing) throw new ApiError(404, 'Ferienzeitraum nicht gefunden.');
      const data = holidayPeriodSchema.parse({ ...existing, ...raw });
      if (id) {
        const [trip, leg] = await Promise.all([
          tx.trip.findFirst({ where: { ownerId, holidayPeriodId: id, OR: [{ startAt: { lt: data.startAt } }, { endAt: { gt: data.endAt } }] }, select: { id: true } }),
          tx.travelLeg.findFirst({ where: { ownerId, holidayPeriodId: id, OR: [{ departureAt: { lt: data.startAt } }, { departureAt: { gt: data.endAt } }] }, select: { id: true } }),
        ]);
        if (trip || leg) throw new ApiError(400, 'Der neue Ferienzeitraum würde zugeordnete Reisen oder Etappen ausschließen. Passe diese zuerst an.');
      }
      const value = id ? await tx.holidayPeriod.update({ where: { id, ownerId }, data }) : await tx.holidayPeriod.create({ data: { ...data, ownerId } });
      await audit(tx, ownerId, id ? 'HOLIDAY_PERIOD_UPDATED' : 'HOLIDAY_PERIOD_CREATED', value.id);
      return value;
    }
    if (route === 'trips') {
      const existing = id ? await tx.trip.findFirst({ where: { id, ownerId }, include: tripInclude }) : null;
      if (id && !existing) throw new ApiError(404, 'Reise nicht gefunden.');
      const { personIds, ...data } = tripSchema.parse({ ...existing, ...(existing ? { personIds: existing.people.map(p => p.id) } : {}), ...raw });
      if (data.holidayPeriodId) inRange(await ownedHoliday(tx, ownerId, data.holidayPeriodId), data, 'Die Reise');
      if (data.placeId) await ownedPlace(tx, ownerId, data.placeId);
      if (personIds.length !== await tx.person.count({ where: { ownerId, id: { in: personIds } } })) throw new ApiError(400, 'Eine ausgewählte Person ist nicht verfügbar.');
      if (id) await checkTripChildren(tx, ownerId, id, data);
      const value = id ? await tx.trip.update({ where: { id, ownerId }, data: { ...data, people: { set: personIds.map(id => ({ id })) } }, include: tripInclude })
        : await tx.trip.create({ data: { ...data, ownerId, people: { connect: personIds.map(id => ({ id })) } }, include: tripInclude });
      // Legs attached to a trip inherit that trip's holiday association.
      if (id && existing?.holidayPeriodId !== data.holidayPeriodId) await tx.travelLeg.updateMany({ where: { ownerId, tripId: id }, data: { holidayPeriodId: data.holidayPeriodId } });
      await audit(tx, ownerId, id ? 'TRIP_UPDATED' : 'TRIP_CREATED', value.id);
      return value;
    }
    const existing = id ? await tx.travelLeg.findFirst({ where: { id, ownerId } }) : null;
    if (id && !existing) throw new ApiError(404, 'Etappe nicht gefunden.');
    const data = travelLegSchema.parse({ ...existing, ...raw,
      ...(Object.prototype.hasOwnProperty.call(raw, 'tripId') && !Object.prototype.hasOwnProperty.call(raw, 'holidayPeriodId') ? { holidayPeriodId: null } : {}),
    });
    const [fromPlace, toPlace] = await Promise.all([ownedPlace(tx, ownerId, data.fromPlaceId), ownedPlace(tx, ownerId, data.toPlaceId)]);
    if (data.tripId) {
      const trip = await ownedTrip(tx, ownerId, data.tripId);
      inRange(trip, { startAt: data.departureAt }, 'Die Etappe');
      if (data.holidayPeriodId && data.holidayPeriodId !== trip.holidayPeriodId) throw new ApiError(400, 'Die Etappe muss zum selben Ferienzeitraum wie ihre Reise gehören.');
      data.holidayPeriodId = trip.holidayPeriodId;
    }
    if (data.holidayPeriodId) inRange(await ownedHoliday(tx, ownerId, data.holidayPeriodId), { startAt: data.departureAt }, 'Die Etappe');
    const values = { ...data, distanceKm: data.distanceSource === 'airline' ? haversineKm(fromPlace, toPlace) : data.distanceKm! };
    const value = id ? await tx.travelLeg.update({ where: { id, ownerId }, data: values, include: travelLegInclude }) : await tx.travelLeg.create({ data: { ...values, ownerId }, include: travelLegInclude });
    await audit(tx, ownerId, id ? 'TRAVEL_LEG_UPDATED' : 'TRAVEL_LEG_CREATED', value.id);
    return value;
  }, { isolationLevel: 'Serializable' });
  return respond(result, id ? 200 : 201);
}
