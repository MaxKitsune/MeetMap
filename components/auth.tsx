"use client";
import { useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  MapPin,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";
export default function Auth({ setup = false }: { setup?: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await fetch(`/api/auth/${setup ? "setup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.location.href = "/";
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Das hat nicht geklappt. Bitte versuche es erneut.",
      );
      setPending(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <img src="/favicon.svg" width="39" height="39" alt="" />
        <span>
          meetmap<span className="logo-dot">.</span>
        </span>
      </div>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">DEIN LEBEN. DEINE VERBINDUNGEN.</span>
          <h1>
            Manche Momente
            <br />
            bleiben.
            <br />
            <em>Gib ihnen einen Ort.</em>
          </h1>
          <p>
            Die Menschen, die dich begleiten. Die Orte, die etwas bedeuten. Und
            all die kleinen Erinnerungen dazwischen.
          </p>
          <div className="auth-art">
            <div className="auth-orbit orbit-one" />
            <div className="auth-orbit orbit-two" />
            <div className="auth-pin">
              <MapPin size={38} />
            </div>
            <span className="orbit-label label-one">Menschen</span>
            <span className="orbit-label label-two">Erinnerungen</span>
            <span className="orbit-label label-three">Orte</span>
          </div>
        </section>
        <section className="auth-card">
          <span className="small-icon">
            <LockKeyhole size={23} />
          </span>
          <h2>{setup ? "Dein Anfang mit MeetMap." : "Willkommen zurück."}</h2>
          <p>
            {setup
              ? "Erstelle deinen Account und halte die ersten Momente fest."
              : "Deine Erinnerungen warten auf dich."}
          </p>
          <form onSubmit={submit}>
            {setup && (
              <label>
                Dein Name
                <input
                  name="name"
                  autoComplete="given-name"
                  placeholder="Wie heißt du?"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              E-Mail-Adresse
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="du@beispiel.de"
                required
              />
            </label>
            <label>
              Passwort
              <div className="password-input">
                <input
                  type={visible ? "text" : "password"}
                  name="password"
                  minLength={setup ? 12 : 1}
                  maxLength={128}
                  autoComplete={setup ? "new-password" : "current-password"}
                  placeholder={
                    setup ? "Mindestens 12 Zeichen" : "Dein Passwort"
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? "Passwort verbergen" : "Passwort anzeigen"
                  }
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button disabled={pending} className="button primary full">
              {pending ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {setup ? "Account erstellen" : "Anmelden"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
      <footer>
        Ein Zuhause für das, was zählt.<span>MEETMAP</span>
      </footer>
    </main>
  );
}
