import DiaryList from '@/components/diary/DiaryList';

export const dynamic = 'force-dynamic';

export default function DiaryPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Diary</h2>
      <DiaryList />
    </div>
  );
}

