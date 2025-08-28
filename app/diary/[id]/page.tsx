import DiaryForm from '@/components/diary/DiaryForm';
import DeleteButton from '@/components/ui/DeleteButton';
import { getBaseUrl } from '@/lib/urls';
import { notFound } from 'next/navigation';

async function getEntry(id: string) {
  const res = await fetch(`${getBaseUrl()}/api/diary/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditDiaryPage({ params }: { params: { id: string } }) {
  const entry = await getEntry(params.id);
  if (!entry) return notFound();
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Edit Entry</h2>
      <DiaryForm mode="edit" initial={entry} />
      <div className="flex justify-between items-center">
        <a className="btn-ghost" href="/diary">Back</a>
        <DeleteButton resourceUrl={`/api/diary/${params.id}`} redirectTo="/diary" label="Delete" confirmTitle="Delete entry?" confirmBody="This will permanently remove the entry." />
      </div>
    </div>
  );
}
