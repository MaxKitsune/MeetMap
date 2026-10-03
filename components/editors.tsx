"use client";
import { DateInput } from "./date-input";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  X,
  CloudCheck,
  ChevronDown,
} from "lucide-react";
import type { AppData, Person, Memory, Place, Attachment } from "@/lib/types";
import { tags, memoryTypes, moods } from "@/lib/types";
import { api, dateInput, fmtDate, today } from "@/lib/utils";
import { Modal, Avatar } from "./ui";
export function PlacePicker({
  places,
  value,
  onChange,
  mapEnabled,
  onCreated,
}: {
  places: Place[];
  value: string;
  onChange: (v: string) => void;
  mapEnabled: boolean;
  onCreated: () => void;
}) {
  const [expanded, setExpanded] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Omit<Place, "id">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });
  async function create(p: Omit<Place, "id">) {
    setBusy(true);
    setError("");
    try {
      const item = await api<Place>("places", "POST", p);
      onCreated();
      onChange(item.id);
      setExpanded(false);
      setResults([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    setBusy(true);
    setError("");
    try {
      setResults(await api("geocode?q=" + encodeURIComponent(query)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="place-picker">
      <div className="place-select">
        <select
          aria-label="Ort"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Ohne Ort</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button bordered"
          aria-label="Neuen Ort hinzufügen"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>
      {expanded && (
        <div className="place-create">
          {mapEnabled && (
            <>
              <div className="place-search">
                <input
                  aria-label="Ort suchen"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Stadt oder Ort suchen …"
                />
                <button
                  type="button"
                  className="button"
                  onClick={search}
                  disabled={query.length < 3 || busy}
                >
                  <Search size={16} />
                </button>
              </div>
              {results.map((p, i) => (
                <button
                  className="place-result"
                  type="button"
                  key={i}
                  onClick={() => create(p)}
                >
                  <MapPin size={16} />
                  {p.name}
                </button>
              ))}
              <p className="field-hint">
                Ortssuche · © OpenStreetMap
              </p>
            </>
          )}
          <p className="field-hint">
            {mapEnabled
              ? "Oder einen Ort selbst eintragen:"
              : "Trage einen Ort mit Koordinaten ein. Online-Ortssuche lässt sich in den Einstellungen aktivieren."}
          </p>
          <input
            aria-label="Ortsname"
            placeholder="Name des Ortes"
            value={manual.name}
            onChange={(e) => setManual({ ...manual, name: e.target.value })}
          />
          <div className="form-grid">
            <input
              aria-label="Breitengrad"
              type="number"
              step="any"
              min="-85"
              max="85"
              placeholder="Breitengrad, z. B. 48.137"
              value={manual.latitude}
              onChange={(e) =>
                setManual({ ...manual, latitude: e.target.value })
              }
            />
            <input
              aria-label="Längengrad"
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="Längengrad, z. B. 11.576"
              value={manual.longitude}
              onChange={(e) =>
                setManual({ ...manual, longitude: e.target.value })
              }
            />
          </div>
          <button
            type="button"
            className="button small"
            disabled={
              !manual.name || !manual.latitude || !manual.longitude || busy
            }
            onClick={() =>
              create({
                name: manual.name,
                latitude: Number(manual.latitude),
                longitude: Number(manual.longitude),
              })
            }
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Plus size={15} />
            )}
            Ort speichern
          </button>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function PersonEditor({
  person,
  data,
  onClose,
  onSaved,
}: {
  person?: Person;
  data: AppData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue: setPersonValue,
  } = useForm({
    defaultValues: {
      name: person?.name || "",
      aliases: person?.aliases || "",
      birthday: dateInput(person?.birthday),
      importance: person?.importance || 2,
      notes: person?.notes || "",
      metAt: dateInput(person?.metAt),
      endedAt: dateInput(person?.endedAt),
      online: person?.online || false,
      platform: person?.platform || "",
      contextUrl: person?.contextUrl || "",
      contactDays: person?.contactDays ?? 30,
      lastContact: dateInput(person?.lastContact),
    },
  });
  const [selectedTags, setTags] = useState(person?.tags || ["Freundschaft"]),
    [favorite, setFavorite] = useState(person?.favorite || false),
    [placeId, setPlace] = useState(person?.placeId || ""),
    [avatarId, setAvatar] = useState(person?.avatarId || null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  async function submit(values: {
    name: string;
    aliases: string;
    birthday: string;
    importance: number;
    notes: string;
    metAt: string;
    endedAt: string;
    online: boolean;
    platform: string;
    contextUrl: string;
    contactDays: number;
    lastContact: string;
  }) {
    setBusy(true);
    setError("");
    try {
      await api(
        person ? "people/" + person.id : "people",
        person ? "PATCH" : "POST",
        {
          ...values,
          importance: Number(values.importance),
          contactDays: Number(values.contactDays),
          tags: selectedTags,
          favorite,
          placeId,
          avatarId,
        },
      );
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const f = await api<Attachment>("upload", "POST", fd);
      setAvatar(f.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={person ? "Person bearbeiten" : "Ein neuer Mensch in deinem Leben"}
      description="Halte fest, was euch verbindet."
      wide
    >
      <form onSubmit={handleSubmit(submit)} className="editor-form">
        <div className="person-editor-top">
          <label className="avatar-upload">
            <Avatar
              person={{ name: watch("name") || "?", avatarId }}
              size="large"
            />
            <span className="avatar-camera">
              {uploading ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Camera size={14} />
              )}
            </span>
            <input
              aria-label="Profilbild hochladen"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          <div>
            <label>
              Name
              <input
                {...register("name", { required: true })}
                placeholder="Vor- und Nachname"
                required
                autoFocus
                maxLength={100}
              />
            </label>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Spitzname
            <input
              {...register("aliases")}
              placeholder="Wie nennst du diese Person?"
            />
          </label>
          <label>
            Geburtstag
            <DateInput
              value={watch("birthday")}
              onChange={(e) =>
                setPersonValue("birthday", e.target.value, {
                  shouldDirty: true,
                })
              }
            />
          </label>
        </div>
        <div>
          <span className="field-label">Eure Verbindung</span>
          <div className="tag-choices">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={
                  "tag-choice " + (selectedTags.includes(tag) ? "selected" : "")
                }
                aria-pressed={selectedTags.includes(tag)}
                onClick={() =>
                  setTags(
                    selectedTags.includes(tag)
                      ? selectedTags.filter((t) => t !== tag)
                      : [...selectedTags, tag],
                  )
                }
              >
                {selectedTags.includes(tag) && <Check size={13} />} {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="form-grid">
          <label>
            Kennengelernt am
            <DateInput
              value={watch("metAt")}
              onChange={(e) =>
                setPersonValue("metAt", e.target.value, { shouldDirty: true })
              }
            />
          </label>
          <label>
            Letzter Kontakt
            <DateInput
              value={watch("lastContact")}
              onChange={(e) =>
                setPersonValue("lastContact", e.target.value, {
                  shouldDirty: true,
                })
              }
            />
          </label>
        </div>
        <div>
          <span className="field-label">Ein Ort, der euch verbindet</span>
          <PlacePicker
            places={data.places}
            value={placeId}
            onChange={setPlace}
            mapEnabled={data.settings.mapEnabled}
            onCreated={onSaved}
          />
        </div>
        <label>
          Notizen
          <textarea
            {...register("notes")}
            placeholder="Was macht diesen Menschen besonders? Worüber habt ihr zuletzt gesprochen?"
          />
        </label>
        <details className="form-details">
          <summary>
            Kontakt & weitere Details
            <ChevronDown size={16} />
          </summary>
          <div className="form-grid">
            <label>
              Kontakt halten alle … Tage
              <input
                type="number"
                min={0}
                max={3650}
                {...register("contactDays")}
              />
              <span className="field-hint">0 = keine Erinnerung</span>
            </label>
            <label>
              Wichtigkeit
              <select {...register("importance")}>
                <option value={1}>Locker verbunden</option>
                <option value={2}>Wichtig</option>
                <option value={3}>Sehr wichtig</option>
              </select>
            </label>
            <label>
              Plattform
              <input {...register("platform")} placeholder="z. B. Discord" />
            </label>
            <label>
              Profil-Link
              <input
                {...register("contextUrl")}
                type="url"
                placeholder="https://…"
              />
            </label>
            <label>
              Kontakt beendet am
              <DateInput
                value={watch("endedAt")}
                onChange={(e) =>
                  setPersonValue("endedAt", e.target.value, {
                    shouldDirty: true,
                  })
                }
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" {...register("online")} /> Online-Kontakt
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
            />{" "}
            Als Favorit merken
          </label>
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <button
            type="submit"
            className="button primary"
            disabled={busy || uploading}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}
            Person speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
type MemoryValues = {
  title: string;
  content: string;
  startAt: string;
  endAt: string;
  type: string;
  mood: string;
  privacy: string;
  favorite: boolean;
  pinned: boolean;
  draft: boolean;
  placeId: string;
  personIds: string[];
  attachmentIds: string[];
  tripId: string;
};
export function MemoryEditor({
  memory,
  personId,
  tripId,
  startAt,
  photo,
  placeId,
  data,
  onClose,
  onSaved,
}: {
  memory?: Memory;
  personId?: string;
  tripId?: string;
  startAt?: string;
  photo?: Attachment;
  placeId?: string;
  data: AppData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialTrip = data.trips.find(
    (t) => t.id === (memory?.tripId || tripId),
  );
  const [value, setValue] = useState<MemoryValues>({
    title: memory?.title || "",
    content: memory?.content || "",
    startAt:
      dateInput(memory?.startAt) ||
      startAt ||
      (initialTrip ? dateInput(initialTrip.startAt) : today()),
    endAt: dateInput(memory?.endAt),
    type: memory?.type || (initialTrip ? "Reise" : "Treffen"),
    mood: memory?.mood || "Glücklich",
    privacy: memory?.privacy || "Privat",
    favorite: memory?.favorite || false,
    pinned: memory?.pinned || false,
    draft: memory?.draft ?? true,
    placeId: memory?.placeId || placeId || initialTrip?.placeId || "",
    tripId: memory?.tripId || tripId || "",
    personIds:
      memory?.people.map((p) => p.id) ||
      (personId ? [personId] : initialTrip?.people.map((p) => p.id) || []),
    attachmentIds:
      memory?.attachments.map((a) => a.id) || (photo ? [photo.id] : []),
  });
  const [attachments, setAttachments] = useState<Attachment[]>(
      memory?.attachments || (photo ? [photo] : []),
    ),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false),
    [finishing, setFinishing] = useState(false);
  const valueRef = useRef(value),
    idRef = useRef(memory?.id),
    revisionRef = useRef(memory?.revision || 0),
    queue = useRef<Promise<void>>(Promise.resolve()),
    lastSaved = useRef(JSON.stringify(value)),
    failed = useRef(false);
  valueRef.current = value;
  function update<K extends keyof MemoryValues>(key: K, v: MemoryValues[K]) {
    setValue((current) => ({ ...current, [key]: v }));
    setStatus("Ungespeicherte Änderungen");
  }
  function save(snapshot: MemoryValues) {
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        if (
          !snapshot.title.trim() &&
          !snapshot.content.trim() &&
          !snapshot.attachmentIds.length
        )
          return;
        setStatus("Wird gespeichert …");
        try {
          const result = await api<Memory>(
            idRef.current ? "memories/" + idRef.current : "memories",
            idRef.current ? "PATCH" : "POST",
            {
              ...snapshot,
              title: snapshot.title.trim() || "Unbenannte Erinnerung",
              revision: revisionRef.current,
            },
          );
          idRef.current = result.id;
          revisionRef.current = result.revision;
          lastSaved.current = JSON.stringify(snapshot);
          setStatus(snapshot.draft ? "Entwurf gespeichert" : "Gespeichert");
          setError("");
          failed.current = false;
          onSaved();
        } catch (e) {
          setError((e as Error).message);
          setStatus("Nicht gespeichert");
          failed.current = true;
          throw e;
        }
      });
    queue.current = task;
    return task;
  }
  useEffect(() => {
    if (
      finishing ||
      (!value.title.trim() &&
        !value.content.trim() &&
        !value.attachmentIds.length) ||
      lastSaved.current === JSON.stringify(value) ||
      failed.current
    )
      return;
    const timer = setTimeout(() => {
      void save(value).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [value, finishing]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (lastSaved.current !== JSON.stringify(valueRef.current)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  async function close() {
    if (
      (valueRef.current.title.trim() ||
        valueRef.current.content.trim() ||
        valueRef.current.attachmentIds.length) &&
      lastSaved.current !== JSON.stringify(valueRef.current)
    ) {
      try {
        await save(valueRef.current);
      } catch {
        return;
      }
    }
    onClose();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFinishing(true);
    try {
      await save({ ...valueRef.current, draft: false });
      onClose();
    } catch {
    } finally {
      setFinishing(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, 12)) {
        const fd = new FormData();
        fd.append("file", file);
        const added = await api<Attachment>("upload", "POST", fd);
        setAttachments((a) => [...a, added]);
        setValue((v) => ({
          ...v,
          attachmentIds: [...v.attachmentIds, added.id],
        }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        void close();
      }}
      title={memory ? "Erinnerung bearbeiten" : "Was möchtest du festhalten?"}
      description="Ein großer Moment. Oder einfach ein schöner Dienstag."
      wide
    >
      <form onSubmit={submit} className="editor-form memory-editor">
        <input
          aria-label="Titel der Erinnerung"
          className="memory-title-input"
          required
          autoFocus
          maxLength={160}
          value={value.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Gib diesem Moment einen Namen …"
        />
        {data.trips.length > 0 && (
          <label>
            Gehört zu einem Urlaub
            <select
              aria-label="Urlaub der Erinnerung"
              value={value.tripId}
              onChange={(e) => {
                const t = data.trips.find((t) => t.id === e.target.value);
                setValue((v) => ({
                  ...v,
                  tripId: e.target.value,
                  ...(t
                    ? {
                        type: "Reise",
                        startAt:
                          v.startAt < dateInput(t.startAt) ||
                          v.startAt > dateInput(t.endAt)
                            ? dateInput(t.startAt)
                            : v.startAt,
                        endAt:
                          v.endAt && v.endAt > dateInput(t.endAt)
                            ? ""
                            : v.endAt,
                        placeId: v.placeId || t.placeId || "",
                        personIds: v.personIds.length
                          ? v.personIds
                          : t.people.map((p) => p.id),
                      }
                    : {}),
                }));
              }}
            >
              <option value="">Eigenständige Erinnerung</option>
              {data.trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {fmtDate(t.startAt)} – {fmtDate(t.endAt)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid three">
          <label>
            Datum
            <DateInput
              required
              value={value.startAt}
              onChange={(e) => update("startAt", e.target.value)}
            />
          </label>
          <label>
            Art der Erinnerung
            <select
              value={value.type}
              onChange={(e) => update("type", e.target.value)}
            >
              {memoryTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            So hat es sich angefühlt
            <select
              value={value.mood}
              onChange={(e) => update("mood", e.target.value)}
            >
              {moods.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          aria-label="Deine Erinnerung"
          className="memory-writing"
          placeholder="Was ist passiert? Was ist dir im Kopf geblieben? Hier ist Platz für deine Geschichte …"
          value={value.content}
          onChange={(e) => update("content", e.target.value)}
        />
        <div>
          <span className="field-label">Wer war dabei?</span>
          <div className="people-choices">
            {data.people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={value.personIds.includes(p.id)}
                className={
                  "person-choice " +
                  (value.personIds.includes(p.id) ? "selected" : "")
                }
                onClick={() =>
                  update(
                    "personIds",
                    value.personIds.includes(p.id)
                      ? value.personIds.filter((id) => id !== p.id)
                      : [...value.personIds, p.id],
                  )
                }
              >
                <Avatar person={p} size="tiny" />
                {p.name.split(" ")[0]}
                {value.personIds.includes(p.id) && <Check size={13} />}
              </button>
            ))}
            {!data.people.length && (
              <p className="field-hint">
                Du kannst später Menschen mit dieser Erinnerung verbinden.
              </p>
            )}
          </div>
        </div>
        <div>
          <span className="field-label">Wo war das?</span>
          <PlacePicker
            places={data.places}
            value={value.placeId}
            onChange={(v) => update("placeId", v)}
            mapEnabled={data.settings.mapEnabled}
            onCreated={onSaved}
          />
        </div>
        <div className="attachment-strip">
          {attachments
            .filter((a) => value.attachmentIds.includes(a.id))
            .map((a) => (
              <div className="attachment-preview" key={a.id}>
                <img src={`/api/attachments/${a.id}?thumb=1`} alt={a.name} />
                <button
                  type="button"
                  aria-label={`${a.name} entfernen`}
                  onClick={() =>
                    update(
                      "attachmentIds",
                      value.attachmentIds.filter((id) => id !== a.id),
                    )
                  }
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          <label className="upload-zone">
            {uploading ? (
              <LoaderCircle className="spin" size={23} />
            ) : (
              <ImagePlus size={23} />
            )}
            <span>
              {uploading ? "Wird hochgeladen …" : "Bilder hinzufügen"}
            </span>
            <small>JPEG, PNG, WebP · bis 12 MB</small>
            <input
              className="sr-only"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => upload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
        <details className="form-details">
          <summary>
            Weitere Details
            <ChevronDown size={16} />
          </summary>
          <div className="form-grid">
            <label>
              Enddatum
              <DateInput
                min={value.startAt}
                value={value.endAt}
                onChange={(e) => update("endAt", e.target.value)}
              />
            </label>
            <label>
              Kennzeichnung
              <select
                value={value.privacy}
                onChange={(e) => update("privacy", e.target.value)}
              >
                <option>Privat</option>
                <option>Sensibel</option>
              </select>
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value.favorite}
              onChange={(e) => update("favorite", e.target.checked)}
            />
            Als Favorit merken
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value.pinned}
              onChange={(e) => update("pinned", e.target.checked)}
            />
            Oben anpinnen
          </label>
        </details>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <span aria-live="polite">
            <CloudCheck size={15} />
            {status || "Änderungen werden automatisch gespeichert"}
          </span>
          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => {
                void close();
              }}
              disabled={finishing || uploading}
            >
              Schließen
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={finishing || uploading}
            >
              {finishing ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Erinnerung speichern
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
