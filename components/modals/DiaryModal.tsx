"use client";
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';

type Entry = {
  id: string;
  headline?: string | null;
  content: string;
  start_at: string | null;
  end_at: string | null;
  location_name: string | null;
  people: { id: string; name: string }[];
  attachmentIds?: string[];
};

export default function DiaryModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<Entry | null>(null);
  useEffect(() => { (async () => { const res = await fetch(`/api/diary/${id}`); if (res.ok) setData(await res.json()); })(); }, [id]);
  return (
    <Modal open={true} onClose={onClose} title={data?.headline || 'Diary Entry'}>
      {!data && <div className="text-white/60">Loading…</div>}
      {data && (
        <div className="space-y-3">
          <div className="text-sm text-white/60">{data.start_at ? new Date(data.start_at).toLocaleString() : ''} {data.location_name ? `· ${data.location_name}` : ''}</div>
          <div className="whitespace-pre-wrap leading-relaxed">{data.content}</div>
          {data.people?.length ? (
            <div className="text-sm"><span className="text-white/60">People:</span> {data.people.map(p => p.name).join(', ')}</div>
          ) : null}
          {data.attachmentIds?.length ? (
            <div className="grid grid-cols-3 gap-2">
              {data.attachmentIds.map(id => (
                <img key={id} src={`/api/diary/attachments/${id}`} alt="" className="rounded-md border border-white/10 object-cover w-full h-28" />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

