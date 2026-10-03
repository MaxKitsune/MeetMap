import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadImmichPhoto, immichAssetPreview, immichConfig, immichStatus, searchImmichPhotos } from "../../lib/immich";
const id = "11111111-1111-4111-8111-111111111111";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server-side Immich import", () => {
  it("is disabled unless explicitly configured and never returns the key", async () => {
    vi.stubEnv("IMMICH_URL", ""); vi.stubEnv("IMMICH_API_KEY", "");
    expect(immichConfig()).toBeNull();
    expect(await immichStatus()).toMatchObject({ configured: false, connected: false });
  });
  it("accepts trusted internal origins and refuses credentials or query-based config", () => {
    vi.stubEnv("IMMICH_URL", "http://immich:2283/api/"); vi.stubEnv("IMMICH_API_KEY", "secret");
    expect(immichConfig()?.base.href).toBe("http://immich:2283/api/");
    vi.stubEnv("IMMICH_URL", "http://secret:password@example.com/");
    expect(() => immichConfig()).toThrow();
    vi.stubEnv("IMMICH_URL", "https://example.com/?redirect=http://internal");
    expect(() => immichConfig()).toThrow();
  });
  it("exposes only safe image metadata and recognized names, without matching local people", () => {
    const asset = immichAssetPreview({ id, type: "IMAGE", originalFileName: "holiday.jpg", originalPath: "/private/path", owner: { email: "secret" }, fileCreatedAt: "2026-07-10T12:00:00Z", exifInfo: { latitude: 46.5, longitude: 11.3 }, people: [{ name: " Alex " }, { name: "Alex" }, { name: "" }] });
    expect(asset.people).toEqual(["Alex"]);
    expect(asset).not.toHaveProperty("originalPath");
    expect(asset).not.toHaveProperty("owner");
    expect(asset).not.toHaveProperty("personIds");
  });
  it("uses authenticated bounded date-range pagination and refuses redirects", async () => {
    vi.stubEnv("IMMICH_URL", "https://photos.example.com"); vi.stubEnv("IMMICH_API_KEY", "secret");
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ assets: { items: [{ id, type: "IMAGE", originalFileName: "test.jpg" }], nextPage: "2" } }))).mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://attacker.example/" } }));
    vi.stubGlobal("fetch", fetch);
    expect((await searchImmichPhotos(new Date("2026-07-01"), new Date("2026-07-12"), 1, 30)).nextPage).toBe(2);
    const [url, options] = fetch.mock.calls[0];
    expect(url.href).toBe("https://photos.example.com/api/search/metadata");
    expect(options.redirect).toBe("manual");
    expect(options.headers["x-api-key"]).toBe("secret");
    expect(JSON.parse(options.body)).toMatchObject({ takenAfter: "2026-07-01T00:00:00.000Z", size: 30, page: 1, withPeople: true });
    await expect(searchImmichPhotos(new Date("2026-07-01"), new Date("2026-07-12"), 2, 30)).rejects.toThrow("leitet");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("refuses path injection and oversized remote images before buffering", async () => {
    vi.stubEnv("IMMICH_URL", "http://immich:2283"); vi.stubEnv("IMMICH_API_KEY", "secret");
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id, type: "IMAGE", originalFileName: "huge.jpg" }))).mockResolvedValueOnce(new Response("x", { headers: { "Content-Length": String(13 * 1024 * 1024) } }));
    vi.stubGlobal("fetch", fetch);
    await expect(downloadImmichPhoto("../../redirect")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await expect(downloadImmichPhoto(id)).rejects.toThrow("zu groß");
  });
});
