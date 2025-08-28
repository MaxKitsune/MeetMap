// app/api/diary/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DiaryUpdate } from '@/lib/validation';

export const revalidate = 0;
export const runtime = 'nodejs';

function parseDate(s?: string | null) {
  if (!s) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? undefined : d;
}

function extractBase64(dataUrl: string) {
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return null;
  return dataUrl.slice(idx + 7);
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const e = await prisma.diaryEntry.findUnique({
    where: { id: params.id },
    include: {
      people: { include: { person: true } },
      attachments: { select: { id: true, mimeType: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: e.id,
    headline: e.headline,
    content: e.content,
    start_at: e.start_at?.toISOString() ?? null,
    end_at: e.end_at?.toISOString() ?? null,
    location_name: e.location_name,
    lat: e.lat ? Number(e.lat) : null,
    lng: e.lng ? Number(e.lng) : null,
    people: e.people.map(p => ({ id: p.person.id, name: p.person.name })),
    attachmentIds: e.attachments.map(a => a.id),
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = DiaryUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const updated = await prisma.diaryEntry.update({
    where: { id: params.id },
    data: {
      headline: d.headline,
      content: d.content,
      start_at: parseDate(d.start_at),
      end_at: parseDate(d.end_at),
      location_name: d.location?.name,
      lat: d.location?.lat ?? undefined,
      lng: d.location?.lng ?? undefined,
    },
  });

  if (d.personIds) {
    await prisma.diaryEntryPerson.deleteMany({ where: { diaryEntryId: updated.id } });
    if (d.personIds.length) {
      await prisma.diaryEntryPerson.createMany({
        data: d.personIds.map(pid => ({ diaryEntryId: updated.id, personId: pid })),
      });
    }
  }

  if (d.attachmentsDeleteIds?.length) {
    await prisma.diaryAttachment.deleteMany({ where: { id: { in: d.attachmentsDeleteIds } } });
  }

  if (d.attachmentsAdd?.length) {
    for (const a of d.attachmentsAdd) {
      const b64 = extractBase64(a.dataBase64);
      if (b64) {
        await prisma.diaryAttachment.create({
          data: { entryId: updated.id, data: Buffer.from(b64, 'base64'), mimeType: a.mimeType },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.diaryEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
