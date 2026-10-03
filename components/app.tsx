"use client";
import { DateInput } from "./date-input";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Ellipsis,
  ExternalLink,
  Gift,
  Heart,
  House,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Map,
  MapPin,
  Menu,
  Plus,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  Pin,
  Globe,
  Route,
} from "lucide-react";
import type {
  AppData,
  Attachment,
  Memory,
  Person,
  Place,
  View,
} from "@/lib/types";
import {
  api,
  birthdayIn,
  daysSince,
  fmtDate,
  fuzzyMatch,
  initials,
} from "@/lib/utils";
import { Avatar, Empty, MemoryCard, Modal } from "./ui";
import { MemoryEditor, PersonEditor } from "./editors";
import Timeline from "./timeline";
import TravelWorkspace, { TravelSettings } from "./travel-workspace";
import AnticipationWidget from "./anticipation";
const MapExplorer = dynamic(() => import("./map-explorer"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <MapPin size={25} />
      <span>Deine Karte wird geladen …</span>
    </div>
  ),
});
const navItems: [View, string, typeof House][] = [
  ["dashboard", "Übersicht", House],
  ["people", "Menschen", Users],
  ["memories", "Erinnerungen", BookOpen],
  ["travel", "Reisen & Ferien", Globe],
  ["map", "Karte", Map],
  ["timeline", "Zeitstrahl", Route],
];
export default function MeetMap({ initialData }: { initialData: AppData }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Workspace initialData={initialData} />
    </QueryClientProvider>
  );
}
function Workspace({ initialData }: { initialData: AppData }) {
  const client = useQueryClient();
  const { data = initialData, isError } = useQuery({
    queryKey: ["data"],
    queryFn: () => api<AppData>("data"),
    initialData,
  });
  const [view, setView] = useState<View>("dashboard"),
    [mobileNav, setMobileNav] = useState(false),
    [search, setSearch] = useState(false),
    [searchQuery, setSearchQuery] = useState(""),
    [toast, setToast] = useState("");
  const [personEditor, setPersonEditor] = useState<Person | true | null>(null),
    [memoryEditor, setMemoryEditor] = useState<{
      memory?: Memory;
      personId?: string;
      tripId?: string;
      startAt?: string;
      photo?: Attachment;
      placeId?: string;
    } | null>(null),
    [selectedPerson, setSelectedPerson] = useState<string | null>(null),
    [selectedMemory, setSelectedMemory] = useState<string | null>(null),
    [lightbox, setLightbox] = useState<{
      items: Attachment[];
      index: number;
    } | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      action: () => Promise<void>;
    } | null>(null),
    [confirmBusy, setConfirmBusy] = useState(false),
    [focus, setFocus] = useState<Place | null>(null),
    [remindersOpen, setRemindersOpen] = useState(false);
  const [query, setQuery] = useState(""),
    [tagFilter, setTagFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [timeFilter, setTimeFilter] = useState(""),
    [showDrafts, setShowDrafts] = useState(false),
    [listMode, setListMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["data"] });
    void client.invalidateQueries({ queryKey: ["status"] });
  };
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    const update = () => {
      const raw = window.location.hash.slice(1).split("?")[0];
      if (
        [
          "dashboard",
          "people",
          "memories",
          "map",
          "timeline",
          "travel",
          "favorites",
          "settings",
        ].includes(raw)
      )
        setView(raw as View);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNav(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function navigate(next: View) {
    setView(next);
    window.location.hash = next;
    setMobileNav(false);
    setQuery("");
    setTagFilter("");
    setTypeFilter("");
    setTimeFilter("");
    setShowDrafts(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "navigate_meetmap",
            title: "MeetMap öffnen",
            description:
              "Navigate the authenticated MeetMap workspace to one of its existing views.",
            inputSchema: {
              type: "object",
              properties: {
                view: {
                  type: "string",
                  enum: [
                    "dashboard",
                    "people",
                    "memories",
                    "map",
                    "timeline",
                    "travel",
                    "favorites",
                    "settings",
                  ],
                },
              },
              required: ["view"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: async (input: { view: View }) => {
              if (
                ![
                  "dashboard",
                  "people",
                  "memories",
                  "map",
                  "timeline",
                  "travel",
                  "favorites",
                  "settings",
                ].includes(input.view)
              )
                throw new Error("Invalid view");
              navigate(input.view);
              return { view: input.view };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  async function favorite(item: Person | Memory, type: "person" | "memory") {
    try {
      await api("favorite", "POST", {
        type,
        id: item.id,
        favorite: !item.favorite,
      });
      refresh();
      notify(
        item.favorite
          ? "Aus deinen Favoriten entfernt"
          : "In deinen Favoriten gespeichert",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function contact(p: Person) {
    try {
      await api("people/" + p.id + "/contact", "POST", {});
      refresh();
      notify(`Kontakt mit ${p.name.split(" ")[0]} für heute notiert`);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const people = data.people.filter(
    (p) =>
      fuzzyMatch(
        p.name + " " + p.aliases + " " + p.notes + " " + p.tags.join(" "),
        query,
      ) &&
      (!tagFilter || p.tags.includes(tagFilter)) &&
      (view !== "favorites" || p.favorite),
  );
  const memories = data.memories.filter(
    (m) =>
      fuzzyMatch(
        m.title +
          " " +
          m.content +
          " " +
          m.place?.name +
          " " +
          m.people.map((p) => p.name).join(" "),
        query,
      ) &&
      (!typeFilter || m.type === typeFilter) &&
      (!tagFilter || m.people.some((p) => p.tags.includes(tagFilter))) &&
      (!timeFilter ||
        new Date(m.startAt) >=
          new Date(Date.now() - Number(timeFilter) * 86400000)) &&
      (showDrafts ? m.draft : !m.draft) &&
      (view !== "favorites" || m.favorite),
  );
  const published = data.memories.filter((m) => !m.draft);
  const reminders = data.people
    .filter(
      (p) =>
        !p.endedAt &&
        p.contactDays > 0 &&
        (daysSince(p.lastContact || p.metAt) === null ||
          (daysSince(p.lastContact || p.metAt) ?? 0) >= p.contactDays),
    )
    .sort(
      (a, b) =>
        (daysSince(b.lastContact || b.metAt) ?? 10000) -
        (daysSince(a.lastContact || a.metAt) ?? 10000),
    );
  const birthdays = data.people
    .filter((p) => p.birthday && !p.endedAt)
    .sort((a, b) => birthdayIn(a.birthday!) - birthdayIn(b.birthday!))
    .slice(0, 3);
  const person = data.people.find((p) => p.id === selectedPerson),
    memory = data.memories.find((m) => m.id === selectedMemory);
  const title: Record<View, string> = {
    dashboard: `Schön, dass du da bist, ${data.owner.name.split(" ")[0]}.`,
    people: "Die Menschen in deinem Leben.",
    memories: "Momente, die bleiben.",
    map: "Dein Leben hat viele Orte.",
    timeline: "Alles hat seine Zeit.",
    travel: "Draußen wartet eine Geschichte.",
    favorites: "Besonders nah am Herzen.",
    settings: "Dein Raum. Deine Regeln.",
  };
  const newPerson = () => setPersonEditor(true),
    newMemory = () => setMemoryEditor({});
  const openPerson = (p: Person) => setSelectedPerson(p.id),
    openMemory = (m: Memory) => setSelectedMemory(m.id);
  const cards = (items: Memory[]) => (
    <div
      className={
        "memory-grid " + (listMode && view !== "dashboard" ? "memory-list" : "")
      }
    >
      {items.map((m) => (
        <MemoryCard
          key={m.id}
          memory={m}
          onOpen={() => openMemory(m)}
          onFavorite={() => favorite(m, "memory")}
        />
      ))}
    </div>
  );
  async function demo() {
    setBusy(true);
    try {
      await api("demo", "POST", {});
      refresh();
      notify("Fiktive Beispielgeschichten hinzugefügt. Entdecke MeetMap!");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="mobile-backdrop"
          aria-label="Navigation schließen"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
        <a
          href="#dashboard"
          className="brand"
          onClick={() => navigate("dashboard")}
        >
          <img src="/favicon.svg" width={35} height={35} alt="" />
          <span>
            meetmap<span className="logo-dot">.</span>
          </span>
        </a>
        <div className="sidebar-section-label">DEIN PERSÖNLICHER RAUM</div>
        <nav aria-label="Hauptnavigation">
          {navItems.map(([id, label, Icon]) => (
            <button
              key={id}
              className={"nav-item " + (view === id ? "active" : "")}
              onClick={() => navigate(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "people" && (
                <span className="nav-count">{data.people.length}</span>
              )}
              {id === "memories" && (
                <span className="nav-count">{published.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-section-label collection-label">
          DEINE SAMMLUNG
        </div>
        <button
          className={"nav-item " + (view === "favorites" ? "active" : "")}
          onClick={() => navigate("favorites")}
          aria-current={view === "favorites" ? "page" : undefined}
        >
          <Heart size={19} strokeWidth={1.7} />
          <span>Favoriten</span>
        </button>
        {data.savedViews.slice(0, 3).map((v) => (
          <button
            className="nav-item saved-nav"
            key={v.id}
            onClick={() => {
              setSearchQuery(v.query);
              setSearch(true);
            }}
          >
            <Search size={16} />
            <span>{v.name}</span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="private-space">
            <span>
              <ShieldCheck size={19} />
            </span>
            <div>
              <strong>Dein Leben bleibt privat.</strong>
              <p>Nur du hast Zugang.</p>
            </div>
          </div>
          <button
            className={"nav-item " + (view === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            <span>Einstellungen</span>
          </button>
          <div className="owner-menu">
            <Avatar
              person={{ name: data.owner.name, avatarId: null }}
              size="small"
            />
            <div>
              <strong>{data.owner.name}</strong>
              <span>Dein privater Bereich</span>
            </div>
            <button
              className="icon-button"
              aria-label="Abmelden"
              title="Abmelden"
              onClick={async () => {
                try {
                  await api("auth/logout", "POST", {});
                  window.location.assign("/login");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Navigation öffnen"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Mein MeetMap<span>/</span>
              <strong>
                {navItems.find((n) => n[0] === view)?.[1] ||
                  (view === "favorites" ? "Favoriten" : "Einstellungen")}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="private-indicator">
              <LockKeyhole size={13} />
              Privat
            </span>
            <button
              className="search-trigger"
              aria-label="Alles durchsuchen"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Alles durchsuchen …</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className={
                "icon-button notification-button " +
                (reminders.length ? "has-reminders" : "")
              }
              aria-label="Kontakterinnerungen öffnen"
              onClick={() => setRemindersOpen(true)}
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main className="main-content" tabIndex={-1}>
          {view !== "travel" && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {view === "dashboard"
                    ? new Date()
                        .toLocaleDateString("de-DE", { weekday: "long" })
                        .toUpperCase() +
                      " · " +
                      fmtDate(new Date().toLocaleDateString("en-CA"))
                    : {
                        people: "MENSCHEN & VERBINDUNGEN",
                        memories: "DEINE ERINNERUNGEN",
                        map: "DEINE PERSÖNLICHE WELTKARTE",
                        timeline: "DEIN ZEITSTRAHL",
                        travel: "REISEN & FERIEN",
                        favorites: "DEINE FAVORITEN",
                        settings: "EINSTELLUNGEN",
                      }[view]}
                </span>
                <h1>{title[view]}</h1>
                {view === "people" && (
                  <p>{data.people.length} Menschen. Unzählige Geschichten.</p>
                )}
                {view === "memories" && (
                  <p>Die großen Erlebnisse und das kleine Glück dazwischen.</p>
                )}
              </div>
              {!["settings", "timeline"].includes(view) && (
                <div className="heading-actions">
                  {view === "dashboard" && (
                    <button className="button" onClick={newPerson}>
                      <Users size={16} />
                      Neue Person
                    </button>
                  )}
                  <button
                    className="button primary"
                    onClick={view === "people" ? newPerson : newMemory}
                  >
                    <Plus size={18} />
                    {view === "people" ? "Neue Person" : "Neue Erinnerung"}
                  </button>
                </div>
              )}
            </div>
          )}
          {isError && (
            <div className="inline-alert">
              Die Verbindung zum Server ist unterbrochen.{" "}
              <button onClick={refresh}>Erneut versuchen</button>
            </div>
          )}
          {view === "travel" && (
            <TravelWorkspace
              data={data}
              refresh={refresh}
              notify={notify}
              onMemory={openMemory}
              onNewMemory={(options) => setMemoryEditor(options)}
              onLightbox={(items, index) => setLightbox({ items, index })}
            />
          )}
          {view === "dashboard" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    icon: Users,
                    label: "Menschen in deinem Leben",
                    value: data.people.length,
                    meta: `${data.people.filter((p) => p.favorite).length} besonders nah`,
                    target: "people",
                  },
                  {
                    icon: BookOpen,
                    label: "Gesammelte Erinnerungen",
                    value: published.length,
                    meta: "Jeder Moment zählt",
                    target: "memories",
                  },
                  {
                    icon: MapPin,
                    label: "Orte voller Geschichten",
                    value: data.places.length,
                    meta: `${new Set(data.places.map((p) => p.name.split(",").at(-1)?.trim())).size} Regionen verbunden`,
                    target: "map",
                  },
                ].map(({ icon: Icon, label, value, meta, target }, i) => (
                  <button
                    className={"stat-card stat-" + i}
                    key={label}
                    onClick={() => navigate(target as View)}
                  >
                    <span className="stat-icon">
                      <Icon size={23} strokeWidth={1.7} />
                    </span>
                    <div>
                      <div className="stat-number">
                        {value}
                        <ArrowUpRight size={17} />
                      </div>
                      <strong>{label}</strong>
                      <p>{meta}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="recent-section">
                  <div className="section-heading">
                    <h2>
                      Letzte Erinnerungen
                      <span className="heading-dot" />
                    </h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("memories")}
                    >
                      Alle ansehen
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {published.length ? (
                    cards(published.slice(0, 3))
                  ) : (
                    <div className="welcome-card">
                      <span className="welcome-icon">
                        <BookOpen size={31} />
                      </span>
                      <h2>Deine Geschichte beginnt hier.</h2>
                      <p>
                        Ein Mensch, ein Ort, ein besonderer Moment.
                        <br />
                        Halte deine erste Erinnerung fest.
                      </p>
                      <button className="button primary" onClick={newMemory}>
                        <Plus size={17} />
                        Meine erste Erinnerung
                      </button>
                      {!data.people.length && (
                        <button
                          className="demo-button"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: "MeetMap mit Beispielen entdecken",
                              text: "Es werden sechs fiktive Personen und drei Beispielerinnerungen mit Fotos in deinem leeren Bereich angelegt. Du kannst sie anschließend einzeln bearbeiten oder löschen.",
                              action: demo,
                            })
                          }
                        >
                          {busy
                            ? "Wird vorbereitet …"
                            : "Erst mit Beispieldaten entdecken"}
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </section>
                <section className="reminder-panel panel">
                  <div className="section-heading">
                    <h2>In Verbindung bleiben</h2>
                    <span className="small-icon-bare">
                      <Heart size={18} />
                    </span>
                  </div>
                  <p className="section-intro">
                    Ein kleines Hallo macht viel aus.
                  </p>
                  {reminders.length ? (
                    <div className="reminder-list">
                      {reminders.slice(0, 3).map((p) => (
                        <div className="reminder-row" key={p.id}>
                          <button
                            className="person-row-button"
                            onClick={() => openPerson(p)}
                          >
                            <Avatar person={p} />
                            <span>
                              <strong>{p.name}</strong>
                              <small>
                                {daysSince(p.lastContact || p.metAt) === null
                                  ? "Noch kein Kontakt notiert"
                                  : `Letzter Kontakt vor ${daysSince(p.lastContact || p.metAt)} Tagen`}
                              </small>
                            </span>
                          </button>
                          <button
                            className="contact-check"
                            title="Heute Kontakt gehabt"
                            aria-label={`Kontakt mit ${p.name} für heute notieren`}
                            onClick={() => contact(p)}
                          >
                            <Check size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="quiet-state">
                      <Check size={23} />
                      <strong>Alles im grünen Bereich.</strong>
                      <p>Hier erinnern wir dich an deine Menschen.</p>
                    </div>
                  )}
                  <button
                    className="panel-footer-button"
                    onClick={() => setRemindersOpen(true)}
                  >
                    Alle Kontakterinnerungen
                    <ArrowRight size={14} />
                  </button>
                </section>
                <section className="dashboard-map panel">
                  <div className="section-heading">
                    <div>
                      <h2>Hier sind deine Geschichten zuhause</h2>
                      <p>Menschen und Momente, über Orte verbunden.</p>
                    </div>
                    <button
                      className="icon-button bordered"
                      onClick={() => navigate("map")}
                      aria-label="Karte öffnen"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <MapExplorer
                    people={data.people}
                    memories={published}
                    compact
                    onPerson={openPerson}
                    onMemory={openMemory}
                    online={data.settings.mapEnabled}
                    privacyRadius={data.settings.privacyRadius}
                  />
                  <div className="map-card-footer">
                    <span>
                      <i className="legend-dot person-dot" />
                      Menschen
                    </span>
                    <span>
                      <i className="legend-dot memory-dot" />
                      Erinnerungen
                    </span>
                    <button onClick={() => navigate("map")}>
                      Karte entdecken
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
                <div className="dashboard-right-bottom">
                  <AnticipationWidget
                    data={data}
                    refresh={refresh}
                    notify={notify}
                    onMemory={openMemory}
                    onTrip={(id) => {
                      navigate("travel");
                      window.location.hash = "travel?trip=" + id;
                    }}
                    onHoliday={(id) => {
                      navigate("travel");
                      window.location.hash = "travel?holiday=" + id;
                    }}
                  />
                  <section className="birthday-panel panel">
                    <div className="section-heading">
                      <h2>Bald gibt’s was zu feiern</h2>
                      <Gift size={19} />
                    </div>
                    {birthdays.length ? (
                      birthdays.map((p) => (
                        <button
                          className="birthday-row"
                          key={p.id}
                          onClick={() => openPerson(p)}
                        >
                          <div className="birthday-date">
                            <strong>
                              {new Date(p.birthday!).getUTCDate()}
                            </strong>
                            <span>
                              {new Date(p.birthday!).toLocaleDateString(
                                "de-DE",
                                { month: "short", timeZone: "UTC" },
                              )}
                            </span>
                          </div>
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              {birthdayIn(p.birthday!) === 0
                                ? "Heute Geburtstag!"
                                : `In ${birthdayIn(p.birthday!)} Tagen`}
                            </small>
                          </span>
                          <span className="birthday-decoration">
                            <Gift size={16} />
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="small-empty">
                        Füge Geburtstage zu deinen Menschen hinzu – wir denken
                        mit.
                      </p>
                    )}
                  </section>
                  <SystemSummary onOpen={() => navigate("settings")} />
                </div>
              </div>
            </>
          )}
          {(view === "people" ||
            view === "memories" ||
            view === "favorites") && (
            <>
              <div className="view-toolbar">
                <div className="filter-controls">
                  <div className="filter-search">
                    <Search size={17} />
                    <input
                      aria-label="Ansicht durchsuchen"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        view === "people"
                          ? "Menschen finden …"
                          : "Erinnerungen finden …"
                      }
                    />
                  </div>
                  <select
                    aria-label="Nach Verbindung filtern"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                  >
                    <option value="">Alle Verbindungen</option>
                    {[...new Set(data.people.flatMap((p) => p.tags))].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                  {view !== "people" && (
                    <>
                      <select
                        aria-label="Erinnerungstyp"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="">Alle Arten</option>
                        {[
                          "Treffen",
                          "Reise",
                          "Notiz",
                          "Call",
                          "Event",
                          "Sonstiges",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Erinnerungszeitraum"
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                      >
                        <option value="">Jederzeit</option>
                        <option value="30">Letzte 30 Tage</option>
                        <option value="365">Letztes Jahr</option>
                      </select>
                    </>
                  )}
                </div>
                {view !== "people" && (
                  <div className="view-switch">
                    <button
                      className={!listMode ? "active" : ""}
                      aria-label="Kartenansicht"
                      onClick={() => setListMode(false)}
                    >
                      <LayoutGrid size={17} />
                    </button>
                    <button
                      className={listMode ? "active" : ""}
                      aria-label="Listenansicht"
                      onClick={() => setListMode(true)}
                    >
                      <List size={18} />
                    </button>
                  </div>
                )}
              </div>
              {view === "memories" && (
                <div className="content-tabs">
                  <button
                    className={!showDrafts ? "active" : ""}
                    onClick={() => setShowDrafts(false)}
                  >
                    Alle Erinnerungen <span>{published.length}</span>
                  </button>
                  <button
                    className={showDrafts ? "active" : ""}
                    onClick={() => setShowDrafts(true)}
                  >
                    Entwürfe{" "}
                    <span>{data.memories.filter((m) => m.draft).length}</span>
                  </button>
                </div>
              )}
              {(view === "people" || view === "favorites") &&
                (people.length ? (
                  <>
                    <div className="people-grid">
                      {people.map((p) => (
                        <article className="person-card" key={p.id}>
                          <button
                            className={
                              "person-favorite " +
                              (p.favorite ? "is-favorite" : "")
                            }
                            aria-label={`${p.name} ${p.favorite ? "aus Favoriten entfernen" : "als Favorit merken"}`}
                            aria-pressed={p.favorite}
                            onClick={() => favorite(p, "person")}
                          >
                            <Heart
                              size={18}
                              fill={p.favorite ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            className="profile-card-main"
                            onClick={() => openPerson(p)}
                          >
                            <Avatar person={p} size="large" />
                            <h2>{p.name}</h2>
                            <p>
                              {p.online ? (
                                <>
                                  <Globe size={13} />
                                  {p.platform || "Online verbunden"}
                                </>
                              ) : (
                                <>
                                  <MapPin size={13} />
                                  {p.place?.name.split(",")[0] ||
                                    "Ein Mensch in deinem Leben"}
                                </>
                              )}
                            </p>
                            <div className="profile-tags">
                              {p.tags.slice(0, 2).map((t) => (
                                <span className="tag" key={t}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </button>
                          <div className="person-card-bottom">
                            <span>
                              <BookOpen size={14} />
                              {p._count?.memories || 0} Erinnerungen
                            </span>
                            <button
                              aria-label={`Neue Erinnerung mit ${p.name}`}
                              onClick={() =>
                                setMemoryEditor({ personId: p.id })
                              }
                            >
                              <Plus size={18} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {view === "favorites" && (
                      <div className="section-heading favorites-heading">
                        <h2>Deine liebsten Erinnerungen</h2>
                      </div>
                    )}
                  </>
                ) : view === "people" ? (
                  <Empty
                    kind="person"
                    title={
                      query || tagFilter
                        ? "Keine Menschen gefunden"
                        : "Wen möchtest du festhalten?"
                    }
                    description={
                      query || tagFilter
                        ? "Versuche einen anderen Namen oder Filter."
                        : "Beginne mit einem Menschen, der dir etwas bedeutet."
                    }
                    action={query || tagFilter ? undefined : "Neue Person"}
                    onAction={newPerson}
                  />
                ) : null)}
              {view !== "people" &&
                (memories.length ? (
                  cards(memories)
                ) : (
                  <Empty
                    title={
                      showDrafts
                        ? "Alles festgehalten"
                        : query || typeFilter
                          ? "Keine passenden Erinnerungen"
                          : view === "favorites"
                            ? "Ein Herz für besondere Momente"
                            : "Der erste Moment wartet"
                    }
                    description={
                      showDrafts
                        ? "Hier erscheinen deine automatisch gespeicherten Entwürfe."
                        : query || typeFilter
                          ? "Ändere deine Suche oder setze die Filter zurück."
                          : view === "favorites"
                            ? "Markiere Menschen und Erinnerungen mit einem Herz, um sie hier wiederzufinden."
                            : "Schreibe eine Erinnerung und verbinde sie mit deinen Menschen."
                    }
                    action={
                      view === "memories" && !showDrafts
                        ? "Neue Erinnerung"
                        : undefined
                    }
                    onAction={newMemory}
                  />
                ))}
            </>
          )}
          {view === "map" && (
            <>
              <div className="view-toolbar">
                <div className="filter-controls">
                  <select
                    aria-label="Karte nach Person filtern"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  >
                    <option value="">Alle Menschen</option>
                    {data.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Karte nach Verbindung filtern"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                  >
                    <option value="">Alle Verbindungen</option>
                    {[...new Set(data.people.flatMap((p) => p.tags))].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                  <select
                    aria-label="Karte nach Typ filtern"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">Alle Erinnerungen</option>
                    {["Treffen", "Reise", "Notiz", "Call", "Event"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Karte nach Datum filtern"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <option value="">Jederzeit</option>
                    <option value="30">Letzte 30 Tage</option>
                    <option value="365">Letztes Jahr</option>
                  </select>
                </div>
                <span className="map-count">
                  <MapPin size={15} />
                  {data.places.length} gespeicherte Orte
                </span>
              </div>
              <div className="full-map-layout">
                <MapExplorer
                  people={data.people.filter(
                    (p) =>
                      (!query || p.id === query) &&
                      (!tagFilter || p.tags.includes(tagFilter)),
                  )}
                  memories={published.filter(
                    (m) =>
                      (!query || m.people.some((p) => p.id === query)) &&
                      (!tagFilter ||
                        m.people.some((p) => p.tags.includes(tagFilter))) &&
                      (!typeFilter || m.type === typeFilter) &&
                      (!timeFilter ||
                        daysSince(m.startAt)! <= Number(timeFilter)),
                  )}
                  onPerson={openPerson}
                  onMemory={openMemory}
                  focus={focus}
                  online={data.settings.mapEnabled}
                  privacyRadius={data.settings.privacyRadius}
                />
                <aside className="map-places panel">
                  <h2>Deine Orte</h2>
                  {data.places.map((p) => (
                    <button
                      key={p.id}
                      className={
                        "map-place-row " +
                        (focus?.id === p.id ? "selected" : "")
                      }
                      onClick={() => setFocus(p)}
                    >
                      <span className="place-marker-icon">
                        <MapPin size={17} />
                      </span>
                      <span>
                        <strong>{p.name.split(",")[0]}</strong>
                        <small>
                          {
                            data.memories.filter((m) => m.placeId === p.id)
                              .length
                          }{" "}
                          Erinnerungen ·{" "}
                          {data.people.filter((x) => x.placeId === p.id).length}{" "}
                          Menschen
                        </small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!data.places.length && (
                    <p className="small-empty">
                      Orte fügst du direkt bei Personen und Erinnerungen hinzu.
                    </p>
                  )}
                  <div className="online-people">
                    <h3>
                      <Globe size={16} />
                      Online verbunden
                    </h3>
                    {data.people
                      .filter((p) => p.online && !p.place)
                      .map((p) => (
                        <button
                          className="online-person"
                          key={p.id}
                          onClick={() => openPerson(p)}
                        >
                          <Avatar person={p} size="small" />
                          <span>
                            {p.name}
                            <small>{p.platform || "Online"}</small>
                          </span>
                        </button>
                      ))}
                    {!data.people.some((p) => p.online && !p.place) && (
                      <p className="field-hint">
                        Auch Verbindungen ohne gemeinsamen Ort haben hier Platz.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === "timeline" && (
            <Timeline data={data} onPerson={openPerson} onMemory={openMemory} />
          )}
          {view === "settings" && (
            <SettingsView
              data={data}
              refresh={refresh}
              notify={notify}
              demo={demo}
              busy={busy}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={13} />
              Deine Geschichten gehören dir.
            </span>
            <span>Mit Sorgfalt gesammelt. Auf deinem Server zuhause.</span>
          </footer>
        </main>
      </div>
      {search && (
        <CommandSearch
          data={data}
          query={searchQuery}
          setQuery={setSearchQuery}
          onClose={() => setSearch(false)}
          refresh={refresh}
          notify={notify}
          onPerson={(p) => {
            setSearch(false);
            openPerson(p);
          }}
          onMemory={(m) => {
            setSearch(false);
            openMemory(m);
          }}
          onPlace={(p) => {
            setSearch(false);
            navigate("map");
            setFocus(p);
          }}
          newPerson={() => {
            setSearch(false);
            newPerson();
          }}
          newMemory={() => {
            setSearch(false);
            newMemory();
          }}
        />
      )}
      {personEditor && (
        <PersonEditor
          person={personEditor === true ? undefined : personEditor}
          data={data}
          onClose={() => setPersonEditor(null)}
          onSaved={refresh}
        />
      )}
      {memoryEditor && (
        <MemoryEditor
          {...memoryEditor}
          data={data}
          onClose={() => setMemoryEditor(null)}
          onSaved={refresh}
        />
      )}
      {person && (
        <Modal
          open
          onClose={() => setSelectedPerson(null)}
          title="Ein Mensch in deinem Leben"
          wide
        >
          <div className="person-detail">
            <div className="profile-heading">
              <Avatar person={person} size="xl" />
              <div>
                <h2>{person.name}</h2>
                {person.aliases && <p>Auch bekannt als {person.aliases}</p>}
                <div className="profile-tags">
                  {person.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className={
                  "icon-button " + (person.favorite ? "is-favorite" : "")
                }
                aria-label="Favorit ändern"
                onClick={() => favorite(person, "person")}
              >
                <Heart
                  size={21}
                  fill={person.favorite ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="button-row profile-actions">
              <button
                className="button primary"
                onClick={() => {
                  setSelectedPerson(null);
                  setMemoryEditor({ personId: person.id });
                }}
              >
                <Plus size={16} />
                Neue gemeinsame Erinnerung
              </button>
              <button
                className="button"
                onClick={() => {
                  setSelectedPerson(null);
                  setPersonEditor(person);
                }}
              >
                <Pencil size={15} />
                Bearbeiten
              </button>
            </div>
            <div className="profile-facts">
              <div>
                <MapPin size={17} />
                <span>
                  Ein gemeinsamer Ort
                  <strong>
                    {person.place?.name || person.platform || "Noch kein Ort"}
                  </strong>
                </span>
              </div>
              <div>
                <CalendarDays size={17} />
                <span>
                  Verbunden seit<strong>{fmtDate(person.metAt, true)}</strong>
                </span>
              </div>
              <div>
                <Gift size={17} />
                <span>
                  Geburtstag
                  <strong>
                    {person.birthday
                      ? fmtDate(person.birthday)
                      : "Noch nicht eingetragen"}
                  </strong>
                </span>
              </div>
              <div>
                <Clock size={17} />
                <span>
                  Letzter Kontakt
                  <strong>
                    {person.lastContact
                      ? fmtDate(person.lastContact, true)
                      : "Noch nicht notiert"}
                  </strong>
                </span>
              </div>
            </div>
            {person.endedAt && (
              <p className="profile-ended">
                Kontakt beendet am {fmtDate(person.endedAt, true)}
              </p>
            )}
            {person.contextUrl && (
              <a
                href={person.contextUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-button"
              >
                {person.platform || "Verknüpftes Profil"} öffnen
                <ExternalLink size={14} />
              </a>
            )}
            {person.notes && (
              <section className="profile-note">
                <h3>Was diesen Menschen besonders macht</h3>
                <p>{person.notes}</p>
              </section>
            )}
            <div className="section-heading">
              <h3>Eure gemeinsamen Momente</h3>
              <span className="pill">
                {
                  published.filter((m) =>
                    m.people.some((p) => p.id === person.id),
                  ).length
                }
              </span>
            </div>
            {published.filter((m) => m.people.some((p) => p.id === person.id))
              .length ? (
              published
                .filter((m) => m.people.some((p) => p.id === person.id))
                .map((m) => (
                  <button
                    className="profile-memory-row"
                    key={m.id}
                    onClick={() => {
                      setSelectedPerson(null);
                      openMemory(m);
                    }}
                  >
                    {m.attachments[0] ? (
                      <img
                        src={`/api/attachments/${m.attachments[0].id}?thumb=1`}
                        alt=""
                      />
                    ) : (
                      <span className="small-icon">
                        <BookOpen size={20} />
                      </span>
                    )}
                    <span>
                      <strong>{m.title}</strong>
                      <small>
                        {fmtDate(m.startAt, true)} · {m.place?.name || m.type}
                      </small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))
            ) : (
              <p className="small-empty">
                Eure Geschichte wartet auf die erste Erinnerung.
              </p>
            )}
            {data.memories.flatMap((m) =>
              m.people.some((p) => p.id === person.id) ? m.attachments : [],
            ).length > 0 && (
              <div className="profile-gallery">
                {data.memories
                  .flatMap((m) =>
                    m.people.some((p) => p.id === person.id)
                      ? m.attachments
                      : [],
                  )
                  .map((a, i, all) => (
                    <button
                      key={a.id}
                      onClick={() => setLightbox({ items: all, index: i })}
                    >
                      <img
                        src={`/api/attachments/${a.id}?thumb=1`}
                        alt={a.name}
                      />
                    </button>
                  ))}
              </div>
            )}
            <div className="detail-footer">
              <button className="text-button" onClick={() => contact(person)}>
                <Check size={16} />
                Heute Kontakt gehabt
              </button>
              <button
                className="danger-link"
                onClick={() =>
                  setConfirm({
                    title: `${person.name} entfernen?`,
                    text: "Die Person wird gelöscht. Gemeinsame Erinnerungen bleiben erhalten.",
                    action: async () => {
                      await api("people/" + person.id, "DELETE");
                      setSelectedPerson(null);
                      refresh();
                      notify("Person entfernt");
                    },
                  })
                }
              >
                <Trash2 size={15} />
                Person entfernen
              </button>
            </div>
          </div>
        </Modal>
      )}
      {memory && (
        <Modal
          open
          onClose={() => setSelectedMemory(null)}
          title={memory.draft ? "Dein Entwurf" : "Eine Erinnerung"}
          wide
        >
          <div className="memory-detail">
            {memory.attachments[0] && (
              <button
                className="detail-cover"
                aria-label="Bilder groß ansehen"
                onClick={() =>
                  setLightbox({ items: memory.attachments, index: 0 })
                }
              >
                <img
                  src={`/api/attachments/${memory.attachments[0].id}`}
                  alt={memory.title}
                />
                <span>
                  {memory.attachments.length}{" "}
                  {memory.attachments.length === 1 ? "Bild" : "Bilder"} ansehen
                </span>
              </button>
            )}
            <div className="detail-meta">
              <span className="pill">{memory.type}</span>
              <span>
                {fmtDate(memory.startAt, true)}
                {memory.endAt ? " – " + fmtDate(memory.endAt, true) : ""}
              </span>
              {memory.pinned && <Pin size={14} />}
              <span className="detail-privacy">
                <LockKeyhole size={12} />
                {memory.privacy}
              </span>
            </div>
            <h2>{memory.title}</h2>
            {memory.tripId && (
              <button
                className="travel-parent-link"
                onClick={() => {
                  setSelectedMemory(null);
                  navigate("travel");
                  window.location.hash = "travel?trip=" + memory.tripId;
                }}
              >
                <Globe size={15} />
                {data.trips.find((t) => t.id === memory.tripId)?.title ||
                  "Zum Urlaub"}
                <ArrowUpRight size={13} />
              </button>
            )}
            {memory.place && (
              <button
                className="text-button detail-location"
                onClick={() => {
                  setSelectedMemory(null);
                  navigate("map");
                  setFocus(memory.place);
                }}
              >
                <MapPin size={15} />
                {memory.place.name}
                <ArrowUpRight size={13} />
              </button>
            )}
            <p className="memory-prose">
              {memory.content || "Manchmal sagt ein Bild mehr als Worte."}
            </p>
            {memory.people.length > 0 && (
              <section className="memory-with">
                <span className="eyebrow">MIT DABEI</span>
                <div className="people-choices">
                  {memory.people.map((p) => (
                    <button
                      key={p.id}
                      className="person-choice"
                      onClick={() => {
                        setSelectedMemory(null);
                        openPerson(p);
                      }}
                    >
                      <Avatar person={p} size="tiny" />
                      {p.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="memory-mood">
              <Sparkles size={16} />
              {memory.mood}
            </div>
            {memory.attachments.length > 1 && (
              <div className="profile-gallery">
                {memory.attachments.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      setLightbox({ items: memory.attachments, index: i })
                    }
                  >
                    <img
                      src={`/api/attachments/${a.id}?thumb=1`}
                      alt={a.name}
                    />
                  </button>
                ))}
              </div>
            )}
            <div className="detail-footer">
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => {
                    setSelectedMemory(null);
                    setMemoryEditor({ memory });
                  }}
                >
                  <Pencil size={15} />
                  Bearbeiten
                </button>
                <button
                  className={
                    "icon-button bordered " +
                    (memory.favorite ? "is-favorite" : "")
                  }
                  aria-label="Favorit ändern"
                  onClick={() => favorite(memory, "memory")}
                >
                  <Heart
                    size={17}
                    fill={memory.favorite ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <button
                className="danger-link"
                onClick={() =>
                  setConfirm({
                    title: "Diese Erinnerung löschen?",
                    text: "Die Erinnerung und ihre Bilder werden dauerhaft von deinem Server entfernt.",
                    action: async () => {
                      await api("memories/" + memory.id, "DELETE");
                      setSelectedMemory(null);
                      refresh();
                      notify("Erinnerung gelöscht");
                    },
                  })
                }
              >
                <Trash2 size={15} />
                Löschen
              </button>
            </div>
          </div>
        </Modal>
      )}
      {lightbox && (
        <Modal
          open
          onClose={() => setLightbox(null)}
          title={`Bild ${lightbox.index + 1} von ${lightbox.items.length}`}
          wide
        >
          <div className="lightbox">
            <img
              src={`/api/attachments/${lightbox.items[lightbox.index].id}`}
              alt={lightbox.items[lightbox.index].name}
            />
            <div className="lightbox-controls">
              <button
                className="button"
                disabled={lightbox.index === 0}
                onClick={() =>
                  setLightbox({ ...lightbox, index: lightbox.index - 1 })
                }
              >
                <ChevronLeft size={16} />
                Zurück
              </button>
              <span>{lightbox.items[lightbox.index].name}</span>
              <button
                className="button"
                disabled={lightbox.index === lightbox.items.length - 1}
                onClick={() =>
                  setLightbox({ ...lightbox, index: lightbox.index + 1 })
                }
              >
                Weiter
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {remindersOpen && (
        <Modal
          open
          onClose={() => setRemindersOpen(false)}
          title="Zeit für ein kleines Hallo"
          description="Deine persönlichen Kontaktintervalle helfen dir, in Verbindung zu bleiben."
        >
          <div className="reminders-modal">
            {reminders.length ? (
              reminders.map((p) => (
                <div className="reminder-row" key={p.id}>
                  <button
                    className="person-row-button"
                    onClick={() => {
                      setRemindersOpen(false);
                      openPerson(p);
                    }}
                  >
                    <Avatar person={p} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>Kontaktwunsch: alle {p.contactDays} Tage</small>
                    </span>
                  </button>
                  <button className="button small" onClick={() => contact(p)}>
                    <Check size={15} />
                    Heute
                  </button>
                </div>
              ))
            ) : (
              <Empty
                kind="person"
                title="Gerade ist alles gut verbunden"
                description="Sobald wieder ein Hallo ansteht, findest du deine Menschen hier."
              />
            )}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          open
          onClose={() => {
            if (!confirmBusy) setConfirm(null);
          }}
          title={confirm.title}
          description={confirm.text}
        >
          <div className="confirm-buttons">
            <button
              className="button"
              disabled={confirmBusy}
              onClick={() => setConfirm(null)}
            >
              Abbrechen
            </button>
            <button
              className="button primary"
              disabled={confirmBusy}
              onClick={async () => {
                setConfirmBusy(true);
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setConfirmBusy(false);
                }
              }}
            >
              {confirmBusy ? <LoaderCircle className="spin" size={16} /> : null}
              {confirm.title.includes("Beispielen")
                ? "Beispiele hinzufügen"
                : "Endgültig entfernen"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button aria-label="Hinweis schließen" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function SystemSummary({ onOpen }: { onOpen: () => void }) {
  const { data } = useQuery({
    queryKey: ["status"],
    queryFn: () =>
      api<{
        database: boolean;
        ai: boolean;
        bytes: number;
        files: number;
        lastBackupAt: string | null;
      }>("status"),
    staleTime: 60000,
  });
  return (
    <button className="system-summary" onClick={onOpen}>
      <span className="system-icon">
        <Server size={19} />
      </span>
      <div>
        <strong>Auf deinem Server zuhause</strong>
        <span>
          {data ? "Alle Daten privat gespeichert" : "Systemstatus laden …"}
        </span>
      </div>
      <span className={"system-light " + (data?.database ? "online" : "")} />
    </button>
  );
}
function SettingsView({
  data,
  refresh,
  notify,
  demo,
  busy,
}: {
  data: AppData;
  refresh: () => void;
  notify: (s: string) => void;
  demo: () => void;
  busy: boolean;
}) {
  const { data: status, isLoading } = useQuery({
    queryKey: ["status"],
    queryFn: () =>
      api<{
        ai: boolean;
        models: string[];
        database: boolean;
        bytes: number;
        files: number;
        lastBackupAt: string | null;
        indexing: string;
      }>("status"),
  });
  const [birthday, setBirthday] = useState(
      data.settings.birthday?.slice(0, 10) || "",
    ),
    [privacyRadius, setRadius] = useState(data.settings.privacyRadius),
    [online, setOnline] = useState(data.settings.mapEnabled),
    [saving, setSaving] = useState(false),
    [travelOpen, setTravelOpen] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api("settings", "PATCH", {
        birthday,
        privacyRadius,
        mapEnabled: online,
      });
      refresh();
      notify("Deine Einstellungen wurden gespeichert");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="section-heading">
          <h2>
            <ShieldCheck size={21} />
            Privatsphäre & persönliche Daten
          </h2>
        </div>
        <label>
          Dein Geburtstag
          <DateInput
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <span className="field-hint">
            Wird auf deinem Server gespeichert.
          </span>
        </label>
        <label>
          Orte auf der Karte vergröbern
          <select
            value={privacyRadius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            <option value={0}>Exakte Positionen anzeigen</option>
            <option value={500}>Auf etwa 500 Meter runden</option>
            <option value={1000}>Auf etwa 1 Kilometer runden</option>
            <option value={5000}>Auf etwa 5 Kilometer runden</option>
          </select>
          <span className="field-hint">
            Gilt für die Kartendarstellung. Die ursprünglichen Koordinaten
            bleiben gespeichert.
          </span>
        </label>
        <div className="setting-toggle">
          <div>
            <strong>Online-Kartendetails & Ortssuche</strong>
            <p>
              Dein Server fragt OpenStreetMap und Nominatim an. Dabei werden die
              Server-IP, Suchbegriffe und Kartenausschnitte an diese Dienste
              übermittelt. Ausgeschaltet bleibt die Karte vollständig lokal.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={online}
            aria-label="Online-Kartendetails und Ortssuche"
            className={"toggle " + (online ? "on" : "")}
            onClick={() => setOnline(!online)}
          >
            <span />
          </button>
        </div>
        <button className="button primary" onClick={save} disabled={saving}>
          {saving ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Check size={16} />
          )}
          Einstellungen speichern
        </button>
        <button
          className="travel-overview-link"
          onClick={() => setTravelOpen(true)}
        >
          <Globe size={21} />
          <span>
            <strong>Zuhause & Reiseerkennung</strong>
            <small>Heimatort und Foto-Vorschläge einstellen</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        {travelOpen && (
          <TravelSettings
            data={data}
            onClose={() => setTravelOpen(false)}
            refresh={refresh}
            notify={notify}
          />
        )}
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <h2>
            <Server size={21} />
            Dein System
          </h2>
          <span className="pill green">
            {isLoading
              ? "Wird geprüft"
              : status?.database
                ? "Verbunden"
                : "Nicht erreichbar"}
          </span>
        </div>
        <div className="system-detail-row">
          <span>Datenbank</span>
          <strong>
            {status?.database ? "PostgreSQL · bereit" : "Wird geprüft …"}
          </strong>
        </div>
        <div className="system-detail-row">
          <span>Bildspeicher</span>
          <strong>
            {status
              ? `${(status.bytes / 1024 / 1024).toFixed(1)} MB · ${status.files} Bilder`
              : "Wird geprüft …"}
          </strong>
        </div>
        <div className="system-detail-row">
          <span>Suche</span>
          <strong>Stichwörter & ähnliche Schreibweisen</strong>
        </div>
        <div className="system-detail-row">
          <span>Letztes vollständiges Backup</span>
          <strong>
            {status?.lastBackupAt
              ? fmtDate(status.lastBackupAt, true)
              : "Noch kein Backup"}
          </strong>
        </div>
        <div className="setting-info">
          <ShieldCheck size={20} />
          <p>
            Ein vollständiges Backup sichert Datenbank und Bilder zusammen. Die
            Anleitung und das Backup-Skript liegen bei deiner Installation.
          </p>
        </div>
        <a className="button" href="/api/export" download>
          <Download size={16} />
          Daten als JSON exportieren
        </a>
        <p className="field-hint">
          Enthält Texte, Kontakte und Bildmetadaten. Bilddateien sind nur im
          vollständigen Backup enthalten.
        </p>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <h2>
            <Sparkles size={21} />
            Lokale KI
          </h2>
          <span className="pill">
            {status?.ai ? "Ollama erreichbar" : "Nicht verbunden"}
          </span>
        </div>
        <p className="settings-copy">
          Deine Gedanken bleiben bei dir. MeetMap kann für Zusammenfassungen mit
          Ollama auf deinem eigenen Server arbeiten.
        </p>
        <p className="settings-copy">
          {status?.ai
            ? `Installierte Modelle: ${status.models?.join(", ") || "Noch kein Modell installiert"}`
            : "Die App funktioniert auch ohne KI uneingeschränkt. Du kannst Ollama später über das optionale Docker-Profil aktivieren."}
        </p>
        <div className="setting-info">
          <LockKeyhole size={18} />
          <p>
            Semantische Suche, automatisches Tagging und OCR sind für die
            nächste Version vorgesehen.
          </p>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="section-heading">
          <h2>
            <Heart size={21} />
            Dein privater Bereich
          </h2>
        </div>
        <div className="account-details">
          <Avatar
            person={{ name: data.owner.name, avatarId: null }}
            size="large"
          />
          <div>
            <h3>{data.owner.name}</h3>
            <p>{data.owner.email}</p>
            <span className="pill">Owner · alleiniger Zugang</span>
          </div>
        </div>
        <p className="settings-copy">
          Keine öffentliche Registrierung. Keine Tracking-Dienste. Schriften und
          Bilder werden von deinem Server geladen.
        </p>
        {!data.people.length && !data.memories.length && (
          <button className="button" disabled={busy} onClick={demo}>
            Fiktive Beispieldaten hinzufügen
            <ArrowRight size={15} />
          </button>
        )}
      </section>
    </div>
  );
}
function CommandSearch({
  data,
  query,
  setQuery,
  onClose,
  onPerson,
  onMemory,
  onPlace,
  newPerson,
  newMemory,
  refresh,
  notify,
}: {
  data: AppData;
  query: string;
  setQuery: (v: string) => void;
  onClose: () => void;
  onPerson: (p: Person) => void;
  onMemory: (m: Memory) => void;
  onPlace: (p: Place) => void;
  newPerson: () => void;
  newMemory: () => void;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [facet, setFacet] = useState("all"),
    [active, setActive] = useState(0),
    [saveName, setSaveName] = useState(""),
    [saving, setSaving] = useState(false);
  const results = [
    ...(facet === "all" || facet === "people"
      ? data.people
          .filter((p) =>
            fuzzyMatch(
              p.name + " " + p.aliases + " " + p.notes + " " + p.tags.join(" "),
              query,
            ),
          )
          .map((p) => ({
            id: p.id,
            label: p.name,
            meta:
              "Mensch · " + (p.place?.name || p.platform || p.tags.join(", ")),
            icon: Users,
            action: () => onPerson(p),
          }))
      : []),
    ...(facet === "all" || facet === "memories"
      ? data.memories
          .filter((m) => fuzzyMatch(m.title + " " + m.content, query))
          .map((m) => ({
            id: m.id,
            label: m.title,
            meta:
              (m.draft ? "Entwurf" : "Erinnerung") +
              " · " +
              fmtDate(m.startAt, true),
            icon: BookOpen,
            action: () => onMemory(m),
          }))
      : []),
    ...(facet === "all" || facet === "places"
      ? data.places
          .filter((p) => fuzzyMatch(p.name, query))
          .map((p) => ({
            id: p.id,
            label: p.name,
            meta: "Ort auf deiner Karte",
            icon: MapPin,
            action: () => onPlace(p),
          }))
      : []),
  ].slice(0, 14);
  useEffect(() => setActive(0), [query, facet]);
  async function save() {
    try {
      await api("views", "POST", { name: saveName || query, query });
      refresh();
      setSaving(false);
      notify("Suche in deiner Sammlung gespeichert");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Alles ist miteinander verbunden"
      description="Suche nach Menschen, Erinnerungen und Orten."
    >
      <div className="command-search">
        <div className="command-input">
          <Search size={21} />
          <input
            autoFocus
            aria-label="Globale Suche"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Wen oder was möchtest du wiederfinden?"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={
              results[active] ? "result-" + results[active].id : undefined
            }
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                results[active].action();
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <div className="command-facets">
          {[
            ["all", "Alles"],
            ["people", "Menschen"],
            ["memories", "Erinnerungen"],
            ["places", "Orte"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFacet(id)}
              className={facet === id ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
        {!query && (
          <div className="command-actions">
            <button onClick={newMemory}>
              <Plus size={15} />
              Neue Erinnerung
            </button>
            <button onClick={newPerson}>
              <Users size={15} />
              Neue Person
            </button>
          </div>
        )}
        <div
          className="search-results"
          id="search-results"
          role="listbox"
          aria-label="Suchergebnisse"
        >
          {results.map((r, i) => (
            <button
              id={"result-" + r.id}
              role="option"
              aria-selected={active === i}
              key={r.id}
              className={"search-result " + (active === i ? "active" : "")}
              onMouseEnter={() => setActive(i)}
              onClick={r.action}
            >
              <span className="result-icon">
                <r.icon size={19} />
              </span>
              <span>
                <strong>{r.label}</strong>
                <small>{r.meta}</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {!results.length && (
            <p className="search-empty">
              {query
                ? "Dazu haben wir noch keine Geschichte. Versuche ein anderes Stichwort."
                : "Deine ersten Menschen und Erinnerungen erscheinen bald hier."}
            </p>
          )}
        </div>
        {query && (
          <div className="save-search">
            {saving ? (
              <>
                <input
                  aria-label="Name der gespeicherten Suche"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={query}
                />
                <button className="button small" onClick={save}>
                  Speichern
                </button>
              </>
            ) : (
              <button className="text-button" onClick={() => setSaving(true)}>
                <Plus size={14} />
                Diese Suche speichern
              </button>
            )}
          </div>
        )}
        <div className="command-hint">
          <span>↑ ↓ navigieren</span>
          <span>↵ öffnen</span>
          <span>esc schließen</span>
        </div>
      </div>
    </Modal>
  );
}
