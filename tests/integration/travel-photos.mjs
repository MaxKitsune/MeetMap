import fs from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";

// Dedicated QA instance only. Creates and deletes only records from this run.
const base = "http://localhost:3001";
const credentials = JSON.parse(fs.readFileSync("work/test-credentials.json", "utf8"));
const prefix = `QA-PHOTO-${Date.now()}`;
let cookie = "";
const owned = { memories: [], attachments: [], trips: [], "holiday-periods": [], places: [] };
let settingsBefore;
async function call(route, method = "GET", body, options = {}) {
  return fetch(`${base}/api/${route}`, {
    method,
    headers: { ...(method !== "GET" ? { Origin: options.origin || base, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) } : {}), ...(options.auth === false ? {} : { Cookie: cookie }) },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}
async function json(response, status = 200) {
  const text = await response.text();
  assert.equal(response.status, status, text);
  return JSON.parse(text);
}
async function create(route, values) {
  const record = await json(await call(route, "POST", values), 201);
  owned[route].push(record.id);
  return record;
}
async function upload(bytes, fields = {}, status = 201) {
  const form = new FormData();
  form.append("files", new Blob([bytes], { type: "image/jpeg" }), `${prefix}-${owned.attachments.length}.jpg`);
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const result = await json(await call("travel-photos", "POST", form), status);
  owned.attachments.push(...result.photos.map(p => p.id));
  return result;
}

async function exifPhoto(date = "2037:08:10 00:30:00", offset = "+02:00") {
  const tiff = Buffer.alloc(197);
  tiff.write("II", 0); tiff.writeUInt16LE(42, 2); tiff.writeUInt32LE(8, 4);
  const entry = (at, tag, type, count, value) => { tiff.writeUInt16LE(tag, at); tiff.writeUInt16LE(type, at + 2); tiff.writeUInt32LE(count, at + 4); tiff.writeUInt32LE(value, at + 8); };
  tiff.writeUInt16LE(2, 8); entry(10, 0x8769, 4, 1, 38); entry(22, 0x8825, 4, 1, 68);
  tiff.writeUInt16LE(2, 38); entry(40, 0x9003, 2, 20, 122); entry(52, 0x9011, 2, 7, 142);
  tiff.writeUInt16LE(4, 68); entry(70, 1, 2, 2, 78); entry(82, 2, 5, 3, 149); entry(94, 3, 2, 2, 69); entry(106, 4, 5, 3, 173);
  tiff.write(date, 122); tiff.write(offset, 142);
  [46, 30, 0, 11, 18, 0].forEach((value, index) => { tiff.writeUInt32LE(value, 149 + index * 8); tiff.writeUInt32LE(1, 153 + index * 8); });
  const payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const marker = Buffer.alloc(4); marker.writeUInt16BE(0xffe1); marker.writeUInt16BE(payload.length + 2, 2);
  const image = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#bc593c" } }).jpeg().toBuffer();
  return Buffer.concat([image.subarray(0, 2), marker, payload, image.subarray(2)]);
}

try {
  for (const route of ["travel-photos", "travel-suggestions", "immich"]) assert.equal((await call(route, "GET", undefined, { auth: false })).status, 401, route);
  for (const [route, method] of [["travel-photos", "POST"], ["travel-photos/unknown", "PATCH"], ["immich", "POST"]]) {
    assert.equal((await call(route, method, {}, { auth: false })).status, 401, route);
    assert.equal((await call(route, method, {}, { origin: "https://attacker.invalid" })).status, 403, route);
  }
  console.log("PASS: new photo, suggestion and Immich routes enforce authentication and mutation Origin");
  const login = await call("auth/login", "POST", credentials);
  assert.equal(login.status, 200, "QA owner must be initialized before photo tests");
  cookie = login.headers.get("set-cookie").split(";")[0];
  const period = await create("holiday-periods", { name: prefix, startAt: "2037-08-01", endAt: "2037-08-31" });
  const trip = await create("trips", { title: `${prefix} unique`, startAt: "2037-08-09", endAt: "2037-08-12", holidayPeriodId: period.id });
  const first = await upload(await exifPhoto());
  const photo = first.photos[0];
  assert.equal(photo.tripId, trip.id);
  assert.equal(photo.capturedAt, "2037-08-09T22:30:00.000Z");
  assert.equal(photo.latitude, 46.5); assert.equal(photo.longitude, 11.3);
  assert.equal(photo.source, "travel-upload");
  assert(!JSON.stringify(first).includes("storageKey"));
  assert(!JSON.stringify(first).includes('"ownerId"'));
  for (const suffix of ["", "?thumb=1"]) {
    const response = await call(`attachments/${photo.id}${suffix}`);
    assert.equal(response.status, 200);
    const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(meta.format, "webp"); assert.equal(meta.exif, undefined);
  }
  const atEnd = await upload(await exifPhoto("2037:08:12 23:59:00", "+00:00"));
  assert.equal(atEnd.photos[0].tripId, trip.id);
  assert.equal((await json(await call(`travel-photos?tripId=${trip.id}`))).photos.filter(p => p.name.startsWith(prefix)).length, 2);
  assert.equal((await json(await call(`travel-photos?holidayPeriodId=${period.id}`))).photos.filter(p => p.name.startsWith(prefix)).length, 2);
  console.log("PASS: real EXIF timestamp/GPS, unique inclusive trip matching, safe DTO and private stripped images");
  const overlap = await create("trips", { title: `${prefix} overlap`, startAt: "2037-08-09", endAt: "2037-08-12" });
  const ambiguous = await upload(await exifPhoto());
  assert.equal(ambiguous.photos[0].tripId, null);
  assert.deepEqual(new Set(ambiguous.results[0].tripSuggestions.map(t => t.id)), new Set([trip.id, overlap.id]));
  console.log("PASS: overlapping trip matches remain unassigned with both suggestions");
  const plain = await sharp({ create: { width: 30, height: 20, channels: 3, background: "blue" } }).jpeg().toBuffer();
  const undated = await upload(plain);
  assert.equal(undated.photos[0].capturedAt, null);
  assert.equal(undated.photos[0].latitude, null);
  assert.equal(undated.photos[0].tripId, null);
  assert(undated.results[0].warnings.some(w => w.includes("Aufnahmedatum")));
  assert((await json(await call("travel-photos?unassigned=true"))).photos.some(p => p.id === undated.photos[0].id));
  const patched = await json(await call(`travel-photos/${undated.photos[0].id}`, "PATCH", { capturedAt: "2037-08-10", latitude: 46.5, longitude: 11.3, tripId: trip.id }));
  assert.equal(patched.photo.tripId, trip.id); assert.equal(patched.photo.latitude, 46.5);
  const wrong = await upload(await exifPhoto("2037:09:10 12:00:00", "+00:00"), { tripId: trip.id }, 422);
  assert.equal(wrong.photos.length, 0); assert.match(wrong.error, /außerhalb/);
  const forged = await upload(Buffer.from("<svg/>"), {}, 422);
  assert.match(forged.error, /JPEG/);
  console.log("PASS: missing metadata stays unknown, manual corrections work, invalid range/type retain actionable errors");
  const memory = await create("memories", { title: `${prefix} memory`, startAt: "2037-08-09", tripId: trip.id, attachmentIds: [photo.id] });
  const conflict = await json(await call(`travel-photos/${photo.id}`, "PATCH", { tripId: overlap.id }), 409);
  assert.match(conflict.error, /Erinnerung/);
  await json(await call(`travel-photos/${photo.id}`, "PATCH", { tripId: null }), 409);
  const snapshot = await json(await call("data"));
  assert.equal(snapshot.memories.find(m => m.id === memory.id).tripId, trip.id);
  assert.equal(snapshot.travelPhotos.find(p => p.id === photo.id).tripId, trip.id);
  console.log("PASS: photo reassignment cannot contradict its existing memory's trip");
  const home = await create("places", { name: `${prefix} home`, latitude: 0, longitude: 0 });
  const settings = await json(await call("settings"));
  settingsBefore = { homePlaceId: settings.homePlaceId, detectionMinDays: settings.detectionMinDays, detectionRadiusKm: settings.detectionRadiusKm };
  await json(await call("settings", "PATCH", { homePlaceId: home.id, detectionMinDays: 2, detectionRadiusKm: 50 }));
  const day1 = await upload(await exifPhoto("2038:02:03 10:00:00", "+00:00"));
  const sameDay = await upload(await exifPhoto("2038:02:03 17:00:00", "+00:00"));
  let suggestions = await json(await call("travel-suggestions"));
  assert(!suggestions.suggestions.some(s => s.attachmentIds.includes(day1.photos[0].id)));
  const day2 = await upload(await exifPhoto("2038:02:04 10:00:00", "+00:00"));
  const tripsBefore = (await json(await call("trips"))).length;
  suggestions = await json(await call("travel-suggestions"));
  const suggestion = suggestions.suggestions.find(s => s.attachmentIds.includes(day1.photos[0].id));
  assert(suggestion); assert.equal(suggestion.evidence.uniqueDays, 2);
  assert.deepEqual(new Set(suggestion.attachmentIds), new Set([day1.photos[0].id, sameDay.photos[0].id, day2.photos[0].id]));
  assert.equal((await json(await call("trips"))).length, tripsBefore);
  const accepted = await create("trips", { title: `${prefix} assigned`, startAt: "2038-02-03", endAt: "2038-02-04" });
  await json(await call(`travel-photos/${day2.photos[0].id}`, "PATCH", { tripId: accepted.id }));
  suggestions = await json(await call("travel-suggestions"));
  assert(!suggestions.suggestions.some(s => s.attachmentIds.includes(day1.photos[0].id)));
  console.log("PASS: trip suggestions require two distinct away days, exclude assigned photos and never auto-create trips");
} finally {
  if (settingsBefore) await json(await call("settings", "PATCH", settingsBefore));
  const cleanupErrors = [];
  for (const route of ["memories", "attachments", "trips", "holiday-periods", "places"]) {
    for (const id of owned[route].reverse()) {
      const response = await call(`${route}/${id}`, "DELETE");
      if (![200, 404].includes(response.status)) cleanupErrors.push(`${route}/${id}: ${response.status}`);
    }
  }
  assert.deepEqual(cleanupErrors, [], "QA record cleanup failed");
  console.log("PASS: own QA photo records removed and previous detection settings restored");
}
