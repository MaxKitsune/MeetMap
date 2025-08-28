export type Tag = { code: string; label: string; color: string };

export async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const Tags = {
  list: () => api<Tag[]>('/api/tags'),
};

