export const metadata = {
  title: 'MeetMap',
  description: 'People, places, and moments on a map',
};

import './globals.css';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const GlobalSearch = dynamic(() => import('@/components/ui/GlobalSearch'), { ssr: false });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 nav-gradient border-b border-white/10 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-glow" />
            <h1 className="text-lg font-semibold tracking-tight">MeetMap</h1>
            <nav className="ml-auto flex items-center gap-2 text-sm">
              <Link className="btn-ghost" href="/map">Map</Link>
              <Link className="btn-ghost" href="/timeline">Timeline</Link>
              <Link className="btn-ghost" href="/people">People</Link>
              <Link className="btn-ghost" href="/diary">Diary</Link>
              <div className="hidden md:block ml-2">
                <GlobalSearch />
              </div>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
