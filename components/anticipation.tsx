"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Heart,
  Plane,
  Plus,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import type { Anticipation, AppData, Memory } from "@/lib/types";
import { api, dateInput, fmtDate, today } from "@/lib/utils";
import { utcDay } from "@/lib/travel";
import { Modal } from "./ui";
import { DateInput } from "./date-input";
import "./anticipation.css";

export default function AnticipationWidget({
  data,
  onTrip,
  onHoliday,
  onMemory,
  refresh,
  notify,
}: {
  data: AppData;
  onTrip: (id: string) => void;
  onHoliday: (id: string) => void;
  onMemory: (m: Memory) => void;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [day, setDay] = useState<string | null>(null),
    [editor, setEditor] = useState<Anticipation | true | null>(null),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const update = () => setDay(today());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  const items = [
    ...data.anticipations.map((a) => ({
      key: "a" + a.id,
      title: a.title,
      date: a.date,
      kind: "Dein Vorfreude-Moment",
      icon: Heart,
      open: () => setEditor(a),
    })),
    ...data.trips.map((t) => ({
      key: "t" + t.id,
      title: t.title,
      date: t.startAt,
      kind: "Dein nächster Urlaub",
      icon: Plane,
      open: () => onTrip(t.id),
    })),
    ...data.holidayPeriods.map((h) => ({
      key: "h" + h.id,
      title: h.name,
      date: h.startAt,
      kind: "Deine Ferien beginnen",
      icon: Sun,
      open: () => onHoliday(h.id),
    })),
    ...data.memories
      .filter((m) => !m.draft && m.type === "Event")
      .map((m) => ({
        key: "m" + m.id,
        title: m.title,
        date: m.startAt,
        kind: "Ein vorgemerkter Termin",
        icon: Sparkles,
        open: () => onMemory(m),
      })),
  ]
    .filter((i) => day && dateInput(i.date) >= day)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="anticipation-panel panel">
      <div className="section-heading">
        <h2>Darauf kannst du dich freuen</h2>
        <Sparkles size={19} />
      </div>
      <p className="anticipation-intro">Ein bisschen Vorfreude gehört dazu.</p>
      {!day ? (
        <p className="small-empty">Deine nächsten Momente werden geladen …</p>
      ) : items.length ? (
        <div className="anticipation-list">
          {items.slice(0, expanded ? items.length : 3).map((i) => {
            const days = utcDay(i.date) - utcDay(day);
            const Icon = i.icon;
            return (
              <button
                className="anticipation-item"
                key={i.key}
                onClick={i.open}
              >
                <span className="anticipation-icon">
                  <Icon size={17} />
                </span>
                <span>
                  <strong>{i.title}</strong>
                  <small>
                    {fmtDate(i.date)} · {i.kind}
                  </small>
                </span>
                <span className="anticipation-count">
                  <strong>{days === 0 ? "Heute" : `noch ${days}`}</strong>
                  <small>
                    {days === 0
                      ? "ist es so weit"
                      : days === 1
                        ? "Tag"
                        : "Tage"}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="anticipation-empty">
          <Heart size={22} />
          <p>
            Die nächste Reise, ein Konzert oder ein Wiedersehen. Gib deiner
            Vorfreude ein Datum.
          </p>
        </div>
      )}
      <div className="anticipation-footer">
        <button className="text-button" onClick={() => setEditor(true)}>
          <Plus size={14} /> Moment vormerken
        </button>
        {items.length > 3 && (
          <button
            className="text-button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Weniger" : `Alle ${items.length}`}
          </button>
        )}
      </div>
      {editor && (
        <AnticipationEditor
          item={editor === true ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
            notify("Dein Vorfreude-Moment ist gespeichert");
          }}
        />
      )}
    </section>
  );
}
function AnticipationEditor({
  item,
  onClose,
  onSaved,
}: {
  item?: Anticipation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, set] = useState({
      title: item?.title || "",
      date: dateInput(item?.date) || today(),
      note: item?.note || "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState(false);
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={item ? "Dein Vorfreude-Moment" : "Worauf freust du dich?"}
      description="Ein Datum, ein guter Gedanke – und ein kleiner Countdown bis dahin."
    >
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(
              "anticipations" + (item ? "/" + item.id : ""),
              item ? "PATCH" : "POST",
              v,
            );
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Darauf freue ich mich
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Ein Wochenende mit meinen Freunden"
            value={v.title}
            onChange={(e) => set({ ...v, title: e.target.value })}
          />
        </label>
        <label>
          Wann ist es so weit?
          <DateInput
            required
            min={today()}
            value={v.date}
            onChange={(e) => set({ ...v, date: e.target.value })}
          />
        </label>
        <label>
          Ein Gedanke dazu
          <textarea
            maxLength={2000}
            placeholder="Was macht diesen Moment besonders?"
            value={v.note}
            onChange={(e) => set({ ...v, note: e.target.value })}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-footer">
          {item && (
            <button
              type="button"
              className="danger-link"
              onClick={() => setRemove(true)}
            >
              <Trash2 size={14} /> Entfernen
            </button>
          )}
          <button className="button primary" disabled={busy}>
            <Check size={16} /> Moment speichern
          </button>
        </div>
        {remove && (
          <div className="anticipation-delete">
            <p>Diesen vorgemerkten Moment dauerhaft entfernen?</p>
            <button
              type="button"
              className="button"
              onClick={() => setRemove(false)}
            >
              Behalten
            </button>
            <button
              type="button"
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("anticipations/" + item!.id, "DELETE");
                  onSaved();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Entfernen
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
