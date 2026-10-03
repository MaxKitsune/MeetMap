"use client";
import { DateInput } from "./date-input";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  CloudDownload,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Sparkles,
  Upload,
  X,
  ArrowRight,
} from "lucide-react";
import type { AppData, Attachment, TravelPhoto, Memory } from "@/lib/types";
import { api, dateInput, fmtDate, today } from "@/lib/utils";
import { Modal } from "./ui";

export type TravelSuggestion = {
  title: string;
  startAt: string;
  endAt: string;
  latitude: number;
  longitude: number;
  attachmentIds: string[];
  evidence: {
    photoCount: number;
    uniqueDays: number;
    distanceFromHomeKm: number;
  };
};
type ImportResult = {
  photos: TravelPhoto[];
  results: {
    name: string;
    photo: TravelPhoto;
    duplicate: boolean;
    warnings: string[];
    tripSuggestions: { id: string; title: string }[];
  }[];
  errors: { name: string; error: string }[];
};
type ImmichAsset = {
  id: string;
  name: string;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  people: string[];
  imported: boolean;
};

export function PhotoGrid({
  photos,
  data,
  onPhoto,
}: {
  photos: Attachment[];
  data: AppData;
  onPhoto: (p: Attachment) => void;
}) {
  if (!photos.length)
    return (
      <div className="travel-empty small">
        <Camera size={32} />
        <h3>Ein Platz für deine Reisefotos.</h3>
        <p>
          Lade Bilder hoch oder importiere sie aus Immich. Aufnahmedatum und GPS
          verbinden sie mit deiner Reise.
        </p>
      </div>
    );
  return (
    <div className="travel-photo-grid">
      {photos.map((p) => (
        <button
          key={p.id}
          className="travel-photo-card"
          onClick={() => onPhoto(p)}
        >
          <img
            loading="lazy"
            src={`/api/attachments/${p.id}?thumb=1`}
            alt={p.name}
          />
          <span className="travel-photo-caption">
            <strong>
              {p.capturedAt ? fmtDate(p.capturedAt, true) : "Datum ergänzen"}
            </strong>
            <small>
              {data.trips.find((t) => t.id === p.tripId)?.title ||
                "Noch keinem Urlaub zugeordnet"}
            </small>
          </span>
          {p.latitude != null && p.longitude != null && (
            <span className="travel-photo-gps" title="GPS vorhanden">
              <MapPin size={13} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function PhotoImport({
  data,
  tripId,
  onClose,
  onRefresh,
}: {
  data: AppData;
  tripId?: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState("upload"),
    [files, setFiles] = useState<File[]>([]),
    [target, setTarget] = useState(tripId || ""),
    [fallback, setFallback] = useState("");
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [report, setReport] = useState<ImportResult | null>(null);
  const [connection, setConnection] = useState<{
      configured: boolean;
      connected: boolean;
      status: string;
      message?: string;
    } | null>(null),
    [assets, setAssets] = useState<ImmichAsset[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [nextPage, setNextPage] = useState<number | null>(null);
  const [range, setRange] = useState({
    start:
      data.trips.find((t) => t.id === tripId)?.startAt.slice(0, 10) ||
      `${new Date().getFullYear()}-01-01`,
    end: data.trips.find((t) => t.id === tripId)?.endAt.slice(0, 10) || today(),
  });
  function changeRange(next: typeof range) {
    setRange(next);
    setAssets([]);
    setSelected([]);
    setNextPage(null);
    setReport(null);
  }
  const fileInput = useRef<HTMLInputElement>(null);
  const importForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (tab === "immich" && !connection)
      api<typeof connection>("immich")
        .then(setConnection)
        .catch((e) => setError(e.message));
  }, [tab, connection]);
  async function upload() {
    if (!importForm.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    const all: ImportResult = { photos: [], results: [], errors: [] };
    try {
      for (const [i, file] of files.entries()) {
        setProgress(`${i + 1} von ${files.length} · ${file.name}`);
        const form = new FormData();
        form.append("file", file);
        if (target) form.append("tripId", target);
        if (fallback) form.append("capturedAt", fallback + "T12:00:00Z");
        try {
          const r = await api<ImportResult>("travel-photos", "POST", form);
          all.photos.push(...r.photos);
          all.results.push(...r.results);
          all.errors.push(...r.errors);
        } catch (e) {
          all.errors.push({ name: file.name, error: (e as Error).message });
        }
      }
      setReport(all);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      onRefresh();
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  async function load(page = 1) {
    if (!importForm.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ assets: ImmichAsset[]; nextPage: number | null }>(
        `immich?start=${range.start}&end=${range.end}&page=${page}&size=24`,
      );
      setAssets((a) => (page === 1 ? r.assets : [...a, ...r.assets]));
      setNextPage(r.nextPage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importImmich() {
    if (!importForm.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    setProgress("Bilder werden von deinem Immich-Server übernommen …");
    try {
      const r = await api<ImportResult>("immich", "POST", {
        assetIds: selected,
        ...(target ? { tripId: target } : {}),
      });
      setReport(r);
      setSelected([]);
      setAssets((a) =>
        a.map((x) =>
          selected.includes(x.id)
            ? {
                ...x,
                imported: r.results.some(
                  (y) => y.photo?.sourceAssetId === x.id,
                ),
              }
            : x,
        ),
      );
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Modal
      open
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Bilder, die deine Reise erzählen."
      description="Aufnahmedatum und GPS werden privat gespeichert. Die ausgelieferten Bilder selbst enthalten weiterhin keine EXIF-Daten."
    >
      <form
        ref={importForm}
        className="editor-form"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="travel-subtabs" aria-label="Fotoquelle">
          <button
            aria-pressed={tab === "upload"}
            onClick={() => {
              setTab("upload");
              setError("");
            }}
            disabled={busy}
          >
            <Upload size={16} /> Hochladen
          </button>
          <button
            aria-pressed={tab === "immich"}
            onClick={() => {
              setTab("immich");
              setError("");
            }}
            disabled={busy}
          >
            <CloudDownload size={16} /> Immich
          </button>
        </div>
        <label>
          Zuordnung
          <select
            value={target}
            disabled={busy}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Automatisch anhand des Aufnahmedatums</option>
            {data.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Passt ein Foto zu mehreren Urlauben, entscheidest du die Zuordnung
            anschließend selbst.
          </span>
        </label>
        {tab === "upload" ? (
          <>
            <label className="travel-dropzone">
              <ImagePlus size={34} />
              <strong>Deine Bilder hier auswählen</strong>
              <span>
                JPEG, PNG, WebP oder AVIF · bis 12 MB pro Bild · 10 auf einmal
              </span>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={busy}
                aria-label="Reisefotos auswählen"
                onChange={(e) => {
                  const f = Array.from(e.target.files || []);
                  setFiles(f.slice(0, 10));
                  setReport(null);
                  setError(
                    f.length > 10
                      ? "Die ersten 10 Bilder sind ausgewählt. Weitere Bilder kannst du danach hochladen."
                      : "",
                  );
                }}
              />
            </label>
            {files.length > 0 && (
              <p className="field-hint">
                {files.length} ausgewählt ·{" "}
                {(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(
                  1,
                )}{" "}
                MB
              </p>
            )}
            <details className="travel-disclosure">
              <summary>Wenn im Foto kein Datum gespeichert ist</summary>
              <label>
                Aufnahmedatum als Ersatz
                <DateInput
                  value={fallback}
                  onChange={(e) => setFallback(e.target.value)}
                  disabled={busy}
                />
                <span className="field-hint">
                  Wird nur verwendet, wenn das Original keine Aufnahmezeit
                  enthält. Fehlende GPS-Daten werden nicht erfunden.
                </span>
              </label>
            </details>
            <button
              className="button primary"
              disabled={busy || !files.length}
              onClick={upload}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Upload size={16} />
              )}{" "}
              {busy ? "Import läuft …" : "Fotos importieren"}
            </button>
          </>
        ) : (
          <>
            {!connection && !error && (
              <p className="field-hint">Immich-Verbindung wird geprüft …</p>
            )}
            {connection && !connection.configured && (
              <div className="travel-connection-note">
                <CloudDownload size={30} />
                <h3>Deine Fotobibliothek kann mitreisen.</h3>
                <p>
                  Verbinde deinen eigenen Immich-Server, um ausgewählte Bilder
                  mit Aufnahmeort, Datum und erkannten Namen zu übernehmen.
                </p>
                <details>
                  <summary>Verbindung einrichten</summary>
                  <p>
                    Trage <code>IMMICH_URL</code> und{" "}
                    <code>IMMICH_API_KEY</code> in deiner Server-Konfiguration
                    ein und starte MeetMap neu. Der Schlüssel bleibt auf dem
                    Server. Die README enthält die Anleitung und benötigten
                    Berechtigungen.
                  </p>
                </details>
              </div>
            )}
            {connection?.configured && (
              <>
                <p
                  className={
                    connection.connected ? "privacy-inline" : "form-error"
                  }
                >
                  {connection.connected ? (
                    <>
                      <CheckCircle2 size={16} /> Mit deinem Immich verbunden
                    </>
                  ) : (
                    connection.message || "Immich ist gerade nicht erreichbar."
                  )}
                </p>
                <div className="form-grid">
                  <label>
                    Fotos ab
                    <DateInput
                      disabled={busy}
                      value={range.start}
                      onChange={(e) =>
                        changeRange({ ...range, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fotos bis
                    <DateInput
                      disabled={busy}
                      min={range.start}
                      value={range.end}
                      onChange={(e) =>
                        changeRange({ ...range, end: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button
                  className="button"
                  onClick={() => {
                    setSelected([]);
                    void load();
                  }}
                  disabled={busy || !range.start || !range.end}
                >
                  Fotos anzeigen
                </button>
                <div className="travel-immich-list">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      disabled={a.imported || busy}
                      className={selected.includes(a.id) ? "selected" : ""}
                      aria-pressed={selected.includes(a.id)}
                      onClick={() =>
                        setSelected((s) =>
                          s.includes(a.id)
                            ? s.filter((id) => id !== a.id)
                            : s.length < 10
                              ? [...s, a.id]
                              : s,
                        )
                      }
                    >
                      <span className="travel-asset-icon">
                        {a.imported || selected.includes(a.id) ? (
                          <Check size={18} />
                        ) : (
                          <Camera size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>
                          {a.capturedAt
                            ? fmtDate(a.capturedAt, true)
                            : "Ohne Aufnahmedatum"}
                          {a.people.length ? " · " + a.people.join(", ") : ""}
                        </small>
                      </span>
                      <small>
                        {a.imported
                          ? "Importiert"
                          : a.latitude != null
                            ? "GPS"
                            : ""}
                      </small>
                    </button>
                  ))}
                </div>
                {nextPage && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void load(nextPage)}
                  >
                    Weitere Fotos laden
                  </button>
                )}
                {!!selected.length && (
                  <button
                    className="button primary"
                    onClick={importImmich}
                    disabled={busy}
                  >
                    <CloudDownload size={16} /> {selected.length} Bilder
                    übernehmen
                  </button>
                )}
                <p className="field-hint">
                  Bis zu 10 Bilder pro Import. Erkannte Namen bleiben Hinweise;
                  sie werden nicht ungefragt mit deinen Kontakten verknüpft.
                </p>
              </>
            )}
          </>
        )}
        {progress && (
          <p role="status" className="field-hint">
            {progress}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {report && (
          <div className="travel-import-report" role="status">
            <h3>
              <CheckCircle2 size={18} /> {report.photos.length} Bilder
              übernommen
            </h3>
            <p>
              {report.photos.filter((p) => p.tripId).length} einem Urlaub
              zugeordnet · {report.photos.filter((p) => !p.tripId).length} zur
              freien Zuordnung
            </p>
            {report.results
              .filter((r) => r.warnings.length || r.tripSuggestions.length)
              .map((r, i) => (
                <p key={i}>
                  <strong>{r.name}</strong>:{" "}
                  {[
                    ...r.warnings,
                    ...(r.tripSuggestions.length
                      ? [
                          "Mehrere passende Urlaube: " +
                            r.tripSuggestions.map((t) => t.title).join(", "),
                        ]
                      : []),
                  ].join(" · ")}
                </p>
              ))}
            {report.errors.map((r, i) => (
              <p className="form-error" key={i}>
                {r.name}: {r.error}
              </p>
            ))}
            <button className="button" onClick={onClose}>
              Zur Fotogalerie <ArrowRight size={15} />
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function PhotoDetails({
  photo,
  data,
  onClose,
  onRefresh,
  onMemory,
  onNewMemory,
  onLightbox,
}: {
  photo: Attachment;
  data: AppData;
  onClose: () => void;
  onRefresh: () => void;
  onMemory: (m: Memory) => void;
  onNewMemory: (options: {
    tripId?: string;
    startAt?: string;
    photo?: Attachment;
    placeId?: string;
  }) => void;
  onLightbox: () => void;
}) {
  const [v, set] = useState({
      tripId: photo.tripId || "",
      capturedAt: dateInput(photo.capturedAt),
      latitude: photo.latitude == null ? "" : String(photo.latitude),
      longitude: photo.longitude == null ? "" : String(photo.longitude),
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  async function persist(): Promise<Attachment> {
    const r = await api<{ photo: Attachment }>(
      "travel-photos/" + photo.id,
      "PATCH",
      {
        tripId: v.tripId || null,
        capturedAt:
          v.capturedAt === dateInput(photo.capturedAt)
            ? photo.capturedAt || null
            : v.capturedAt
              ? v.capturedAt + "T12:00:00Z"
              : null,
        latitude: v.latitude === "" ? null : Number(v.latitude),
        longitude: v.longitude === "" ? null : Number(v.longitude),
      },
    );
    onRefresh();
    return r.photo;
  }
  async function save() {
    if (!formRef.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      await persist();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function entry() {
    if (!formRef.current?.reportValidity()) return;
    setBusy(true);
    setError("");
    try {
      const updatedPhoto = await persist();
      if (updatedPhoto.memoryId) {
        const m = data.memories.find((m) => m.id === updatedPhoto.memoryId);
        if (m) {
          onClose();
          onMemory(m);
        }
        return;
      }
      let placeId: string | undefined;
      if (updatedPhoto.latitude != null && updatedPhoto.longitude != null) {
        const existing = data.places.find(
          (p) =>
            Math.abs(p.latitude - updatedPhoto.latitude!) < 0.0001 &&
            Math.abs(p.longitude - updatedPhoto.longitude!) < 0.0001,
        );
        placeId = existing?.id;
        if (!placeId) {
          const p = await api<{ id: string }>("places", "POST", {
            name: `Fotoort · ${updatedPhoto.latitude.toFixed(3)}, ${updatedPhoto.longitude.toFixed(3)}`,
            latitude: updatedPhoto.latitude,
            longitude: updatedPhoto.longitude,
          });
          placeId = p.id;
          onRefresh();
        }
      }
      onClose();
      const selectedTrip = data.trips.find((t) => t.id === updatedPhoto.tripId);
      onNewMemory({
        tripId: updatedPhoto.tripId || undefined,
        startAt:
          dateInput(updatedPhoto.capturedAt) ||
          dateInput(selectedTrip?.startAt) ||
          today(),
        photo: updatedPhoto,
        placeId,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Ein Bild. Viele Verbindungen."
      description={photo.name}
    >
      <div className="travel-photo-detail">
        <button
          className="travel-photo-large"
          onClick={onLightbox}
          aria-label="Foto groß ansehen"
        >
          <img src={`/api/attachments/${photo.id}`} alt={photo.name} />
        </button>
        <form
          ref={formRef}
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Urlaub
            <select
              value={v.tripId}
              onChange={(e) => set({ ...v, tripId: e.target.value })}
            >
              <option value="">Noch nicht zugeordnet</option>
              {data.trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aufnahmedatum
            <DateInput
              value={v.capturedAt}
              onChange={(e) => set({ ...v, capturedAt: e.target.value })}
            />
          </label>
          <details className="travel-disclosure">
            <summary>
              <MapPin size={14} /> Aufnahmeort{" "}
              {photo.latitude != null ? "vorhanden" : "ergänzen"}
            </summary>
            <div className="form-grid">
              <label>
                Breitengrad
                <input
                  type="number"
                  step="any"
                  min="-85"
                  max="85"
                  value={v.latitude}
                  onChange={(e) => set({ ...v, latitude: e.target.value })}
                />
              </label>
              <label>
                Längengrad
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={v.longitude}
                  onChange={(e) => set({ ...v, longitude: e.target.value })}
                />
              </label>
            </div>
          </details>
          {!!photo.sourcePeople?.length && (
            <div className="travel-recognized">
              <span className="field-label">In Immich erkannte Namen</span>
              <p>{photo.sourcePeople.join(" · ")}</p>
              <small>
                Hinweise aus deiner Fotobibliothek, keine automatisch
                bestätigten Kontakte.
              </small>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            <Check size={16} /> Zuordnung speichern
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={entry}
          >
            <Plus size={16} />
            {photo.memoryId
              ? "Tagebucheintrag öffnen"
              : "Als Tagebucheintrag festhalten"}
          </button>
          <span className="field-hint">
            Deine Änderungen werden beim Erstellen des Tagebucheintrags
            mitgespeichert.
          </span>
        </form>
      </div>
    </Modal>
  );
}

export function TripSuggestions({
  data,
  onSuggestion,
  onSettings,
}: {
  data: AppData;
  onSuggestion: (s: TravelSuggestion) => void;
  onSettings: () => void;
}) {
  const [result, setResult] = useState<{
      suggestions: TravelSuggestion[];
      reason?: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function discover() {
    setBusy(true);
    setError("");
    try {
      setResult(await api("travel-suggestions"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="travel-discovery">
      <div className="travel-discovery-intro">
        <span className="travel-icon">
          <Sparkles size={22} />
        </span>
        <div>
          <h3>Vielleicht steckt hier schon eine Reise.</h3>
          <p>
            Finde zusammenhängende Fototage abseits von zuhause. Du
            entscheidest, was ein Urlaub wird.
          </p>
        </div>
      </div>
      {!data.settings.homePlaceId ? (
        <button className="button" onClick={onSettings}>
          Zuhause & Erkennung festlegen
        </button>
      ) : (
        <button className="button" disabled={busy} onClick={discover}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          Urlaube entdecken
        </button>
      )}
      {result && (
        <div className="travel-suggestions">
          {!result.suggestions.length && (
            <p className="field-hint">
              {result.reason ||
                "Noch keine passenden Fotogruppen. Wir brauchen datierte GPS-Fotos an mehreren Tagen außerhalb deines Heimatorts."}
            </p>
          )}
          {result.suggestions.map((s, i) => (
            <article key={i}>
              <div>
                <strong>{s.title}</strong>
                <p>
                  {fmtDate(s.startAt, true)} – {fmtDate(s.endAt, true)}
                </p>
                <small>
                  {s.evidence.photoCount} Fotos · {s.evidence.uniqueDays}{" "}
                  Fototage · {Math.round(s.evidence.distanceFromHomeKm)} km von
                  zuhause
                </small>
              </div>
              <button className="button" onClick={() => onSuggestion(s)}>
                Vorschlag prüfen <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
