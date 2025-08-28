import PersonForm from '@/components/people/PersonForm';

export default function NewPersonPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">New Person</h2>
      <PersonForm mode="create" />
    </div>
  );
}

