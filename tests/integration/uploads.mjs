import fs from "node:fs";
import assert from "node:assert/strict";
import sharp from "sharp";
const base = "http://localhost:3001";
const cookie = fs.readFileSync("work/test-cookie.txt", "utf8");
async function upload(blob, name) {
  const f = new FormData();
  f.append("file", blob, name);
  return fetch(base + "/api/upload", {
    method: "POST",
    headers: { Origin: base, Cookie: cookie },
    body: f,
  });
}
let r = await upload(
  new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/jpeg" }),
  "fake.jpg",
);
assert.equal(r.status, 415);
console.log("PASS: forged image MIME rejected");
r = await upload(
  new Blob([new Uint8Array(13 * 1024 * 1024 + 10)], { type: "image/jpeg" }),
  "huge.jpg",
);
assert.equal(r.status, 413);
console.log("PASS: oversized upload rejected");
const input = await sharp({
  create: { width: 240, height: 160, channels: 3, background: "#bc593c" },
})
  .jpeg()
  .withMetadata({ exif: { IFD0: { Artist: "TEST PRIVATE METADATA" } } })
  .toBuffer();
r = await upload(new Blob([input], { type: "image/jpeg" }), "test-exif.jpg");
assert.equal(r.status, 201, await r.clone().text());
const attachment = await r.json();
const bytes = await fetch(base + "/api/attachments/" + attachment.id, {
  headers: { Cookie: cookie },
}).then((r) => r.arrayBuffer());
const metadata = await sharp(Buffer.from(bytes)).metadata();
assert.equal(metadata.format, "webp");
assert.equal(metadata.exif, undefined);
assert.equal(metadata.width, 240);
console.log("PASS: EXIF stripped, image normalized and dimensions recorded");
r = await fetch(base + "/api/attachments/" + attachment.id + "?thumb=1", {
  headers: { Cookie: cookie },
});
assert.equal(r.status, 200);
await fetch(base + "/api/attachments/" + attachment.id, {
  method: "DELETE",
  headers: { Origin: base, Cookie: cookie },
});
console.log("PASS: authenticated thumbnail and cleanup");
