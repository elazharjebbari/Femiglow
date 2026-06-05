// @vitest-environment node
/**
 * UX4-AUDIENCES-011 (volet moteur) — previewAudienceBreakdown (vraie DB).
 *
 * Oracle métier : sépare la cible brute (rules seules) de la cible envoyable
 * (rules + exclusions). `excluded = matched − deliverable`. On seed des leads
 * consentants dont CERTAINS sont en suppression list (unsubscribe) → la cible
 * brute les compte, la cible envoyable les retire.
 *
 * NB : la table `leads` n'est PAS dans truncateEmailTables → on insère des ids
 * uniques et on les nettoie explicitement en afterEach (la base femiglow_test
 * est inscriptible).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/audiences/__qa__/preview-breakdown.integration.test.ts
 */
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';

import { leads } from '@/lib/db/schema';
import { emailSuppression } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { previewAudienceBreakdown } from '../preview';
import type { ExclusionFlags, RulesGroup } from '../rules-types';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const RUN = `bd${Date.now().toString(36)}`;
const seededLeadIds: string[] = [];

async function seedLead(suffix: string, consent: boolean): Promise<string> {
  const id = `lead-${RUN}-${suffix}`;
  await db.insert(leads).values({
    id,
    email: `${id}@x.test`,
    name: `L-${suffix}`,
    consentMarketing: consent,
  });
  seededLeadIds.push(id);
  return `${id}@x.test`;
}

// Scopé au préfixe d'email de CE run : la table `leads` n'est PAS truncatée et
// peut contenir d'autres leads (seed/historique) → on ne compte QUE les nôtres.
const ALL_CONSENT: RulesGroup = {
  kind: 'all',
  conditions: [
    { kind: 'consent_marketing', value: true },
    { kind: 'email_pattern', operator: 'contains', value: RUN },
  ],
};

const EXCL_UNSUB: ExclusionFlags = {
  hard_bounce: false,
  unsubscribe: true,
  manual_suppression: false,
  marketing_optout: false,
};

describeEmailsDb('previewAudienceBreakdown — santé du ciblage (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterEach(async () => {
    if (seededLeadIds.length > 0) {
      await db.delete(leads).where(inArray(leads.id, seededLeadIds.splice(0)));
    }
  });
  afterAll(closeTestDb);

  // AUD-BD-001 — matched > deliverable quand un lead consentant est désinscrit.
  it('compte les exclus = matched − deliverable', async () => {
    // 3 leads consentants ; 1 d'entre eux est en suppression (unsubscribe).
    const e1 = await seedLead('1', true);
    await seedLead('2', true);
    await seedLead('3', true);
    await db.insert(emailSuppression).values({
      email: e1,
      reason: 'unsubscribe',
      since: new Date(),
      source: 'listmonk',
    });

    const r = await previewAudienceBreakdown(ALL_CONSENT, EXCL_UNSUB);
    expect(r.matched).toBe(3); // rules seules : 3 consentants
    expect(r.deliverable).toBe(2); // moins le désinscrit
    expect(r.excluded).toBe(1);
  });

  // AUD-BD-002 — aucun exclu quand la suppression list est désactivée.
  it('excluded = 0 si aucune exclusion active', async () => {
    const e1 = await seedLead('a', true);
    await seedLead('b', true);
    await db.insert(emailSuppression).values({
      email: e1,
      reason: 'unsubscribe',
      since: new Date(),
      source: 'listmonk',
    });

    const noExcl: ExclusionFlags = {
      hard_bounce: false,
      unsubscribe: false,
      manual_suppression: false,
      marketing_optout: false,
    };
    const r = await previewAudienceBreakdown(ALL_CONSENT, noExcl);
    expect(r.matched).toBe(2);
    expect(r.deliverable).toBe(2);
    expect(r.excluded).toBe(0);
  });
});
