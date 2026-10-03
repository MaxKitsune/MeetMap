import { formatDate } from "./dates";
export const dateInput = (value?: string | null) => value?.slice(0, 10) || "";
export const today = () => new Date().toLocaleDateString("en-CA");
export const fmtDate = (value?: string | null, _year = false) => formatDate(value);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
export const daysSince = (date?: string | null) =>
  date
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(date).getTime()) / 86400000),
      )
    : null;
export function birthdayIn(date: string, now = new Date()) {
  const b = new Date(date);
  const next = new Date(now.getFullYear(), b.getUTCMonth(), b.getUTCDate());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < start) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - start.getTime()) / 86400000);
}
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function fuzzyMatch(text: string, query: string) {
  const t = normalize(text),
    q = normalize(query).trim();
  if (!q || t.includes(q)) return true;
  if (q.length < 4) return false;
  return t.split(/\W+/).some((word) => {
    if (Math.abs(word.length - q.length) > 1) return false;
    const matrix = Array.from({ length: word.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= q.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= word.length; i++)
      for (let j = 1; j <= q.length; j++)
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (word[i - 1] === q[j - 1] ? 0 : 1),
        );
    return matrix[word.length][q.length] <= 1;
  });
}
export async function api<T = unknown>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + url, {
    method,
    headers:
      data instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  if (response.status === 401 && url !== "auth/login") {
    window.location.assign("/login");
    throw new Error("Deine Sitzung ist abgelaufen.");
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Das hat nicht geklappt. Bitte versuche es erneut.",
    );
  return result;
}
