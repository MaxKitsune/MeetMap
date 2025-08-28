// app/api/diary/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DiaryCreate } from '@/lib/validation';

export const revalidate = 0;
export const runtime = 'nodejs';

function parseDate(s?: string | null) {
  if (!s) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

function extractBase64(dataUrl: string) {
  // ex: data:image/jpeg;base64,/9j/...
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return null;
  return dataUrl.slice(idx + 7);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? undefined;
  const personId = searchParams.get('personId') ?? undefined;
  const take = Math.min(Number(searchParams.get('take') || '30'), 100);

  const where: any = {};
  if (q) {
    where.OR = [
      { content: { contains: q, mode: 'insensitive' } },
      { location_name: { contains: q, mode: 'insensitive' } },
      { people: { some: { person: { name: { contains: q, mode: 'insensitive' } } } } },
    ];
  }
  if (personId) where.people = { some: { personId } };

  const entries = await prisma.diaryEntry.findMany({
    where,
    orderBy: [{ start_at: 'desc' }, { createdAt: 'desc' }],
    take,
    include: {
      people: { include: { person: true } },
      attachments: { select: { id: true, mimeType: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  });

  const normalized = entries.map(e => ({
    id: e.id,
    headline: e.headline,
    content: e.content,
    start_at: e.start_at?.toISOString() ?? null,
    end_at: e.end_at?.toISOString() ?? null,
    location_name: e.location_name,
    lat: e.lat ? Number(e.lat) : null,
    lng: e.lng ? Number(e.lng) : null,
    people: e.people.map(p => ({ id: p.person.id, name: p.person.name })),
    previewAttachmentId: e.attachments[0]?.id ?? null,
    created_at: e.createdAt.toISOString(),
  }));

  return NextResponse.json(normalized);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = DiaryCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const entry = await prisma.diaryEntry.create({
    data: {
      headline: d.headline,
      content: d.content,
      start_at: parseDate(d.start_at),
      end_at: parseDate(d.end_at),
      location_name: d.location?.name,
      lat: d.location?.lat ?? null,
      lng: d.location?.lng ?? null,
    },
  });

  if (d.personIds?.length) {
    await prisma.diaryEntryPerson.createMany({
      data: d.personIds.map(pid => ({ diaryEntryId: entry.id, personId: pid })),
      skipDuplicates: true,
    });
  }

  if (d.attachments?.length) {
    const payloads = d.attachments
      .map(a => {
        const b64 = extractBase64(a.dataBase64);
        if (!b64) return null;
        return { entryId: entry.id, data: Buffer.from(b64, 'base64'), mimeType: a.mimeType };
      })
      .filter(Boolean) as { entryId: string; data: Buffer; mimeType: string }[];

    if (payloads.length) {
      // Prisma doesn't support createMany with Bytes in some drivers; use loop for safety.
      for (const p of payloads) {
        await prisma.diaryAttachment.create({ data: p });
      }
    }
  }

  return NextResponse.json({ id: entry.id });
}
