import { describe, expect, it } from 'vitest';
import { anticipationSchema } from '../../lib/anticipation-validation';

describe('private anticipation dates', () => {
  it('accepts real leap days and historical moments', () => {
    expect(anticipationSchema.parse({ title: 'Erinnerter Moment', date: '2024-02-29' }).date.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(anticipationSchema.safeParse({ title: 'Ungültig', date: '2025-02-29' }).success).toBe(false);
    expect(anticipationSchema.safeParse({ title: 'Ungültig', date: '2030-02-30' }).success).toBe(false);
    expect(anticipationSchema.safeParse({ title: 'Kein Jahr Null', date: '0000-01-01' }).success).toBe(false);
    expect(anticipationSchema.safeParse({ title: 'Gültiges Kalenderjahr', date: '0001-01-01' }).success).toBe(true);
  });
  it('bounds title and note and rejects whitespace-only names', () => {
    expect(anticipationSchema.safeParse({ title: ' ', date: '2030-01-01' }).success).toBe(false);
    expect(anticipationSchema.safeParse({ title: 'x'.repeat(121), date: '2030-01-01' }).success).toBe(false);
    expect(anticipationSchema.safeParse({ title: 'Moment', date: '2030-01-01', note: 'x'.repeat(2001) }).success).toBe(false);
  });
  it('ignores forged ownership and preserves merged fields on partial updates', () => {
    const existing = anticipationSchema.parse({ title: 'Moment', date: '2030-01-01', note: 'Meine Notiz', ownerId: 'forged-owner' });
    expect(existing).not.toHaveProperty('ownerId');
    const updated = anticipationSchema.parse({ ...existing, title: 'Neuer Titel' });
    expect(updated.note).toBe('Meine Notiz');
    expect(updated.date).toEqual(existing.date);
  });
});
