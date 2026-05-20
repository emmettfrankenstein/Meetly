import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CLIENT_URLS: z.string().min(1),

  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  MEDIASOUP_LISTEN_IP: z.string().default("0.0.0.0"),
  MEDIASOUP_ANNOUNCED_IP: z.string().optional(),
  MEDIASOUP_MIN_PORT: z.coerce.number().default(40000),
  MEDIASOUP_MAX_PORT: z.coerce.number().default(40100),

  RECORDINGS_DIR: z.string().default("./recordings"),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  RECORDING_RETENTION_DAYS: z.coerce.number().default(30),
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = env.CLIENT_URLS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
