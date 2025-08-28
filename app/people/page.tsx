import PeopleList from '@/components/people/PeopleList';

export const dynamic = 'force-dynamic';

export default function PeoplePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">People</h2>
      <PeopleList />
    </div>
  );
}

