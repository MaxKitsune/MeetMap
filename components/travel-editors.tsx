"use client";
import { DateInput } from "./date-input";
import { useState } from "react";
import { Check, LoaderCircle, Route } from "lucide-react";
import type { AppData, HolidayPeriod, Trip, TravelLeg } from "@/lib/types";
import { api, dateInput, today } from "@/lib/utils";
import { Modal, Avatar } from "./ui";
import { PlacePicker } from "./editors";

export const transportLabels: Record<string, string> = {
  car: "Auto",
  train: "Zug",
  flight: "Flug",
  bus: "Bus",
  bike: "Fahrrad",
  walk: "Zu Fuß",
  ferry: "Fähre",
  other: "Sonstiges",
};
export type TripSeed = {
  title?: string;
  startAt?: string;
  endAt?: string;
  holidayPeriodId?: string;
  placeId?: string;
  attachmentIds?: string[];
};
const colors = [
  "#b85c40",
  "#587869",
  "#627b9c",
  "#b08b51",
  "#a46c87",
  "#80709a",
];
function Footer({ busy, label }: { busy: boolean; label: string }) {
  return (
    <div className="editor-footer">
      <button className="button primary" disabled={busy} type="submit">
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Check size={16} />
        )}{" "}
        {label}
      </button>
    </div>
  );
}
export function HolidayEditor({
  holiday,
  startAt,
  data,
  onClose,
  onSaved,
}: {
  holiday?: HolidayPeriod;
  startAt?: string;
  data: AppData;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [v, set] = useState({
    name: holiday?.name || "",
    description: holiday?.description || "",
    startAt: dateInput(holiday?.startAt) || startAt || today(),
    endAt: dateInput(holiday?.endAt) || startAt || today(),
    color: holiday?.color || colors[0],
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<HolidayPeriod>(
        "holiday-periods" + (holiday ? "/" + holiday.id : ""),
        holiday ? "PATCH" : "POST",
        v,
      );
      onSaved(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={holiday ? "Ferien bearbeiten" : "Raum für eine Auszeit."}
      description="Ein Ferienzeitraum verbindet alle Urlaube darin – zum Beispiel deine Sommersemesterferien."
    >
      <form className="editor-form" onSubmit={submit}>
        <label>
          Name der Ferien
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Sommersemesterferien 2026"
            value={v.name}
            onChange={(e) => set({ ...v, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Ferienbeginn
            <DateInput
              required
              value={v.startAt}
              onChange={(e) => set({ ...v, startAt: e.target.value })}
            />
          </label>
          <label>
            Ferienende
            <DateInput
              required
              min={v.startAt}
              value={v.endAt}
              onChange={(e) => set({ ...v, endAt: e.target.value })}
            />
          </label>
        </div>
        <label>
          Was hast du vor?
          <textarea
            placeholder="Viel Zeit draußen. Neue Orte. Und ein paar freie Tage zuhause."
            value={v.description}
            maxLength={10000}
            onChange={(e) => set({ ...v, description: e.target.value })}
          />
        </label>
        <fieldset className="travel-colors">
          <legend>Farbe im Kalender</legend>
          {colors.map((c, i) => (
            <button
              type="button"
              key={c}
              style={{ background: c }}
              aria-label={`Kalenderfarbe ${i + 1}`}
              aria-pressed={v.color === c}
              onClick={() => set({ ...v, color: c })}
            >
              {v.color === c && <Check size={16} />}
            </button>
          ))}
        </fieldset>
        {holiday &&
          data.trips.some((t) => t.holidayPeriodId === holiday.id) && (
            <p className="field-hint">
              Zugehörige Urlaube müssen innerhalb dieser Ferien liegen.
            </p>
          )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Footer busy={busy} label="Ferien speichern" />
      </form>
    </Modal>
  );
}
export function TripEditor({
  trip,
  seed,
  data,
  onClose,
  onSaved,
  onRefresh,
}: {
  trip?: Trip;
  seed?: TripSeed;
  data: AppData;
  onClose: () => void;
  onSaved: (id: string) => void;
  onRefresh: () => void;
}) {
  const initialPeriod = data.holidayPeriods.find(
    (h) => h.id === seed?.holidayPeriodId,
  );
  const [v, set] = useState({
    title: trip?.title || seed?.title || "",
    description: trip?.description || "",
    startAt:
      dateInput(trip?.startAt) ||
      seed?.startAt ||
      dateInput(initialPeriod?.startAt) ||
      today(),
    endAt:
      dateInput(trip?.endAt) ||
      seed?.endAt ||
      dateInput(initialPeriod?.startAt) ||
      today(),
    holidayPeriodId: trip?.holidayPeriodId || seed?.holidayPeriodId || "",
    placeId: trip?.placeId || seed?.placeId || "",
    personIds: trip?.people.map((p) => p.id) || ([] as string[]),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const period = data.holidayPeriods.find((h) => h.id === v.holidayPeriodId);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<Trip>(
        "trips" + (trip ? "/" + trip.id : ""),
        trip ? "PATCH" : "POST",
        v,
      );
      onSaved(r.id);
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
      title={trip ? "Urlaub bearbeiten" : "Wohin zieht es dich?"}
      description="Ein Wochenende, ein Roadtrip, eine große Reise. Halte Ziele, Zeitraum und Mitreisende fest."
    >
      <form className="editor-form" onSubmit={submit}>
        <label>
          Name des Urlaubs
          <input
            autoFocus
            required
            maxLength={160}
            placeholder="Ein Sommer zwischen Bergen und Meer"
            value={v.title}
            onChange={(e) => set({ ...v, title: e.target.value })}
          />
        </label>
        <label>
          Gehört zu diesen Ferien
          <select
            value={v.holidayPeriodId}
            onChange={(e) => set({ ...v, holidayPeriodId: e.target.value })}
          >
            <option value="">Eigenständiger Urlaub</option>
            {data.holidayPeriods.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Anreise
            <DateInput
              required
              min={dateInput(period?.startAt) || undefined}
              max={dateInput(period?.endAt) || undefined}
              value={v.startAt}
              onChange={(e) => set({ ...v, startAt: e.target.value })}
            />
          </label>
          <label>
            Abreise
            <DateInput
              required
              min={v.startAt}
              max={dateInput(period?.endAt) || undefined}
              value={v.endAt}
              onChange={(e) => set({ ...v, endAt: e.target.value })}
            />
          </label>
        </div>
        <div>
          <span className="field-label">Hauptziel des Urlaubs</span>
          <PlacePicker
            places={data.places}
            value={v.placeId}
            onChange={(id) => set({ ...v, placeId: id })}
            mapEnabled={data.settings.mapEnabled}
            onCreated={onRefresh}
          />
          <p className="field-hint">
            Weitere Orte kannst du in Tagebucheinträgen und Reiseetappen
            festhalten.
          </p>
        </div>
        <div>
          <span className="field-label">Mit wem bist du unterwegs?</span>
          <div className="people-choices">
            {data.people.map((p) => (
              <button
                type="button"
                className={
                  "person-choice " +
                  (v.personIds.includes(p.id) ? "selected" : "")
                }
                aria-pressed={v.personIds.includes(p.id)}
                key={p.id}
                onClick={() =>
                  set({
                    ...v,
                    personIds: v.personIds.includes(p.id)
                      ? v.personIds.filter((id) => id !== p.id)
                      : [...v.personIds, p.id],
                  })
                }
              >
                <Avatar person={p} size="tiny" />
                {p.name}
                {v.personIds.includes(p.id) && <Check size={13} />}
              </button>
            ))}
          </div>
          {!data.people.length && (
            <p className="field-hint">
              Sobald du Menschen angelegt hast, kannst du sie hier mitnehmen.
            </p>
          )}
        </div>
        <label>
          Pläne & Notizen
          <textarea
            placeholder="Was möchtest du erleben?"
            value={v.description}
            maxLength={10000}
            onChange={(e) => set({ ...v, description: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Footer busy={busy} label="Urlaub speichern" />
      </form>
    </Modal>
  );
}
export function LegEditor({
  leg,
  tripId,
  holidayPeriodId,
  data,
  onClose,
  onSaved,
  onRefresh,
}: {
  leg?: TravelLeg;
  tripId?: string;
  holidayPeriodId?: string;
  data: AppData;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
}) {
  const trip = data.trips.find((t) => t.id === (leg?.tripId || tripId));
  const holiday = data.holidayPeriods.find(
    (h) =>
      h.id ===
      (leg?.holidayPeriodId || holidayPeriodId || trip?.holidayPeriodId),
  );
  const [v, set] = useState({
    tripId: leg?.tripId || tripId || "",
    holidayPeriodId:
      leg?.holidayPeriodId || holidayPeriodId || trip?.holidayPeriodId || "",
    fromPlaceId: leg?.fromPlaceId || data.settings.homePlaceId || "",
    toPlaceId: leg?.toPlaceId || trip?.placeId || "",
    departureAt:
      dateInput(leg?.departureAt) ||
      dateInput(trip?.startAt) ||
      dateInput(holiday?.startAt) ||
      today(),
    mode: leg?.mode || "car",
    distanceSource: leg?.distanceSource || "airline",
    distanceKm: leg?.distanceSource === "manual" ? String(leg.distanceKm) : "",
    notes: leg?.notes || "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        "travel-legs" + (leg ? "/" + leg.id : ""),
        leg ? "PATCH" : "POST",
        {
          ...v,
          distanceKm:
            v.distanceSource === "manual" ? Number(v.distanceKm) : undefined,
        },
      );
      onSaved();
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
      title={leg ? "Reiseetappe bearbeiten" : "Auch der Weg gehört dazu."}
      description="Halte Fahrten, Flüge und kleine Abstecher fest. Für Hin- und Rückreise legst du jeweils eine Etappe an."
    >
      <form className="editor-form" onSubmit={submit}>
        <label>
          Zuordnung
          <select
            value={
              v.tripId
                ? "trip:" + v.tripId
                : v.holidayPeriodId
                  ? "holiday:" + v.holidayPeriodId
                  : ""
            }
            onChange={(e) => {
              const [k, id] = e.target.value.split(":");
              const t = data.trips.find((t) => t.id === id);
              set({
                ...v,
                tripId: k === "trip" ? id : "",
                holidayPeriodId:
                  k === "holiday" ? id : t?.holidayPeriodId || "",
              });
            }}
            required
          >
            <option value="">Urlaub oder Ferien auswählen</option>
            <optgroup label="Urlaube">
              {data.trips.map((t) => (
                <option key={t.id} value={"trip:" + t.id}>
                  {t.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Zwischen Urlauben / gesamte Ferien">
              {data.holidayPeriods.map((h) => (
                <option key={h.id} value={"holiday:" + h.id}>
                  {h.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="form-grid">
          <div>
            <span className="field-label">Von</span>
            <PlacePicker
              places={data.places}
              value={v.fromPlaceId}
              onChange={(id) => set({ ...v, fromPlaceId: id })}
              mapEnabled={data.settings.mapEnabled}
              onCreated={onRefresh}
            />
          </div>
          <div>
            <span className="field-label">Nach</span>
            <PlacePicker
              places={data.places}
              value={v.toPlaceId}
              onChange={(id) => set({ ...v, toPlaceId: id })}
              mapEnabled={data.settings.mapEnabled}
              onCreated={onRefresh}
            />
          </div>
        </div>
        <div className="form-grid">
          <label>
            Reisedatum
            <DateInput
              required
              value={v.departureAt}
              onChange={(e) => set({ ...v, departureAt: e.target.value })}
            />
          </label>
          <label>
            Verkehrsmittel
            <select
              value={v.mode}
              onChange={(e) =>
                set({ ...v, mode: e.target.value as typeof v.mode })
              }
            >
              {Object.entries(transportLabels).map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="travel-distance-hint">
          <Route size={20} />
          <div>
            <strong>Deine Strecke, nachvollziehbar.</strong>
            <p>
              Automatisch berechnen wir die Luftlinie zwischen den Orten. Eine
              echte Fahrstrecke aus Tacho oder Routenplaner kannst du selbst
              eintragen.
            </p>
          </div>
        </div>
        <label>
          Distanz
          <select
            value={v.distanceSource}
            onChange={(e) =>
              set({
                ...v,
                distanceSource: e.target.value as typeof v.distanceSource,
              })
            }
          >
            <option value="airline">Automatisch · Luftlinie</option>
            <option value="manual">Tatsächliche Strecke eintragen</option>
          </select>
        </label>
        {v.distanceSource === "manual" && (
          <label>
            Zurückgelegte Kilometer
            <input
              type="number"
              min="0.1"
              max="100000"
              step="0.1"
              required
              value={v.distanceKm}
              onChange={(e) => set({ ...v, distanceKm: e.target.value })}
            />
          </label>
        )}
        <label>
          Notiz
          <input
            maxLength={2000}
            placeholder="Fensterplatz, Lieblingsplaylist, ein spontaner Zwischenstopp …"
            value={v.notes}
            onChange={(e) => set({ ...v, notes: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Footer busy={busy} label="Etappe speichern" />
      </form>
    </Modal>
  );
}
