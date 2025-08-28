"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Confirm } from './Confirm';

export default function DeleteButton({ resourceUrl, redirectTo, label = 'Delete', confirmTitle = 'Delete?', confirmBody }: {
  resourceUrl: string;
  redirectTo: string;
  label?: string;
  confirmTitle?: string;
  confirmBody?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function doDelete() {
    const res = await fetch(resourceUrl, { method: 'DELETE' });
    if (res.ok) { setOpen(false); router.push(redirectTo); router.refresh(); }
  }
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>{label}</button>
      <Confirm open={open} onCancel={() => setOpen(false)} onConfirm={doDelete} title={confirmTitle} body={confirmBody} />
    </>
  );
}

