import DiaryList from '@/components/diary/DiaryList';
import BirthAndPeople from '@/components/timeline/BirthAndPeople';

export const dynamic = 'force-dynamic';

export default function TimelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Timeline</h2>
        <p className="text-white/70 text-sm">Life overview + people duration lanes + events.</p>
      </div>
      <BirthAndPeople />
      <section>
        <h3 className="font-semibold mb-2">Events</h3>
        <DiaryList timeline />
      </section>
    </div>
  );
}
