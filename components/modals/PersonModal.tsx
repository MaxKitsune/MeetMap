"use client";
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';

type Person = {
  id: string;
  name: string;
  age: number | null;
  is_online: boolean;
  location_name: string | null;
  met_at: string | null;
  ended_at: string | null;
  tags?: string[];
};

export default function PersonModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<Person | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/people/${id}`); if (r.ok) setP(await r.json());
      const d = await fetch(`/api/diary?personId=${id}`); if (d.ok) setEntries(await d.json());
    })();
  }, [id]);
  return (
    <Modal open={true} onClose={onClose} title={p?.name || 'Person'}>
      {!p && <div className="text-white/60">Loading…</div>}
      {p && (
        <div className="space-y-3">
          <div className="text-sm text-white/60">{p.age ? `${p.age} yrs · ` : ''}{p.is_online ? 'online' : 'offline'}{p.location_name ? ` · ${p.location_name}` : ''}</div>
          <div className="text-sm text-white/60">{p.met_at ? `met ${new Date(p.met_at).toDateString()}` : ''}{p.ended_at ? ` · ended ${new Date(p.ended_at).toDateString()}` : ''}</div>
          {p.tags?.length ? <div className="text-sm"><span className="text-white/60">Tags:</span> {p.tags.join(', ')}</div> : null}
          <div>
            <div className="font-semibold mb-1">Related entries</div>
            <div className="space-y-2 max-h-56 overflow-auto pr-2">
              {entries.length === 0 && <div className="text-white/60 text-sm">No entries</div>}
              {entries.map((e: any) => (
                <a key={e.id} href={`/diary/${e.id}`} className="block p-2 rounded-md hover:bg-white/10">
                  <div className="text-xs text-white/60">{e.start_at ? new Date(e.start_at).toDateString() : new Date(e.created_at).toDateString()}</div>
                  <div className="text-sm line-clamp-1">{e.headline || e.content}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

