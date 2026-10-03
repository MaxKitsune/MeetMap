import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ApiError } from './security';

export const anticipationReply = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});
export function anticipationFailure(error: unknown) {
  if (error instanceof ApiError) return anticipationReply({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return anticipationReply({ error: error.issues[0]?.message || 'Bitte überprüfe deine Eingaben.' }, 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return anticipationReply({ error: 'Dieser Vorfreude-Moment wurde nicht gefunden.' }, 404);
    if (['P2002', 'P2034'].includes(error.code)) return anticipationReply({ error: 'Der Moment wurde gleichzeitig geändert. Bitte lade ihn neu.' }, 409);
  }
  return anticipationReply({ error: 'Der Vorfreude-Moment konnte nicht gespeichert werden. Bitte versuche es erneut.' }, 500);
}
