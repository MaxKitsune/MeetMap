"use client";
import { ServerCrash } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="system-error">
      <ServerCrash size={35} />
      <h1>Dein Server ist kurz nicht erreichbar.</h1>
      <p>
        Bitte prüfe, ob MeetMap und die Datenbank laufen. Deine gespeicherten
        Erinnerungen bleiben erhalten.
      </p>
      <button className="button primary" onClick={reset}>
        Erneut versuchen
      </button>
    </main>
  );
}
