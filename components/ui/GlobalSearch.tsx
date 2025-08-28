"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type PersonHit = { id: string; name: string };
type DiaryHit = { id: string; content: string; start_at: string | null };
type PlaceHit = { name: string; lat: number; lng: number };

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [diary, setDiary] = useState<DiaryHit[]>([]);
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!q.trim()) { setPeople([]); setDiary([]); setPlaces([]); setOpen(false); return; }
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const [pr, dr] = await Promise.all([
          fetch(`/api/people?q=${encodeURIComponent(q)}&take=5`),
          fetch(`/api/diary?q=${encodeURIComponent(q)}&take=5`),
        ]);
        const pjson = await pr.json();
        const djson = await dr.json();
        setPeople(pjson.map((p: any) => ({ id: p.id, name: p.name })));
        setDiary(djson.map((e: any) => ({ id: e.id, content: e.content, start_at: e.start_at })));
      } catch {}

      // Places
      try {
        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        if (key) {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?limit=5&key=${key}`;
          const res = await fetch(url);
          const data = await res.json();
          const out = (data.features || []).map((f: any) => ({ name: f.place_name || f.text || q, lng: f.center?.[0], lat: f.center?.[1] })).filter((r: any) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
          setPlaces(out);
        } else {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5`;
          const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          const out = (data || []).map((r: any) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
          setPlaces(out);
        }
      } catch { setPlaces([]); }
      setLoading(false);
      setOpen(true);
    }, 350) as unknown as number;
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  function gotoPerson(id: string) { router.push(`/people/${id}`); setOpen(false); }
  function gotoDiary(id: string) { router.push(`/diary/${id}`); setOpen(false); }
  function gotoPlace(p: PlaceHit) { router.push(`/map?lat=${p.lat}&lng=${p.lng}&z=12&place=${encodeURIComponent(p.name)}`); setOpen(false); }

  return (
    <div className="relative w-72">
      <input
        className="input w-full"
        placeholder="Search people, diary, places…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => { if (q.trim()) setOpen(true); }}
      />
      {open && (
        <div className="absolute mt-2 w-full card p-2 z-50">
          {loading && <div className="text-xs text-white/60 px-2 py-1">Searching…</div>}
          {!loading && (
            <div className="space-y-2">
              <Section title="People" empty={people.length === 0}>
                {people.map(p => (
                  <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-md" onClick={() => gotoPerson(p.id)}>
                    <div className="text-sm">{p.name}</div>
                  </button>
                ))}
              </Section>
              <Section title="Diary" empty={diary.length === 0}>
                {diary.map(e => (
                  <button key={e.id} className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-md" onClick={() => gotoDiary(e.id)}>
                    <div className="text-sm line-clamp-1">{e.content}</div>
                    <div className="text-xs text-white/50">{e.start_at ? new Date(e.start_at).toDateString() : ''}</div>
                  </button>
                ))}
              </Section>
              <Section title="Places" empty={places.length === 0}>
                {places.map((p, i) => (
                  <button key={i} className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-md" onClick={() => gotoPlace(p)}>
                    <div className="text-sm line-clamp-1">{p.name}</div>
                  </button>
                ))}
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/50 px-2 mb-1">{title}</div>
      {empty ? <div className="text-xs text-white/40 px-2 py-1">No results</div> : children}
    </div>
  );
}

