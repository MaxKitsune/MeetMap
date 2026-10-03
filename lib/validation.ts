import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum eingeben.")
  .refine((v) => {
    const d = new Date(v);
    return Number(v.slice(0, 4)) >= 1 && !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Ungültiges Datum.");
const optionalDate = z
  .union([date, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));
const optionalId = z
  .string()
  .max(64)
  .nullable()
  .optional()
  .transform((v) => v || null);
export const personSchema = z
  .object({
    name: z.string().trim().min(1, "Ein Name fehlt noch.").max(100),
    aliases: z.string().max(300).default(""),
    birthday: optionalDate,
    tags: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
    importance: z.number().int().min(1).max(3).default(2),
    favorite: z.boolean().default(false),
    notes: z.string().max(30000).default(""),
    metAt: optionalDate,
    endedAt: optionalDate,
    online: z.boolean().default(false),
    platform: z.string().max(100).default(""),
    contextUrl: z
      .union([
        z.literal(""),
        z
          .url()
          .refine(
            (v) => /^https?:\/\//.test(v),
            "Nur HTTP- und HTTPS-Links sind erlaubt.",
          ),
      ])
      .default(""),
    contactDays: z.number().int().min(0).max(3650).default(30),
    lastContact: optionalDate,
    placeId: optionalId,
    avatarId: optionalId,
  })
  .refine((v) => !v.endedAt || !v.metAt || v.endedAt >= v.metAt, {
    message: "Das Enddatum liegt vor dem Kennenlernen.",
    path: ["endedAt"],
  });
export const memorySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Gib deiner Erinnerung einen Titel.")
      .max(160),
    content: z.string().max(50000).default(""),
    startAt: date.transform((v) => new Date(`${v}T00:00:00Z`)),
    endAt: optionalDate,
    type: z
      .enum(["Notiz", "Treffen", "Reise", "Call", "Event", "Sonstiges"])
      .default("Treffen"),
    mood: z
      .enum([
        "Glücklich",
        "Dankbar",
        "Entspannt",
        "Aufgeregt",
        "Nachdenklich",
        "Traurig",
      ])
      .default("Glücklich"),
    privacy: z.enum(["Privat", "Sensibel"]).default("Privat"),
    favorite: z.boolean().default(false),
    pinned: z.boolean().default(false),
    draft: z.boolean().default(false),
    revision: z.number().int().min(0).optional(),
    // Older editors omit this key. Undefined must preserve an existing association.
    tripId: z.string().max(64).nullable().optional().transform(v => v === '' ? null : v),
    placeId: optionalId,
    personIds: z.array(z.string().max(64)).max(100).default([]),
    attachmentIds: z.array(z.string().max(64)).max(50).default([]),
  })
  .refine((v) => !v.endAt || v.endAt >= v.startAt, {
    message: "Das Enddatum liegt vor dem Startdatum.",
    path: ["endAt"],
  });
export const placeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  latitude: z.number().min(-85).max(85),
  longitude: z.number().min(-180).max(180),
});
export const settingsSchema = z.object({
  birthday: z.union([date, z.literal(''), z.null()]).optional().transform(v => v === undefined ? undefined : v ? new Date(`${v}T00:00:00Z`) : null),
  privacyRadius: z.number().int().min(0).max(10000).optional(),
  mapEnabled: z.boolean().optional(),
  homePlaceId: z.string().max(64).nullable().optional().transform(v => v === '' ? null : v),
  detectionMinDays: z.number().int().min(1).max(365).optional(),
  detectionRadiusKm: z.number().finite().min(1).max(20000).optional(),
});
export const setupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(12, "Das Passwort muss mindestens 12 Zeichen haben.")
    .max(128),
});
export const loginSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});
