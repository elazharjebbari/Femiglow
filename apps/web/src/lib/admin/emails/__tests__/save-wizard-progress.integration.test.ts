// @vitest-environment node
/**
 * F05 P3.2-b — saveWizardProgress (autosave) en VRAIE DB (femiglow_test_m03campagnes).
 * Couvre : merge non destructif (F05-I-001), refus hors draft = garde R-010
 * (F05-I-002), patch partiel (U-033), persistance wizard_step/schedule_timezone,
 * optimistic-lock multi-onglets via payload._rev, not_found.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m03campagnes#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/admin/emails/__tests__/save-wizard-progress.integration.test.ts
 */
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'nadia@femiglow-maroc.com' }),
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { emailCampaignLink } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeCampaignLink } from '@/test/factories/emails.factory';
import { saveWizardProgress } from '@/lib/admin/emails/wizard-actions';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

async function seedDraft(over = {}) {
  const row = makeCampaignLink({ status: 'draft', ...over });
  await db.insert(emailCampaignLink).values(row);
  return row.id;
}

async function readRow(id: string) {
  const [r] = await db.select().from(emailCampaignLink).where(eq(emailCampaignLink.id, id)).limit(1);
  return r;
}

beforeEach(async () => {
  await truncateEmailTables();
});
afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('F05 — saveWizardProgress (VRAIE DB)', () => {
  it('F05-I-001 — merge NON DESTRUCTIF : un patch partiel garde les champs intacts', async () => {
    const id = await seedDraft({
      name: 'Promo juin',
      subject: 'Ancien sujet',
      preheader: 'Ancien preheader',
      payloadJson: { body: '<p>corps</p>', promoMad: 90 },
    });
    const res = await saveWizardProgress({ id, subject: 'Nouveau sujet', wizardStep: 4 });
    expect(res.ok).toBe(true);
    const row = await readRow(id);
    expect(row!.subject).toBe('Nouveau sujet'); // touché
    expect(row!.name).toBe('Promo juin'); // intact
    expect(row!.preheader).toBe('Ancien preheader'); // intact
    expect(row!.wizardStep).toBe(4); // persisté
    // payload mergé : body conservé + versionné + rev.
    expect((row!.payloadJson as Record<string, unknown>).body).toBe('<p>corps</p>');
    expect((row!.payloadJson as Record<string, unknown>).promoMad).toBe(90);
    if (res.ok) expect(res.rev).toBe(1);
  });

  it('F05-U-033 — patch ne touche QUE les champs fournis', async () => {
    const id = await seedDraft({ name: 'Nom initial', subject: 'Sujet S', preheader: 'Preh P' });
    await saveWizardProgress({ id, name: 'Nom modifié' });
    const row = await readRow(id);
    expect(row!.name).toBe('Nom modifié');
    expect(row!.subject).toBe('Sujet S'); // intact (non fourni)
    expect(row!.preheader).toBe('Preh P'); // intact (non fourni)
  });

  it('F05-I-002 — GARDE R-010 : refuse hors draft (0 écriture)', async () => {
    const id = await seedDraft({ status: 'sent', name: 'Finalisée', subject: 'Figé' });
    const res = await saveWizardProgress({ id, subject: 'TENTATIVE' });
    expect(res).toEqual({ ok: false, reason: 'not_draft' });
    const row = await readRow(id);
    expect(row!.subject).toBe('Figé'); // INCHANGÉ — jamais d'écriture sur une campagne finalisée
    expect(row!.status).toBe('sent');
  });

  it('persiste schedule_timezone + scheduledFor', async () => {
    const id = await seedDraft();
    await saveWizardProgress({
      id,
      wizardStep: 5,
      scheduledFor: '2026-07-15T08:00:00.000Z',
      scheduleTimezone: 'Africa/Casablanca',
    });
    const row = await readRow(id);
    expect(row!.scheduleTimezone).toBe('Africa/Casablanca');
    expect(row!.scheduledFor?.toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });

  it('optimistic-lock : expectedRev périmé → conflict (pas d’écrasement) ; rev à jour → ok', async () => {
    const id = await seedDraft({ subject: 'v0' });
    const r1 = await saveWizardProgress({ id, subject: 'v1' }); // rev 0 → 1
    expect(r1.ok && r1.rev).toBe(1);

    // Onglet périmé qui croit encore au rev 0 :
    const stale = await saveWizardProgress({ id, subject: 'ECRASEMENT', expectedRev: 0 });
    expect(stale).toEqual({ ok: false, reason: 'conflict' });
    expect((await readRow(id))!.subject).toBe('v1'); // pas écrasé

    // Onglet à jour (rev 1) :
    const r2 = await saveWizardProgress({ id, subject: 'v2', expectedRev: 1 });
    expect(r2.ok && r2.rev).toBe(2);
    expect((await readRow(id))!.subject).toBe('v2');
  });

  it('id inconnu → not_found', async () => {
    const res = await saveWizardProgress({ id: 'camp_inexistant', subject: 'x' });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
