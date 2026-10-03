"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CalendarDays, Expand, Minus, Plus } from "lucide-react";
import type { AppData, Memory, Person } from "@/lib/types";
import { Avatar, Empty } from "./ui";
import { fmtDate } from "@/lib/utils";
import "./timeline.css";

const DAY = 86_400_000;
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8];
export function timelineGeometry(viewport: number, zoom: number) {
  const width = Math.max(1, Number.isFinite(viewport) ? viewport : 800);
  const labelWidth =
    width < 360
      ? Math.min(112, Math.round(width * 0.36))
      : width < 600
        ? 112
        : 170;
  const available = width - labelWidth;
  const trackWidth = available * Math.max(1, Math.min(8, zoom));
  return { labelWidth, available, trackWidth, width: labelWidth + trackWidth };
}
export function timelineTicks(start: number, end: number, width: number) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    width <= 0
  )
    return [];
  const spacing = ((end - start) / width) * 100;
  const choices = [
    { unit: "day", step: 1, duration: DAY },
    { unit: "day", step: 2, duration: 2 * DAY },
    { unit: "day", step: 7, duration: 7 * DAY },
    { unit: "day", step: 14, duration: 14 * DAY },
    { unit: "month", step: 1, duration: 30.44 * DAY },
    { unit: "month", step: 3, duration: 91.32 * DAY },
    { unit: "month", step: 6, duration: 182.64 * DAY },
    ...[1, 2, 5, 10, 20, 50, 100, 500].map((step) => ({
      unit: "year",
      step,
      duration: step * 365.25 * DAY,
    })),
  ];
  const interval =
    choices.find((choice) => choice.duration >= spacing) || choices.at(-1)!;
  const date = new Date(start);
  let cursor: number;
  if (interval.unit === "year")
    cursor = Date.UTC(
      Math.floor(date.getUTCFullYear() / interval.step) * interval.step,
      0,
      1,
    );
  else if (interval.unit === "month") {
    const month =
      Math.floor(
        (date.getUTCFullYear() * 12 + date.getUTCMonth()) / interval.step,
      ) * interval.step;
    cursor = Date.UTC(Math.floor(month / 12), month % 12, 1);
  } else {
    const origin = interval.step >= 7 ? 4 : 0; // Week ticks start on Monday.
    cursor =
      (Math.floor((Math.floor(start / DAY) - origin) / interval.step) *
        interval.step +
        origin) *
      DAY;
  }
  const advance = (value: number) => {
    const d = new Date(value);
    if (interval.unit === "year")
      return Date.UTC(d.getUTCFullYear() + interval.step, 0, 1);
    if (interval.unit === "month")
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + interval.step, 1);
    return value + interval.step * DAY;
  };
  const ticks: { at: number; label: string; left: number }[] = [];
  for (
    let safety = 0;
    cursor <= end && safety < 2000;
    safety++, cursor = advance(cursor)
  ) {
    if (cursor < start) continue;
    const d = new Date(cursor);
    const label =
      interval.unit === "year"
        ? String(d.getUTCFullYear())
        : interval.unit === "month"
          ? d.toLocaleDateString("de-DE", {
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })
          : `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    ticks.push({
      at: cursor,
      label,
      left: ((cursor - start) / (end - start)) * width,
    });
  }
  return ticks;
}
export default function Timeline({
  data,
  onPerson,
  onMemory,
}: {
  data: AppData;
  onPerson: (p: Person) => void;
  onMemory: (m: Memory) => void;
}) {
  const [filter, setFilter] = useState(""),
    [tag, setTag] = useState(""),
    [zoom, setZoom] = useState(1),
    [period, setPeriod] = useState("all");
  const people = data.people.filter(
    (p) => (!filter || p.id === filter) && (!tag || p.tags.includes(tag)),
  );
  const memories = data.memories.filter(
    (m) =>
      !m.draft &&
      (!filter || m.people.some((p) => p.id === filter)) &&
      (!tag || m.people.some((p) => p.tags.includes(tag))),
  );
  const [now] = useState(() => Date.now());
  const scroll = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<number | null>(null);
  const [viewport, setViewport] = useState(800);
  const [scrollLeft, setScrollLeft] = useState(0);
  const geometry = timelineGeometry(viewport, zoom);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (!element.clientWidth) return;
      const previous = geometryRef.current;
      pendingAnchor.current =
        (element.scrollLeft + previous.available / 2) / previous.trackWidth;
      setViewport(element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    if (zoom === 1) element.scrollLeft = 0;
    else if (pendingAnchor.current !== null)
      element.scrollLeft =
        pendingAnchor.current * geometry.trackWidth - geometry.available / 2;
    pendingAnchor.current = null;
    setScrollLeft(element.scrollLeft);
  }, [zoom, viewport, geometry.trackWidth, geometry.available]);
  const dates = [
    ...people.flatMap((person) =>
      [person.metAt, person.endedAt]
        .filter(Boolean)
        .map((date) => new Date(date!).getTime()),
    ),
    ...memories.flatMap((memory) =>
      [memory.startAt, memory.endAt]
        .filter(Boolean)
        .map((date) => new Date(date!).getTime()),
    ),
    now,
  ].filter(Number.isFinite);
  const firstDate = Math.min(...dates),
    lastDate = Math.max(...dates);
  const padding = Math.max(90 * DAY, lastDate - firstDate) * 0.04;
  const start = period === "year" ? now - 365.25 * DAY : firstDate - padding;
  const end = period === "year" ? now : lastDate + padding;
  const span = end - start;
  const pos = (value: string | number) =>
    Math.max(
      0,
      Math.min(
        geometry.trackWidth,
        (((typeof value === "number" ? value : new Date(value).getTime()) -
          start) /
          span) *
          geometry.trackWidth,
      ),
    );
  const ticks = useMemo(
    () => timelineTicks(start, end, geometry.trackWidth),
    [start, end, geometry.trackWidth],
  );
  const visiblePeople = people.filter(
    (person) =>
      person.metAt &&
      new Date(person.metAt).getTime() <= end &&
      new Date(person.endedAt || now).getTime() >= start,
  );
  const changeZoom = (next: number) => {
    if (scroll.current)
      pendingAnchor.current =
        (scroll.current.scrollLeft + geometry.available / 2) /
        geometry.trackWidth;
    setZoom(next);
  };
  const shownStart = start + (scrollLeft / geometry.trackWidth) * span;
  const shownEnd = Math.min(
    end,
    shownStart + (geometry.available / geometry.trackWidth) * span,
  );
  const groups = [...memories]
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .reduce<Record<string, Memory[]>>((result, m) => {
      if (
        new Date(m.startAt).getTime() < start ||
        new Date(m.startAt).getTime() > end
      )
        return result;
      const key = new Date(m.startAt).toLocaleDateString("de-DE", {
        month: "long",
        year: "numeric",
      });
      (result[key] ||= []).push(m);
      return result;
    }, {});
  return (
    <>
      <div className="view-toolbar tl-toolbar">
        <div className="filter-controls tl-filters">
          <select
            aria-label="Timeline nach Person filtern"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Alle Menschen</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Timeline nach Verbindung filtern"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Alle Verbindungen</option>
            {[...new Set(data.people.flatMap((p) => p.tags))].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="Zeitraum"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Mein ganzes Leben</option>
            <option value="year">Letzte 12 Monate</option>
          </select>
        </div>
        <div className="button-row tl-zoom-controls">
          <button
            className="icon-button bordered"
            aria-label="Zeitstrahl verkleinern"
            disabled={zoom === ZOOMS[0]}
            onClick={() =>
              changeZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])
            }
          >
            <Minus size={16} />
          </button>
          <button
            className="icon-button bordered"
            aria-label="Zeitstrahl vergrößern"
            disabled={zoom === ZOOMS[ZOOMS.length - 1]}
            onClick={() =>
              changeZoom(
                ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)],
              )
            }
          >
            <Plus size={16} />
          </button>
          <output
            className="tl-zoom-value"
            aria-label="Zeitstrahl Zoom"
            aria-live="polite"
          >
            {zoom.toLocaleString("de-DE")}×
          </output>
          <button className="button small" onClick={() => changeZoom(1)}>
            <Expand size={14} />
            Einpassen
          </button>
        </div>
      </div>
      <section className="timeline-card">
        <div className="section-heading tl-section-heading">
          <div>
            <h2>Menschen, die dich begleiten</h2>
            <p>Entdecke, wie eure Geschichte gewachsen ist.</p>
          </div>
          <span className="pill">{people.length} Verbindungen</span>
        </div>
        <div className="tl-scale-heading">
          <span>
            <CalendarDays size={14} />
            {fmtDate(new Date(start).toISOString(), true)} –{" "}
            {fmtDate(new Date(end).toISOString(), true)}
          </span>
          <small>
            {zoom === 1
              ? "Der ganze Zeitraum auf einen Blick"
              : "Seitlich scrollen, um weiterzureisen"}
          </small>
        </div>
        <div
          ref={scroll}
          className="tl-scroll"
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          tabIndex={0}
          aria-label="Zoombarer Zeitstrahl. Bei vergrößerter Ansicht horizontal scrollen."
        >
          <div
            className="tl-chart"
            style={
              {
                width: geometry.width,
                "--tl-label-width": `${geometry.labelWidth}px`,
              } as CSSProperties
            }
          >
            <div className="tl-axis-row">
              <div className="tl-label-head">DEINE MENSCHEN</div>
              <div className="tl-axis" style={{ width: geometry.trackWidth }}>
                {ticks.map((tick) => (
                  <span
                    className="tl-tick"
                    key={tick.at}
                    style={{ left: tick.left }}
                    title={fmtDate(new Date(tick.at).toISOString(), true)}
                  >
                    {tick.label}
                  </span>
                ))}
                {now >= start && now <= end && (
                  <span className="tl-today-label" style={{ left: pos(now) }}>
                    Heute
                  </span>
                )}
              </div>
            </div>
            {visiblePeople.map((person, index) => {
              const left = pos(person.metAt!);
              const right = pos(person.endedAt || now);
              const barWidth = Math.max(4, right - left);
              const label = `${person.name}: ${fmtDate(person.metAt, true)} – ${person.endedAt ? fmtDate(person.endedAt, true) : "heute"}`;
              return (
                <div className="tl-row" key={person.id}>
                  <button
                    className="tl-person"
                    onClick={() => onPerson(person)}
                  >
                    <Avatar person={person} size="small" />
                    <span>{person.name}</span>
                  </button>
                  <div
                    className="tl-track"
                    style={{ width: geometry.trackWidth }}
                  >
                    {ticks.map((tick) => (
                      <i
                        className="tl-grid-line"
                        key={tick.at}
                        style={{ left: tick.left }}
                      />
                    ))}
                    {now >= start && now <= end && (
                      <i className="tl-today-line" style={{ left: pos(now) }} />
                    )}
                    <button
                      className={`tl-relationship tl-bar-${index % 4}${person.endedAt ? " tl-relationship-ended" : ""}`}
                      style={{
                        left,
                        width: Math.min(barWidth, geometry.trackWidth - left),
                      }}
                      onClick={() => onPerson(person)}
                      title={label}
                      aria-label={label}
                    >
                      {barWidth > 95 && (
                        <span>{person.tags[0] || "Verbunden"}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {visiblePeople.length === 0 && (
          <Empty
            kind="person"
            title={
              people.some((person) => person.metAt)
                ? "In diesem Zeitraum ist noch alles offen"
                : "Jede Geschichte hat einen Anfang"
            }
            description={
              people.some((person) => person.metAt)
                ? "Erweitere den Zeitraum oder wähle eine andere Verbindung."
                : "Trage bei einer Person ein Kennenlerndatum ein, um eure Verbindung hier zu sehen."
            }
          />
        )}
        {zoom > 1 && (
          <p className="tl-visible-range">
            Sichtbarer Ausschnitt:{" "}
            {fmtDate(new Date(shownStart).toISOString(), true)} –{" "}
            {fmtDate(new Date(shownEnd).toISOString(), true)}
          </p>
        )}
      </section>
      <div className="section-heading timeline-memory-heading">
        <h2>Momente entlang des Weges</h2>
        <CalendarDays size={19} />
      </div>
      {!Object.keys(groups).length ? (
        <Empty
          title="Die Geschichte beginnt mit einem Moment"
          description="Deine gespeicherten Erinnerungen erscheinen hier in zeitlicher Reihenfolge."
        />
      ) : (
        Object.entries(groups).map(([month, items]) => (
          <section className="timeline-month" key={month}>
            <h3>{month}</h3>
            <div className="timeline-events">
              {items.map((m) => (
                <button
                  key={m.id}
                  className="timeline-event"
                  onClick={() => onMemory(m)}
                >
                  <span className="event-node" />
                  <span className="event-date">{fmtDate(m.startAt)}</span>
                  {m.attachments[0] && (
                    <img
                      src={`/api/attachments/${m.attachments[0].id}?thumb=1`}
                      alt=""
                    />
                  )}
                  <span className="event-text">
                    <strong>{m.title}</strong>
                    <span>
                      {m.place?.name || m.type} ·{" "}
                      {m.people.map((p) => p.name.split(" ")[0]).join(", ") ||
                        "Nur du"}
                    </span>
                  </span>
                  <span className="pill">{m.type}</span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
