export type TripDateRange = { id: string; title: string; startAt: Date; endAt: Date };
export const utcPhotoDay = (date: Date) => new Date(date.toISOString().slice(0, 10) + "T00:00:00Z");

export function matchingPhotoTrips<T extends TripDateRange>(capturedAt: Date | null, trips: T[]): T[] {
  if (!capturedAt) return [];
  const day = utcPhotoDay(capturedAt).getTime();
  return trips.filter((trip) => trip.startAt.getTime() <= day && trip.endAt.getTime() >= day);
}

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const p = (b.latitude - a.latitude) * rad;
  const l = (b.longitude - a.longitude) * rad;
  const h = Math.sin(p / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(l / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

type LocatedPhoto = { id: string; capturedAt: Date | null; latitude: number | null; longitude: number | null; tripId: string | null };
export function suggestPhotoTrips(photos: LocatedPhoto[], home: { latitude: number; longitude: number }, minDays = 2, homeRadiusKm = 50, clusterRadiusKm = 50) {
  type Point = LocatedPhoto & { capturedAt: Date; latitude: number; longitude: number };
  const ordered = photos.filter((p): p is Point => !p.tripId && p.capturedAt !== null && p.latitude !== null && p.longitude !== null)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime() || a.id.localeCompare(b.id));
  const groups: Point[][] = [];
  let current: Point[] = [];
  for (const photo of ordered) {
    // A photographed return home breaks a trip even if later photos are close.
    if (distanceKm(photo, home) <= homeRadiusKm) {
      if (current.length) groups.push(current);
      current = [];
      continue;
    }
    const last = current.at(-1);
    const gapDays = last ? (utcPhotoDay(photo.capturedAt).getTime() - utcPhotoDay(last.capturedAt).getTime()) / 86400000 : 0;
    // Compare with the first point too, preventing a chain from drifting
    // hundreds of kilometres while each adjacent pair remains close.
    if (last && (gapDays > 1 || distanceKm(current[0], photo) > clusterRadiusKm || distanceKm(last, photo) > clusterRadiusKm)) {
      groups.push(current);
      current = [];
    }
    current.push(photo);
  }
  if (current.length) groups.push(current);
  return groups.flatMap((group) => {
    const days = new Set(group.map(p => p.capturedAt.toISOString().slice(0, 10)));
    if (days.size < minDays) return [];
    const startAt = group[0].capturedAt.toISOString().slice(0, 10);
    const endAt = group[group.length - 1].capturedAt.toISOString().slice(0, 10);
    // A real photographed point avoids dateline errors from averaging longitude.
    const { latitude, longitude } = group[Math.floor(group.length / 2)];
    return [{
      title: `Reise vom ${startAt.split("-").reverse().join(".")}`,
      startAt, endAt, latitude, longitude, attachmentIds: group.map(p => p.id),
      evidence: { photoCount: group.length, uniqueDays: days.size, distanceFromHomeKm: Math.round(Math.min(...group.map(p => distanceKm(p, home)))), homeRadiusKm, clusterRadiusKm },
    }];
  });
}
