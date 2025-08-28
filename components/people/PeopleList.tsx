"use client";
import { useEffect, useMemo, useState } from 'react';
import { Tags } from '@/lib/api';
import { TagCode } from '@prisma/client';
import dynamic from 'next/dynamic';

type Person = {
  id: string;
  name: string;
  is_online: boolean;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  tags: TagCode[];
};

export default function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/people');
    setPeople(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(p => p.name.toLowerCase().includes(q) || (p.location_name||'').toLowerCase().includes(q));
  }, [people, query]);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <input className="input" placeholder="Search people…" value={query} onChange={e => setQuery(e.target.value)} />
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </div>
      <div className="mt-3 divide-y divide-white/10">
        {loading && <div className="text-white/60 py-6">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="text-white/60 py-6">No people</div>}
        {filtered.map(p => (
          <div key={p.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-white/60">{p.is_online ? 'Online' : (p.location_name || 'Unknown place')}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setModal({ open: true, id: p.id })}>View</button>
              <a href={`/people/${p.id}`} className="btn-ghost">Edit</a>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <a href="/people/new" className="btn-primary">New Person</a>
      </div>
      {modal.open && modal.id && <PersonModal id={modal.id} onClose={() => setModal({ open: false })} />}
    </div>
  );
}

const PersonModal = dynamic(() => import('@/components/modals/PersonModal'), { ssr: false });
