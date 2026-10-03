import { Prisma } from "@prisma/client";
import { db } from "./db";
export const attachmentSelect = {
  id: true,
  name: true,
  width: true,
  height: true,
  mime: true,
  size: true,
  capturedAt: true,
  latitude: true,
  longitude: true,
  tripId: true,
  memoryId: true,
  source: true,
  sourceAssetId: true,
  sourcePeople: true,
} as const;
export const tripInclude = { place: true, people: { include: { place: true } } } satisfies Prisma.TripInclude;
export const travelLegInclude = { fromPlace: true, toPlace: true } satisfies Prisma.TravelLegInclude;
export const anticipationSelect = { id: true, title: true, date: true, note: true } as const;
export const memoryInclude = {
  people: { include: { place: true } },
  place: true,
  attachments: { select: attachmentSelect },
} satisfies Prisma.MemoryInclude;
export async function appData(owner: {
  id: string;
  name: string;
  email: string;
}) {
  const [people, memories, places, savedViews, settings, holidayPeriods, trips, travelLegs, travelPhotos, anticipations] = await Promise.all([
    db.person.findMany({
      where: { ownerId: owner.id },
      include: { place: true, _count: { select: { memories: true } } },
      orderBy: { name: "asc" },
    }),
    db.memory.findMany({
      where: { ownerId: owner.id },
      include: memoryInclude,
      orderBy: [{ pinned: "desc" }, { startAt: "desc" }],
    }),
    db.place.findMany({
      where: { ownerId: owner.id },
      orderBy: { name: "asc" },
    }),
    db.savedView.findMany({ where: { ownerId: owner.id } }),
    db.appSettings.findUniqueOrThrow({ where: { ownerId: owner.id } }),
    db.holidayPeriod.findMany({ where: { ownerId: owner.id }, orderBy: { startAt: 'desc' } }),
    db.trip.findMany({ where: { ownerId: owner.id }, include: tripInclude, orderBy: { startAt: 'desc' } }),
    db.travelLeg.findMany({ where: { ownerId: owner.id }, include: travelLegInclude, orderBy: { departureAt: 'asc' } }),
    db.attachment.findMany({
      where: { ownerId: owner.id, OR: [{ capturedAt: { not: null } }, { latitude: { not: null } }, { longitude: { not: null } }, { tripId: { not: null } }, { source: { not: 'upload' } }, { sourcePeople: { isEmpty: false } }] },
      select: attachmentSelect,
      orderBy: [{ capturedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    db.anticipation.findMany({ where: { ownerId: owner.id }, select: anticipationSelect, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  return { owner, people, memories, places, savedViews, settings, holidayPeriods, trips, travelLegs, travelPhotos, anticipations };
}
export async function verifyRelations(
  tx: Prisma.TransactionClient,
  ownerId: string,
  values: {
    placeId?: string | null;
    avatarId?: string | null;
    personIds?: string[];
    attachmentIds?: string[];
  },
  memoryId?: string,
) {
  if (
    values.placeId &&
    !(await tx.place.findFirst({ where: { id: values.placeId, ownerId } }))
  )
    throw new Error("INVALID_RELATION");
  if (
    values.avatarId &&
    !(await tx.attachment.findFirst({
      where: { id: values.avatarId, ownerId },
    }))
  )
    throw new Error("INVALID_RELATION");
  const people = [...new Set(values.personIds || [])];
  if (
    people.length !==
    (await tx.person.count({ where: { id: { in: people }, ownerId } }))
  )
    throw new Error("INVALID_RELATION");
  const attachments = [...new Set(values.attachmentIds || [])];
  if (
    attachments.length !==
    (await tx.attachment.count({
      where: {
        id: { in: attachments },
        ownerId,
        OR: [{ memoryId: null }, ...(memoryId ? [{ memoryId }] : [])],
      },
    }))
  )
    throw new Error("INVALID_RELATION");
}
