// app/api/people/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TagCode } from '@prisma/client';
import { PersonUpdate } from '@/lib/validation';
import { TAG_META } from '@/lib/tags';

export const revalidate = 0;
export const runtime = 'nodejs';

function parseDate(s?: string | null) {
  if (!s) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const p = await prisma.person.findUnique({
    where: { id: params.id },
    include: { tagLinks: { include: { tag: true } }, diaryLinks: true },
  });
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
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
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = PersonUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // If tags provided: ensure Tag rows exist (idempotent)
  if (d.tags?.length) {
    await Promise.all(
      d.tags.map((code: TagCode) =>
        prisma.tag.upsert({
          where: { code },
          create: { code, label: TAG_META[code].label, color: TAG_META[code].color },
          update: {},
        })
      )
    );
  }

  const updated = await prisma.person.update({
    where: { id: params.id },
    data: {
      name: d.name,
      age: d.age,
      is_online: d.is_online,
      notes: d.notes,
      met_at: parseDate(d.met_at),
      ended_at: parseDate(d.ended_at),
      location_name: d.location?.name,
      lat: d.is_online === true ? null : d.location?.lat ?? undefined,
      lng: d.is_online === true ? null : d.location?.lng ?? undefined,
      platform: d.location?.platform,
      context_url: d.location?.url,
    },
  });

  if (d.tags) {
    // Replace all tags
    await prisma.personTag.deleteMany({ where: { personId: updated.id } });
    if (d.tags.length) {
      const tagRows = await prisma.tag.findMany({ where: { code: { in: d.tags } } });
      await prisma.personTag.createMany({
        data: tagRows.map(t => ({ personId: updated.id, tagId: t.id })),
      });
    }
  }

  const withTags = await prisma.person.findUnique({
    where: { id: updated.id },
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

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.person.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
