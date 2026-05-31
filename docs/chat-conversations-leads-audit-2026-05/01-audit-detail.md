# Audit détaillé — pollution conversations & leads chat

> **Période d'observation** : 26 mai 2026, env local Node 20 (preview admin sur port 3001), DB locale.
> **Périmètre** : `/admin/chat/conversations`, `/admin/chat/leads`, `/admin/leads`, et l'ensemble du pipeline qui peuple `chat_session` + `chat_lead`.

## 1. Méthodologie

1. **Live preview** : login `admin@femiglow.local` sur `http://localhost:3001` → navigation `/admin/chat/conversations`, `/admin/chat/leads`, `/admin/leads`. Snapshots accessibility-tree pour extraire counts et IDs.
2. **Lecture code (read-only)** : pages RSC, queries Drizzle, schéma DB, repos chat & checkout, endpoint `/api/checkout/lead`, service `sessionService.getOrCreate`.
3. **Recoupement** : matching ID-prefix (cs_ vs s_) ↔ chemin d'écriture (chat natif vs wizard) ↔ enum `chat_lead.source`.
4. **Validation contrôlée** : aucune écriture, aucun fix appliqué. Cet audit reste purement observationnel.

## 2. Architecture découverte

### 2.1 Deux générateurs de sessionId distincts

```
┌──────────────────────────────────┬──────────────────────────────────────┐
│ Système chat natif (widget IA)   │ Système wizard checkout (B2C kit)   │
├──────────────────────────────────┼──────────────────────────────────────┤
│ Source : sessionRepo.create()    │ Source : ensureSessionId() client    │
│ Fichier :                        │ Fichier :                            │
│ src/lib/chat/repos/session.ts:45 │ src/lib/checkout/client/             │
│                                  │   visitor-id.ts:54                   │
│ Helper : createId('cs')          │ Helper : createNanoId('s')           │
│ Output : "cs_<20 chars base36>"  │ Output : "s_<random>"                │
│ Storage : DB (chat_session)      │ Storage : sessionStorage tab-scoped  │
│ Durée : tant que status=open     │ Durée : vie de l'onglet (reset close)│
└──────────────────────────────────┴──────────────────────────────────────┘
```

> **Note** : `createId('cs')` produit `cs_<20 chars base 36>` (cf. `src/lib/ids.ts:5-12`) → cohérent avec les IDs `cs_1mxdwivvxq8ixgd4`, `cs_yey94otm7nn57cfn` observés. Côté client, `createNanoId('s')` produit `s_<random>` → cohérent avec `s_m89vfat478lpj1o3tjik`, `s_aeh9i9v97pxbu3mtsd1a` observés.

### 2.2 Une seule table partagée : `chat_session`

Le schéma DB (`src/lib/chat/db/schema.ts:148`) :

```ts
export const chatSession = pgTable('chat_session', {
  id: text('id').primaryKey(),                  // <-- commentaire dit "cs_xxxxxxxx"
                                                //     mais accepte n'importe quoi
  visitorId: text('visitor_id').notNull(),
  page: text('page'),                           // nullable
  status: text('status', {
    enum: ['open', 'idle', 'archived', 'purged']
  }).notNull().default('open'),
  // ... pas de discriminateur "source" / "kind" / "channel"
})
```

**Aucun discriminateur** existe pour distinguer une session chat native d'une session "ghost wizard". La seule heuristique disponible est :
- le préfixe d'ID (`cs_` vs `s_`) — fragile, dépend d'une convention non garantie
- la présence de `chat_message` rattachés — fiable mais nécessite un JOIN

### 2.3 Pipeline d'écriture wizard → chat_session

Référence : `src/app/api/checkout/lead/route.ts:44-53` :

```ts
const result = await withIdempotency({
  request: req, scope: 'lead_create', payload: parsed.data,
  execute: async () => {
    const input = parsed.data;
    // Garantit l'existence d'une row chat_session (FK chat_lead.session_id).
    // Idempotent : no-op si la session existe déjà.
    await wizardSessionRepo.ensureForWizard({
      sessionId: input.sessionId,    // <-- arrive depuis le client = "s_xxx"
      visitorId: input.visitorId,
      language: input.language,
      page: input.page,
      // ...
    });
    const lead = await wizardLeadRepo.createWizardLead({ /* ... */ });
    // ...
  },
});
```

Et `src/lib/checkout/repos/session-repo.ts:5-9` confirme explicitement l'intention :

> *Le wizard checkout réutilise la table `chat_session` (FK depuis `chat_lead.session_id`) mais n'a pas besoin d'une conversation IA. Ce repo crée une session "fantôme" à la volée (status=open, pas de messages) afin de satisfaire la contrainte FK sans dupliquer la table.*

Le code :

```ts
async ensureForWizard(input: EnsureWizardSessionInput): Promise<ChatSessionRow> {
  // ...
  const inserted = await db.insert(chatSession).values({
    id: input.sessionId,                  // <-- "s_xxx" écrit directement en DB
    visitorId: input.visitorId,
    language: input.language ?? 'fr',
    page: input.page ?? null,
    referrer: input.referrer ?? null,
    utm: input.utm ?? null,
    instructionVersionId: active.id,
    status: 'open',                       // <-- jamais fermée
  })
  .onConflictDoNothing({ target: chatSession.id })
  .returning();
  // ...
}
```

### 2.4 Pipeline d'écriture chat natif → chat_session

`src/lib/chat/services/session-service.ts:36-69` :

```ts
async getOrCreate(opts: GetOrCreateOptions = {}): Promise<ChatSessionRow> {
  const visitorId = getVisitorId();
  const existing = await sessionRepo.getActiveByVisitor(visitorId);
  if (existing) {
    await sessionRepo.touch(existing.id);
    return existing;
  }
  // ...
  const created = await sessionRepo.create({ /* ... visitorId, page, ... */ });
  // ...
}
```

Et `sessionRepo.create()` (`src/lib/chat/repos/session.ts:43-48`) :

```ts
async create(insert: Omit<ChatSessionInsert, 'id'>): Promise<ChatSessionRow> {
  const db = requireChatDb();
  const id = createId('cs');               // <-- préfixe cs_
  const rows = await db.insert(chatSession).values({ ...insert, id }).returning();
  return rows[0]!;
}
```

> **Implication C4** : à la première visite d'une page où le widget appelle `/api/chat/session`, une row `chat_session` est créée **avant tout message**. Si l'utilisateur n'ouvre jamais le widget ou ne tape rien, la row reste avec `status='open'` indéfiniment. Pollution permanente même hors wizard.

## 3. Causes racines, en détail

### 3.1 C1 — Ghost sessions wizard pollution chat_session

**Mécanique exacte** :
1. Visiteur arrive sur `/kit`, le wizard charge.
2. Hook React `ensureSessionId()` → génère `s_xxx` et le stocke en `sessionStorage`.
3. À la step 1 du wizard, l'utilisateur soumet prénom + téléphone.
4. POST `/api/checkout/lead` avec `sessionId = 's_xxx'`.
5. `wizardSessionRepo.ensureForWizard({ sessionId: 's_xxx', ... })` INSERT dans `chat_session` la row id=`s_xxx`, status=`open`, **page = `/kit`** (donc cette row est PAS "vide" page-wise).
6. `wizardLeadRepo.createWizardLead()` INSERT dans `chat_lead` la row avec source=`wizard_kit` ou `wizard_commander`.

**Résultat dans `/admin/chat/conversations`** :
- Ligne `s_m89vfat478lpj1o3tjik` / page `/kit` / status `open` / Convertie ← *c'est un lead wizard converti, PAS une conversation chat.*

**Résultat dans `/admin/chat/leads`** :
- Ligne firstName=`yasmine`, trigger=`purchase-intent`, outcome=`converted`, session=`s_m89vfat478…` ← *lead wizard affiché comme lead chat.*

### 3.2 C2 — `adminQueries.listChatLeads` sans filtre source

Code actuel (`src/lib/chat/admin/queries.ts:278-297`) :

```ts
async listChatLeads(opts: {
  outcome?: ChatLeadRow['outcome'];
  triggerReason?: ChatLeadRow['triggerReason'];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
} = {}): Promise<ChatLeadRow[]> {
  const db = requireChatDb();
  const conds: ReturnType<typeof eq>[] = [];
  if (opts.outcome) conds.push(eq(chatLead.outcome, opts.outcome));
  if (opts.triggerReason) conds.push(eq(chatLead.triggerReason, opts.triggerReason));
  // ... fromDate / toDate ...
  return db
    .select()
    .from(chatLead)                       // <-- pas de WHERE source IN (...)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(chatLead.createdAt))
    .limit(opts.limit ?? 100);
}
```

**Pourtant** la table a déjà l'enum approprié (`src/lib/chat/db/schema.ts:542-546`) :

```ts
source: text('source', {
  enum: ['chat_widget', 'wizard_kit', 'wizard_commander', 'newsletter', 'admin', 'inline'],
})
.notNull()
.default('chat_widget'),
formMode: text('form_mode', {
  enum: ['wizard_embed', 'wizard_cart', 'legacy_cart', 'chat'],
}),
```

Donc l'infrastructure est prête côté DB, c'est la **query qui ne consomme pas** le champ.

### 3.3 C3 — `adminQueries.listConversations` sans filtre messages

Code actuel (`src/lib/chat/admin/queries.ts:235-241`) :

```ts
return db
  .select()
  .from(chatSession)
  .where(conds.length ? and(...conds) : undefined)
  .orderBy(desc(chatSession.lastSeenAt))
  .limit(limit);
```

Aucun JOIN sur `chat_message`. Une session ghost (0 message) est listée à parité avec une session vraiment échangée. Le compteur affiché en haut de page (`100 conversations · converties : 3`) inclut les ghosts.

### 3.4 C4 — `sessionService.getOrCreate` côté serveur prématuré

`src/lib/chat/services/session-service.ts:37-43` montre que :
- Lors de l'appel `GET /api/chat/session` (ou équivalent), si pas de session active pour ce visitor, le serveur **crée immédiatement une row** en DB.
- Le widget peut faire cet appel au chargement de page (pour pré-warmer / récupérer les pills suggérées) sans que l'utilisateur ouvre le chat.
- Donc chaque visiteur unique = 1 row chat_session, même s'il n'ouvre jamais le widget.

Sur l'évidence preview, on observe 5 IDs `cs_xxx` avec **page = "—" (NULL)** :
- `cs_1mxdwivvxq8ixgd4`, `cs_ir4llypdd69yjl7q`, `cs_iyz4vl9kj9hza31m`, `cs_yey94otm7nn57cfn`, `cs_kyrb54oqh311d7ow`

Ces sessions n'ont même pas de `page` enregistrée → probable `getOrCreate({ })` appelé sans `opts.page` (config serveur), ou flux de bootstrap où `page` n'est pas encore connu.

## 4. Impact business

| Domaine | Impact | Quantification (observée preview) |
|---|---|---|
| **Care SLA** | L'équipe Care voit `/admin/chat/leads` avec des leads wizard qui ne nécessitent **pas** de rappel chat (ils sont déjà au step 2/3 du wizard ou convertis). Risque de double appel. | 28 leads chat affichés vs vrais leads chat ≈ probablement <10 (1 "Sara" CHAT visible sur `/admin/leads`). |
| **KPIs** | "Conversion rate" `/admin/chat` divise par sessions ghost → ratio sous-estimé (3/100 = 3% vs réalité). Décisions copy/promo erronées. | Si on retire les 5 ghosts vides + ~25-30 ghosts wizard, le taux passe à ≈ 3/65 ≈ 4.6% (estimation). |
| **Export CSV** | `/api/admin/chat/export/leads` exporte tous les leads → CRM reçoit du bruit wizard qui n'attend pas de rappel. | À mesurer via `Exporter CSV`. |
| **Digest hebdo** | `/api/admin/chat/digest/preview` envoyé le lundi inclut probablement les leads wizard. | Mail confus pour la fondatrice. |
| **DB cost** | 1 row par visiteur même sans interaction. Index `chat_session_visitor_idx`, `chat_session_status_idx` grossissent. | Probablement marginal pour Neon free tier mais à monitorer si traffic ↑. |

## 5. Échantillon d'évidence (preview admin live)

### 5.1 Conversations (top 10 visible)

| # | ID (préfixe) | Page | Status | Convertie | Origine probable |
|---|---|---|---|---|---|
| 1 | `cs_1mxdwivvxq8ixgd4` | — | open | — | **Bootstrap widget vide (C4)** |
| 2 | `cs_ir4llypdd69yjl7q` | — | open | — | **Bootstrap widget vide (C4)** |
| 3 | `cs_iyz4vl9kj9hza31m` | — | open | — | **Bootstrap widget vide (C4)** |
| 4 | `cs_yey94otm7nn57cfn` | — | open | — | **Bootstrap widget vide (C4)** |
| 5 | `cs_kyrb54oqh311d7ow` | — | open | — | **Bootstrap widget vide (C4)** |
| 6 | `s_m89vfat478lpj1o3tjik` | /kit | open | **Convertie** | **Ghost wizard `/kit` (C1)** |
| 7 | `s_aeh9i9v97pxbu3mtsd1a` | /kit | open | — | **Ghost wizard `/kit` (C1)** |
| 8 | ... (~93 lignes additionnelles, mêmes patterns) | | | | |

### 5.2 Compteur affiché

- Page : `100 conversation(s) · converties : 3`
- Hypothèse : si on filtre `chat_session` ayant ≥1 `chat_message` de role=`user`, ce compteur tomberait probablement à <20.

### 5.3 Leads chat (top 2 visible)

| firstName | phone | trigger | outcome | session prefix | source DB probable |
|---|---|---|---|---|---|
| yasmine | +212751592310 | purchase-intent | converted | `s_m89vfat478…` | `wizard_kit` (PAS chat) |
| test | +212751592310 | purchase-intent | converted | `s_aeh9i9v97p…` | `wizard_kit` (PAS chat) |
| Sara | +212612345678 | ? | pending | (`s_` ou `cs_`?) | `chat_widget` (vrai chat) |

Le bouton "Conversation" pointe vers `/admin/chat/conversations/{sessionId}` — ouvre la ghost session vide pour les deux premiers.

## 6. Citations code (références exactes)

| Constat | Fichier:ligne | Citation |
|---|---|---|
| Wizard sessionId préfixe `s_` côté client | `src/lib/checkout/client/visitor-id.ts:54` | `const fresh = createNanoId('s');` |
| Wizard force `'s_unknown_session'` si null | `src/lib/checkout/state/use-wizard-mutations.ts:198` | `const sessionId = ensureSessionId() ?? 's_unknown_session';` |
| Ghost session insérée par wizard | `src/lib/checkout/repos/session-repo.ts:80-93` | `await db.insert(chatSession).values({ id: input.sessionId, ... }).onConflictDoNothing(...)` |
| Commentaire intentionnel "fantôme" | `src/lib/checkout/repos/session-repo.ts:5-9` | *"Ce repo crée une session 'fantôme' à la volée (status=open, pas de messages)"* |
| Chat natif préfixe `cs_` | `src/lib/chat/repos/session.ts:45` | `const id = createId('cs');` |
| Bootstrap immédiat session chat | `src/lib/chat/services/session-service.ts:37-43` | `const existing = await sessionRepo.getActiveByVisitor(visitorId); if (existing) ...` |
| Query chat leads sans filtre source | `src/lib/chat/admin/queries.ts:278-297` | `return db.select().from(chatLead).where(conds.length ? and(...conds) : undefined)` |
| Query conversations sans filtre messages | `src/lib/chat/admin/queries.ts:235-241` | `return db.select().from(chatSession).where(conds.length ? and(...conds) : undefined)` |
| Enum `source` discriminateur DB | `src/lib/chat/db/schema.ts:542-546` | `source: text('source', { enum: ['chat_widget', 'wizard_kit', ...] })` |
| Enum `formMode` discriminateur DB | `src/lib/chat/db/schema.ts:548-550` | `formMode: text('form_mode', { enum: ['wizard_embed', 'wizard_cart', 'legacy_cart', 'chat'] })` |

## 7. Conclusion

L'audit confirme que les symptômes signalés résultent de **4 défauts architecturaux additifs** :

- **Design intentionnel** : la table `chat_session` est utilisée comme table partagée chat + wizard FK pivot (acceptable, mais sans discriminateur).
- **Défaut requête** : les queries admin ne consomment pas le discriminateur DB `source` / `formMode` ni la jointure `chat_message` pour cibler les vraies conversations & leads chat.
- **Défaut bootstrap** : le service chat crée des sessions vides dès la pre-init, pollution même hors wizard.

Le fix ne nécessite **ni migration destructive ni refonte du schéma** : il s'agit principalement de **filtres SQL ciblés** dans `adminQueries.listConversations` et `adminQueries.listChatLeads`, plus une **politique de cleanup** (archivage des sessions ghost + vides au-delà de N jours).

Détails actionnables dans [`03-recommandations.md`](./03-recommandations.md).
