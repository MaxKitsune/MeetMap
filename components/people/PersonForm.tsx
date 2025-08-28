"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tag } from '@/lib/api';
import PlaceSearch from '@/components/places/PlaceSearch';

type Initial = Partial<{
  id: string;
  name: string;
  age: number | null;
  is_online: boolean;
  notes: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  platform: string | null;
  context_url: string | null;
  tags: string[];
  met_at: string | null;
  ended_at: string | null;
}>;

export default function PersonForm({ initial, mode = 'create' }: { initial?: Initial; mode?: 'create' | 'edit' }) {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    age: initial?.age ?? undefined as number | undefined,
    is_online: initial?.is_online ?? false,
    notes: initial?.notes ?? '',
    met_at: (initial?.met_at ?? '').slice(0, 10),
    ended_at: (initial?.ended_at ?? '').slice(0, 10),
    location_name: initial?.location_name ?? '',
    lat: initial?.lat ?? undefined as number | undefined,
    lng: initial?.lng ?? undefined as number | undefined,
    platform: initial?.platform ?? '',
    url: initial?.context_url ?? '',
    tags: (initial?.tags ?? []) as string[],
  });

  useEffect(() => { (async () => setTags(await (await fetch('/api/tags')).json()))(); }, []);

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false;
    if (!form.is_online && (form.lat == null || form.lng == null)) return false;
    return true;
  }, [form]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload: any = {
        name: form.name.trim(),
        age: form.age ?? undefined,
        is_online: !!form.is_online,
        notes: form.notes || undefined,
        met_at: form.met_at || undefined,
        ended_at: form.ended_at || undefined,
        tags: form.tags,
        location: {
          name: form.location_name || undefined,
          lat: form.is_online ? undefined : form.lat,
          lng: form.is_online ? undefined : form.lng,
          platform: form.platform || undefined,
          url: form.url || undefined,
        },
      };
      const res = await fetch(mode === 'create' ? '/api/people' : `/api/people/${initial!.id}` , {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push('/people');
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
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Age</label>
          <input type="number" className="input" value={form.age ?? ''} onChange={e => setForm(f => ({ ...f, age: e.target.value ? Number(e.target.value) : undefined }))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea className="textarea" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div>
          <label className="label">Met at</label>
          <input type="date" className="input" value={form.met_at} onChange={e => setForm(f => ({ ...f, met_at: e.target.value }))} />
        </div>
        <div>
          <label className="label">Ended at</label>
          <input type="date" className="input" value={form.ended_at} onChange={e => setForm(f => ({ ...f, ended_at: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <input id="isonline" type="checkbox" className="h-4 w-4" checked={form.is_online} onChange={e => setForm(f => ({ ...f, is_online: e.target.checked }))} />
          <label htmlFor="isonline" className="label">Online-only (no coordinates)</label>
        </div>
        {!form.is_online && (
          <div className="md:col-span-2">
            <PlaceSearch
              label="Place"
              value={form.location_name}
              onSelect={(r) => setForm(f => ({ ...f, location_name: r.name, lat: r.lat, lng: r.lng }))}
            />
          </div>
        )}
        {/* location name is populated by PlaceSearch */}
        <div>
          <label className="label">Platform</label>
          <input className="input" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} />
        </div>
        <div>
          <label className="label">Context URL</label>
          <input className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label">Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <label key={t.code} className="chip cursor-pointer">
              <input type="checkbox" className="mr-1"
                checked={form.tags.includes(t.code)}
                onChange={e => setForm(f => ({ ...f, tags: e.target.checked ? [...f.tags, t.code] : f.tags.filter(c => c !== t.code) }))}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button disabled={!canSubmit || saving} className="btn-primary" type="submit">{saving ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save changes')}</button>
      </div>
    </form>
  );
}
