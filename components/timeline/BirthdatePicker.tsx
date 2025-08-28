"use client";
import { useEffect, useState } from 'react';

export default function BirthdatePicker({ onChange }: { onChange: (d: Date | null) => void }) {
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    const saved = localStorage.getItem('birthDate');
    if (saved) setValue(saved);
  }, []);

  useEffect(() => {
    if (!value) { onChange(null); return; }
    const d = new Date(value);
    if (!isNaN(d.getTime())) onChange(d); else onChange(null);
  }, [value, onChange]);

  function save(v: string) {
    setValue(v);
    if (v) localStorage.setItem('birthDate', v); else localStorage.removeItem('birthDate');
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <label className="label">Your birth date</label>
        <input type="date" className="input w-52" value={value} onChange={e => save(e.target.value)} />
        <span className="text-xs text-white/60">Used to render the full timeline.</span>
      </div>
    </div>
  );
}

