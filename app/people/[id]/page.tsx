import PersonForm from '@/components/people/PersonForm';
import DeleteButton from '@/components/ui/DeleteButton';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getBaseUrl } from '@/lib/urls';

async function getPerson(id: string) {
  const res = await fetch(`${getBaseUrl()}/api/people/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function EditPersonPage({ params }: { params: { id: string } }) {
  const person = await getPerson(params.id);
  if (!person) return notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Edit Person</h2>
      </div>
      <Suspense>
        <PersonForm mode="edit" initial={person} />
      </Suspense>
      <div className="flex justify-between items-center">
        <a className="btn-ghost" href="/people">Back</a>
        <DeleteButton resourceUrl={`/api/people/${params.id}`} redirectTo="/people" label="Delete" confirmTitle="Delete person?" confirmBody="This will remove the person and relationships." />
      </div>
    </div>
  );
}
