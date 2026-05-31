/**
 * CHA-225 — Tests CONTRAT enum `trigger_reason` (3 sources de vérité).
 *
 * Le bug prod qui a déclenché CHA-225 : la migration SQL CHECK constraint
 * ne contenait PAS `'purchase-intent'` ni `'inline-contact'` alors que
 * la Zod enum + Drizzle schema les déclaraient. Résultat : l'insertion
 * automatique d'un lead `inline-contact` levait une `CheckViolation`
 * qui était silencieusement avalée par le try/catch de l'orchestrateur.
 *
 * Ces tests verrouillent la cohérence entre les 3 sources :
 *   1. `chatLeadTriggerReasonSchema` (Zod, contrats HTTP)
 *   2. `chatLead.triggerReason.enum` (Drizzle TS, runtime types)
 *   3. CHECK constraint SQL dans `0014_chat_lead.sql` (Postgres runtime)
 *
 * Si l'une des trois dérive (oubli d'ajouter une nouvelle valeur dans
 * la SQL après l'avoir ajoutée dans les contrats par exemple), le test
 * casse — exactement ce qu'on veut.
 *
 * Idem pour `webhookStatus` et `outcome` : on les couvre aussi pour
 * éviter le même piège demain.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  chatLeadTriggerReasonSchema,
  // Pas de Zod pour outcome / webhookStatus — on s'appuie sur Drizzle
  // comme source côté TS.
} from '@/lib/chat/contracts';
import { chatLead } from '@/lib/chat/db/schema';

/**
 * Extrait les valeurs littérales d'une CHECK constraint
 * `IN ( '…', '…', ...)` à partir du SQL d'une migration.
 *
 * Étape 1 : on strip les commentaires SQL `-- …` parce qu'ils peuvent
 * contenir des parenthèses ou apostrophes qui désynchroniseraient le
 * matcher.
 * Étape 2 : on capture le contenu de `IN ( … )` jusqu'au `)` qui ferme
 * spécifiquement le IN, pas un autre.
 */
function extractCheckValues(sql: string, constraintName: string): string[] {
  const stripped = sql.replace(/--[^\n]*/g, '');
  const re = new RegExp(
    String.raw`CONSTRAINT\s+"${constraintName}"\s+CHECK\s*\([^)]*IN\s*\(([^)]+)\)`,
    's',
  );
  const m = stripped.match(re);
  if (!m) {
    throw new Error(`Constraint ${constraintName} not found in SQL`);
  }
  const values = m[1]!.match(/'([^']+)'/g) ?? [];
  return values.map((v) => v.slice(1, -1));
}

const MIGRATION_PATH = join(
  process.cwd(),
  'drizzle',
  'migrations',
  '0014_chat_lead.sql',
);
const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

describe("chat_lead — cohérence des enums (Zod ↔ Drizzle ↔ SQL)", () => {
  it('trigger_reason : Zod enum ↔ Drizzle enum (TS-runtime cohérent)', () => {
    const zodValues = chatLeadTriggerReasonSchema.options;
    // Drizzle expose le tuple via la déclaration du schéma. On le récupère
    // via `getSQL` ne donne pas le tuple, donc on ré-importe la liste
    // littérale et on la compare à la Zod.
    const drizzleEnum: readonly string[] = (
      chatLead.triggerReason as unknown as { enumValues: readonly string[] }
    ).enumValues;
    expect([...drizzleEnum].sort()).toEqual([...zodValues].sort());
  });

  it('trigger_reason : SQL CHECK constraint contient TOUTES les valeurs Zod', () => {
    const sqlValues = extractCheckValues(
      migrationSql,
      'chat_lead_trigger_reason_check',
    );
    const zodValues = chatLeadTriggerReasonSchema.options;
    expect([...sqlValues].sort()).toEqual([...zodValues].sort());
  });

  it("trigger_reason : SQL CHECK contient explicitement 'purchase-intent' et 'inline-contact' (régression CHA-225)", () => {
    const sqlValues = extractCheckValues(
      migrationSql,
      'chat_lead_trigger_reason_check',
    );
    expect(sqlValues).toContain('purchase-intent');
    expect(sqlValues).toContain('inline-contact');
  });

  it('webhook_status : SQL CHECK ↔ Drizzle enum', () => {
    const sqlValues = extractCheckValues(
      migrationSql,
      'chat_lead_webhook_status_check',
    );
    const drizzleEnum: readonly string[] = (
      chatLead.webhookStatus as unknown as { enumValues: readonly string[] }
    ).enumValues;
    expect([...sqlValues].sort()).toEqual([...drizzleEnum].sort());
  });

  it('outcome : SQL CHECK ↔ Drizzle enum', () => {
    const sqlValues = extractCheckValues(
      migrationSql,
      'chat_lead_outcome_check',
    );
    const drizzleEnum: readonly string[] = (
      chatLead.outcome as unknown as { enumValues: readonly string[] }
    ).enumValues;
    expect([...sqlValues].sort()).toEqual([...drizzleEnum].sort());
  });
});
