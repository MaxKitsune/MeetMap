function calendarDate(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1
  )
    return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse a calendar date without locale heuristics, timezones or DST conversion. */
export function parseDateInput(text: string): string | null {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const date = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/.exec(value);
  return date
    ? calendarDate(Number(date[4]), Number(date[3]), Number(date[1]))
    : null;
}

/** Display the stored calendar day; timestamps do not shift by browser timezone. */
export function formatDate(value?: string | null): string {
  if (!value?.trim()) return "Noch offen";
  const timestampDay = /^(\d{4}-\d{2}-\d{2})T/.exec(value)?.[1];
  const iso = parseDateInput(timestampDay || value);
  if (!iso) return "Ungültiges Datum";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function dateInputError(
  text: string,
  rules: {
    required?: boolean;
    min?: string | number;
    max?: string | number;
  } = {},
): string {
  if (!text.trim())
    return rules.required
      ? "Bitte ein Datum im Format dd/mm/yyyy eingeben."
      : "";
  const iso = parseDateInput(text);
  if (!iso) return "Bitte ein gültiges Datum im Format dd/mm/yyyy eingeben.";
  const min =
    rules.min === undefined ? null : parseDateInput(String(rules.min));
  const max =
    rules.max === undefined ? null : parseDateInput(String(rules.max));
  if (min && iso < min)
    return `Das Datum muss am oder nach dem ${formatDate(min)} liegen.`;
  if (max && iso > max)
    return `Das Datum muss am oder vor dem ${formatDate(max)} liegen.`;
  return "";
}
