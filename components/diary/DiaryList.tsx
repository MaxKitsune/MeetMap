"use client";
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

type Entry = {
  id: string;
  headline?: string | null;
  content: string;
  start_at: string | null;
  location_name: string | null;
  previewAttachmentId: string | null;
  created_at: string;
  people: { id: string; name: string }[];
};

const DiaryModal = dynamic(() => import('@/components/modals/DiaryModal'), { ssr: false });

export default function DiaryList({ timeline = false }: { timeline?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/diary');
    const d = await res.json();
    setEntries(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter(e => e.content.toLowerCase().includes(s) || (e.location_name||'').toLowerCase().includes(s));
  }, [entries, q]);

  function openDiary(id: string) { setModal({ open: true, id }); }

  if (timeline) {
    return (
      <div className="space-y-4">
        <div className="card p-4 flex items-center gap-2">
          <input className="input flex-1" placeholder="Search diary…" value={q} onChange={e => setQ(e.target.value)} />
          <a href="/diary/new" className="btn-primary ml-auto whitespace-nowrap">New Entry</a>
        </div>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-fuchsia-500/50 via-white/10 to-indigo-500/50" />
          <div className="space-y-6">
            {loading && <div className="text-white/60">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="text-white/60">No entries</div>}
            {filtered.map(e => (
              <button key={e.id} onClick={() => openDiary(e.id)} className="relative block pl-3 text-left w-full">
                <div className="absolute left-[-6px] top-2 w-3 h-3 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400 shadow-glow" />
                <div className="card p-4">
                  <div className="flex items-start gap-3">
                    {e.previewAttachmentId ? (
                      <img src={`/api/diary/attachments/${e.previewAttachmentId}`} alt="" className="w-20 h-20 object-cover rounded-md border border-white/10" />
                    ) : (
                      <div className="w-20 h-20 rounded-md bg-white/5 border border-white/10" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm text-white/60">{e.start_at ? new Date(e.start_at).toDateString() : new Date(e.created_at).toDateString()}</div>
                      <div className="font-medium">{e.headline || e.content.slice(0, 140)}</div>
                      <div className="text-xs text-white/60 mt-1">{e.people.map(p => p.name).join(', ') || e.location_name || '—'}</div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        {modal.open && modal.id && <DiaryModal id={modal.id} onClose={() => setModal({ open: false })} />}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <input className="input flex-1" placeholder="Search diary…" value={q} onChange={e => setQ(e.target.value)} />
        <a href="/diary/new" className="btn-primary ml-auto whitespace-nowrap">New Entry</a>
      </div>
      <div className="mt-3 grid md:grid-cols-2 gap-3">
        {loading && <div className="text-white/60">Loading…</div>}
        {!loading && filtered.length === 0 && <div className="text-white/60">No entries</div>}
        {filtered.map(e => (
          <button key={e.id} onClick={() => openDiary(e.id)} className="card p-4 hover:bg-white/10 transition-colors text-left">
            <div className="flex items-start gap-3">
              {e.previewAttachmentId ? (
                <img src={`/api/diary/attachments/${e.previewAttachmentId}`} alt="" className="w-20 h-20 object-cover rounded-md border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-md bg-white/5 border border-white/10" />
              )}
              <div className="flex-1">
                <div className="text-sm text-white/60">{e.start_at ? new Date(e.start_at).toDateString() : new Date(e.created_at).toDateString()}</div>
                <div className="font-medium">{e.headline || e.content.slice(0, 140)}</div>
                <div className="text-xs text-white/60 mt-1">{e.people.map(p => p.name).join(', ') || e.location_name || '—'}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      {modal.open && modal.id && <DiaryModal id={modal.id} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
