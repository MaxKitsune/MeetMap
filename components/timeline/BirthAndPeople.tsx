"use client";
import { useEffect, useState } from 'react';
import BirthdatePicker from './BirthdatePicker';
import PeopleTimeline from './PeopleTimeline';

export default function BirthAndPeople() {
  const [birth, setBirth] = useState<Date | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('birthDate');
    if (saved) setBirth(new Date(saved));
    setEditing(!saved); // ask once if not set
  }, []);

  return (
    <div className="space-y-3">
      {editing ? (
        <BirthdatePicker onChange={(d) => { setBirth(d); }} />
      ) : null}
      <section>
        <h3 className="font-semibold mb-2">People</h3>
        <PeopleTimeline birth={birth} />
        <div className="mt-2 text-right">
          <button className="btn-ghost text-xs" onClick={() => setEditing(e => !e)}>{editing ? 'Hide' : 'Change birth date'}</button>
        </div>
      </section>
    </div>
  );
}
