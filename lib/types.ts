export type Place = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};
export type Attachment = {
  id: string;
  name: string;
  width: number;
  height: number;
  mime: string;
  size: number;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tripId?: string | null;
  memoryId?: string | null;
  source?: string;
  sourceAssetId?: string | null;
  sourcePeople?: string[];
};
export type TravelPhoto = Attachment & {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  tripId: string | null;
  memoryId: string | null;
  source: string;
  sourceAssetId: string | null;
  sourcePeople: string[];
};
export type HolidayPeriod = {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  color: string;
};
export type Trip = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  holidayPeriodId: string | null;
  placeId: string | null;
  place: Place | null;
  people: Person[];
};
export type TravelMode = 'car' | 'train' | 'flight' | 'bus' | 'bike' | 'walk' | 'ferry' | 'other';
export type TravelLeg = {
  id: string;
  tripId: string | null;
  holidayPeriodId: string | null;
  fromPlaceId: string;
  toPlaceId: string;
  fromPlace: Place;
  toPlace: Place;
  departureAt: string;
  mode: TravelMode;
  distanceKm: number;
  distanceSource: 'airline' | 'manual';
  notes: string;
};
export type Person = {
  id: string;
  name: string;
  aliases: string;
  birthday: string | null;
  tags: string[];
  importance: number;
  favorite: boolean;
  notes: string;
  metAt: string | null;
  endedAt: string | null;
  online: boolean;
  platform: string;
  contextUrl: string;
  contactDays: number;
  lastContact: string | null;
  avatarId: string | null;
  placeId: string | null;
  place: Place | null;
  _count?: { memories: number };
};
export type Memory = {
  id: string;
  title: string;
  content: string;
  startAt: string;
  endAt: string | null;
  type: string;
  mood: string;
  privacy: string;
  favorite: boolean;
  pinned: boolean;
  draft: boolean;
  revision: number;
  placeId: string | null;
  tripId: string | null;
  place: Place | null;
  people: Person[];
  attachments: Attachment[];
};
export type Anticipation = { id: string; title: string; date: string; note: string };
export type AppData = {
  owner: { id: string; name: string; email: string };
  people: Person[];
  memories: Memory[];
  places: Place[];
  holidayPeriods: HolidayPeriod[];
  trips: Trip[];
  travelLegs: TravelLeg[];
  travelPhotos: TravelPhoto[];
  anticipations: Anticipation[];
  savedViews: { id: string; name: string; query: string }[];
  settings: {
    birthday: string | null;
    privacyRadius: number;
    mapEnabled: boolean;
    lastBackupAt: string | null;
    homePlaceId: string | null;
    detectionMinDays: number;
    detectionRadiusKm: number;
  };
};
export type View =
  | "dashboard"
  | "people"
  | "memories"
  | "map"
  | "timeline"
  | "favorites"
  | "travel"
  | "settings";
export const tags = [
  "Freundschaft",
  "Enger Freund",
  "Familie",
  "Beziehung",
  "Love Interest",
  "Bekanntschaft",
  "Begegnung",
];
export const memoryTypes = [
  "Treffen",
  "Reise",
  "Notiz",
  "Call",
  "Event",
  "Sonstiges",
];
export const moods = [
  "Glücklich",
  "Dankbar",
  "Entspannt",
  "Aufgeregt",
  "Nachdenklich",
  "Traurig",
];
