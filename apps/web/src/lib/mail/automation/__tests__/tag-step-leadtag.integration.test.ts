// @vitest-environment node
/**
 * AUT-INT-030..032 — régression croisée chantier 1.1 × step handler `tag`.
 *
 * Le fix du drift lead_tag (schema.ts text→uuid, la DB génère l'id) a laissé
 * un call-site orphelin : handleTagStep insérait encore `id: createId('tag')`
 * (= `tag_…`, non-uuid) → cast uuid impossible → tout step automation
 * `tag` action=add plantait au RUNTIME (le typage ne le voit pas : uuid est
 * `string` côté drizzle).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_automation#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/automation/__tests__/tag-step-leadtag.integration.test.ts
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { leads, leadTag } from '@/lib/db/schema';
import { closeTestDb, emailsTestDb, truncateEmailTables, describeEmailsDb } from '@/test/db/emails-db';
import { handleTagStep } from '@/lib/mail/automation/step-handlers/tag';

const EMAIL = 'kaoutar.tag@exemple.test';

async function seedLead(): Promise<string> {
  const db = emailsTestDb();
  const id = createId('l');
  await db.insert(leads).values({
    id,
    email: EMAIL,
    phone: '+212600445566',
    name: 'Kaoutar',
    consentMarketing: true,
  });
  return id;
}

beforeEach(async () => {
  await truncateEmailTables();
  const db = emailsTestDb();
  await db.delete(leads).where(eq(leads.email, EMAIL));
});

afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('handleTagStep — insert lead_tag sous colonne uuid (vraie DB)', () => {
  // AUT-INT-030 : action=add → la ligne lead_tag existe avec un id uuid généré DB.
  it('AUT-INT-030 : add → ok:true + ligne lead_tag créée (id uuid DB)', async () => {
    const leadId = await seedLead();
    const res = await handleTagStep(
      { kind: 'tag', action: 'add', tag: 'vip-riad' },
      EMAIL,
      'automation-test',
    );
    expect(res).toEqual({ ok: true });

    const db = emailsTestDb();
    const rows = await db
      .select()
      .from(leadTag)
      .where(and(eq(leadTag.leadId, leadId), eq(leadTag.tag, 'vip-riad')));
    expect(rows).toHaveLength(1);
    // L'id est généré par la DB : format uuid, pas `tag_…`.
    expect(rows[0]!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(rows[0]!.source).toBe('automation');
    expect(rows[0]!.sourceRef).toBe('automation-test');
  });

  // AUT-INT-031 : add idempotent (onConflictDoNothing) — pas de doublon ni d'erreur.
  it('AUT-INT-031 : add rejoué → pas de doublon', async () => {
    const leadId = await seedLead();
    const step = { kind: 'tag', action: 'add', tag: 'vip-riad' } as const;
    await handleTagStep(step, EMAIL, 'automation-test');
    const res2 = await handleTagStep(step, EMAIL, 'automation-test');
    expect(res2.ok).toBe(true);

    const db = emailsTestDb();
    const rows = await db
      .select()
      .from(leadTag)
      .where(and(eq(leadTag.leadId, leadId), eq(leadTag.tag, 'vip-riad')));
    expect(rows).toHaveLength(1);
  });

  // AUT-INT-032 : action=remove → la ligne disparaît.
  it('AUT-INT-032 : remove → ligne supprimée', async () => {
    const leadId = await seedLead();
    await handleTagStep({ kind: 'tag', action: 'add', tag: 'vip-riad' }, EMAIL, 'a');
    const res = await handleTagStep(
      { kind: 'tag', action: 'remove', tag: 'vip-riad' },
      EMAIL,
      'a',
    );
    expect(res.ok).toBe(true);

    const db = emailsTestDb();
    const rows = await db.select().from(leadTag).where(eq(leadTag.leadId, leadId));
    expect(rows).toHaveLength(0);
  });
});
