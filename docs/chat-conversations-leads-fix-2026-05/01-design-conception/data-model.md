# Data model — schéma DB cible

> Modification minimale au schéma existant. Une seule colonne ajoutée à `chat_session`.

## 1. Avant — schéma actuel

```sql
CREATE TABLE chat_session (
  id TEXT PRIMARY KEY,                                -- "cs_xxx" OU "s_xxx" (pollution)
  visitor_id TEXT NOT NULL,
  fingerprint_hash TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  page TEXT,                                          -- nullable
  referrer TEXT,
  utm JSONB,
  instruction_version_id TEXT NOT NULL REFERENCES chat_instruction_version(id),
  theme_preset_id TEXT REFERENCES chat_theme_preset(id),
  experiment_variant_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'idle', 'archived', 'purged')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  consent JSONB,
  converted_order_id TEXT,
  converted_at TIMESTAMPTZ,
  meta_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chat_session_visitor_idx ON chat_session(visitor_id);
CREATE INDEX chat_session_status_idx ON chat_session(status, last_seen_at);
CREATE INDEX chat_session_conv_idx ON chat_session(converted_at);
CREATE INDEX chat_session_page_idx ON chat_session(page);
```

## 2. Après — schéma cible

```sql
-- Ajout de la colonne ``kind`` (discriminateur).
ALTER TABLE chat_session
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'chat'
    CHECK (kind IN ('chat', 'wizard_pivot', 'system'));

-- Index dédié pour les queries filtrées par kind + status.
CREATE INDEX IF NOT EXISTS chat_session_kind_status_idx
  ON chat_session(kind, status, last_seen_at DESC);

-- Backfill historique : tout ID commençant par 's_' → 'wizard_pivot'
UPDATE chat_session
   SET kind = 'wizard_pivot',
       updated_at = NOW()
 WHERE id LIKE 's\_%' ESCAPE '\'
   AND kind = 'chat';  -- ne touche pas les rows déjà classées

-- (Optionnel — phase 2) Archiver les orphelins wizard sans lead > 30j
UPDATE chat_session s
   SET status = 'archived',
       archived_at = NOW(),
       updated_at = NOW()
 WHERE s.kind = 'wizard_pivot'
   AND s.status = 'open'
   AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id)
   AND s.opened_at < NOW() - INTERVAL '30 days';
```

## 3. Drizzle schema TypeScript

**Fichier** : `src/lib/chat/db/schema.ts`

**Diff** :

```diff
 export const chatSession = pgTable(
   'chat_session',
   {
     id: text('id').primaryKey(),
+    /**
+     * CHA-LEAD-V2-01 — Discriminateur entre conversations chat réelles
+     * et "ghost sessions" wizard utilisées comme pivot FK pour chat_lead.
+     *
+     * Valeurs :
+     *  - 'chat' (default) : conversation chat IA standard, créée par
+     *    `sessionRepo.create()` lors du bootstrap widget. ID préfixe `cs_`.
+     *  - 'wizard_pivot' : row pivot insérée par `wizardSessionRepo.ensureForWizard()`
+     *    pour satisfaire la FK `chat_lead.session_id`. Pas de messages.
+     *    ID préfixe `s_` (généré client côté wizard).
+     *  - 'system' : row créée par un flow système (ex. newsletter, admin
+     *    seed) qui n'a ni interface chat ni wizard.
+     *
+     * Les queries admin (`adminQueries.listConversations/listChatLeads`)
+     * filtrent par défaut `kind='chat'` quand `CHAT_ADMIN_FILTERS_V2=true`.
+     */
+    kind: text('kind', { enum: ['chat', 'wizard_pivot', 'system'] })
+      .notNull()
+      .default('chat'),
     visitorId: text('visitor_id').notNull(),
     fingerprintHash: text('fingerprint_hash'),
     language: text('language').notNull().default('fr'),
     page: text('page'),
     // ...
   },
   (t) => ({
     visitorIdx: index('chat_session_visitor_idx').on(t.visitorId),
     statusIdx: index('chat_session_status_idx').on(t.status, t.lastSeenAt),
     convIdx: index('chat_session_conv_idx').on(t.convertedAt),
     pageIdx: index('chat_session_page_idx').on(t.page),
+    kindStatusIdx: index('chat_session_kind_status_idx').on(
+      t.kind, t.status, t.lastSeenAt,
+    ),
   }),
 );
```

## 4. Constants & enums TypeScript

**Fichier** : `src/lib/chat/db/kind.ts` (nouveau, exportable pour réutilisation)

```ts
/**
 * CHA-LEAD-V2 — Discriminateur de `chat_session.kind`.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/data-model.md
 */
export const CHAT_SESSION_KINDS = ['chat', 'wizard_pivot', 'system'] as const;
export type ChatSessionKind = (typeof CHAT_SESSION_KINDS)[number];

/** Set des kinds qui apparaissent dans /admin/chat/conversations. */
export const ADMIN_CHAT_VISIBLE_KINDS = new Set<ChatSessionKind>(['chat']);

/** Set des sources `chat_lead.source` visibles dans /admin/chat/leads. */
export const ADMIN_CHAT_VISIBLE_LEAD_SOURCES = [
  'chat_widget',
  'inline',
] as const;
export type ChatVisibleLeadSource = (typeof ADMIN_CHAT_VISIBLE_LEAD_SOURCES)[number];

/** Guard runtime. */
export function isChatVisibleKind(k: string): k is 'chat' {
  return ADMIN_CHAT_VISIBLE_KINDS.has(k as ChatSessionKind);
}
```

## 5. Indexes — analyse performance

### 5.1 Index `chat_session_kind_status_idx`

**But** : accélérer `WHERE kind='chat' AND status='open' ORDER BY last_seen_at DESC`.

**Plan d'exécution attendu** (PostgreSQL EXPLAIN) :

```
Index Scan using chat_session_kind_status_idx on chat_session
  Index Cond: (kind = 'chat' AND status = 'open')
  Order: last_seen_at DESC
```

**Coût estimé** : O(log n) au lieu de O(n) avec Seq Scan.

### 5.2 Index existant `chat_session_status_idx`

Reste utile pour les queries qui ne filtrent pas sur `kind` (ex. cleanup endpoint qui itère par status). Pas de conflit.

### 5.3 Espace disque

`kind` est un text de max 13 chars (`'wizard_pivot'`). Surcoût par row : ~17 bytes. Pour 100k rows : ~1.7 MB. Négligeable.

L'index `chat_session_kind_status_idx` ajoute ~2-4 MB pour 100k rows. Acceptable.

## 6. Contraintes de cohérence cross-table

### 6.1 Invariant I5 (kind ↔ source)

`chat_lead.source` et `chat_session.kind` doivent être cohérents :

| chat_lead.source | chat_session.kind attendu |
|---|---|
| `'chat_widget'` | `'chat'` |
| `'inline'` | `'chat'` |
| `'wizard_kit'` | `'wizard_pivot'` |
| `'wizard_commander'` | `'wizard_pivot'` |
| `'newsletter'` | `'system'` |
| `'admin'` | `'chat'` ou `'system'` (selon contexte) |

**Mise en œuvre** : pas de contrainte DB pour rester souple. Vérification via test unit `should match source ↔ kind` qui s'exécute périodiquement sur prod (audit query).

### 6.2 Query d'audit cohérence

```sql
-- À exécuter mensuel pour détecter les incohérences kind ↔ source
SELECT s.kind, l.source, COUNT(*) AS n
  FROM chat_session s
  JOIN chat_lead l ON l.session_id = s.id
 GROUP BY 1, 2
 ORDER BY n DESC;
```

Attendu après backfill : pas plus de 1-2 % d'incohérences (legacy data pre-fix).

## 7. Tests d'invariants schema

**Fichier** : `src/lib/chat/db/__tests__/schema-kind.invariant.test.ts` (nouveau)

```ts
import { describe, it, expect } from 'vitest';
import { chatSession } from '../schema';
import { CHAT_SESSION_KINDS } from '../kind';

describe('chat_session.kind invariants', () => {
  it('exposes kind column with correct enum', () => {
    const col = chatSession.kind;
    expect(col).toBeDefined();
    // Cohérence avec CHAT_SESSION_KINDS
    expect(CHAT_SESSION_KINDS).toEqual(['chat', 'wizard_pivot', 'system']);
  });

  it('defaults kind to "chat" if not provided', () => {
    // Vérifie le default Drizzle en simulant un insert
    const minimal: typeof chatSession.$inferInsert = {
      id: 'cs_test',
      visitorId: 'v_test',
      instructionVersionId: 'iv_test',
    };
    // Le default Drizzle est appliqué côté DB ; on vérifie ici que la
    // colonne est marquée notNull et default('chat') dans le schema.
    expect(chatSession.kind.default).toBe('chat');
    expect(chatSession.kind.notNull).toBe(true);
  });
});
```

## 8. Rollback de la migration

Si pour une raison quelconque on doit annuler :

```sql
-- Réversible : drop l'index (auto par DROP COLUMN)
DROP INDEX IF EXISTS chat_session_kind_status_idx;

-- Drop la colonne (les rows historiques retrouvent l'absence du discriminateur)
ALTER TABLE chat_session DROP COLUMN IF EXISTS kind;
```

**Conditions** :
- Aucun code en cours d'utiliser `chat_session.kind` (déployer d'abord la révision code sans la colonne).
- Feature flag `CHAT_ADMIN_FILTERS_V2=false`.

**Risque** : si le code prod référence `chat_session.kind` (via Drizzle), un `DROP COLUMN` casse les SELECT. D'où l'importance du flag + déploiement en 2 temps.
