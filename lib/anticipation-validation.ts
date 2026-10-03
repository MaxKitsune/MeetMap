import { z } from 'zod';
import { travelDateSchema } from './travel-validation';

export const anticipationSchema = z.object({
  title: z.string().trim().min(1, 'Worauf freust du dich?').max(120, 'Der Titel darf höchstens 120 Zeichen haben.'),
  date: travelDateSchema,
  note: z.string().max(2000, 'Die Notiz darf höchstens 2000 Zeichen haben.').default(''),
});
