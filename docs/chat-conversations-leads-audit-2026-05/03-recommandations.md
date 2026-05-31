# Recommandations — fix pollution chat & leads

> **Objectif** : à terme, `/admin/chat/conversations` n'affiche QUE des vraies conversations chat IA (≥ 1 message user) ; `/admin/chat/leads` n'affiche QUE les leads source `chat_widget` ou `inline`.
> **Contrainte** : aucune régression sur `/admin/leads` (vue fusionnée) ; les wizards continuent à fonctionner ; aucune migration destructive.

## 1. Stratégie en 3 niveaux

| Niveau | Effort | Risque | Délai | Objet |
|---|---|---|---|---|
| **N1 — Quick wins** | 0.5 j-h | Très faible | 1 jour | Filtres SQL ciblés dans les queries admin. **Pas de migration.** |
| **N2 — Court terme** | 1-2 j-h | Faible | 1 semaine | Ajout colonne `chat_session.kind` discriminateur + backfill. Tests. |
| **N3 — Long terme** | 3-5 j-h | Moyen | 1 mois | Refonte schéma : table dédiée `wizard_session` ou pivot virtuel. Cleanup historique. |

> **Recommandation** : appliquer **N1 cette semaine** (résout 95 % des symptômes), planifier **N2** dans le sprint suivant, **N3** seulement si le volume devient problématique (>10k sessions).

---

## 2. N1 — Quick wins (filtres SQL ciblés)

### 2.1 Fix C2 — filtrer `listChatLeads` par source

**Fichier** : `src/lib/chat/admin/queries.ts:278`

**Diff suggéré** :

```diff
async listChatLeads(opts: {
   outcome?: ChatLeadRow['outcome'];
   triggerReason?: ChatLeadRow['triggerReason'];
+  /**
+   * CHA-XXX — Filtre source pour exclure les leads wizard (qui apparaissent
+   * sinon dans `/admin/chat/leads` à cause du FK partagé `chat_lead.session_id`
+   * → `chat_session`). Par défaut, on ne renvoie QUE les leads chat purs.
+   */
+  sources?: ReadonlyArray<ChatLeadRow['source']>;
   fromDate?: Date;
   toDate?: Date;
   limit?: number;
 } = {}): Promise<ChatLeadRow[]> {
   const db = requireChatDb();
   const conds: ReturnType<typeof eq>[] = [];
   if (opts.outcome) conds.push(eq(chatLead.outcome, opts.outcome));
   if (opts.triggerReason) conds.push(eq(chatLead.triggerReason, opts.triggerReason));
+  // Par défaut : leads chat purs (chat_widget + inline). Override possible
+  // via opts.sources pour `/admin/leads` (vue fusionnée).
+  const sources = opts.sources ?? ['chat_widget', 'inline'];
+  conds.push(inArray(chatLead.source, sources));
   if (opts.fromDate) conds.push(gte(chatLead.createdAt, opts.fromDate));
   if (opts.toDate) conds.push(lte(chatLead.createdAt, opts.toDate));
   return db
     .select()
     .from(chatLead)
     .where(conds.length ? and(...conds) : undefined)
     .orderBy(desc(chatLead.createdAt))
     .limit(opts.limit ?? 100);
}
```

**Effort** : ~10 min écriture + 30 min tests + 10 min revue.

**Test** :
```ts
// src/lib/chat/admin/queries.test.ts (à ajouter)
it('listChatLeads par défaut exclut wizard_kit/wizard_commander', async () => {
  // Setup : mocker chat_lead avec 3 rows source=chat_widget, 2 source=wizard_kit
  // Action : adminQueries.listChatLeads()
  // Assert : rows.length === 3, tous source==='chat_widget'
});

it('listChatLeads avec opts.sources explicite inclut wizard', async () => {
  // Action : adminQueries.listChatLeads({ sources: ['chat_widget', 'wizard_kit'] })
  // Assert : rows.length === 5
});
```

### 2.2 Fix C3 — filtrer `listConversations` par présence de messages

**Fichier** : `src/lib/chat/admin/queries.ts:163`

**Diff suggéré** :

```diff
async listConversations(opts: {
   q?: string;
   language?: string;
   status?: ChatSessionRow['status'];
+  /**
+   * CHA-XXX — Si true (défaut), n'affiche que les sessions ayant au moins
+   * 1 chat_message de role='user'. Évite de polluer la liste avec les
+   * "ghost sessions" wizard (pas de message) et les bootstraps abandonnés.
+   */
+  withMessagesOnly?: boolean;
   fromDate?: Date;
   toDate?: Date;
   converted?: 'yes' | 'no';
   limit?: number;
}) {
   const db = requireChatDb();
   const limit = opts.limit ?? 50;
+  const withMessagesOnly = opts.withMessagesOnly ?? true;
   
   // ... [code existant pour converted filter et q search] ...
   
   const conds = [];
   if (opts.language) conds.push(eq(chatSession.language, opts.language));
   // ... [autres conds existantes] ...
+  if (withMessagesOnly) {
+    conds.push(sql`EXISTS (
+      SELECT 1 FROM chat_message m
+       WHERE m.session_id = ${chatSession.id}
+         AND m.role = 'user'
+         AND m.status = 'sent'
+    )`);
+  }
   
   return db
     .select()
     .from(chatSession)
     .where(conds.length ? and(...conds) : undefined)
     .orderBy(desc(chatSession.lastSeenAt))
     .limit(limit);
}
```

**Note importante** : `withMessagesOnly` doit être désactivable via un toggle UI pour permettre le debug (admin avancé veut voir les ghosts pour comprendre la pollution).

**UI suggéré** sur `/admin/chat/conversations` :
```tsx
<label className="inline-flex items-center gap-1.5 ...">
  <input type="checkbox" name="includeGhosts" value="1" defaultChecked={includeGhosts} />
  Inclure sessions sans messages (debug)
</label>
```

### 2.3 Fix C1+C3 supplémentaire — afficher badge "wizard ghost" si présent

Pour la sécurité, même avec le filtre `withMessagesOnly`, ajouter un badge visuel quand un session/lead est suspecté ghost :

```tsx
{l.source && l.source.startsWith('wizard_') && (
  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
    via wizard
  </span>
)}
```

### 2.4 Fix C4 — Lazy session creation côté chat

**Fichier** : `src/lib/chat/services/session-service.ts:36`

**Stratégie** : ne créer `chat_session` qu'au premier `chat_message` envoyé, pas au bootstrap.

**Diff suggéré** :

```diff
async getOrCreate(opts: GetOrCreateOptions = {}): Promise<ChatSessionRow> {
   const visitorId = getVisitorId();
   const existing = await sessionRepo.getActiveByVisitor(visitorId);
   if (existing) {
     await sessionRepo.touch(existing.id);
     return existing;
   }
-  const instruction = await instructionRepo.active('default');
-  // ... création immédiate ...
+  // CHA-XXX — Lazy creation : ne pas matérialiser une row chat_session tant
+  // qu'aucun message n'est échangé. Retourner un snapshot virtuel.
+  if (opts.deferUntilFirstMessage) {
+    return makeVirtualSession(visitorId, opts);
+  }
+  // ... création immédiate (legacy path pour wizard) ...
}
```

**Impact** : nécessite que le widget chat ne réclame pas de `sessionId` au bootstrap, mais seulement au premier `POST /api/chat/message`. À évaluer côté UX (potentiel re-roll de pills si visitor change).

**Effort** : ~2 h (changement non trivial). **À reporter à N2 si C1-C3 suffisent.**

---

## 3. N2 — Court terme (discriminateur explicite)

### 3.1 Ajouter `chat_session.kind`

**Migration Drizzle** :

```ts
// drizzle/migrations/XXXX_chat_session_kind.ts
export async function up(db: PgDatabase) {
  await db.execute(sql`
    ALTER TABLE chat_session
      ADD COLUMN kind text NOT NULL DEFAULT 'chat'
      CHECK (kind IN ('chat', 'wizard_pivot', 'system'));

    CREATE INDEX chat_session_kind_idx ON chat_session (kind, status);

    -- Backfill historique : tout id commençant par 's_' = wizard_pivot
    UPDATE chat_session SET kind = 'wizard_pivot' WHERE id LIKE 's\\_%' ESCAPE '\\';

    -- Sessions cs_ sans messages = candidats orphan (à classer system ou archived)
    -- On laisse à 'chat' par défaut pour ne pas perdre historique.
  `);
}
```

**Schéma** (`src/lib/chat/db/schema.ts`) :

```diff
export const chatSession = pgTable('chat_session', {
   id: text('id').primaryKey(),
+  kind: text('kind', { enum: ['chat', 'wizard_pivot', 'system'] })
+    .notNull()
+    .default('chat'),
   visitorId: text('visitor_id').notNull(),
   // ...
});
```

**Code wizard** (`session-repo.ts`) : forcer `kind='wizard_pivot'` à l'insert.

**Code chat** (`sessionRepo.create`) : laisser default `chat`.

**Queries admin** : remplacer `inArray(chatLead.source, ...)` par `eq(chatSession.kind, 'chat')` quand approprié — plus performant (index direct vs JOIN sur chat_lead).

### 3.2 Cleanup historique

Script de migration data :

```sql
-- À exécuter une fois après le ajout colonne `kind`
-- Marque comme 'archived' les sessions ghost wizard sans aucun lead lié
-- (= cas d'INSERT ghost mais lead jamais créé, ex: erreur Zod step 1)
UPDATE chat_session s
   SET status = 'archived',
       archived_at = NOW(),
       updated_at = NOW()
 WHERE kind = 'wizard_pivot'
   AND NOT EXISTS (SELECT 1 FROM chat_lead l WHERE l.session_id = s.id)
   AND opened_at < NOW() - INTERVAL '30 days';

-- Marque comme 'archived' les sessions chat sans aucun message user > 7j
UPDATE chat_session s
   SET status = 'archived',
       archived_at = NOW(),
       updated_at = NOW()
 WHERE kind = 'chat'
   AND status = 'open'
   AND NOT EXISTS (
     SELECT 1 FROM chat_message m
      WHERE m.session_id = s.id AND m.role = 'user' AND m.status = 'sent'
   )
   AND opened_at < NOW() - INTERVAL '7 days';
```

### 3.3 Endpoint de cleanup automatisé

`/api/admin/chat/cleanup-ghosts` (POST, admin-only, rate-limited) qui exécute le SQL ci-dessus et retourne un JSON `{ archived_wizard: N, archived_empty_chat: M }`. À déclencher manuellement ou via cron weekly.

---

## 4. N3 — Long terme (refonte schéma)

À évaluer si :
- volume `chat_session` > 100k
- multiples sources externes (B2B form, social ads landing) viennent s'y greffer
- équipe gardée souvent surprise par la table partagée

**Option A — table dédiée wizard**

```sql
CREATE TABLE wizard_session (
  id text PRIMARY KEY,           -- 's_xxxxxxxx'
  visitor_id text NOT NULL,
  page text,
  -- ... champs wizard-spécifiques
);

ALTER TABLE chat_lead
  DROP CONSTRAINT chat_lead_session_id_fk,
  ADD COLUMN wizard_session_id text REFERENCES wizard_session(id),
  ADD CONSTRAINT chat_lead_session_xor CHECK (
    (chat_session_id IS NOT NULL AND wizard_session_id IS NULL)
    OR (chat_session_id IS NULL AND wizard_session_id IS NOT NULL)
  );
```

**Pros** : modèle conceptuellement propre, queries simples.
**Cons** : migration lourde (relink chat_lead, code touchant FK), risque régression.

**Option B — Vue SQL virtuelle**

Garder le schéma actuel, mais créer une view :
```sql
CREATE VIEW v_chat_conversations AS
SELECT s.* FROM chat_session s
 WHERE s.kind = 'chat'
   AND EXISTS (SELECT 1 FROM chat_message m WHERE m.session_id = s.id AND m.role = 'user');
```

→ Toutes les queries admin lisent `v_chat_conversations` au lieu de `chat_session`. Wizard continue à insérer direct.

**Recommandé** : Option B (low-cost, low-risk).

---

## 5. Tests à ajouter

### 5.1 Unit (Vitest)

- `adminQueries.listChatLeads` par défaut exclut `wizard_*` sources.
- `adminQueries.listChatLeads({ sources: [...] })` override correctement.
- `adminQueries.listConversations` par défaut exclut sessions sans `chat_message` user.
- `adminQueries.listConversations({ withMessagesOnly: false })` inclut tout (debug).
- `wizardSessionRepo.ensureForWizard()` insère bien `kind='wizard_pivot'` (après N2).

### 5.2 Integration (MSW + Drizzle in-memory)

- POST `/api/checkout/lead` → vérifier que `chat_session` ghost reçoit `kind='wizard_pivot'`.
- GET `/admin/chat/leads` → vérifier que la response n'inclut pas les leads `wizard_kit`.
- GET `/admin/leads` → vérifier que la response inclut TOUS les leads.

### 5.3 E2E (Playwright)

```ts
test('@chat-purity admin/chat/conversations exclut ghosts wizard', async ({ request, page }) => {
  // 1. Créer un lead wizard via API (ghost session)
  await request.post('/api/checkout/lead', { /* ... */ });
  // 2. Login admin, visit /admin/chat/conversations
  await page.goto('/admin/chat/conversations');
  // 3. Aucune row ne doit avoir le sessionId 's_GHOST...'
  await expect(page.getByText('s_GHOST')).toHaveCount(0);
});

test('@chat-purity admin/chat/leads exclut leads source wizard_*', async ({ page }) => {
  await page.goto('/admin/chat/leads');
  // Le badge "via wizard" ne doit apparaître nulle part par défaut
  await expect(page.locator('text=via wizard')).toHaveCount(0);
});
```

---

## 6. Définition de "Done" (Acceptance Criteria)

- [ ] `/admin/chat/conversations` n'affiche QUE des sessions avec ≥ 1 message user (sauf override debug)
- [ ] `/admin/chat/leads` n'affiche QUE les leads `source IN ('chat_widget', 'inline')`
- [ ] Le bouton "Conversation" sur `/admin/chat/leads` mène vers une session avec messages réels (jamais ghost vide)
- [ ] `/admin/leads` (global) continue de montrer TOUT (chat + wizard)
- [ ] Le KPI "Conversion rate" `/admin/chat/kpis` reflète le ratio CHAT pur
- [ ] Export CSV `/api/admin/chat/export/leads` n'exporte plus les wizard leads
- [ ] Digest hebdo `/api/admin/chat/digest/preview` n'inclut plus les wizard leads
- [ ] 100 % des tests vitest + Playwright `@chat-purity` verts
- [ ] Migration data backfill historique exécutée et vérifiée (counts before/after)
- [ ] Documentation mise à jour : `docs/chat-assistant/03-backend.md` ajoute une section "Table partagée chat_session"

---

## 7. Plan d'action proposé (1 semaine)

| Jour | Tâche | Owner | Livrable |
|---|---|---|---|
| J+0 | Lecture audit + alignement équipe | Lead | OK pour go |
| J+0 | Feature flag `CHAT_ADMIN_FILTERS_V2=false` (default off) | Dev | flag dispo |
| J+1 | Implémenter fix C2 + tests vitest | Dev | PR1 |
| J+1 | Implémenter fix C3 + tests vitest | Dev | PR1 |
| J+2 | E2E `@chat-purity` (2 specs) | Dev | PR2 |
| J+2 | Code review + merge PR1+PR2 derrière flag | Lead | green |
| J+3 | Toggle flag `CHAT_ADMIN_FILTERS_V2=true` en staging | DevOps | smoke OK |
| J+4 | Verify counts staging vs prod | Lead | rapport |
| J+5 | Toggle flag en prod | DevOps | live |
| J+5 | Monitoring 48h | Lead | OK ship |

Si J+5 OK → planifier N2 dans le sprint suivant. Sinon rollback flag, RCA, fix.

---

## 8. Risques résiduels

| # | Risque | Probabilité | Mitigation |
|---|---|---|---|
| R1 | Filtre `source` casse un export CSV ou digest legacy | Faible | Tester `/api/admin/chat/export/leads` + digest preview avant merge |
| R2 | Filtre `chat_message` cache des sessions valides (1er message en pending) | Moyenne | Inclure `chat_message.status IN ('sent', 'pending')` |
| R3 | Performance dégradée par EXISTS subquery | Faible | Index `chat_message(session_id, role, status)` déjà présent |
| R4 | Ghost session avec preview/email modal capture le visiteur dans le wizard mais ne crée pas de lead → reste orphaine | Faible | Cleanup périodique N2 — orphan archive après 30j |

---

## 9. Ressources

- Audit principal : [`01-audit-detail.md`](./01-audit-detail.md)
- Évidence preview : [`02-evidence-observations.md`](./02-evidence-observations.md)
- Schéma DB : `src/lib/chat/db/schema.ts`
- Doc chat existante : `docs/chat-assistant/03-backend.md`
- Pattern attribution sprint (référence méthodologique) : `docs/attribution-fix-2026-05/`
- Pattern live-systems sprint (référence sprint plan) : `docs/live-systems-fix-2026-05/`
