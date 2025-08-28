// app/api/tags/route.ts
import { NextResponse } from 'next/server';
import { TagCode } from '@prisma/client';
import { TAG_META } from '@/lib/tags';

export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  const list = (Object.keys(TAG_META) as TagCode[]).map(code => ({
    code,
    label: TAG_META[code].label,
    color: TAG_META[code].color,
  }));
  return NextResponse.json(list);
}

