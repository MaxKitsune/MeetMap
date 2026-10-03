// Run only against the dedicated local meetmap_test instance started by test:serve.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root = 'http://localhost:3001';
const credentials = JSON.parse(fs.readFileSync('work/test-credentials.json', 'utf8'));
let cookie = '';
async function call(path, method = 'GET', body, authenticated = true) {
  return fetch(`${root}/api/${path}`, {
    method,
    headers: { ...(method === 'GET' ? {} : { Origin: root, 'Content-Type': 'application/json' }), ...(authenticated ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function ok(path, method = 'GET', body, status = 200) {
  const response = await call(path, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
async function uploadImage() {
  const form = new FormData();
  const bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#608878' } }).png().toBuffer();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'travel-invariant.png');
  const response = await fetch(`${root}/api/upload`, { method: 'POST', headers: { Origin: root, Cookie: cookie }, body: form });
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}
for (const path of ['trips', 'holiday-periods', 'travel-legs']) assert.equal((await call(path, 'GET', undefined, false)).status, 401);
const login = await call('auth/login', 'POST', credentials);
assert.equal(login.status, 200, await login.clone().text());
cookie = login.headers.get('set-cookie').split(';')[0];
const stamp = Date.now().toString(36);
const [home, away] = await Promise.all([
  ok('places', 'POST', { name: `Travel QA Munich ${stamp}`, latitude: 48.137, longitude: 11.576 }, 201),
  ok('places', 'POST', { name: `Travel QA Berlin ${stamp}`, latitude: 52.52, longitude: 13.405 }, 201),
]);
const dates = { startAt: '2030-07-01', endAt: '2030-07-31' };
assert.equal((await call('trips', 'POST', { title: 'No calendar year zero', startAt: '0000-01-01', endAt: '0000-01-02' })).status, 400);
assert.equal((await call('holiday-periods', 'POST', { name: 'No calendar year zero', startAt: '0000-01-01', endAt: '0000-01-02' })).status, 400);
assert.equal((await call('memories', 'POST', { title: 'No calendar year zero', startAt: '0000-01-01' })).status, 400);
const holiday = await ok('holiday-periods', 'POST', { name: `QA Summer ${stamp}`, ...dates }, 201);
const holidayTwo = await ok('holiday-periods', 'POST', { name: `QA Other ${stamp}`, ...dates }, 201);
const tripInput = { title: `QA Trip ${stamp}`, startAt: '2030-07-05', endAt: '2030-07-10', holidayPeriodId: holiday.id, placeId: away.id };
assert.equal((await call('trips', 'POST', { ...tripInput, placeId: 'unavailable-place' })).status, 400);
assert.equal((await call('trips', 'POST', { ...tripInput, endAt: '2030-08-01' })).status, 400);
assert.equal((await call('trips', 'POST', { ...tripInput, personIds: ['unavailable-person'] })).status, 400);
const trip = await ok('trips', 'POST', tripInput, 201);
const legInput = { tripId: trip.id, fromPlaceId: home.id, toPlaceId: away.id, departureAt: '2030-07-07', mode: 'train', distanceSource: 'airline' };
assert.equal((await call('travel-legs', 'POST', { ...legInput, holidayPeriodId: holidayTwo.id })).status, 400);
assert.equal((await call('travel-legs', 'POST', { ...legInput, departureAt: '2030-07-11' })).status, 400);
const leg = await ok('travel-legs', 'POST', { ...legInput, distanceKm: 999999 }, 201);
assert(leg.distanceKm > 500 && leg.distanceKm < 510, 'Airline distance must be calculated by the server.');
assert.equal(leg.holidayPeriodId, holiday.id);
const manual = await ok(`travel-legs/${leg.id}`, 'PATCH', { distanceSource: 'manual', distanceKm: 585.4 });
assert.equal(manual.distanceKm, 585.4);
assert.equal(manual.mode, 'train', 'Partial PATCH must preserve other fields.');

const memoryInput = { title: `QA Memory ${stamp}`, startAt: '2030-07-10', tripId: trip.id };
assert.equal((await call('memories', 'POST', { ...memoryInput, startAt: '2030-07-11' })).status, 400);
let memory = await ok('memories', 'POST', memoryInput, 201);
assert.equal((await call(`trips/${trip.id}`, 'PATCH', { endAt: '2030-07-09' })).status, 400, 'Cannot exclude an attached memory.');
assert.equal((await call(`holiday-periods/${holiday.id}`, 'PATCH', { endAt: '2030-07-09' })).status, 400, 'Cannot exclude a child trip.');
const legacy = { title: memory.title, content: 'Updated from a legacy editor', startAt: '2030-07-10', revision: memory.revision };
memory = await ok(`memories/${memory.id}`, 'PATCH', legacy);
assert.equal(memory.tripId, trip.id, 'Omitted tripId must preserve the association.');
assert.equal((await call(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-11', revision: memory.revision })).status, 400);

// Memory and photo trip assignments must move together, including legacy uploads.
const photo = await uploadImage();
memory = await ok(`memories/${memory.id}`, 'PATCH', { ...legacy, revision: memory.revision, attachmentIds: [photo.id] });
assert.equal(memory.attachments[0].tripId, trip.id, 'A plain upload must inherit the memory trip.');
await ok(`travel-photos/${photo.id}`, 'PATCH', { capturedAt: '2030-07-10T23:59:59Z' });
memory = await ok(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, attachmentIds: [photo.id] });
assert.equal((await call(`trips/${trip.id}`, 'PATCH', { endAt: '2030-07-09' })).status, 400, 'A trip cannot exclude a photo while still containing its memory.');
const shortTrip = await ok('trips', 'POST', { ...tripInput, title: `QA Short ${stamp}`, endAt: '2030-07-09' }, 201);
assert.equal((await call(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, tripId: shortTrip.id, attachmentIds: [photo.id] })).status, 400, 'Moving a memory must validate every photo capture date.');
const independentPhoto = await uploadImage();
await ok(`travel-photos/${independentPhoto.id}`, 'PATCH', { tripId: shortTrip.id, capturedAt: '2030-07-09T12:00:00Z' });
assert.equal((await call(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, attachmentIds: [photo.id, independentPhoto.id] })).status, 409, 'Cannot silently steal a photo from another trip.');
await ok(`trips/${shortTrip.id}`, 'PATCH', { endAt: '2030-07-10' });
memory = await ok(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, tripId: shortTrip.id, attachmentIds: [photo.id] });
assert.equal(memory.attachments[0].tripId, shortTrip.id, 'Attached photos follow an explicit memory move.');
assert.equal((await call(`travel-photos/${photo.id}`, 'PATCH', { tripId: trip.id })).status, 409, 'Photo edits cannot disagree with their memory.');
memory = await ok(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, tripId: null, attachmentIds: [photo.id] });
assert.equal(memory.attachments[0].tripId, null, 'Removing a memory trip also clears its photo trip.');
memory = await ok(`memories/${memory.id}`, 'PATCH', { ...legacy, startAt: '2030-07-09', revision: memory.revision, tripId: trip.id, attachmentIds: [photo.id] });
await ok(`attachments/${independentPhoto.id}`, 'DELETE');
await ok(`trips/${shortTrip.id}`, 'DELETE');

await ok(`trips/${trip.id}`, 'PATCH', { holidayPeriodId: holidayTwo.id });
assert.equal((await ok(`travel-legs/${leg.id}`)).holidayPeriodId, holidayTwo.id);
const exported = await ok('export');
assert(exported.holidayPeriods.some(p => p.id === holidayTwo.id));
assert(exported.trips.some(t => t.id === trip.id));
assert(exported.travelLegs.some(l => l.id === leg.id));
assert(Array.isArray(exported.travelPhotos));
assert(exported.travelPhotos.every(photo => !('storageKey' in photo) && !('hash' in photo)));

await ok(`holiday-periods/${holidayTwo.id}`, 'DELETE');
assert.equal((await ok(`trips/${trip.id}`)).holidayPeriodId, null);
assert.equal((await ok(`travel-legs/${leg.id}`)).holidayPeriodId, null);
await ok(`trips/${trip.id}`, 'DELETE');
assert.equal((await ok(`travel-legs/${leg.id}`)).tripId, null);
assert.equal((await ok('memories')).find(m => m.id === memory.id).tripId, null);
assert.equal((await ok('memories')).find(m => m.id === memory.id).attachments[0].tripId, null);
await ok(`travel-legs/${leg.id}`, 'DELETE');
await ok(`holiday-periods/${holiday.id}`, 'DELETE');
await ok(`memories/${memory.id}`, 'DELETE');
console.log('PASS: travel ownership, calendar containment, partial updates, distances, export, memory/photo synchronization and preserving parent deletions');

// Race a parent shrink against a new child. The persisted state must stay valid
// regardless of which transaction wins; both contradictory writes cannot commit.
let serializationConflicts = 0;
function checkRace(responses, successCodes) {
  const codes = responses.map(r => r.status);
  assert(!codes.every((code, i) => code === successCodes[i]), `Conflicting writes both committed: ${codes}`);
  codes.forEach((code, i) => assert([successCodes[i], 400, 409].includes(code), `Unexpected concurrent result: ${codes}`));
  serializationConflicts += codes.filter(code => code === 409).length;
}
for (let iteration = 0; iteration < 3; iteration++) {
  const period = await ok('holiday-periods', 'POST', { name: `QA Race Period ${stamp}-${iteration}`, startAt: '2031-08-01', endAt: '2031-08-31' }, 201);
  let responses = await Promise.all([
    call(`holiday-periods/${period.id}`, 'PATCH', { endAt: '2031-08-05' }),
    call('trips', 'POST', { title: `QA Race Child ${stamp}`, holidayPeriodId: period.id, startAt: '2031-08-10', endAt: '2031-08-12' }),
  ]);
  checkRace(responses, [200, 201]);
  if (responses[1].status === 201) {
    const child = await responses[1].json(), persistedPeriod = await ok(`holiday-periods/${period.id}`);
    assert(child.endAt <= persistedPeriod.endAt);
    await ok(`trips/${child.id}`, 'DELETE');
  }
  await ok(`holiday-periods/${period.id}`, 'DELETE');

  const parent = await ok('trips', 'POST', { title: `QA Race Trip ${stamp}-${iteration}`, startAt: '2031-08-01', endAt: '2031-08-10' }, 201);
  responses = await Promise.all([
    call(`trips/${parent.id}`, 'PATCH', { endAt: '2031-08-05' }),
    call('memories', 'POST', { title: `QA Race Memory ${stamp}`, tripId: parent.id, startAt: '2031-08-09' }),
  ]);
  checkRace(responses, [200, 201]);
  if (responses[1].status === 201) {
    const child = await responses[1].json(), persistedTrip = await ok(`trips/${parent.id}`);
    assert(child.startAt <= persistedTrip.endAt);
    await ok(`memories/${child.id}`, 'DELETE');
  }
  await ok(`trips/${parent.id}`, 'DELETE');

  const photoParent = await ok('trips', 'POST', { title: `QA Race Photo Trip ${stamp}-${iteration}`, startAt: '2031-08-01', endAt: '2031-08-10' }, 201);
  const asset = await uploadImage();
  responses = await Promise.all([
    call(`trips/${photoParent.id}`, 'PATCH', { endAt: '2031-08-05' }),
    call(`travel-photos/${asset.id}`, 'PATCH', { tripId: photoParent.id, capturedAt: '2031-08-09T23:30:00Z' }),
  ]);
  checkRace(responses, [200, 200]);
  if (responses[1].status === 200) {
    const child = (await responses[1].json()).photo, persistedTrip = await ok(`trips/${photoParent.id}`);
    assert(child.capturedAt.slice(0, 10) <= persistedTrip.endAt.slice(0, 10));
  }
  await ok(`attachments/${asset.id}`, 'DELETE');
  await ok(`trips/${photoParent.id}`, 'DELETE');
}
console.log(`PASS: 9 concurrent parent/child races preserved date invariants (${serializationConflicts} serialization conflicts returned safely)`);
