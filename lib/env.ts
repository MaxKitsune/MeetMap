import { z } from "zod";
import path from "node:path";
const schema = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  APP_URL: z.url().refine((v) => /^https?:\/\//.test(v)),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  OLLAMA_URL: z.url().optional(),
  OLLAMA_MODEL: z.string().default("gemma3:4b"),
  GEOCODER_URL: z.url().default("https://nominatim.openstreetmap.org"),
});
export function env() {
  const values = schema.parse(process.env);
  return {
    ...values,
    UPLOAD_DIR: path.resolve(values.UPLOAD_DIR),
    origin: new URL(values.APP_URL).origin,
    secure: new URL(values.APP_URL).protocol === "https:",
  };
}
