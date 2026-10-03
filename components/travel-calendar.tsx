"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Sun,
  TentTree,
} from "lucide-react";
import type { AppData, Memory } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import "./travel-visuals.css";

type Scope = { holidayPeriodId?: string; tripId?: string };
export type TravelCalendarProps = {
  data: AppData;
  onTrip: (id: string) => void;
  onHoliday: (id: string) => void;
  onMemory: (memory: Memory) => void;
  onCreate: (date: string) => void;
  displayedScope?: Scope;
};

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const asDate = (key: string) => new Date(`${key.slice(0, 10)}T12:00:00`);
const shiftDay = (key: string, delta: number) => {
  const date = asDate(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
};
const includesDay = (key: string, start: string, end?: string | null) =>
  key >= start.slice(0, 10) && key <= (end || start).slice(0, 10);
const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const longDate = (key: string) =>
  `${asDate(key).toLocaleDateString("de-DE", { weekday: "long" })}, ${fmtDate(key, true)}`;

export default function TravelCalendar({
  data,
  onTrip,
  onHoliday,
  onMemory,
  onCreate,
  displayedScope,
}: TravelCalendarProps) {
  const now = dayKey(new Date());
  const scopedTrip = data.trips.find(
    (trip) => trip.id === displayedScope?.tripId,
  );
  const scopedHoliday = data.holidayPeriods.find(
    (holiday) =>
      holiday.id ===
      (displayedScope?.holidayPeriodId || scopedTrip?.holidayPeriodId),
  );
  const initial = (scopedTrip?.startAt || scopedHoliday?.startAt || now).slice(
    0,
    10,
  );
  const [selected, setSelected] = useState(initial);
  const createHintId = useId();
  const createAllowed =
    !scopedTrip || includesDay(selected, scopedTrip.startAt, scopedTrip.endAt);
  const [month, setMonth] = useState(
    () =>
      new Date(
        asDate(initial).getFullYear(),
        asDate(initial).getMonth(),
        1,
        12,
      ),
  );
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const scopeKey = `${displayedScope?.tripId || ""}/${displayedScope?.holidayPeriodId || ""}`;

  useEffect(() => {
    const key = (scopedTrip?.startAt || scopedHoliday?.startAt || now).slice(
      0,
      10,
    );
    setSelected(key);
    const date = asDate(key);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    // Only navigation to a different scope resets the month; refreshing data preserves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const scoped = useMemo(() => {
    const trips = data.trips.filter((trip) =>
      displayedScope?.tripId
        ? trip.id === displayedScope.tripId
        : displayedScope?.holidayPeriodId
          ? trip.holidayPeriodId === displayedScope.holidayPeriodId
          : true,
    );
    const holidays = data.holidayPeriods.filter((holiday) =>
      displayedScope?.holidayPeriodId
        ? holiday.id === displayedScope.holidayPeriodId
        : displayedScope?.tripId
          ? holiday.id === scopedTrip?.holidayPeriodId
          : true,
    );
    const tripIds = new Set(trips.map((trip) => trip.id));
    const memories = data.memories.filter(
      (memory) =>
        !memory.draft &&
        ((!displayedScope?.tripId && !displayedScope?.holidayPeriodId) ||
          (!!memory.tripId && tripIds.has(memory.tripId))),
    );
    return { trips, holidays, memories };
  }, [
    data.trips,
    data.holidayPeriods,
    data.memories,
    displayedScope?.tripId,
    displayedScope?.holidayPeriodId,
    scopedTrip?.holidayPeriodId,
  ]);

  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const cellCount =
    Math.ceil(
      (((new Date(month.getFullYear(), month.getMonth(), 1, 12).getDay() + 6) %
        7) +
        last.getDate()) /
        7,
    ) * 7;
  const days = Array.from({ length: cellCount }, (_, index) =>
    shiftDay(dayKey(first), index),
  );
  const agenda = {
    holidays: scoped.holidays.filter((item) =>
      includesDay(selected, item.startAt, item.endAt),
    ),
    trips: scoped.trips.filter((item) =>
      includesDay(selected, item.startAt, item.endAt),
    ),
    memories: scoped.memories.filter((item) =>
      includesDay(selected, item.startAt, item.endAt),
    ),
  };
  const total =
    agenda.holidays.length + agenda.trips.length + agenda.memories.length;
  const selectDay = (key: string, focus = false) => {
    setSelected(key);
    const date = asDate(key);
    if (
      date.getMonth() !== month.getMonth() ||
      date.getFullYear() !== month.getFullYear()
    )
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    if (focus)
      requestAnimationFrame(() => dayButtons.current.get(key)?.focus());
  };
  const moveMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
    setMonth(next);
    setSelected(dayKey(next));
  };

  return (
    <section className="tc-layout" aria-label="Ferien- und Urlaubskalender">
      <div className="tc-calendar">
        <div className="tc-toolbar">
          <div>
            <span className="tc-kicker">ZEIT FÜR ERINNERUNGEN</span>
            <h2 aria-live="polite">
              {month.toLocaleDateString("de-DE", {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>
          <div className="tc-navigation">
            <button
              type="button"
              className="tc-today"
              onClick={() => selectDay(now)}
            >
              Heute
            </button>
            <button
              type="button"
              className="tc-icon-button"
              aria-label="Vorheriger Monat"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              className="tc-icon-button"
              aria-label="Nächster Monat"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>
        <div className="tc-legend" aria-label="Kalenderlegende">
          <span>
            <i className="tc-dot tc-dot-holiday" />
            Ferienzeit
          </span>
          <span>
            <i className="tc-dot tc-dot-trip" />
            Urlaub
          </span>
          <span>
            <i className="tc-dot tc-dot-memory" />
            Tagebuch
          </span>
        </div>
        <div className="tc-weekdays" aria-hidden="true">
          {weekdays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className="tc-grid"
          role="group"
          aria-label={month.toLocaleDateString("de-DE", {
            month: "long",
            year: "numeric",
          })}
        >
          {days.map((key) => {
            const day = asDate(key);
            const holidays = scoped.holidays.filter((item) =>
              includesDay(key, item.startAt, item.endAt),
            );
            const trips = scoped.trips.filter((item) =>
              includesDay(key, item.startAt, item.endAt),
            );
            const memories = scoped.memories.filter((item) =>
              includesDay(key, item.startAt, item.endAt),
            );
            const names = [
              ...holidays.map((item) => item.name),
              ...trips.map((item) => item.title),
              ...memories.map((item) => item.title),
            ];
            return (
              <button
                key={key}
                type="button"
                ref={(node) => {
                  if (node) dayButtons.current.set(key, node);
                  else dayButtons.current.delete(key);
                }}
                className={`tc-day${day.getMonth() !== month.getMonth() ? " tc-day-outside" : ""}${holidays.length ? " tc-day-holiday" : ""}${selected === key ? " tc-day-selected" : ""}${key === now ? " tc-day-now" : ""}`}
                style={
                  holidays[0]
                    ? ({
                        "--tc-holiday-color": holidays[0].color,
                      } as CSSProperties)
                    : undefined
                }
                onClick={() => selectDay(key)}
                onKeyDown={(event) => {
                  const delta = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  }[event.key];
                  if (delta !== undefined) {
                    event.preventDefault();
                    selectDay(shiftDay(key, delta), true);
                  }
                }}
                aria-pressed={selected === key}
                tabIndex={selected === key ? 0 : -1}
                aria-current={key === now ? "date" : undefined}
                aria-label={`${longDate(key)}${names.length ? `: ${names.join(", ")}` : ": Keine Einträge"}`}
              >
                <span className="tc-day-number">{day.getDate()}</span>
                <span className="tc-day-events" aria-hidden="true">
                  {!!holidays.length && (
                    <span className="tc-holiday-caption">
                      <Sun size={11} />
                      <span>{holidays[0].name}</span>
                      {holidays.length > 1 && <b>+{holidays.length - 1}</b>}
                    </span>
                  )}
                  {trips.slice(0, 2).map((trip) => (
                    <span className="tc-trip-bar" key={trip.id}>
                      {trip.title}
                    </span>
                  ))}
                  {!!memories.length && (
                    <span className="tc-memory-count">
                      <span className="tc-dot tc-dot-memory" />
                      {memories.length}{" "}
                      {memories.length === 1 ? "Eintrag" : "Einträge"}
                    </span>
                  )}
                  {trips.length > 2 && (
                    <span className="tc-more">+{trips.length - 2} weitere</span>
                  )}
                </span>
                <span className="tc-mobile-dots" aria-hidden="true">
                  {!!holidays.length && <i className="tc-dot tc-dot-holiday" />}
                  {!!trips.length && <i className="tc-dot tc-dot-trip" />}
                  {!!memories.length && <i className="tc-dot tc-dot-memory" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="tc-calendar-hint">
          Wähle einen Tag, um seine Reisen und Einträge zu entdecken.
        </p>
      </div>
      <aside className="tc-agenda" aria-label="Ausgewählter Tag">
        <header className="tc-agenda-header">
          <span className="tc-kicker">DEIN TAG</span>
          <h3 aria-live="polite">{fmtDate(selected, true)}</h3>
          <p>
            {asDate(selected).toLocaleDateString("de-DE", {
              weekday: "long",
            })}
          </p>
        </header>
        {total === 0 && (
          <div className="tc-empty-day">
            <CalendarDays size={31} strokeWidth={1.3} />
            <strong>Ein bisschen Platz für Neues.</strong>
            <p>
              Hier ist noch nichts eingetragen. Halte einen besonderen Moment
              fest.
            </p>
          </div>
        )}
        <div className="tc-agenda-items">
          {agenda.holidays.map((holiday) => (
            <button
              type="button"
              className="tc-agenda-item tc-agenda-holiday"
              style={{ "--tc-holiday-color": holiday.color } as CSSProperties}
              key={holiday.id}
              onClick={() => onHoliday(holiday.id)}
            >
              <span className="tc-agenda-icon">
                <Sun size={17} />
              </span>
              <span>
                <small>FERIENZEIT</small>
                <strong>{holiday.name}</strong>
                <em>
                  {fmtDate(holiday.startAt)} – {fmtDate(holiday.endAt)}
                </em>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {agenda.trips.map((trip) => (
            <button
              type="button"
              className="tc-agenda-item tc-agenda-trip"
              key={trip.id}
              onClick={() => onTrip(trip.id)}
            >
              <span className="tc-agenda-icon">
                <TentTree size={17} />
              </span>
              <span>
                <small>URLAUB</small>
                <strong>{trip.title}</strong>
                <em>
                  {trip.place ? (
                    <>
                      <MapPin size={11} />
                      {trip.place.name}
                    </>
                  ) : (
                    `${fmtDate(trip.startAt)} – ${fmtDate(trip.endAt)}`
                  )}
                </em>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {agenda.memories.map((memory) => (
            <button
              type="button"
              className="tc-agenda-item tc-agenda-memory"
              key={memory.id}
              onClick={() => onMemory(memory)}
            >
              <span className="tc-agenda-icon">
                {memory.attachments[0] ? (
                  <img
                    src={`/api/attachments/${memory.attachments[0].id}?thumb=1`}
                    alt=""
                  />
                ) : (
                  <BookOpen size={17} />
                )}
              </span>
              <span>
                <small>TAGEBUCH</small>
                <strong>{memory.title}</strong>
                {memory.place && (
                  <em>
                    <MapPin size={11} />
                    {memory.place.name}
                  </em>
                )}
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button tc-create"
          disabled={!createAllowed}
          aria-describedby={!createAllowed ? createHintId : undefined}
          onClick={() => {
            if (createAllowed) onCreate(selected);
          }}
        >
          <Plus size={16} />
          Eintrag hinzufügen
        </button>
        {!createAllowed && scopedTrip && (
          <p id={createHintId} className="tc-create-hint">
            Wähle einen Tag innerhalb dieses Urlaubs:{" "}
            {fmtDate(scopedTrip.startAt, true)} –{" "}
            {fmtDate(scopedTrip.endAt, true)}.
          </p>
        )}
      </aside>
    </section>
  );
}
