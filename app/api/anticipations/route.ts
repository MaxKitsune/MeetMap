import { db } from '@/lib/db';
import { anticipationSelect } from '@/lib/data';
import { checkOrigin, requireOwner, jsonBody, rateLimit } from '@/lib/security';
import { anticipationSchema } from '@/lib/anticipation-validation';
import { anticipationReply, anticipationFailure } from '@/lib/anticipation-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { id: ownerId } = await requireOwner();
    return anticipationReply(await db.anticipation.findMany({ where: { ownerId }, select: anticipationSelect, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }));
  } catch (error) { return anticipationFailure(error); }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    await rateLimit('anticipation-write-' + ownerId, 120);
    const data = anticipationSchema.parse(await jsonBody(request));
    const result = await db.$transaction(async tx => {
      const value = await tx.anticipation.create({ data: { ...data, ownerId }, select: anticipationSelect });
      await tx.auditLog.create({ data: { ownerId, action: 'ANTICIPATION_CREATED', entityId: value.id } });
      return value;
    });
    return anticipationReply(result, 201);
  } catch (error) { return anticipationFailure(error); }
}
