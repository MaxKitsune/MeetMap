import { headers } from 'next/headers';

export function getBaseUrl() {
  // Prefer explicit env override
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  // Derive from request headers (works in server components/routes)
  try {
    const h = headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || 'http';
    if (host) return `${proto}://${host}`;
  } catch {}
  // Fallback to dev default
  return 'http://localhost:3000';
}

