// lib/validation.ts
import { z } from 'zod';
import { TagCode } from '@prisma/client';

const dateLike = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    z.string().datetime({ offset: true }), // ISO w/ TZ
  ])
  .optional();

const PersonObj = z
  .object({
    name: z.string().min(1),
    age: z.number().int().min(0).max(150).optional(),
    is_online: z.boolean(),
    notes: z.string().max(10_000).optional(),
    met_at: dateLike,
    ended_at: dateLike,
    tags: z.array(z.nativeEnum(TagCode)).default([]),
    location: z.object({
      name: z.string().optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
      platform: z.string().optional(),
      url: z.string().url().optional(),
    }),
  });

export const PersonBase = PersonObj;
export const PersonCreate = PersonObj.superRefine((v, ctx) => {
  if (!v.is_online) {
    if (v.location.lat == null || v.location.lng == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['location'], message: 'Physical person requires lat & lng' });
    }
  }
});
export const PersonUpdate = PersonObj.partial().extend({
  tags: z.array(z.nativeEnum(TagCode)).optional(),
});

export type PersonCreateInput = z.infer<typeof PersonCreate>;
export type PersonUpdateInput = z.infer<typeof PersonUpdate>;

export const DiaryAttachmentInput = z.object({
  mimeType: z.string().regex(/^image\//),
  dataBase64: z.string().startsWith('data:'), // "data:image/jpeg;base64,...."
});

export const DiaryCreate = z.object({
  headline: z.string().max(200).optional(),
  content: z.string().min(1),
  start_at: dateLike,
  end_at: dateLike,
  location: z
    .object({
      name: z.string().optional(),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  personIds: z.array(z.string()).default([]),
  attachments: z.array(DiaryAttachmentInput).default([]),
});

export const DiaryUpdate = DiaryCreate.partial().extend({
  attachmentsAdd: z.array(DiaryAttachmentInput).optional(),
  attachmentsDeleteIds: z.array(z.string()).optional(),
});
