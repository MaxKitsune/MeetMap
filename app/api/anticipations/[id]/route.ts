import { z } from 'zod';
import { db } from '@/lib/db';
import { anticipationSelect } from '@/lib/data';
import { ApiError, checkOrigin, requireOwner, jsonBody, rateLimit } from '@/lib/security';
import { anticipationSchema } from '@/lib/anticipation-validation';
import { anticipationReply, anticipationFailure } from '@/lib/anticipation-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id: ownerId } = await requireOwner();
    const { id } = await context.params;
    const value = await db.anticipation.findFirst({ where: { id, ownerId }, select: anticipationSelect });
    if (!value) throw new ApiError(404, 'Dieser Vorfreude-Moment wurde nicht gefunden.');
    return anticipationReply(value);
  } catch (error) { return anticipationFailure(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    await rateLimit('anticipation-write-' + ownerId, 120);
    const { id } = await context.params;
    const patch = z.record(z.string(), z.unknown()).parse(await jsonBody(request));
    const result = await db.$transaction(async tx => {
      const existing = await tx.anticipation.findFirst({ where: { id, ownerId }, select: anticipationSelect });
      if (!existing) throw new ApiError(404, 'Dieser Vorfreude-Moment wurde nicht gefunden.');
      const data = anticipationSchema.parse({ ...existing, ...patch });
      const value = await tx.anticipation.update({ where: { id, ownerId }, data, select: anticipationSelect });
      await tx.auditLog.create({ data: { ownerId, action: 'ANTICIPATION_UPDATED', entityId: id } });
      return value;
    }, { isolationLevel: 'Serializable' });
    return anticipationReply(result);
  } catch (error) { return anticipationFailure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id: ownerId } = await requireOwner();
    await rateLimit('anticipation-write-' + ownerId, 120);
    const { id } = await context.params;
    await db.$transaction(async tx => {
      const result = await tx.anticipation.deleteMany({ where: { id, ownerId } });
      if (!result.count) throw new ApiError(404, 'Dieser Vorfreude-Moment wurde nicht gefunden.');
      await tx.auditLog.create({ data: { ownerId, action: 'ANTICIPATION_DELETED', entityId: id } });
    });
    return anticipationReply({ ok: true });
  } catch (error) { return anticipationFailure(error); }
}
