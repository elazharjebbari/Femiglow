/**
 * Applique UNIQUEMENT le DDL coupons (idempotent) — sans toucher aux autres
 * migrations en attente. Pour préview/démo. cf. docs/coupons-qa-2026-06-02.
 *
 *   node --env-file=.env scripts/_apply-coupons-ddl.mjs
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

const enums = [
  ['coupon_bucket', "'treatment','holdout'"],
  ['coupon_event_phase', "'exposed','applied','converted'"],
  ['coupon_mode', "'auto','code'"],
  ['coupon_status', "'draft','active','paused','archived'"],
  ['coupon_target', "'product_price','shipping','future_credit'"],
  ['coupon_type', "'welcome_auto','rescue','email_unlock','manual_code','post_purchase'"],
  ['coupon_usage_scope', "'unlimited','once_per_visitor','global_cap'"],
  ['coupon_value_kind', "'fixed_amount','percent'"],
];

async function main() {
  for (const [name, vals] of enums) {
    await sql.unsafe(
      `DO $$ BEGIN CREATE TYPE "public"."${name}" AS ENUM(${vals}); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
  }

  await sql.unsafe(`CREATE TABLE IF NOT EXISTS "coupons" (
    "id" text PRIMARY KEY NOT NULL,
    "label" text NOT NULL,
    "code" text,
    "type" "coupon_type" NOT NULL,
    "mode" "coupon_mode" NOT NULL,
    "status" "coupon_status" DEFAULT 'draft' NOT NULL,
    "value_kind" "coupon_value_kind" NOT NULL,
    "value_amount" integer NOT NULL,
    "target" "coupon_target" DEFAULT 'product_price' NOT NULL,
    "currency" text DEFAULT 'MAD' NOT NULL,
    "eligibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "stackable" boolean DEFAULT false NOT NULL,
    "usage_scope" "coupon_usage_scope" DEFAULT 'unlimited' NOT NULL,
    "usage_cap" integer,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "holdout_pct" integer DEFAULT 0 NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" text
  );`);

  await sql.unsafe(`CREATE TABLE IF NOT EXISTS "coupon_events" (
    "id" text PRIMARY KEY NOT NULL,
    "coupon_id" text,
    "phase" "coupon_event_phase" NOT NULL,
    "bucket" "coupon_bucket" NOT NULL,
    "visitor_key" text,
    "order_id" text,
    "amount_cents" integer,
    "traffic_source" text,
    "device" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );`);

  // FKs (best-effort, ignore si déjà présentes).
  const fks = [
    `ALTER TABLE "coupon_events" ADD CONSTRAINT "coupon_events_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null`,
    `ALTER TABLE "coupon_events" ADD CONSTRAINT "coupon_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null`,
    `ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null`,
  ];
  for (const stmt of fks) {
    try {
      await sql.unsafe(stmt);
    } catch (e) {
      if (!/already exists|duplicate/i.test(String(e?.message))) throw e;
    }
  }

  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "coupon_events_coupon_phase_idx" ON "coupon_events" ("coupon_id","phase","created_at");`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "coupon_events_visitor_idx" ON "coupon_events" ("visitor_key");`,
  );
  await sql.unsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "coupon_events_order_converted_unique" ON "coupon_events" ("order_id") WHERE "phase" = 'converted' AND "order_id" IS NOT NULL;`,
  );
  await sql.unsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_unique" ON "coupons" ("code") WHERE "code" IS NOT NULL;`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "coupons_status_type_idx" ON "coupons" ("status","type");`,
  );

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM coupons`;
  console.log(`[apply-coupons-ddl] OK — tables coupons prêtes (coupons rows: ${count})`);
  await sql.end();
}

main().catch((e) => {
  console.error('[apply-coupons-ddl] échec', e);
  process.exit(1);
});
