// app/api/people/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PersonCreate } from '@/lib/validation';
import { TagCode } from '@prisma/client';
import { TAG_META } from '@/lib/tags';

export const revalidate = 0;
export const runtime = 'nodejs';

function parseDate(s?: string | null) {
  if (!s) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get('q') ?? undefined;
  const tagsCsv = searchParams.get('tags') ?? '';
  const online = searchParams.get('online');
  const bbox = searchParams.get('bbox');
  const take = Math.min(Number(searchParams.get('take') || '100'), 100);

  const tags = tagsCsv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as TagCode[];

  const where: any = {};

  if (online === 'true') where.is_online = true;
  if (online === 'false') where.is_online = false;

  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      { location_name: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (bbox) {
    const [west, south, east, north] = bbox.split(',').map(Number);
    if ([west, south, east, north].every(n => Number.isFinite(n))) {
      where.AND = [
        { lat: { gte: south }, lng: { gte: west } },
        { lat: { lte: north }, lng: { lte: east } },
      ];
    }
  }

  if (tags.length) {
    where.tagLinks = { some: { tag: { code: { in: tags } } } };
  }

  const people = await prisma.person.findMany({
    where,
    include: { tagLinks: { include: { tag: true } } },
    orderBy: [{ met_at: 'desc' }, { createdAt: 'desc' }],
    take,
  });

  const normalized = people.map(p => ({
    id: p.id,
    name: p.name,
    age: p.age,
    is_online: p.is_online,
    notes: p.notes,
    location_name: p.location_name,
    lat: p.lat ? Number(p.lat) : null,
    lng: p.lng ? Number(p.lng) : null,
    met_at: p.met_at?.toISOString() ?? null,
    ended_at: p.ended_at?.toISOString() ?? null,
    platform: p.platform,
    context_url: p.context_url,
    tags: p.tagLinks.map(t => t.tag.code),
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  }));

  return NextResponse.json(normalized);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = PersonCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Defensive: ensure Tag rows exist (idempotent)
  if (data.tags?.length) {
    await Promise.all(
      data.tags.map(code =>
        prisma.tag.upsert({
          where: { code },
          create: { code, label: TAG_META[code].label, color: TAG_META[code].color },
          update: {},
        })
      )
    );
  }

  const person = await prisma.person.create({
    data: {
      name: data.name,
      age: data.age,
      is_online: data.is_online,
      notes: data.notes,
      met_at: parseDate(data.met_at),
      ended_at: parseDate(data.ended_at),
      location_name: data.location?.name,
      lat: data.is_online ? null : data.location.lat,
      lng: data.is_online ? null : data.location.lng,
      platform: data.location.platform,
      context_url: data.location.url,
    },
  });

  // Attach tags via explicit join table
  if (data.tags?.length) {
    const tagsRows = await prisma.tag.findMany({ where: { code: { in: data.tags } } });
    if (tagsRows.length) {
      await prisma.personTag.createMany({
        data: tagsRows.map(t => ({ personId: person.id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  const withTags = await prisma.person.findUnique({
    where: { id: person.id },
    include: { tagLinks: { include: { tag: true } } },
  });

  return NextResponse.json({
    id: withTags!.id,
    name: withTags!.name,
    age: withTags!.age,
    is_online: withTags!.is_online,
    notes: withTags!.notes,
    location_name: withTags!.location_name,
    lat: withTags!.lat ? Number(withTags!.lat) : null,
    lng: withTags!.lng ? Number(withTags!.lng) : null,
    met_at: withTags!.met_at?.toISOString() ?? null,
    ended_at: withTags!.ended_at?.toISOString() ?? null,
    platform: withTags!.platform,
    context_url: withTags!.context_url,
    tags: withTags!.tagLinks.map(t => t.tag.code),
    created_at: withTags!.createdAt.toISOString(),
    updated_at: withTags!.updatedAt.toISOString(),
  });
}
