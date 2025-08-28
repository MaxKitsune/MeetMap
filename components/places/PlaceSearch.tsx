"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

type Result = { name: string; lat: number; lng: number };

export default function PlaceSearch({ label = 'Place', value, onSelect }: { label?: string; value?: string; onSelect: (r: Result) => void }) {
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const query = q.trim();
      if (!query) { setResults([]); return; }
      try {
        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        if (key) {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?limit=5&key=${key}`;
          const res = await fetch(url);
          const data = await res.json();
          const out = (data.features || []).map((f: any) => ({ name: f.place_name || f.text || f.properties?.name || query, lng: f.center?.[0], lat: f.center?.[1] })).filter((r: any) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
          setResults(out);
        } else {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=5`;
          const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          const out = (data || []).map((r: any) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
          setResults(out);
        }
        setOpen(true);
      } catch (e) {
        setResults([]);
        setOpen(false);
      }
    }, 400) as unknown as number;
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q]);

  function pick(r: Result) {
    onSelect(r);
    setQ(r.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="label">{label}</label>
      <input className="input" placeholder="Search a place…" value={q} onChange={e => setQ(e.target.value)} onFocus={() => { if (results.length) setOpen(true); }} />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full card max-h-72 overflow-auto">
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => pick(r)} className="w-full text-left px-3 py-2 hover:bg-white/10">
              <div className="text-sm">{r.name}</div>
              <div className="text-xs text-white/50">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

