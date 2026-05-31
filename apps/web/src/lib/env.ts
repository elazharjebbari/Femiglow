import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  CMS_PROVIDER: z.enum(['mock', 'sanity']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  B2B_ENABLED: z.enum(['true', 'false']).default('false'),
  DATABASE_URL: z.string().optional(),
  DIRECT_DATABASE_URL: z.string().optional(),
  ADMIN_SESSION_PASSWORD: z.string().min(32).optional(),
  WEBHOOK_SECRET_KEY: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MAINTENANCE_MODE: z.enum(['true', 'false']).default('false'),
  MEDIA_STORAGE_DRIVER: z.enum(['local', 'vercelBlob', 'external']).default('local'),
  MEDIA_LOCAL_DIR: z.string().default('./.media-storage'),
  MEDIA_PUBLIC_BASE_URL: z.string().default('/_media'),
  MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MEDIA_SIGNED_URL_SECRET: z.string().min(32).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  ADMIN_BOOTSTRAP_NAME: z.string().min(1).optional(),
  // Chat assistant (cf. docs/chat-assistant/15-plan-action.md CHA-001/CHA-008).
  CHAT_ENABLED: z.enum(['true', 'false']).default('false'),
  // LEGAL-V2 — Active nouveau naming vars + presetVarsForPage + UI create-var.
  // Cf. docs/pages-legales-fix-2026-05/00-context/decisions-architecturales.md ADR-002.
  LEGAL_VARS_V2: z.enum(['true', 'false']).default('false'),
  // I18N — Active le routing locale-aware (path-based /[locale]/) + middleware
  // next-intl. Par défaut OFF → zéro régression : toutes les routes legacy
  // (`/kit`, `/maison`, ...) continuent de fonctionner en FR uniquement.
  // Cf. docs/i18n-strategy-2026-05/08-plan-action/feature-flags.md
  I18N_ENABLED: z.enum(['true', 'false']).default('false'),
  CHAT_PROVIDER_KEY: z.string().min(32).optional(),
  CHAT_TOTAL_BUDGET_EUR_MONTHLY: z.coerce.number().nonnegative().default(0),
  CHAT_DEFAULT_LANGUAGE: z.enum(['fr', 'ar', 'ar-MA']).default('fr'),
  CHAT_DEFAULT_PROVIDER: z
    .enum([
      'openai',
      'gemini',
      'anthropic',
      'mistral',
      'qwen',
      'deepseek',
      'zhipu',
      'ollama',
      'azure-openai',
    ])
    .default('openai'),
  CHAT_OPENAI_API_KEY: z.string().optional(),
  CHAT_GEMINI_API_KEY: z.string().optional(),
  CHAT_ANTHROPIC_API_KEY: z.string().optional(),
  CHAT_MISTRAL_API_KEY: z.string().optional(),
  CHAT_OLLAMA_BASE_URL: z.string().url().optional(),
  CHAT_AZURE_API_KEY: z.string().optional(),
  CHAT_AZURE_API_BASE: z.string().url().optional(),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  CHAT_SESSION_COOKIE_NAME: z.string().min(3).default('femiglow_chat_session'),
  CHAT_VISITOR_COOKIE_NAME: z.string().min(2).default('fg_v'),
  // CHA-206 — Webhook lead capture (n8n / Zapier / CRM).
  CHAT_LEAD_WEBHOOK_URL: z.string().url().optional(),
  CHAT_LEAD_WEBHOOK_SECRET: z.string().min(16).optional(),
  CHAT_LEAD_CONSENT_VERSION: z.string().min(4).default('2026-05-06'),
  // CHA-260 — Outbound webhook unifié (order, cart-abandon, contact, …).
  // Priorité sur CHAT_LEAD_WEBHOOK_URL ; fallback rétrocompat si absent.
  OUTBOUND_WEBHOOK_URL: z.string().url().optional(),
  OUTBOUND_WEBHOOK_SECRET: z.string().min(16).optional(),

  // Snapchat Conversions API — token CAPI disponible comme suggestion dans
  // l'admin UI (/admin/tracking/providers). Non utilisé comme fallback automatique.
  // Pour activer Snap CAPI : configurer le token via l'admin UI ou l'API.
  SNAP_CAPI_TOKEN: z.string().optional(),
  // CHAT-047/068 — Webhook compatible Slack pour les alertes runtime
  // (provider désactivé par budget-watch, etc.). Si absent, no-op.
  CHAT_ALERTS_WEBHOOK_URL: z.string().url().optional(),
  // S3.2 — Slack/Discord webhook dédié aux échecs de publication sociale.
  // Si absent, on retombe sur CHAT_ALERTS_WEBHOOK_URL.
  SOCIAL_ALERTS_WEBHOOK_URL: z.string().url().optional(),
  // S3.2 — destinataire du digest hebdo des échecs. Si absent, on retombe
  // sur CHAT_DIGEST_RECIPIENT.
  SOCIAL_DIGEST_RECIPIENT: z.string().email().optional(),
  // CHAT-067 — Email digest hebdo des leads chat (Care).
  CHAT_DIGEST_RECIPIENT: z.string().email().optional(),
  CHAT_DIGEST_FROM: z.string().min(3).default('FemiGlow Chat <chat@femiglow.local>'),

  // — Emailing (cf. docs/emailing/09-infrastructure-setup.md §11) ——————————
  // SMTP transactional vers Stalwart en loopback. Optional en dev/test ;
  // required en prod via runtime guard dans lib/mail/client.ts.
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('FemiGlow <noreply@femiglow-maroc.com>'),
  MAIL_REPLY_TO: z.string().default('info@femiglow-maroc.com'),

  // Listmonk API (loopback). Required quand broadcast/automation activé.
  LISTMONK_INTERNAL_URL: z.string().url().default('http://127.0.0.1:9000'),
  // Public URL où le SPA Listmonk est joignable depuis le navigateur (ex.
  // https://listmonk.femiglow-maroc.com). Sert d'origin iframe sur
  // /admin/emails/listmonk. Si absent, l'iframe retombe sur le proxy
  // same-origin (cassé tant que Listmonk sert son SPA depuis /admin/*).
  LISTMONK_PUBLIC_URL: z.string().url().optional(),
  LISTMONK_API_USER: z.string().optional(),
  LISTMONK_API_TOKEN: z.string().optional(),
  LISTMONK_WEBHOOK_SECRET: z.string().min(16).optional(),

  // Stalwart → FemiGlow webhook authentication.
  FEMIGLOW_STALWART_WEBHOOK_SECRET: z.string().min(16).optional(),

  // List-Unsubscribe one-click token signing (HMAC).
  MAIL_UNSUB_TOKEN_SECRET: z.string().min(32).optional(),

  // — AI Content Studio ————————————————————————————————————————————————
  CONTENT_STUDIO_ENABLED: z.enum(['true', 'false']).default('false'),
  // S2.3 phase a — hides legacy `content_postiz_delivery` UI controls so the
  // new `social_publish_job` pipeline becomes the only publishing path.
  CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED: z.enum(['true', 'false']).default('false'),
  POSTIZ_BASE_URL: z.string().url().optional(),
  POSTIZ_API_KEY: z.string().optional(),
  CONTENT_STUDIO_DEFAULT_TIMEZONE: z.string().min(3).default('Africa/Casablanca'),
  CONTENT_STUDIO_OPENAI_API_KEY: z.string().optional(),
  CONTENT_STUDIO_TEXT_MODEL: z.string().min(1).default('gpt-4o-mini'),
  CONTENT_STUDIO_IMAGE_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  CONTENT_STUDIO_IMAGE_MODEL: z.string().min(1).default('gpt-image-1-mini'),
  CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS: z.coerce.number().int().nonnegative().default(500),
  // Content Studio v2 (refonte complete) — sous flag, derriere
  // /admin/content-studio-v2/* tant que la migration n'est pas terminee.
  CONTENT_STUDIO_V2_ENABLED: z.enum(['true', 'false']).default('false'),
  // When true, /admin/content-studio redirects to /admin/content-studio-v2/home
  // and the legacy module lives under /admin/content-studio-legacy.
  // Set to 'true' once Phase 7 polish + Phase 5 /plan completes; rollback
  // is a flag flip away.
  CONTENT_STUDIO_V2_DEFAULT: z.enum(['true', 'false']).default('false'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
  CMS_PROVIDER: process.env.CMS_PROVIDER,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  PLAUSIBLE_DOMAIN: process.env.PLAUSIBLE_DOMAIN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  B2B_ENABLED: process.env.B2B_ENABLED,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
  ADMIN_SESSION_PASSWORD: process.env.ADMIN_SESSION_PASSWORD,
  WEBHOOK_SECRET_KEY: process.env.WEBHOOK_SECRET_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  LOG_LEVEL: process.env.LOG_LEVEL,
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE,
  MEDIA_STORAGE_DRIVER: process.env.MEDIA_STORAGE_DRIVER,
  MEDIA_LOCAL_DIR: process.env.MEDIA_LOCAL_DIR,
  MEDIA_PUBLIC_BASE_URL: process.env.MEDIA_PUBLIC_BASE_URL,
  MEDIA_MAX_BYTES: process.env.MEDIA_MAX_BYTES,
  MEDIA_SIGNED_URL_SECRET: process.env.MEDIA_SIGNED_URL_SECRET,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD,
  ADMIN_BOOTSTRAP_NAME: process.env.ADMIN_BOOTSTRAP_NAME,
  CHAT_ENABLED: process.env.CHAT_ENABLED,
  LEGAL_VARS_V2: process.env.LEGAL_VARS_V2,
  I18N_ENABLED: process.env.I18N_ENABLED,
  CHAT_PROVIDER_KEY: process.env.CHAT_PROVIDER_KEY,
  CHAT_TOTAL_BUDGET_EUR_MONTHLY: process.env.CHAT_TOTAL_BUDGET_EUR_MONTHLY,
  CHAT_DEFAULT_LANGUAGE: process.env.CHAT_DEFAULT_LANGUAGE,
  CHAT_DEFAULT_PROVIDER: process.env.CHAT_DEFAULT_PROVIDER,
  CHAT_OPENAI_API_KEY: process.env.CHAT_OPENAI_API_KEY,
  CHAT_GEMINI_API_KEY: process.env.CHAT_GEMINI_API_KEY,
  CHAT_ANTHROPIC_API_KEY: process.env.CHAT_ANTHROPIC_API_KEY,
  CHAT_MISTRAL_API_KEY: process.env.CHAT_MISTRAL_API_KEY,
  CHAT_OLLAMA_BASE_URL: process.env.CHAT_OLLAMA_BASE_URL,
  CHAT_AZURE_API_KEY: process.env.CHAT_AZURE_API_KEY,
  CHAT_AZURE_API_BASE: process.env.CHAT_AZURE_API_BASE,
  CHAT_RATE_LIMIT_PER_MIN: process.env.CHAT_RATE_LIMIT_PER_MIN,
  CHAT_SESSION_COOKIE_NAME: process.env.CHAT_SESSION_COOKIE_NAME,
  CHAT_VISITOR_COOKIE_NAME: process.env.CHAT_VISITOR_COOKIE_NAME,
  CHAT_LEAD_WEBHOOK_URL: process.env.CHAT_LEAD_WEBHOOK_URL,
  CHAT_LEAD_WEBHOOK_SECRET: process.env.CHAT_LEAD_WEBHOOK_SECRET,
  CHAT_LEAD_CONSENT_VERSION: process.env.CHAT_LEAD_CONSENT_VERSION,
  OUTBOUND_WEBHOOK_URL: process.env.OUTBOUND_WEBHOOK_URL,
  OUTBOUND_WEBHOOK_SECRET: process.env.OUTBOUND_WEBHOOK_SECRET,
  SNAP_CAPI_TOKEN: process.env.SNAP_CAPI_TOKEN,
  CHAT_ALERTS_WEBHOOK_URL: process.env.CHAT_ALERTS_WEBHOOK_URL,
  SOCIAL_ALERTS_WEBHOOK_URL: process.env.SOCIAL_ALERTS_WEBHOOK_URL,
  SOCIAL_DIGEST_RECIPIENT: process.env.SOCIAL_DIGEST_RECIPIENT,
  CHAT_DIGEST_RECIPIENT: process.env.CHAT_DIGEST_RECIPIENT,
  CHAT_DIGEST_FROM: process.env.CHAT_DIGEST_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  MAIL_FROM: process.env.MAIL_FROM,
  MAIL_REPLY_TO: process.env.MAIL_REPLY_TO,
  LISTMONK_INTERNAL_URL: process.env.LISTMONK_INTERNAL_URL,
  LISTMONK_PUBLIC_URL: process.env.LISTMONK_PUBLIC_URL,
  LISTMONK_API_USER: process.env.LISTMONK_API_USER,
  LISTMONK_API_TOKEN: process.env.LISTMONK_API_TOKEN,
  LISTMONK_WEBHOOK_SECRET: process.env.LISTMONK_WEBHOOK_SECRET,
  FEMIGLOW_STALWART_WEBHOOK_SECRET: process.env.FEMIGLOW_STALWART_WEBHOOK_SECRET,
  MAIL_UNSUB_TOKEN_SECRET: process.env.MAIL_UNSUB_TOKEN_SECRET,
  CONTENT_STUDIO_ENABLED: process.env.CONTENT_STUDIO_ENABLED,
  CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED: process.env.CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED,
  POSTIZ_BASE_URL: process.env.POSTIZ_BASE_URL,
  POSTIZ_API_KEY: process.env.POSTIZ_API_KEY,
  CONTENT_STUDIO_DEFAULT_TIMEZONE: process.env.CONTENT_STUDIO_DEFAULT_TIMEZONE,
  CONTENT_STUDIO_OPENAI_API_KEY: process.env.CONTENT_STUDIO_OPENAI_API_KEY,
  CONTENT_STUDIO_TEXT_MODEL: process.env.CONTENT_STUDIO_TEXT_MODEL,
  CONTENT_STUDIO_IMAGE_PROVIDER: process.env.CONTENT_STUDIO_IMAGE_PROVIDER,
  CONTENT_STUDIO_IMAGE_MODEL: process.env.CONTENT_STUDIO_IMAGE_MODEL,
  CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS:
    process.env.CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS,
  CONTENT_STUDIO_V2_ENABLED: process.env.CONTENT_STUDIO_V2_ENABLED,
  CONTENT_STUDIO_V2_DEFAULT: process.env.CONTENT_STUDIO_V2_DEFAULT,
});
