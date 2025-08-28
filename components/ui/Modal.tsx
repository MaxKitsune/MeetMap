"use client";
import { ReactNode, useEffect } from 'react';

export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card w-full max-w-2xl h-[70vh] overflow-auto p-5">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
