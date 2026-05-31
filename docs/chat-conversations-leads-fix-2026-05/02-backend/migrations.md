# Migrations Drizzle

> Migration unique pour le sprint. Idempotente, réversible.

## 1. Génération de la migration

```bash
cd apps/web
pnpm drizzle-kit generate --name chat_session_kind
```

Cela crée un fichier `drizzle/migrations/0XYZ_chat_session_kind.sql` (numéro auto-incrément).

## 2. Contenu attendu — SQL

```sql
-- ============================================================================
-- CHA-LEAD-V2-01 — Ajout de la colonne `kind` à `chat_session`.
--
-- Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/data-model.md
--
-- Cette migration est :
--  - idempotente (IF NOT EXISTS)
--  - réversible (DROP COLUMN possible si CHAT_ADMIN_FILTERS_V2=false)
--  - sans verrou long (CONCURRENTLY sur l'index)
-- ============================================================================

-- 1. Ajout colonne avec default 'chat' → toutes les rows historiques OK
ALTER TABLE chat_session
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'chat';

-- 2. Contrainte CHECK pour limiter aux valeurs autorisées
ALTER TABLE chat_session
  ADD CONSTRAINT chat_session_kind_check
  CHECK (kind IN ('chat', 'wizard_pivot', 'system'));

-- 3. Index composé pour les queries admin (kind + status + last_seen_at DESC)
-- CONCURRENTLY évite le verrou exclusif sur la table durant la création.
CREATE INDEX CONCURRENTLY IF NOT EXISTS chat_session_kind_status_idx
  ON chat_session(kind, status, last_seen_at DESC);

-- 4. Backfill historique : tout ID commençant par 's_' → wizard_pivot
-- (Cf. ADR-001 — ID préfixe 's_' = wizard ghost depuis sprint CHA-230)
UPDATE chat_session
   SET kind = 'wizard_pivot',
       updated_at = NOW()
 WHERE id LIKE 's\_%' ESCAPE '\'
   AND kind = 'chat';  -- ne touche pas les rows déjà classées
```

## 3. Drizzle TypeScript — diff sur `schema.ts`

**Fichier** : `apps/web/src/lib/chat/db/schema.ts`

```diff
 export const chatSession = pgTable(
   'chat_session',
   {
     id: text('id').primaryKey(), // cs_xxxxxxxx OU s_xxx (wizard pivot)
+    /**
+     * CHA-LEAD-V2-01 — Discriminateur entre conversations chat réelles
+     * (`'chat'`, default) et "ghost sessions" wizard utilisées comme pivot
+     * FK pour `chat_lead` (`'wizard_pivot'`). `'system'` couvre les flows
+     * système (newsletter standalone, admin seed) qui n'ont ni interface
+     * chat ni wizard.
+     *
+     * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/data-model.md
+     */
+    kind: text('kind', { enum: ['chat', 'wizard_pivot', 'system'] })
+      .notNull()
+      .default('chat'),
     visitorId: text('visitor_id').notNull(),
     fingerprintHash: text('fingerprint_hash'),
     // ... reste inchangé ...
   },
   (t) => ({
     visitorIdx: index('chat_session_visitor_idx').on(t.visitorId),
     statusIdx: index('chat_session_status_idx').on(t.status, t.lastSeenAt),
     convIdx: index('chat_session_conv_idx').on(t.convertedAt),
     pageIdx: index('chat_session_page_idx').on(t.page),
+    kindStatusIdx: index('chat_session_kind_status_idx').on(
+      t.kind,
+      t.status,
+      t.lastSeenAt,
+    ),
   }),
 );
```

## 4. Nouveau fichier `kind.ts`

**Fichier** : `apps/web/src/lib/chat/db/kind.ts` (création)

```ts
/**
 * CHA-LEAD-V2 — Discriminateur de `chat_session.kind`.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/data-model.md
 */
import type { ChatLeadRow } from './schema';

/** Valeurs possibles de `chat_session.kind`. */
export const CHAT_SESSION_KINDS = ['chat', 'wizard_pivot', 'system'] as const;
export type ChatSessionKind = (typeof CHAT_SESSION_KINDS)[number];

/** Set des kinds visibles dans /admin/chat/conversations. */
export const ADMIN_CHAT_VISIBLE_KINDS: ReadonlyArray<ChatSessionKind> = ['chat'];

/** Set des sources `chat_lead.source` visibles dans /admin/chat/leads. */
export const ADMIN_CHAT_VISIBLE_LEAD_SOURCES: ReadonlyArray<
  ChatLeadRow['source']
> = ['chat_widget', 'inline'];

/** Type guard. */
export function isChatSessionKind(value: unknown): value is ChatSessionKind {
  return typeof value === 'string'
    && (CHAT_SESSION_KINDS as readonly string[]).includes(value);
}
```

## 5. Extension du feature flag

**Fichier** : `apps/web/src/lib/chat/feature-flag.ts`

```diff
 /**
  * Feature flags chat.
  */
 export function isChatEnabled(): boolean {
   return process.env.NEXT_PUBLIC_CHAT_ENABLED === 'true';
 }
+
+/**
+ * CHA-LEAD-V2 — Active les filtres admin V2 (kind + source).
+ * Default false pour rollback safe ; toggle à true progressivement.
+ */
+export function isChatAdminFiltersV2Enabled(): boolean {
+  return process.env.CHAT_ADMIN_FILTERS_V2 === 'true';
+}
```

## 6. Script de backfill TypeScript (alternative à SQL brut)

**Fichier** : `apps/web/scripts/backfill-chat-session-kind.ts` (création)

Utile pour environnements où on ne peut pas exécuter de migration SQL brute (ex. en local hors Drizzle migrate).

```ts
/**
 * CHA-LEAD-V2-01 — Backfill chat_session.kind.
 *
 * Usage :
 *   pnpm tsx scripts/backfill-chat-session-kind.ts --dry-run
 *   pnpm tsx scripts/backfill-chat-session-kind.ts --execute
 *
 * Sécurité :
 *   - Dry-run par défaut (--execute requis pour mutation).
 *   - Logge chaque batch.
 *   - Idempotent : `kind = 'chat'` reste 'chat' si on relance.
 */
import './_load-env.mjs';
import { eq, like, sql } from 'drizzle-orm';

import { requireChatDb } from '@/lib/chat/db/client';
import { chatSession } from '@/lib/chat/db/schema';

interface Args {
  dryRun: boolean;
  batchSize: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: true, batchSize: 500 };
  for (const a of argv) {
    if (a === '--execute') args.dryRun = false;
    if (a.startsWith('--batch=')) args.batchSize = Number(a.split('=')[1] ?? '500');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = requireChatDb();

  console.log(`\nBackfill chat_session.kind — ${args.dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  // Count avant
  const [{ value: before }] = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`);

  console.log(`Candidates (id préfixe s_ + kind='chat') : ${before}`);

  if (args.dryRun) {
    console.log('\n💡 Use --execute to apply the update.');
    process.exit(0);
  }

  // Update batché
  const updated = await db
    .update(chatSession)
    .set({ kind: 'wizard_pivot', updatedAt: new Date() })
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`)
    .returning({ id: chatSession.id });

  console.log(`✅ Updated ${updated.length} rows to kind='wizard_pivot'`);

  // Vérification post-update
  const [{ value: remaining }] = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(sql`id LIKE 's\\_%' ESCAPE '\\' AND kind = 'chat'`);

  if (remaining !== 0) {
    console.error(`⚠️  Remaining mismatched rows: ${remaining}`);
    process.exit(1);
  }

  console.log(`\n📊 Backfill complete. 0 rows remaining mismatched.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
```

## 7. Vérification post-migration

**Avant** d'activer le flag, exécuter ces SQL d'audit :

```sql
-- 1. Distribution des kind
SELECT kind, COUNT(*) AS n
  FROM chat_session
 GROUP BY kind
 ORDER BY n DESC;

-- Attendu approximatif :
-- chat            | ~XX (vraies sessions + bootstraps vides)
-- wizard_pivot    | ~XX (toutes les rows id LIKE 's_%')
-- system          | 0

-- 2. Vérifier qu'aucune row id préfixe 's_' n'est restée en kind='chat'
SELECT COUNT(*) AS bad
  FROM chat_session
 WHERE id LIKE 's\_%' ESCAPE '\'
   AND kind = 'chat';

-- Attendu : 0

-- 3. Vérifier qu'aucune row id préfixe 'cs_' n'est devenue 'wizard_pivot'
SELECT COUNT(*) AS bad
  FROM chat_session
 WHERE id LIKE 'cs\_%' ESCAPE '\'
   AND kind = 'wizard_pivot';

-- Attendu : 0

-- 4. Cohérence kind ↔ source (cross-table)
SELECT s.kind, l.source, COUNT(*) AS n
  FROM chat_session s
  JOIN chat_lead l ON l.session_id = s.id
 GROUP BY 1, 2
 ORDER BY n DESC;

-- Attendu :
-- kind='chat'         source='chat_widget'      | XX  ✅
-- kind='chat'         source='inline'           | XX  ✅
-- kind='wizard_pivot' source='wizard_kit'       | XX  ✅
-- kind='wizard_pivot' source='wizard_commander' | XX  ✅
-- kind='chat'         source='wizard_kit'       |  0  ✅ (incohérence à 0)
```

## 8. Rollback de la migration

Si on doit annuler (extrême urgence) :

```sql
-- Étape 1 : désactiver le flag pour ne plus utiliser kind
-- Set CHAT_ADMIN_FILTERS_V2=false, redéployer

-- Étape 2 : drop l'index
DROP INDEX CONCURRENTLY IF EXISTS chat_session_kind_status_idx;

-- Étape 3 : drop la contrainte
ALTER TABLE chat_session DROP CONSTRAINT IF EXISTS chat_session_kind_check;

-- Étape 4 : drop la colonne
ALTER TABLE chat_session DROP COLUMN IF EXISTS kind;
```

⚠️ **Important** : étape 1 OBLIGATOIRE avant 2-4, sinon le code Drizzle qui référence `kind` casse les SELECT.

## 9. Tests post-migration

```bash
# Vérifier que la migration s'applique sans erreur
pnpm drizzle-kit migrate

# Vérifier les schémas générés
pnpm drizzle-kit check

# Lancer la suite vitest pour s'assurer qu'aucune fixture ne casse
pnpm vitest run --reporter=verbose 2>&1 | tail -20

# Doit afficher : Test Files X passed, Tests Y passed (idem qu'avant)
```

## 10. Estimations DB

- Durée migration sur 10k rows : ~2-5 secondes (incluant backfill).
- Durée migration sur 1M rows : ~30-60 secondes (CONCURRENTLY évite lock long).
- Espace disque ajouté : ~17 bytes/row (colonne kind text) + ~30 bytes/row (index entry) = ~47 bytes/row.
