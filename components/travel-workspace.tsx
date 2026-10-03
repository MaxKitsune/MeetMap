"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Camera,
  Car,
  Check,
  Compass,
  Flag,
  Footprints,
  ImagePlus,
  MapPin,
  Mountain,
  Pencil,
  Plane,
  Plus,
  Route,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import type {
  AppData,
  Attachment,
  HolidayPeriod,
  Memory,
  Trip,
  TravelLeg,
} from "@/lib/types";
import { api, dateInput, fmtDate, today } from "@/lib/utils";
import { holidayStats, inclusiveDays, travelStats } from "@/lib/travel";
import { Avatar, Modal } from "./ui";
import { PlacePicker } from "./editors";
import {
  HolidayEditor,
  TripEditor,
  LegEditor,
  transportLabels,
  type TripSeed,
} from "./travel-editors";
import {
  PhotoGrid,
  PhotoImport,
  PhotoDetails,
  TripSuggestions,
  type TravelSuggestion,
} from "./travel-photos";
import TravelCalendar from "./travel-calendar";
import "./travel.css";
const TravelMap = dynamic(() => import("./travel-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <MapPin size={24} />
      Deine Reiseorte werden geladen …
    </div>
  ),
});
type Seed = {
  tripId?: string;
  startAt?: string;
  photo?: Attachment;
  placeId?: string;
};
type Scope = { kind: "holiday" | "trip"; id: string } | null;
const number = (v: number) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const range = (start: string, end: string) =>
  `${fmtDate(start, true)} – ${fmtDate(end, true)}`;
const status = (t: { startAt: string; endAt: string }) =>
  dateInput(t.endAt) < today()
    ? "Gesammelt"
    : dateInput(t.startAt) > today()
      ? "Vorfreude"
      : "Gerade unterwegs";
const TransportIcon = ({ mode }: { mode: string }) =>
  mode === "flight" ? (
    <Plane size={18} />
  ) : mode === "car" ? (
    <Car size={18} />
  ) : mode === "walk" ? (
    <Footprints size={18} />
  ) : (
    <Route size={18} />
  );

export default function TravelWorkspace({
  data,
  refresh,
  notify,
  onMemory,
  onNewMemory,
  onLightbox,
}: {
  data: AppData;
  refresh: () => void;
  notify: (message: string) => void;
  onMemory: (m: Memory) => void;
  onNewMemory: (seed: Seed) => void;
  onLightbox: (items: Attachment[], index: number) => void;
}) {
  const [mode, setMode] = useState("overview"),
    [entryTripPicker, setEntryTripPicker] = useState(false),
    [scope, setScope] = useState<Scope>(null),
    [detailTab, setDetailTab] = useState("trips"),
    [year, setYear] = useState("all"),
    [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [holidayEditor, setHolidayEditor] = useState<{
      holiday?: HolidayPeriod;
      startAt?: string;
    } | null>(null),
    [tripEditor, setTripEditor] = useState<{
      trip?: Trip;
      seed?: TripSeed;
    } | null>(null),
    [legEditor, setLegEditor] = useState<{ leg?: TravelLeg } | null>(null),
    [importing, setImporting] = useState(false),
    [selectedPhoto, setSelectedPhoto] = useState<Attachment | null>(null),
    [travelSettings, setTravelSettings] = useState(false),
    [confirm, setConfirm] = useState<{
      endpoint: string;
      title: string;
      description: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#travel")) return;
      const q = new URLSearchParams(hash.split("?")[1]);
      if (q.get("trip")) {
        setScope({ kind: "trip", id: q.get("trip")! });
        setDetailTab("diary");
      } else if (q.get("holiday")) {
        setScope({ kind: "holiday", id: q.get("holiday")! });
        setDetailTab("trips");
      } else setScope(null);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function select(next: Scope) {
    setScope(next);
    setMode("overview");
    setDetailTab(next?.kind === "trip" ? "diary" : "trips");
    window.location.hash = next
      ? `travel?${next.kind}=${encodeURIComponent(next.id)}`
      : "travel";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const trip =
    scope?.kind === "trip"
      ? data.trips.find((t) => t.id === scope.id)
      : undefined;
  const holiday =
    scope?.kind === "holiday"
      ? data.holidayPeriods.find((h) => h.id === scope.id)
      : undefined;
  const scopedTrips = trip
    ? [trip]
    : holiday
      ? data.trips.filter((t) => t.holidayPeriodId === holiday.id)
      : data.trips;
  const tripIds = new Set(scopedTrips.map((t) => t.id));
  const memories = data.memories
    .filter((m) => m.tripId && tripIds.has(m.tripId))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const legs = data.travelLegs
    .filter(
      (l) =>
        !scope ||
        (trip
          ? l.tripId === trip.id
          : holiday
            ? l.holidayPeriodId === holiday.id ||
              (!!l.tripId && tripIds.has(l.tripId))
            : false),
    )
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  const photos = useMemo(() => {
    const source = scope
      ? data.travelPhotos.filter((p) => p.tripId && tripIds.has(p.tripId))
      : data.travelPhotos;
    return [
      ...new Map(
        [
          ...source,
          ...memories.flatMap((m) =>
            m.attachments.map((a) => ({
              ...a,
              tripId: m.tripId,
              memoryId: m.id,
            })),
          ),
        ].map((p) => [p.id, p]),
      ).values(),
    ].sort((a, b) => (b.capturedAt || "").localeCompare(a.capturedAt || ""));
  }, [data.travelPhotos, data.memories, scope?.id]);
  const stats = holiday
    ? holidayStats(holiday, data.trips, data.travelLegs)
    : travelStats(scopedTrips, legs);
  const hs = holiday
    ? holidayStats(holiday, data.trips, data.travelLegs)
    : null;
  const allPastTrips = data.trips.filter((t) => dateInput(t.endAt) < today());
  const pastTrips = allPastTrips.filter(
    (t) => year === "all" || t.endAt.slice(0, 4) === year,
  );
  const pastHolidays = data.holidayPeriods.filter(
    (h) =>
      dateInput(h.endAt) < today() &&
      (year === "all" || h.endAt.slice(0, 4) === year),
  );
  const pastIds = new Set(pastTrips.map((t) => t.id)),
    pastHolidayIds = new Set(pastHolidays.map((h) => h.id));
  const pastLegs = data.travelLegs.filter(
    (l) =>
      dateInput(l.departureAt) < today() &&
      ((l.tripId && pastIds.has(l.tripId)) ||
        (l.holidayPeriodId && pastHolidayIds.has(l.holidayPeriodId))),
  );
  const retrospective = travelStats(pastTrips, pastLegs);
  const years = [
    ...new Set([
      ...allPastTrips.map((t) => t.endAt.slice(0, 4)),
      ...data.holidayPeriods
        .filter((h) => dateInput(h.endAt) < today())
        .map((h) => h.endAt.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse();
  const upcoming = [...data.trips]
    .filter((t) => dateInput(t.endAt) >= today())
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const next = upcoming[0];
  function tripPhotos(t: Trip) {
    return photos.filter((p) => p.tripId === t.id);
  }
  function tripCard(t: Trip) {
    const cover = tripPhotos(t)[0];
    const p = data.holidayPeriods.find((h) => h.id === t.holidayPeriodId);
    return (
      <button
        className="travel-trip-card"
        key={t.id}
        onClick={() => select({ kind: "trip", id: t.id })}
      >
        <div
          className={
            "travel-trip-cover " + (!cover ? "travel-cover-illustrated" : "")
          }
        >
          {cover ? (
            <img
              src={`/api/attachments/${cover.id}?thumb=1`}
              alt=""
              loading="lazy"
            />
          ) : (
            <>
              <Mountain size={76} strokeWidth={0.8} />
              <span className="travel-cover-sun" />
            </>
          )}
          <span className="travel-cover-tag">{status(t)}</span>
          <span className="travel-cover-days">
            {inclusiveDays(t.startAt, t.endAt)} Tage
          </span>
        </div>
        <div className="travel-trip-copy">
          <span className="eyebrow">{p?.name || "Dein Urlaub"}</span>
          <h3>{t.title}</h3>
          <p>
            <MapPin size={14} />
            {t.place?.name || "Das Ziel steht noch offen"}
          </p>
          <div className="travel-card-bottom">
            <small>{range(t.startAt, t.endAt)}</small>
            <span className="avatar-stack">
              {t.people.slice(0, 3).map((p) => (
                <Avatar person={p} size="tiny" key={p.id} />
              ))}
            </span>
            <ArrowUpRight size={17} />
          </div>
        </div>
      </button>
    );
  }
  function holidayCard(h: HolidayPeriod) {
    const s = holidayStats(h, data.trips, data.travelLegs);
    return (
      <button
        className="travel-holiday-card"
        key={h.id}
        onClick={() => select({ kind: "holiday", id: h.id })}
        style={{ "--holiday-color": h.color } as CSSProperties}
      >
        <div className="travel-holiday-top">
          <span className="travel-holiday-symbol">
            <Sun size={22} />
          </span>
          <small>{status(h)}</small>
          <ArrowUpRight size={17} />
        </div>
        <h3>{h.name}</h3>
        <p>{range(h.startAt, h.endAt)}</p>
        <div className="travel-holiday-progress">
          <span style={{ width: s.awayPercent + "%" }} />
        </div>
        <div className="travel-holiday-values">
          <strong>
            {number(s.awayPercent)}% <small>unterwegs</small>
          </strong>
          <span>
            {s.daysAway} / {s.periodDays} Tage
          </span>
        </div>
        <div className="travel-holiday-foot">
          <span>{s.tripCount} Urlaube</span>
          <span>{number(s.distanceKm)} km erfasst</span>
        </div>
      </button>
    );
  }
  async function fromSuggestion(s: TravelSuggestion) {
    setBusy(true);
    try {
      const p = await api<{ id: string }>("places", "POST", {
        name: `Reiseziel · ${s.latitude.toFixed(3)}, ${s.longitude.toFixed(3)}`,
        latitude: s.latitude,
        longitude: s.longitude,
      });
      refresh();
      setTripEditor({
        seed: {
          title: s.title,
          startAt: s.startAt.slice(0, 10),
          endAt: s.endAt.slice(0, 10),
          placeId: p.id,
          attachmentIds: s.attachmentIds,
        },
      });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function tripSaved(id: string) {
    const ids = tripEditor?.seed?.attachmentIds || [];
    setTripEditor(null);
    if (ids.length) {
      const results = await Promise.allSettled(
        ids.map((photoId) =>
          api("travel-photos/" + photoId, "PATCH", { tripId: id }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      notify(
        failed
          ? `Urlaub gespeichert. ${failed} Bilder brauchen noch eine manuelle Zuordnung.`
          : "Deine erkannte Reise und ihre Fotos sind verbunden.",
      );
    } else notify("Urlaub gespeichert");
    refresh();
    select({ kind: "trip", id });
  }
  const createTrip = (startAt?: string) =>
    setTripEditor({
      seed: { holidayPeriodId: holiday?.id, startAt, endAt: startAt },
    });
  const entryForTrip = (selected: Trip) =>
    onNewMemory({
      tripId: selected.id,
      startAt:
        dateInput(selected.startAt) > today() ||
        dateInput(selected.endAt) < today()
          ? dateInput(selected.startAt)
          : today(),
    });
  const newEntry = () => {
    if (trip) entryForTrip(trip);
    else if (scopedTrips.length === 1) entryForTrip(scopedTrips[0]);
    else if (scopedTrips.length > 1) setEntryTripPicker(true);
    else createTrip();
  };
  const detailTitle = trip?.title || holiday?.name;
  const detailCover = photos[0];
  if (scope && !trip && !holiday)
    return (
      <div className="travel-empty">
        <Compass size={30} />
        <h3>Dieser Eintrag wird geladen.</h3>
        <p>
          Falls der Eintrag inzwischen entfernt wurde, findest du die übrigen
          Reisen in deiner Übersicht.
        </p>
        <div className="button-row">
          <button className="button" onClick={refresh}>
            Erneut laden
          </button>
          <button className="button primary" onClick={() => select(null)}>
            Alle Reisen & Ferien
          </button>
        </div>
      </div>
    );
  return (
    <div className="travel-workspace">
      <div className="travel-page-heading">
        <div>
          {scope && (
            <button
              className="text-button travel-back"
              onClick={() => select(null)}
            >
              <ArrowLeft size={15} /> Alle Reisen & Ferien
            </button>
          )}
          <span className="eyebrow">
            {scope
              ? trip
                ? "DEIN REISETAGEBUCH"
                : "ZEIT FÜR DEINE AUSZEIT"
              : "DEINE WELT WIRD GRÖSSER"}
          </span>
          <h1>{detailTitle || "Draußen wartet eine Geschichte."}</h1>
          {!scope && (
            <p>
              Ferien planen. Zusammen losziehen. Erinnerungen mit nach Hause
              nehmen.
            </p>
          )}
          {trip && (
            <div className="travel-detail-meta">
              <span>
                <CalendarDays size={15} />
                {range(trip.startAt, trip.endAt)}
              </span>
              {trip.place && (
                <span>
                  <MapPin size={15} />
                  {trip.place.name}
                </span>
              )}
              {trip.holidayPeriodId && (
                <button
                  className="travel-parent-link"
                  onClick={() =>
                    select({ kind: "holiday", id: trip.holidayPeriodId! })
                  }
                >
                  <Sun size={14} />
                  {
                    data.holidayPeriods.find(
                      (h) => h.id === trip.holidayPeriodId,
                    )?.name
                  }
                </button>
              )}
            </div>
          )}
          {holiday && (
            <p>
              {range(holiday.startAt, holiday.endAt)} ·{" "}
              {inclusiveDays(holiday.startAt, holiday.endAt)} Tage voller
              Möglichkeiten
            </p>
          )}
        </div>
        <div className="travel-heading-actions">
          {!scope ? (
            <>
              <button className="button" onClick={() => setHolidayEditor({})}>
                <Sun size={16} /> Ferien anlegen
              </button>
              <button className="button primary" onClick={() => createTrip()}>
                <Plus size={17} /> Urlaub anlegen
              </button>
            </>
          ) : (
            <>
              <button
                className="button"
                onClick={() =>
                  trip ? setTripEditor({ trip }) : setHolidayEditor({ holiday })
                }
              >
                <Pencil size={15} /> Bearbeiten
              </button>
              <button
                className="icon-button bordered"
                aria-label={trip ? "Urlaub löschen" : "Ferien löschen"}
                onClick={() =>
                  setConfirm({
                    endpoint: trip
                      ? "trips/" + trip.id
                      : "holiday-periods/" + holiday?.id,
                    title: trip
                      ? "Diesen Urlaub entfernen?"
                      : "Diesen Ferienzeitraum entfernen?",
                    description: trip
                      ? "Tagebucheinträge und Bilder bleiben erhalten und verlieren nur ihre Zuordnung zu diesem Urlaub. Reiseetappen werden ebenfalls erhalten."
                      : "Deine Urlaube, Tagebucheinträge, Fotos und Reiseetappen bleiben erhalten. Nur die Zuordnung zu diesen Ferien wird entfernt.",
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
      {!scope && (
        <div className="travel-tabs" aria-label="Reiseansichten">
          {[
            ["overview", "Übersicht", Compass],
            ["calendar", "Kalender", CalendarDays],
            ["photos", "Fotos", Camera],
            ["archive", "Rückblick", Sparkles],
          ].map(([id, label, Icon]) => (
            <button
              key={String(id)}
              aria-pressed={mode === id}
              onClick={() => setMode(String(id))}
            >
              {typeof Icon !== "string" && <Icon size={17} />} {String(label)}
            </button>
          ))}
        </div>
      )}
      {!scope && mode === "overview" && (
        <>
          <section className="travel-hero">
            <div>
              <span className="eyebrow">
                {next
                  ? "DAS NÄCHSTE KAPITEL"
                  : "KLEINE FLUCHTEN. GROSSE GESCHICHTEN."}
              </span>
              <h2>
                {next ? next.title : "Mehr als nur ein Punkt auf der Karte."}
              </h2>
              <p>
                {next
                  ? `${range(next.startAt, next.endAt)}${next.place ? " · " + next.place.name : ""}`
                  : "Deine Ferien sind der Rahmen. Deine Urlaube füllen ihn mit Leben. Hier findet alles zusammen."}
              </p>
              <button
                className="button"
                onClick={() =>
                  next
                    ? select({ kind: "trip", id: next.id })
                    : setHolidayEditor({})
                }
              >
                {next
                  ? "Reise öffnen"
                  : data.holidayPeriods.length
                    ? "Die nächsten Ferien planen"
                    : "Meine ersten Ferien"}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="travel-hero-art" aria-hidden="true">
              <span className="travel-orbit one" />
              <span className="travel-orbit two" />
              <span className="travel-art-sun" />
              <Mountain size={130} strokeWidth={0.65} />
              <span className="travel-art-pin">
                <MapPin size={28} />
              </span>
              <span className="travel-art-plane">
                <Plane size={23} />
              </span>
            </div>
          </section>
          <div className="travel-quiet-stats">
            <span>
              <strong>{data.holidayPeriods.length}</strong> Ferienzeiträume
            </span>
            <span>
              <strong>{data.trips.length}</strong> Urlaube
            </span>
            <span>
              <strong>{travelStats(allPastTrips).daysAway}</strong> bisherige
              Reisetage
            </span>
            <span>
              <strong>{data.travelPhotos.length}</strong> Reisefotos
            </span>
          </div>
          <section>
            <div className="section-heading">
              <h2>
                Deine Ferien{" "}
                <span className="travel-count">
                  {data.holidayPeriods.length}
                </span>
              </h2>
              <button
                className="text-button"
                onClick={() => setHolidayEditor({})}
              >
                <Plus size={15} /> Ferien hinzufügen
              </button>
            </div>
            {data.holidayPeriods.length ? (
              <div className="travel-holiday-grid">
                {[...data.holidayPeriods]
                  .sort((a, b) => b.startAt.localeCompare(a.startAt))
                  .map(holidayCard)}
              </div>
            ) : (
              <div className="travel-empty">
                <Sun size={35} />
                <h3>Ein freier Sommer. Ein verlängertes Semesterende.</h3>
                <p>
                  Lege zuerst einen Ferienzeitraum an. Darin können beliebig
                  viele Urlaube Platz finden.
                </p>
                <button className="button" onClick={() => setHolidayEditor({})}>
                  Ferienzeitraum anlegen
                </button>
              </div>
            )}
          </section>
          <section>
            <div className="section-heading">
              <h2>
                Deine Urlaube{" "}
                <span className="travel-count">{data.trips.length}</span>
              </h2>
              <button className="text-button" onClick={() => createTrip()}>
                <Plus size={15} /> Urlaub hinzufügen
              </button>
            </div>
            {data.trips.length ? (
              <div className="travel-trip-grid">
                {[...data.trips]
                  .sort((a, b) => b.startAt.localeCompare(a.startAt))
                  .map(tripCard)}
              </div>
            ) : (
              <div className="travel-empty small">
                <Compass size={30} />
                <h3>Wohin geht die erste Reise?</h3>
                <p>
                  Ein Urlaub funktioniert auch ganz ohne übergeordneten
                  Ferienzeitraum.
                </p>
                <button className="button" onClick={() => createTrip()}>
                  Urlaub anlegen
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {!scope && mode === "calendar" && (
        <TravelCalendar
          data={data}
          onTrip={(id) => select({ kind: "trip", id })}
          onHoliday={(id) => select({ kind: "holiday", id })}
          onMemory={onMemory}
          onCreate={(date) => createTrip(date)}
        />
      )}
      {!scope && mode === "photos" && (
        <>
          <div className="travel-section-toolbar">
            <div>
              <h2>Dein Fotoalbum, verbunden.</h2>
              <p>
                Aufnahmedatum und GPS helfen, den richtigen Urlaub
                wiederzufinden.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => setImporting(true)}
            >
              <ImagePlus size={16} /> Fotos importieren
            </button>
          </div>
          <div className="travel-filter-row">
            <button
              className={!onlyUnassigned ? "active" : ""}
              onClick={() => setOnlyUnassigned(false)}
            >
              Alle Bilder <span>{photos.length}</span>
            </button>
            <button
              className={onlyUnassigned ? "active" : ""}
              onClick={() => setOnlyUnassigned(true)}
            >
              Noch zuordnen{" "}
              <span>{photos.filter((p) => !p.tripId).length}</span>
            </button>
            <button
              className="text-button"
              onClick={() => setTravelSettings(true)}
            >
              Erkennung einstellen
            </button>
          </div>
          <PhotoGrid
            photos={onlyUnassigned ? photos.filter((p) => !p.tripId) : photos}
            data={data}
            onPhoto={setSelectedPhoto}
          />
          <TripSuggestions
            data={data}
            onSuggestion={(s) => void fromSuggestion(s)}
            onSettings={() => setTravelSettings(true)}
          />
        </>
      )}
      {!scope && mode === "archive" && (
        <>
          <div className="travel-section-toolbar">
            <div>
              <h2>Was von deinen Auszeiten bleibt.</h2>
              <p>
                Vergangene Ferien und Urlaube im Vergleich – nur abgeschlossene
                Zeiträume, nach dem Jahr ihres Endes sortiert.
              </p>
            </div>
            <select
              aria-label="Rückblick nach Jahr filtern"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="all">Alle Jahre</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  Abgeschlossen {y}
                </option>
              ))}
            </select>
          </div>
          <div className="travel-metrics">
            <Metric
              icon={Sun}
              value={String(retrospective.daysAway)}
              label="Tage unterwegs"
              hint="Überlappende Tage zählen einmal"
            />
            <Metric
              icon={Flag}
              value={String(pastTrips.length)}
              label="Gesammelte Urlaube"
              hint={`${pastHolidays.length} vergangene Ferienzeiträume`}
            />
            <Metric
              icon={Route}
              value={number(retrospective.distanceKm) + " km"}
              label="Erfasste Reisewege"
              hint={`${retrospective.legCount} einzelne Etappen`}
            />
          </div>
          <section className="panel travel-comparison">
            <div className="section-heading">
              <h2>Wie viel deiner Ferien warst du unterwegs?</h2>
            </div>
            {pastHolidays.length ? (
              pastHolidays
                .sort((a, b) => b.startAt.localeCompare(a.startAt))
                .map((h) => {
                  const s = holidayStats(h, data.trips, data.travelLegs);
                  return (
                    <button
                      className="travel-comparison-row"
                      key={h.id}
                      onClick={() => select({ kind: "holiday", id: h.id })}
                    >
                      <span>
                        <strong>{h.name}</strong>
                        <small>
                          {s.daysAway} von {s.periodDays} Tagen · {s.tripCount}{" "}
                          Urlaube
                        </small>
                      </span>
                      <span className="travel-comparison-track">
                        <i
                          style={{
                            width: s.awayPercent + "%",
                            background: h.color,
                          }}
                        />
                      </span>
                      <strong>{number(s.awayPercent)}%</strong>
                      <ArrowUpRight size={16} />
                    </button>
                  );
                })
            ) : (
              <div className="travel-empty small">
                <Sun size={27} />
                <p>
                  Abgeschlossene Ferien erscheinen hier mit ihren Reisetagen.
                </p>
              </div>
            )}
          </section>
          <section className="panel travel-comparison">
            <div className="section-heading">
              <h2>Deine Urlaube im Rückblick</h2>
            </div>
            {pastTrips.length ? (
              pastTrips
                .sort((a, b) => b.endAt.localeCompare(a.endAt))
                .map((t) => {
                  const l = data.travelLegs.filter((l) => l.tripId === t.id);
                  return (
                    <button
                      className="travel-archive-row"
                      onClick={() => select({ kind: "trip", id: t.id })}
                      key={t.id}
                    >
                      <span className="travel-icon">
                        <Compass size={21} />
                      </span>
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {range(t.startAt, t.endAt)} ·{" "}
                          {t.place?.name || "Ohne Hauptziel"}
                        </small>
                      </span>
                      <span>
                        <strong>
                          {inclusiveDays(t.startAt, t.endAt)} Tage
                        </strong>
                        <small>
                          {number(travelStats([t], l).distanceKm)} km ·{" "}
                          {
                            data.memories.filter(
                              (m) => m.tripId === t.id && !m.draft,
                            ).length
                          }{" "}
                          Einträge
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  );
                })
            ) : (
              <div className="travel-empty small">
                <Compass size={26} />
                <p>
                  Nach deiner ersten Reise beginnt hier dein persönlicher
                  Rückblick.
                </p>
              </div>
            )}
          </section>
          <p className="field-hint">
            Kilometer summieren erfasste Etappen. Automatische Werte sind
            Luftlinien, manuelle Werte deine tatsächlich eingetragenen Strecken.
          </p>
          {pastLegs.length > 0 && (
            <section className="panel travel-comparison">
              <h2>So warst du unterwegs</h2>
              <div className="travel-transport-summary">
                {Object.entries(transportLabels)
                  .filter(([id]) => pastLegs.some((l) => l.mode === id))
                  .map(([id, label]) => (
                    <div key={id}>
                      <TransportIcon mode={id} />
                      <strong>{label}</strong>
                      <span>
                        {number(
                          pastLegs
                            .filter((l) => l.mode === id)
                            .reduce((sum, l) => sum + l.distanceKm, 0),
                        )}{" "}
                        km
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
      {scope && (trip || holiday) && (
        <>
          <div className="travel-detail-intro">
            {detailCover && (
              <button
                className="travel-detail-cover"
                onClick={() => onLightbox(photos, 0)}
                aria-label="Reisefotos groß ansehen"
              >
                <img src={`/api/attachments/${detailCover.id}`} alt="" />
                <span>
                  <Camera size={15} />
                  {photos.length} Reisefotos
                </span>
              </button>
            )}
            <div
              className={
                "travel-detail-summary " + (!detailCover ? "no-cover" : "")
              }
            >
              <div className="travel-metrics">
                <Metric
                  icon={holiday ? Sun : CalendarDays}
                  value={
                    holiday
                      ? number(hs!.awayPercent) + "%"
                      : String(inclusiveDays(trip!.startAt, trip!.endAt))
                  }
                  label={
                    holiday
                      ? "Deiner Ferien unterwegs"
                      : "Tage voller Geschichten"
                  }
                  hint={
                    holiday
                      ? `${hs!.daysAway} von ${hs!.periodDays} Tagen · ${hs!.daysHome} ohne Urlaub`
                      : status(trip!)
                  }
                />
                <Metric
                  icon={Route}
                  value={number(stats.distanceKm) + " km"}
                  label="Erfasste Reisewege"
                  hint={`${legs.length} Etappen · Luftlinie oder manuell`}
                />
                <Metric
                  icon={BookOpen}
                  value={String(memories.filter((m) => !m.draft).length)}
                  label="Tagebucheinträge"
                  hint={`${photos.length} Bilder · ${new Set([...memories.flatMap((m) => (m.placeId ? [m.placeId] : [])), ...scopedTrips.flatMap((t) => (t.placeId ? [t.placeId] : []))]).size} gespeicherte Orte`}
                />
              </div>
              {(trip?.description || holiday?.description) && (
                <p className="travel-description">
                  {trip?.description || holiday?.description}
                </p>
              )}
              {trip && trip.people.length > 0 && (
                <div className="travel-companions">
                  <span>Mit dabei</span>
                  {trip.people.map((p) => (
                    <span className="person-choice" key={p.id}>
                      <Avatar person={p} size="tiny" />
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              {holiday && (
                <div className="travel-holiday-progress large">
                  <span
                    style={{
                      width: hs!.awayPercent + "%",
                      background: holiday.color,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="travel-detail-navigation">
            <div className="travel-subtabs">
              {[
                ...(holiday ? [["trips", "Urlaube", Compass]] : []),
                ["diary", "Tagebuch", BookOpen],
                ["map", "Karte", MapPin],
                ["photos", "Fotos", Camera],
                ["legs", "Reisewege", Route],
                ["calendar", "Kalender", CalendarDays],
              ].map(([id, label, Icon]) => (
                <button
                  key={String(id)}
                  aria-pressed={detailTab === id}
                  onClick={() => setDetailTab(String(id))}
                >
                  {typeof Icon !== "string" && <Icon size={15} />}{" "}
                  {String(label)}
                </button>
              ))}
            </div>
          </div>
          {detailTab === "trips" && holiday && (
            <>
              <div className="travel-section-toolbar">
                <div>
                  <h2>Ein Ferienzeitraum. Viele kleine Abenteuer.</h2>
                  <p>
                    {scopedTrips.length} Urlaube in {holiday.name}
                  </p>
                </div>
                <button className="button primary" onClick={() => createTrip()}>
                  <Plus size={16} /> Urlaub hinzufügen
                </button>
              </div>
              {scopedTrips.length ? (
                <div className="travel-trip-grid">
                  {scopedTrips.map(tripCard)}
                </div>
              ) : (
                <div className="travel-empty">
                  <Compass size={34} />
                  <h3>Deine Ferien haben noch Platz.</h3>
                  <p>
                    Trage einen Urlaub ein und beobachte, wie sich dein
                    Ferienkalender füllt.
                  </p>
                </div>
              )}
            </>
          )}
          {detailTab === "diary" && (
            <>
              <div className="travel-section-toolbar">
                <div>
                  <h2>
                    {trip
                      ? "Dein Reisetagebuch"
                      : "Alle Geschichten deiner Ferien"}
                  </h2>
                  <p>
                    Große Erlebnisse, kleine Abstecher und der Ort dazwischen.
                  </p>
                </div>
                <button className="button primary" onClick={newEntry}>
                  <Plus size={16} /> Tagebucheintrag
                </button>
              </div>
              {memories.length ? (
                <div className="travel-diary">
                  {memories.map((m) => (
                    <button
                      className="travel-diary-entry"
                      onClick={() => onMemory(m)}
                      key={m.id}
                    >
                      <span className="travel-diary-date">
                        <strong>{new Date(m.startAt).getUTCDate()}</strong>
                        <small>
                          {new Date(m.startAt).toLocaleDateString("de-DE", {
                            month: "short",
                            timeZone: "UTC",
                          })}
                        </small>
                      </span>
                      <span className="travel-diary-body">
                        <span className="travel-diary-tags">
                          {m.draft && <span className="pill">Entwurf</span>}
                          <small>
                            {data.trips.find((t) => t.id === m.tripId)?.title}
                          </small>
                        </span>
                        <h3>{m.title}</h3>
                        <p>
                          {m.content ||
                            "Dieser Moment ist in Bildern festgehalten."}
                        </p>
                        {m.place && (
                          <small>
                            <MapPin size={13} />
                            {m.place.name}
                          </small>
                        )}
                      </span>
                      {m.attachments[0] && (
                        <img
                          loading="lazy"
                          src={`/api/attachments/${m.attachments[0].id}?thumb=1`}
                          alt=""
                        />
                      )}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="travel-empty">
                  <BookOpen size={33} />
                  <h3>Was möchtest du von dieser Reise behalten?</h3>
                  <p>
                    Jeder Eintrag kann seinen eigenen Ort und seine eigenen
                    Fotos haben.
                  </p>
                  <button className="button" onClick={newEntry}>
                    Ersten Tagebucheintrag schreiben
                  </button>
                </div>
              )}
            </>
          )}
          {detailTab === "map" && (
            <TravelMap
              data={data}
              trips={scopedTrips}
              memories={memories}
              photos={photos}
              legs={legs}
              onMemory={onMemory}
              onPhoto={setSelectedPhoto}
              onTrip={(id) => select({ kind: "trip", id })}
            />
          )}
          {detailTab === "photos" && (
            <>
              <div className="travel-section-toolbar">
                <div>
                  <h2>Deine Reise in Bildern</h2>
                  <p>{photos.length} private Bilder</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setImporting(true)}
                >
                  <ImagePlus size={16} /> Fotos importieren
                </button>
              </div>
              <PhotoGrid
                photos={photos}
                data={data}
                onPhoto={setSelectedPhoto}
              />
            </>
          )}
          {detailTab === "legs" && (
            <>
              <div className="travel-section-toolbar">
                <div>
                  <h2>Von hier nach dort.</h2>
                  <p>
                    {holiday
                      ? "Alle Reisewege deiner Ferien, auch zwischen zwei Urlauben."
                      : "Anreise, Ausflüge, Heimweg – jede Etappe zählt."}
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setLegEditor({})}
                >
                  <Plus size={16} /> Etappe hinzufügen
                </button>
              </div>
              {legs.length ? (
                <div className="travel-legs-list">
                  {legs.map((l) => (
                    <article key={l.id}>
                      <span className="travel-transport-icon">
                        <TransportIcon mode={l.mode} />
                      </span>
                      <div className="travel-leg-main">
                        <small>
                          {fmtDate(l.departureAt, true)} ·{" "}
                          {transportLabels[l.mode]}
                          {!l.tripId ? " · Zwischen den Urlauben" : ""}
                        </small>
                        <h3>
                          {l.fromPlace.name} <ArrowRight size={16} />{" "}
                          {l.toPlace.name}
                        </h3>
                        {l.notes && <p>{l.notes}</p>}
                      </div>
                      <div className="travel-leg-distance">
                        <strong>{number(l.distanceKm)} km</strong>
                        <small>
                          {l.distanceSource === "manual"
                            ? "Manuell erfasst"
                            : "Luftlinie"}
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Etappe ${l.fromPlace.name} nach ${l.toPlace.name} bearbeiten`}
                        onClick={() => setLegEditor({ leg: l })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Etappe löschen"
                        onClick={() =>
                          setConfirm({
                            endpoint: "travel-legs/" + l.id,
                            title: "Diese Reiseetappe löschen?",
                            description:
                              "Die Etappe und ihre Kilometer werden aus deinen Reisestatistiken entfernt.",
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="travel-empty">
                  <Route size={34} />
                  <h3>Auch die Kilometer erzählen etwas.</h3>
                  <p>
                    Füge deine erste Fahrt oder deinen ersten Flug hinzu. Die
                    Distanz berechnen wir aus den beiden Orten.
                  </p>
                </div>
              )}
              <div className="travel-route-total">
                <strong>
                  Gesamt <span>{number(stats.distanceKm)} km</span>
                </strong>
                <p>
                  {legs.filter((l) => l.distanceSource === "airline").length}{" "}
                  Etappen mit Luftlinie ·{" "}
                  {legs.filter((l) => l.distanceSource === "manual").length}{" "}
                  manuell erfasst. Luftlinien sind keine gefahrenen
                  Straßenkilometer.
                </p>
              </div>
            </>
          )}
          {detailTab === "calendar" && (
            <TravelCalendar
              data={data}
              displayedScope={
                trip ? { tripId: trip.id } : { holidayPeriodId: holiday?.id }
              }
              onTrip={(id) => select({ kind: "trip", id })}
              onHoliday={(id) => select({ kind: "holiday", id })}
              onMemory={onMemory}
              onCreate={(date) =>
                trip
                  ? onNewMemory({ tripId: trip.id, startAt: date })
                  : createTrip(date)
              }
            />
          )}
        </>
      )}
      {entryTripPicker && (
        <Modal
          open
          onClose={() => setEntryTripPicker(false)}
          title="Zu welchem Urlaub gehört dieser Moment?"
          description="So bleibt dein Eintrag im richtigen Reisetagebuch."
        >
          <div className="editor-form">
            {scopedTrips.map((t) => (
              <button
                className="button"
                key={t.id}
                onClick={() => {
                  setEntryTripPicker(false);
                  entryForTrip(t);
                }}
              >
                <Compass size={16} />
                {t.title}
                <span className="muted">{range(t.startAt, t.endAt)}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {holidayEditor && (
        <HolidayEditor
          {...holidayEditor}
          data={data}
          onClose={() => setHolidayEditor(null)}
          onSaved={(id) => {
            setHolidayEditor(null);
            refresh();
            notify("Ferien gespeichert");
            select({ kind: "holiday", id });
          }}
        />
      )}
      {tripEditor && (
        <TripEditor
          {...tripEditor}
          data={data}
          onClose={() => setTripEditor(null)}
          onRefresh={refresh}
          onSaved={(id) => void tripSaved(id)}
        />
      )}
      {legEditor && (
        <LegEditor
          {...legEditor}
          data={data}
          tripId={trip?.id}
          holidayPeriodId={holiday?.id}
          onClose={() => setLegEditor(null)}
          onRefresh={refresh}
          onSaved={() => {
            setLegEditor(null);
            refresh();
            notify("Reiseetappe gespeichert");
          }}
        />
      )}
      {importing && (
        <PhotoImport
          data={data}
          tripId={trip?.id}
          onClose={() => {
            setImporting(false);
            if (scope) setDetailTab("photos");
            else setMode("photos");
          }}
          onRefresh={refresh}
        />
      )}
      {selectedPhoto && (
        <PhotoDetails
          photo={selectedPhoto}
          data={data}
          onClose={() => setSelectedPhoto(null)}
          onRefresh={refresh}
          onMemory={onMemory}
          onNewMemory={onNewMemory}
          onLightbox={() =>
            onLightbox(
              photos,
              Math.max(
                0,
                photos.findIndex((p) => p.id === selectedPhoto.id),
              ),
            )
          }
        />
      )}
      {travelSettings && (
        <TravelSettings
          data={data}
          onClose={() => setTravelSettings(false)}
          refresh={refresh}
          notify={notify}
        />
      )}
      {confirm && (
        <Modal
          open
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          title={confirm.title}
          description={confirm.description}
        >
          <div className="confirm-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Abbrechen
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(confirm.endpoint, "DELETE");
                  if (!confirm.endpoint.startsWith("travel-legs")) select(null);
                  setConfirm(null);
                  refresh();
                  notify("Eintrag entfernt");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Löschen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  hint,
}: {
  icon: typeof Sun;
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="travel-metric">
      <span>
        <Icon size={19} />
      </span>
      <strong>{value}</strong>
      <p>{label}</p>
      <small>{hint}</small>
    </div>
  );
}
export function TravelSettings({
  data,
  onClose,
  refresh,
  notify,
}: {
  data: AppData;
  onClose: () => void;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [v, set] = useState({
      homePlaceId: data.settings.homePlaceId || "",
      detectionMinDays: data.settings.detectionMinDays || 2,
      detectionRadiusKm: data.settings.detectionRadiusKm || 50,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Von zuhause in die Welt."
      description="Die Reiseerkennung läuft auf deinem Server und macht ausschließlich Vorschläge."
    >
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("settings", "PATCH", v);
            refresh();
            notify("Reiseerkennung gespeichert");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <span className="field-label">Dein Zuhause</span>
          <PlacePicker
            places={data.places}
            value={v.homePlaceId}
            onChange={(id) => set({ ...v, homePlaceId: id })}
            mapEnabled={data.settings.mapEnabled}
            onCreated={refresh}
          />
          <p className="field-hint">
            Ein Ort in deiner Heimatstadt reicht aus.
          </p>
        </div>
        <label>
          Ab wie vielen Fototagen?
          <input
            type="number"
            min="2"
            max="30"
            required
            value={v.detectionMinDays}
            onChange={(e) =>
              set({ ...v, detectionMinDays: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Mindestentfernung von zuhause (km)
          <input
            type="number"
            min="1"
            max="20000"
            required
            value={v.detectionRadiusKm}
            onChange={(e) =>
              set({ ...v, detectionRadiusKm: Number(e.target.value) })
            }
          />
        </label>
        <p className="field-hint">
          Berücksichtigt werden datierte GPS-Fotos ohne Urlaubszuordnung.
          Zeitliche Lücken und weit auseinanderliegende Aufnahmeorte trennen
          Vorschläge. Ein Fotovorschlag ersetzt keine bestätigte Reise.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          <Check size={16} /> Erkennung speichern
        </button>
      </form>
    </Modal>
  );
}
