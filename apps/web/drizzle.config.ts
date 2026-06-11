import type { Config } from 'drizzle-kit';

export default {
  schema: [
    './src/lib/db/schema.ts',
    './src/lib/db/schema-emails.ts',
    './src/lib/chat/db/schema.ts',
    './src/lib/db/schema-content-studio.ts',
    './src/lib/db/schema-social-publishing.ts',
    './src/lib/leads/db/schema-lead-outbox.ts',
  ],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://invalid',
  },
  strict: true,
  verbose: true,
} satisfies Config;
