// lib/tags.ts
import { TagCode } from '@prisma/client';

export const TAG_META: Record<TagCode, { label: string; color: string }> = {
  FAMILY: { label: 'Family', color: '#f97316' },
  CLOSE_FRIEND: { label: 'Close friend', color: '#22c55e' },
  FRIEND: { label: 'Friend', color: '#3b82f6' },
  LOVE_INTEREST: { label: 'Love interest', color: '#e11d48' },
  RELATIONSHIP: { label: 'Relationship', color: '#a855f7' },
  ACQUAINTANCE: { label: 'Acquaintance', color: '#14b8a6' },
  ENCOUNTER: { label: 'Encounter', color: '#64748b' },
};

export const TAG_ORDER: TagCode[] = [
  TagCode.FAMILY,
  TagCode.RELATIONSHIP,
  TagCode.LOVE_INTEREST,
  TagCode.CLOSE_FRIEND,
  TagCode.FRIEND,
  TagCode.ACQUAINTANCE,
  TagCode.ENCOUNTER,
];

