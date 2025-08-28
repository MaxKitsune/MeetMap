"use client";
import { useEffect, useMemo, useState } from 'react';
import PlaceSearch from '@/components/places/PlaceSearch';
import { useRouter } from 'next/navigation';

type PersonRef = { id: string; name: string };

type Initial = Partial<{
  id: string;
  headline: string | null;
  content: string;
  start_at: string | null;
  end_at: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  people: PersonRef[];
  attachmentIds: string[];
}>;

type NewAttachment = { file: File; dataUrl: string; mimeType: string };

export default function DiaryForm({ initial, mode = 'create' }: { initial?: Initial; mode?: 'create'|'edit' }) {
  const router = useRouter();
  const [people, setPeople] = useState<PersonRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    headline: initial?.headline ?? '',
    content: initial?.content ?? '',
    start_at: (initial?.start_at ?? '').slice(0, 10),
    end_at: (initial?.end_at ?? '').slice(0, 10),
    location_name: initial?.location_name ?? '',
    lat: initial?.lat ?? undefined as number | undefined,
    lng: initial?.lng ?? undefined as number | undefined,
    personIds: (initial?.people ?? []).map(p => p.id) as string[],
    attachmentsToDelete: [] as string[],
  });

  const [newFiles, setNewFiles] = useState<NewAttachment[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/people');
      const ps = await res.json();
      setPeople(ps.map((p: any) => ({ id: p.id, name: p.name })));
    })();
  }, []);

  const canSubmit = useMemo(() => form.content.trim().length > 0, [form.content]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const items: NewAttachment[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      items.push({ file, dataUrl, mimeType: file.type || 'image/jpeg' });
    }
    setNewFiles(prev => [...prev, ...items]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (mode === 'create') {
        const payload: any = {
          headline: form.headline || undefined,
          content: form.content.trim(),
          start_at: form.start_at || undefined,
          end_at: form.end_at || undefined,
          location: form.lat != null && form.lng != null ? { name: form.location_name || undefined, lat: form.lat, lng: form.lng } : undefined,
          personIds: form.personIds,
          attachments: newFiles.map(f => ({ mimeType: f.mimeType, dataBase64: f.dataUrl })),
        };
        const res = await fetch('/api/diary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const payload: any = {
          headline: form.headline || undefined,
          content: form.content.trim(),
          start_at: form.start_at || undefined,
          end_at: form.end_at || undefined,
          location: (form.lat != null && form.lng != null) || form.location_name ? { name: form.location_name || undefined, lat: form.lat, lng: form.lng } : undefined,
          personIds: form.personIds,
          attachmentsAdd: newFiles.map(f => ({ mimeType: f.mimeType, dataBase64: f.dataUrl })),
          attachmentsDeleteIds: form.attachmentsToDelete,
        };
        const res = await fetch(`/api/diary/${initial!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
      }
      router.push('/diary');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 space-y-4">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div>
        <label className="label">Headline</label>
        <input className="input" value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Optional headline" />
      </div>
      <div>
        <label className="label">Content</label>
        <textarea className="textarea" rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
        </div>
        <div>
          <label className="label">End date</label>
          <input type="date" className="input" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
        </div>
        <div className="md:col-span-3">
          <PlaceSearch
            label="Place"
            value={form.location_name}
            onSelect={(r) => setForm(f => ({ ...f, location_name: r.name, lat: r.lat, lng: r.lng }))}
          />
        </div>
      </div>
      <div>
        <label className="label">People</label>
        <div className="flex flex-wrap gap-2">
          {people.map(p => (
            <label key={p.id} className="chip cursor-pointer">
              <input type="checkbox" className="mr-1"
                checked={form.personIds.includes(p.id)}
                onChange={e => setForm(f => ({ ...f, personIds: e.target.checked ? [...f.personIds, p.id] : f.personIds.filter(id => id !== p.id) }))}
              />
              <span>{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      {mode === 'edit' && initial?.attachmentIds && initial.attachmentIds.length > 0 && (
        <div>
          <label className="label">Attachments</label>
          <div className="grid grid-cols-4 gap-2">
            {initial.attachmentIds.map(id => (
              <div key={id} className="relative">
                <img src={`/api/diary/attachments/${id}`} alt="attachment" className="rounded-lg border border-white/10 object-cover w-full h-24" />
                <label className="absolute top-1 right-1 chip">
                  <input type="checkbox" className="mr-1" onChange={e => setForm(f => ({ ...f, attachmentsToDelete: e.target.checked ? [...f.attachmentsToDelete, id] : f.attachmentsToDelete.filter(x => x !== id) }))} />
                  Remove
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Add images</label>
        <input className="input" type="file" accept="image/*" multiple onChange={onFiles} />
        {!!newFiles.length && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {newFiles.map((f, i) => (
              <img key={i} src={f.dataUrl} alt={f.file.name} className="rounded-lg border border-white/10 object-cover w-full h-24" />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button disabled={!canSubmit || saving} className="btn-primary" type="submit">{saving ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save changes')}</button>
      </div>
    </form>
  );
}
