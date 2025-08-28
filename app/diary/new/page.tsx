import DiaryForm from '@/components/diary/DiaryForm';

export default function NewDiaryPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">New Entry</h2>
      <DiaryForm mode="create" />
    </div>
  );
}

