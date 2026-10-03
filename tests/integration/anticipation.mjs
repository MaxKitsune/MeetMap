// Integration fixtures are restricted to the isolated localhost meetmap_test DB.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
process.loadEnvFile('.env');
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.pathname = '/meetmap_test';
assert(['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname));
assert.equal(databaseUrl.pathname, '/meetmap_test');
const db = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });
const root = 'http://localhost:3001';
const credentials = JSON.parse(fs.readFileSync('work/test-credentials.json', 'utf8'));
let cookie = '', foreignOwnerId = null;
const ownIds = new Set();
async function call(path, method = 'GET', body, auth = true, origin = root) {
  return fetch(`${root}/api/${path}`, {
    method,
    headers: { ...(auth ? { Cookie: cookie } : {}), ...(method === 'GET' ? {} : { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function ok(path, method = 'GET', body, status = 200) {
  const response = await call(path, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
try {
  assert.equal((await call('anticipations', 'GET', undefined, false)).status, 401);
  assert.equal((await call('anticipations/unknown', 'GET', undefined, false)).status, 401);
  assert.equal((await call('anticipations', 'POST', {}, false)).status, 401);
  assert.equal((await call('anticipations', 'POST', {}, false, 'https://foreign.invalid')).status, 403);
  const login = await call('auth/login', 'POST', credentials);
  assert.equal(login.status, 200, await login.clone().text());
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('anticipations', 'POST', {}, true, '')).status, 403);

  const stamp = crypto.randomBytes(8).toString('hex');
  const foreign = await db.user.create({ data: { singleton: 'qa-anticipation-' + stamp, name: 'QA foreign owner', email: `qa-anticipation-${stamp}@test.invalid`, passwordHash: 'test-fixture-login-disabled', anticipations: { create: { title: 'Foreign private target', date: new Date('2030-01-01T00:00:00Z'), note: 'Must not leak' } } }, include: { anticipations: true } });
  foreignOwnerId = foreign.id;
  const forbiddenId = foreign.anticipations[0].id;
  assert.equal((await call(`anticipations/${forbiddenId}`)).status, 404);
  assert.equal((await call(`anticipations/${forbiddenId}`, 'PATCH', { title: 'Hijacked' })).status, 404);
  assert.equal((await call(`anticipations/${forbiddenId}`, 'DELETE')).status, 404);
  assert.equal((await db.anticipation.findUniqueOrThrow({ where: { id: forbiddenId } })).title, 'Foreign private target');

  assert.equal((await call('anticipations', 'POST', { title: 'Impossible', date: '2030-02-30' })).status, 400);
  assert.equal((await call('anticipations', 'POST', { title: 'No calendar year zero', date: '0000-01-01' })).status, 400);
  assert.equal((await call('anticipations', 'POST', { title: 'x'.repeat(121), date: '2030-01-01' })).status, 400);
  assert.equal((await call('anticipations', 'POST', { title: 'Too long note', date: '2030-01-01', note: 'x'.repeat(2001) })).status, 400);
  let own = await ok('anticipations', 'POST', { title: `QA Countdown ${stamp}`, date: '2030-07-15', note: 'A personal future moment', ownerId: foreign.id }, 201);
  ownIds.add(own.id);
  assert.deepEqual(Object.keys(own).sort(), ['date', 'id', 'note', 'title']);
  assert.notEqual((await db.anticipation.findUniqueOrThrow({ where: { id: own.id } })).ownerId, foreign.id);
  own = await ok(`anticipations/${own.id}`, 'PATCH', { title: 'Updated personal moment', ownerId: foreign.id });
  assert.equal(own.note, 'A personal future moment');
  assert.equal(own.date, '2030-07-15T00:00:00.000Z');
  own = await ok(`anticipations/${own.id}`, 'PATCH', { date: '2024-02-29' });
  assert.equal(own.title, 'Updated personal moment');
  const list = await ok('anticipations');
  assert(list.some(row => row.id === own.id), 'Past dates remain available for history.');
  assert(!list.some(row => row.id === forbiddenId), 'The collection is owner-scoped.');
  const data = await ok('data'), exported = await ok('export');
  assert(data.anticipations.some(row => row.id === own.id));
  assert(exported.anticipations.some(row => row.id === own.id));
  assert(!exported.anticipations.some(row => row.id === forbiddenId));
  await ok(`anticipations/${own.id}`, 'DELETE');
  ownIds.delete(own.id);
  assert.equal((await call(`anticipations/${own.id}`)).status, 404);
  console.log('PASS: Anticipation auth/origin, genuine cross-owner isolation, real calendar dates, limits, partial updates, history, AppData/export and deletion');
} finally {
  for (const id of ownIds) await db.anticipation.deleteMany({ where: { id } });
  if (foreignOwnerId) await db.user.deleteMany({ where: { id: foreignOwnerId } });
  await db.$disconnect();
}
