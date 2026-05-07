import type { Config } from 'drizzle-kit';

export default {
  schema: ['./src/lib/db/schema.ts', './src/lib/chat/db/schema.ts'],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://invalid',
  },
  strict: true,
  verbose: true,
} satisfies Config;
