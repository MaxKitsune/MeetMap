import MeetMap from '@/components/map/MeetMap';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Map</h2>
          <p className="text-white/70 text-sm">See people and diary moments placed in space.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-ghost" href="/people">Manage People</Link>
          <Link className="btn-ghost" href="/diary">Manage Diary</Link>
        </div>
      </div>
      <MeetMap />
    </div>
  );
}

