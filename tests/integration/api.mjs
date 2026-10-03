import fs from "node:fs";
import assert from "node:assert/strict";
const root = "http://localhost:3001";
const creds = JSON.parse(fs.readFileSync("work/test-credentials.json"));
let cookie = "";
async function call(path, method = "GET", body, origin = root, auth = true) {
  return fetch(root + "/api/" + path, {
    method,
    headers: {
      ...(method !== "GET"
        ? { Origin: origin, "Content-Type": "application/json" }
        : {}),
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
for (const path of [
  "data",
  "people",
  "memories",
  "settings",
  "status",
  "search?q=test",
  "geocode?q=Berlin",
  "attachments/unknown",
  "export",
  "tiles/1/0/0",
]) {
  const r = await call(path);
  assert.equal(r.status, 401, path);
}
console.log("PASS: all private endpoints require authentication");
for (const path of [
  "auth/setup",
  "auth/login",
  "auth/logout",
  "people",
  "memories",
  "settings",
  "upload",
])
  assert.equal(
    (await call(path, "POST", {}, "https://attacker.invalid")).status,
    403,
    path,
  );
console.log("PASS: cross-origin mutations rejected");
let setup = await call("auth/setup", "POST", creds);
if (setup.status === 409) setup = await call("auth/login", "POST", creds);
assert.equal(setup.status, 200, await setup.text());
cookie = setup.headers.get("set-cookie").split(";")[0];
fs.writeFileSync("work/test-cookie.txt", cookie, { mode: 0o600 });
assert.equal((await call("auth/setup", "POST", creds)).status, 409);
console.log("PASS: setup, session creation, singleton owner");
let r = await call("demo", "POST", {});
if (r.status !== 409) assert.equal(r.status, 200, await r.text());
r = await call("data");
let d = await r.json();
assert(d.people.length >= 6);
assert(d.memories.length >= 3);
assert(d.places.length >= 5);
assert(d.people.some((person) => person.name === "Lena Fischer"));
const photoMemory = d.memories.find((memory) => memory.attachments.length > 0);
assert(photoMemory);
console.log("PASS: demo records persisted with private images");
assert.equal(
  (await call("attachments/" + photoMemory.attachments[0].id)).status,
  200,
);
assert.equal(
  (
    await call(
      "attachments/" + photoMemory.attachments[0].id,
      "GET",
      undefined,
      root,
      false,
    )
  ).status,
  401,
);
console.log("PASS: image read access is authenticated");
r = await call("memories", "POST", {
  title: "QA Erinnerung",
  content: "Browser und API Test",
  startAt: "2026-09-11",
  personIds: [d.people[0].id],
  placeId: d.places[0].id,
  draft: true,
});
assert.equal(r.status, 201, await r.clone().text());
let m = await r.json();
r = await call("memories/" + m.id, "PATCH", {
  title: m.title,
  content: "Geändert",
  startAt: "2026-09-11",
  personIds: [d.people[0].id],
  placeId: d.places[0].id,
  draft: false,
  revision: m.revision,
});
assert.equal(r.status, 200, await r.clone().text());
const updated = await r.json();
assert.equal(updated.revision, 1);
assert.equal(updated.draft, false);
assert.equal(
  (
    await call("memories/" + m.id, "PATCH", {
      title: m.title,
      startAt: "2026-09-11",
      revision: 0,
    })
  ).status,
  409,
);
console.log(
  "PASS: create/edit memory, publication and stale revision conflict",
);
assert.equal(
  (
    await call("people", "POST", {
      name: "Bad relationship",
      placeId: "not-owned",
    })
  ).status,
  400,
);
assert.equal(
  (
    await call("people", "POST", {
      name: "Invalid link",
      contextUrl: "javascript:alert(1)",
    })
  ).status,
  400,
);
console.log("PASS: invalid nested relation and unsafe URLs rejected");
assert.equal((await call("memories/" + m.id, "DELETE")).status, 200);
const exported = await (await call("export")).json();
assert(!JSON.stringify(exported).includes("passwordHash"));
assert(!JSON.stringify(exported).includes("storageKey"));
console.log("PASS: deletion and safe export DTO");
assert.equal((await call("readyz")).status, 200);
console.log("PASS: DB/storage readiness");
