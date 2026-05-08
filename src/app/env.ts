import { configDotenv } from 'dotenv';
import { z } from 'zod';

configDotenv({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  VERIFY_CHANNEL_ID: z.string().default('523634607845801995'),
  DISCORD_LOG_CHANNEL_ID: z.string().optional(),
  RNT_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  // Auto-refresh interval in hours. Set to 0 to disable.
  REFRESH_INTERVAL_HOURS: z.coerce.number().min(0).default(24),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
