// app/api/diary/attachments/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const a = await prisma.diaryAttachment.findUnique({ where: { id: params.id } });
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Convert Buffer to Uint8Array to satisfy BodyInit types
  const body = new Uint8Array(a.data);
  return new NextResponse(body, {
    headers: {
      'Content-Type': a.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
