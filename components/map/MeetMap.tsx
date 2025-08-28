"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Map as MapLibreMap, LngLatLike, Marker as MLMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Person = {
  id: string;
  name: string;
  age: number | null;
  is_online: boolean;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  tags: string[];
};

type Diary = {
  id: string;
  content: string;
  start_at: string | null;
  end_at: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
};

export default function MeetMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, MLMarker>>({});
  const highlightRef = useRef<MLMarker | null>(null);
  const searchParams = useSearchParams();

  const [people, setPeople] = useState<Person[]>([]);
  const [diary, setDiary] = useState<Diary[]>([]);
  const [mode, setMode] = useState<'all'|'people'|'diary'>('all');
  const [modal, setModal] = useState<{ type: 'person'|'diary'|null; id?: string }>({ type: null });

  // Fetch data
  useEffect(() => {
    (async () => {
      const [pRes, dRes] = await Promise.all([
        fetch('/api/people'),
        fetch('/api/diary')
      ]);
      const p = await pRes.json();
      const d = await dRes.json();
      setPeople(p);
      setDiary(d);
    })();
  }, []);

  // Init map on mount
  useEffect(() => {
    if (!container.current || mapRef.current) return;
    (async () => {
      const { Map, Marker, NavigationControl, Popup } = await import('maplibre-gl');
      const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE || 'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json';
      const map = new Map({
        container: container.current!,
        style: styleUrl,
        center: [13.405, 52.52] as LngLatLike,
        zoom: 3,
      });
      map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
      mapRef.current = map;
    })();
  }, []);

  // Render markers when data/map ready
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const { Marker, Popup } = await import('maplibre-gl');
      // clear old markers
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      const showPeople = mode === 'all' || mode === 'people';
      const showDiary = mode === 'all' || mode === 'diary';

      if (showPeople) {
        for (const p of people) {
          if (p.lat == null || p.lng == null) continue;
          const el = document.createElement('div');
          el.className = 'w-3 h-3 rounded-full bg-fuchsia-400 ring-2 ring-fuchsia-300/40 shadow-glow cursor-pointer';
          const marker = new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(mapRef.current);
          const placeShort = (p.location_name || '').split(/[ ,]/).slice(0,2).join(' ');
          const status = p.is_online ? 'online' : 'offline';
          const popup = new Popup({ closeButton: false, closeOnClick: false }).setHTML(`<div style="color:#111;font-size:12px"><strong>${p.name}</strong><br/>${p.age ?? ''}${p.age ? ' yrs · ' : ''}${status}${placeShort ? ' · ' + placeShort : ''}</div>`)
            .setLngLat([p.lng, p.lat]);
          el.addEventListener('mouseenter', () => popup.addTo(mapRef.current!));
          el.addEventListener('mouseleave', () => popup.remove());
          el.addEventListener('click', () => setModal({ type: 'person', id: p.id }));
          markersRef.current[`p:${p.id}`] = marker as unknown as MLMarker;
        }
      }
      if (showDiary) {
        for (const e of diary) {
          if (e.lat == null || e.lng == null) continue;
          const el = document.createElement('div');
          el.className = 'w-3 h-3 rounded-full bg-indigo-400 ring-2 ring-indigo-300/40 shadow-glow cursor-pointer';
          const marker = new Marker({ element: el }).setLngLat([e.lng, e.lat]).addTo(mapRef.current);
          const date = e.start_at ? new Date(e.start_at).toDateString() : '';
          const popup = new Popup({ closeButton: false, closeOnClick: false }).setHTML(`<div style="color:#111;font-size:12px"><div>${date}</div><div>${e.content.slice(0,120)}</div></div>`)
            .setLngLat([e.lng, e.lat]);
          el.addEventListener('mouseenter', () => popup.addTo(mapRef.current!));
          el.addEventListener('mouseleave', () => popup.remove());
          el.addEventListener('click', () => setModal({ type: 'diary', id: e.id }));
          markersRef.current[`d:${e.id}`] = marker as unknown as MLMarker;
        }
      }
    })();
  }, [people, diary, mode]);

  // Handle query param centering and highlight marker
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const lat = Number(searchParams.get('lat'));
      const lng = Number(searchParams.get('lng'));
      const z = Number(searchParams.get('z') || '12');
      const name = searchParams.get('place') || 'Selected place';
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        mapRef.current.setCenter([lng, lat]);
        if (Number.isFinite(z)) mapRef.current.setZoom(z);
        const { Marker, Popup } = await import('maplibre-gl');
        if (highlightRef.current) highlightRef.current.remove();
        const el = document.createElement('div');
        el.className = 'w-4 h-4 rounded-full bg-amber-400 ring-2 ring-amber-300/60 shadow-glow';
        const popup = new Popup({ closeButton: false, closeOnClick: false }).setHTML(`<div class="text-xs">${name}</div>`).setLngLat([lng, lat]);
        const marker = new Marker({ element: el }).setLngLat([lng, lat]).addTo(mapRef.current);
        popup.addTo(mapRef.current);
        highlightRef.current = marker as unknown as MLMarker;
      }
    })();
  }, [searchParams]);

  const counts = useMemo(() => ({
    people: people.filter(p => p.lat != null && p.lng != null).length,
    diary: diary.filter(d => d.lat != null && d.lng != null).length,
  }), [people, diary]);

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-xl border border-white/10">
      <div ref={container} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      <div className="absolute top-3 left-3 card px-3 py-2 flex items-center gap-2">
        <button className={`btn-ghost ${mode==='all'?'ring-2 ring-white/30':''}`} onClick={() => setMode('all')}>All</button>
        <button className={`btn-ghost ${mode==='people'?'ring-2 ring-white/30':''}`} onClick={() => setMode('people')}>People <span className="chip ml-1">{counts.people}</span></button>
        <button className={`btn-ghost ${mode==='diary'?'ring-2 ring-white/30':''}`} onClick={() => setMode('diary')}>Diary <span className="chip ml-1">{counts.diary}</span></button>
      </div>
      {modal.type === 'person' && modal.id && <PersonModal id={modal.id} onClose={() => setModal({ type: null })} />}
      {modal.type === 'diary' && modal.id && <DiaryModal id={modal.id} onClose={() => setModal({ type: null })} />}
    </div>
  );
}

const PersonModal = dynamic(() => import('@/components/modals/PersonModal'), { ssr: false });
const DiaryModal = dynamic(() => import('@/components/modals/DiaryModal'), { ssr: false });
