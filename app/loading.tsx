export default function Loading() {
  return (
    <main className="app-loading">
      <img src="/favicon.svg" alt="" width={46} height={46} />
      <p>Dein MeetMap wird geöffnet …</p>
      <div className="loading-line" />
    </main>
  );
}
