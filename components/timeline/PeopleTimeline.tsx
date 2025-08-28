"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

type Person = {
  id: string;
  name: string;
  met_at: string | null;
  ended_at: string | null;
  created_at?: string;
};

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

type LaneItem = { id: string; name: string; start: Date; end: Date };

export default function PeopleTimeline({ birth }: { birth: Date | null }) {
  const [rows, setRows] = useState<Person[]>([]);
  const [zoom, setZoom] = useState(1); // 1x by default
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/people');
      const data = await res.json();
      setRows(data.map((p: any) => ({ id: p.id, name: p.name, met_at: p.met_at, ended_at: p.ended_at, created_at: p.created_at })));
    })();
  }, []);

  const now = new Date();
  const birthDate = birth || new Date(now.getFullYear() - 30, 0, 1);
  const start = birthDate;
  const end = now;
  const totalMs = end.getTime() - start.getTime();
  const pxPerYearBase = 80; // base scale: 80px per year at 1x
  const yearsSpan = (end.getFullYear() - start.getFullYear()) + 1;
  const widthPx = Math.max(800, Math.ceil(pxPerYearBase * yearsSpan * zoom));
  const pxPerMs = widthPx / totalMs;

  const items: LaneItem[] = useMemo(() => rows
    .map(r => ({ id: r.id, name: r.name, start: toDate(r.met_at) || toDate(r.created_at || '') || start, end: toDate(r.ended_at) || end }))
    .filter(r => r.start < r.end)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  , [rows]);

  // Greedy lane packing (no overlaps within a lane)
  const lanes: LaneItem[][] = useMemo(() => {
    const l: LaneItem[][] = [];
    for (const it of items) {
      let placed = false;
      for (const lane of l) {
        const last = lane[lane.length - 1];
        if (last.end.getTime() <= it.start.getTime()) { lane.push(it); placed = true; break; }
      }
      if (!placed) l.push([it]);
    }
    return l;
  }, [items]);

  function px(date: Date) { return (date.getTime() - start.getTime()) * pxPerMs; }

  // Year ticks
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) ys.push(y);
    return ys;
  }, [start, end]);

  function fitToViewport() {
    if (!scrollRef.current) return;
    const vw = scrollRef.current.clientWidth;
    const spanYears = yearsSpan;
    const targetZoom = Math.max(0.2, Math.min(8, vw / (pxPerYearBase * spanYears)));
    setZoom(targetZoom);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="chip">Zoom: {zoom.toFixed(2)}x</div>
        <button className="btn-ghost" onClick={() => setZoom(z => Math.max(0.25, z / 1.25))}>-</button>
        <button className="btn-ghost" onClick={() => setZoom(z => Math.min(8, z * 1.25))}>+</button>
        <button className="btn-ghost" onClick={fitToViewport}>Fit</button>
      </div>
      <div ref={scrollRef} className="card p-4 overflow-x-auto">
        <div className="relative" style={{ width: `${widthPx}px` }}>
          <div className="h-10 relative">
            {years.map(y => (
              <div key={y} className="absolute top-0 h-full border-l border-white/10 text-xs text-white/60" style={{ left: `${px(new Date(y,0,1))}px` }}>
                <div className="-translate-x-1/2">{y}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-2">
            {lanes.map((lane, i) => (
              <div key={i} className="relative h-8">
                {lane.map(it => {
                  const left = px(it.start);
                  const w = Math.max(4, px(it.end) - px(it.start));
                  return (
                    <div key={it.id} title={`${it.name}`}
                      className="absolute h-6 rounded-md bg-gradient-to-r from-indigo-500/80 to-fuchsia-500/80 border border-white/10 text-xs px-2 flex items-center shadow-glow"
                      style={{ left: `${left}px`, width: `${w}px` }}>
                      <span className="truncate max-w-[14rem]">{it.name}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
