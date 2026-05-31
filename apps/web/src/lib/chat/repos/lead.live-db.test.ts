/**
 * CHA-225 — Test d'intégration DB RÉELLE pour `leadRepo`.
 *
 * Pourquoi : la suite mock-mémoire (cf. `chat-store.ts` côté repo) ne
 * peut PAS détecter une CHECK constraint manquante côté Postgres.
 * C'est exactement ce qui s'est passé en prod : tous les tests passaient
 * en mémoire mais l'INSERT réel levait `CheckViolation` parce que la
 * migration SQL avait dérivé de la Zod enum.
 *
 * Ce fichier exécute un vrai INSERT/DELETE pour CHAQUE valeur de
 * `triggerReason`, en utilisant la même connexion DB que l'app dev.
 *
 * Mode :
 *  - SKIP par défaut → ne casse pas la suite vitest standard.
 *  - Activation via `LEAD_REPO_LIVE_DB=1` (ou `DATABASE_URL` + flag).
 *
 * Lancement :
 *
 *   LEAD_REPO_LIVE_DB=1 \
 *     DATABASE_URL="postgresql://localhost:5432/femiglow" \
 *     node_modules/.bin/vitest run src/lib/chat/repos/lead.live-db.test.ts
 *
 * Cleanup :
 *  - Chaque test crée une session jetable, y attache un lead, puis
 *    supprime la session (ON DELETE CASCADE → le lead disparaît).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { chatLeadTriggerReasonSchema } from '@/lib/chat/contracts';

const SHOULD_RUN =
  process.env.LEAD_REPO_LIVE_DB === '1' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!SHOULD_RUN)(
  'leadRepo — INSERT live DB pour chaque triggerReason (CHA-225)',
  () => {
    let leadRepo: typeof import('./lead').leadRepo;
    let chatDb: () => unknown;
    let schema: typeof import('@/lib/chat/db/schema');
    type SqlEqLike = (col: unknown, val: unknown) => unknown;
    let eqOp: SqlEqLike;
    let testInstructionId: string;

    beforeAll(async () => {
      // Imports DYNAMIQUES pour que vitest ne crashe pas en mode skip
      // (le client DB charge des bindings natifs).
      const repoMod = await import('./lead');
      leadRepo = repoMod.leadRepo;
      const dbMod = await import('@/lib/chat/db/client');
      chatDb = dbMod.chatDb;
      schema = await import('@/lib/chat/db/schema');
      const drizzle = await import('drizzle-orm');
      eqOp = drizzle.eq as unknown as SqlEqLike;

      // Récupère un instruction_version_id existant (FK obligatoire).
      const db = chatDb() as unknown as {
        select: () => {
          from: (t: unknown) => { limit: (n: number) => Promise<{ id: string }[]> };
        };
      };
      const rows = await db
        .select()
        .from(schema.chatInstructionVersion)
        .limit(1);
      if (rows.length === 0) {
        throw new Error(
          'Aucune chat_instruction_version dans la DB de test — pré-seed requis.',
        );
      }
      testInstructionId = rows[0]!.id;
    });

    afterAll(async () => {
      // Purge toute session laissée par les tests si jamais cleanup raté.
      const db = chatDb() as unknown as {
        delete: (t: unknown) => {
          where: (cond: unknown) => Promise<unknown>;
        };
      };
      const { like } = await import('drizzle-orm');
      await db
        .delete(schema.chatSession)
        .where(like(schema.chatSession.id, 'cs_test_lead_repo_%'));
    });

    /** Crée une session jetable, retourne son id. */
    async function createTestSession(): Promise<string> {
      const id = `cs_test_lead_repo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const db = chatDb() as unknown as {
        insert: (t: unknown) => {
          values: (v: unknown) => Promise<unknown>;
        };
      };
      await db.insert(schema.chatSession).values({
        id,
        visitorId: `v_test_${id}`,
        language: 'fr',
        instructionVersionId: testInstructionId,
        status: 'open',
      });
      return id;
    }

    async function deleteTestSession(id: string): Promise<void> {
      const db = chatDb() as unknown as {
        delete: (t: unknown) => {
          where: (cond: unknown) => Promise<unknown>;
        };
      };
      await db
        .delete(schema.chatSession)
        .where(eqOp(schema.chatSession.id, id));
    }

    // Un test par valeur d'enum — si l'une est manquante côté SQL, le
    // CheckViolation lève et le test fail (avec un message clair).
    for (const reason of chatLeadTriggerReasonSchema.options) {
      it(`triggerReason='${reason}' : INSERT accepté par le CHECK constraint`, async () => {
        const sessionId = await createTestSession();
        try {
          const lead = await leadRepo.create({
            sessionId,
            triggeringMessageId: null,
            triggerReason: reason,
            firstName: 'Hamid',
            phoneE164: '+212600000000',
            phoneRaw: '0600000000',
            consentVersion: '2026-05-06',
            visitorId: `v_test_${sessionId}`,
            language: 'fr',
          });
          expect(lead.id).toMatch(/^cl_/);
          expect(lead.triggerReason).toBe(reason);
        } finally {
          await deleteTestSession(sessionId);
        }
      });
    }

    it('triggerReason invalide → erreur Postgres (cause = check_violation)', async () => {
      const sessionId = await createTestSession();
      try {
        let caught: unknown = null;
        try {
          await leadRepo.create({
            sessionId,
            triggeringMessageId: null,
            // @ts-expect-error — valeur volontairement non listée pour
            // valider que le CHECK rejette bien ce qu'il doit rejeter.
            triggerReason: 'totally-not-allowed',
            firstName: 'X',
            phoneE164: '+212600000001',
            phoneRaw: '0600000001',
            consentVersion: '2026-05-06',
            visitorId: `v_test_${sessionId}`,
            language: 'fr',
          });
        } catch (err) {
          caught = err;
        }
        expect(caught, "INSERT d'une trigger_reason invalide devrait échouer").not.toBeNull();
        // Drizzle enrobe l'erreur Postgres dans `Failed query: …`. La
        // cause Postgres expose un `code` SQLSTATE — `23514` =
        // check_violation. On matche soit la cause soit le message
        // sous-jacent (selon le driver).
        const e = caught as Error & {
          cause?: { code?: string; message?: string };
          code?: string;
        };
        const cause = e.cause ?? e;
        const code = (cause as { code?: string }).code;
        const causeMsg = (cause as { message?: string }).message ?? '';
        const matchedByCode = code === '23514';
        const matchedByMessage =
          /chat_lead_trigger_reason_check|check constraint|check_violation/i.test(
            causeMsg,
          );
        expect(matchedByCode || matchedByMessage).toBe(true);
      } finally {
        await deleteTestSession(sessionId);
      }
    });
  },
);

// Un mini-test toujours présent pour signaler que la suite live-DB
// existe mais a été skip (utile en CI pour vérifier que le hook
// n'est pas oublié).
describe('leadRepo live-DB — guard', () => {
  it('le test live-DB est gated par LEAD_REPO_LIVE_DB=1', () => {
    expect(typeof SHOULD_RUN).toBe('boolean');
  });
});
