# Architecture cible

> Vision après application du fix complet (T6).

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                     APP NEXT.JS (App Router)                          │
└──────────────────────────────────────────────────────────────────────┘

   ┌──────────────────────┐                    ┌────────────────────────┐
   │  CLIENT (chat widget)│                    │ CLIENT (wizard /kit)   │
   │  visitorId = cookie  │                    │ visitorId = localStorage│
   │   sessionId = serveur│                    │  sessionId = s_xxx     │
   └─────────┬────────────┘                    └────────┬───────────────┘
             │ GET /api/chat/session                    │ POST /api/checkout/lead
             ▼                                          ▼
   ┌──────────────────────┐                    ┌────────────────────────┐
   │ sessionService       │                    │ wizardSessionRepo      │
   │ .getOrCreate()       │                    │ .ensureForWizard()     │
   │                      │                    │                        │
   │ → INSERT chat_session│                    │ → INSERT chat_session  │
   │   id = cs_xxx        │                    │   id = s_xxx           │
   │   kind = 'chat' ✨   │                    │   kind = 'wizard_pivot'│✨
   └─────────┬────────────┘                    └────────┬───────────────┘
             │                                          │
             ▼                                          ▼
                  ┌─────────────────────────────────┐
                  │     chat_session (DB)            │
                  │ ┌─────────────────────────────┐ │
                  │ │ id PK                        │ │
                  │ │ kind enum CHECK ✨           │ │
                  │ │   ('chat' | 'wizard_pivot'  │ │
                  │ │    | 'system')              │ │
                  │ │ visitor_id                   │ │
                  │ │ page                         │ │
                  │ │ status                       │ │
                  │ │ ...                          │ │
                  │ └─────────────────────────────┘ │
                  └────────────┬────────────────────┘
                               │ FK chat_lead.session_id
                               ▼
                  ┌─────────────────────────────────┐
                  │      chat_lead (DB)              │
                  │ ┌─────────────────────────────┐ │
                  │ │ session_id FK                │ │
                  │ │ source enum (déjà existe)   │ │
                  │ │  • chat_widget (✅ admin chat)│ │
                  │ │  • inline      (✅ admin chat)│ │
                  │ │  • wizard_kit  (❌ admin chat)│ │
                  │ │  • wizard_commander          │ │
                  │ │  • newsletter / admin        │ │
                  │ └─────────────────────────────┘ │
                  └─────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│              ADMIN (lecture filtrée derrière feature flag)            │
└──────────────────────────────────────────────────────────────────────┘

  /admin/chat/conversations              /admin/chat/leads
  ┌───────────────────────────┐          ┌───────────────────────────┐
  │ adminQueries              │          │ adminQueries              │
  │ .listConversations()      │          │ .listChatLeads()          │
  │                           │          │                           │
  │ WHERE                     │          │ WHERE                     │
  │  s.kind = 'chat' ✨       │          │  l.source IN              │
  │  AND EXISTS (             │          │   ('chat_widget',         │
  │    SELECT 1 FROM          │          │    'inline') ✨           │
  │    chat_message m         │          │                           │
  │    WHERE m.session_id     │          │  (override via            │
  │      = s.id               │          │   opts.sources)           │
  │      AND role='user') ✨  │          │                           │
  └───────────────────────────┘          └───────────────────────────┘

  /admin/leads (vue globale fusionnée — NON CHANGÉ)
  ┌───────────────────────────────────────────────────────────┐
  │ adminLeadsUnion.list()                                    │
  │ Continue d'afficher tous les leads (chat + wizard)        │
  │ pour ne PAS régresser le tableau global                   │
  └───────────────────────────────────────────────────────────┘
```

## 2. Différentiel avant/après

### 2.1 Insert chat_session

| Path | Avant | Après |
|---|---|---|
| Chat natif (sessionRepo.create) | `INSERT id=cs_xxx, ...` | `INSERT id=cs_xxx, kind='chat', ...` |
| Wizard ghost (ensureForWizard) | `INSERT id=s_xxx, ...` | `INSERT id=s_xxx, kind='wizard_pivot', ...` |

### 2.2 Insert chat_lead

| Path | Avant | Après |
|---|---|---|
| Chat lead form (in-widget) | `INSERT source='chat_widget'` | (inchangé) |
| Chat lead form (inline phone) | `INSERT source='inline'` | (inchangé) |
| Wizard step 1 | `INSERT source='wizard_kit'` | (inchangé) |
| Wizard cart | `INSERT source='wizard_commander'` | (inchangé) |
| Newsletter / admin | `INSERT source='newsletter'/'admin'` | (inchangé) |

**Important** : la table `chat_lead` n'est pas modifiée. Le filtre se fait en lecture admin.

### 2.3 Queries admin

| Query | Avant | Après |
|---|---|---|
| `listConversations()` | `SELECT * FROM chat_session ORDER BY ...` | `SELECT * FROM chat_session WHERE kind='chat' AND EXISTS (msg user)` |
| `listChatLeads()` | `SELECT * FROM chat_lead ORDER BY ...` | `SELECT * FROM chat_lead WHERE source IN ('chat_widget','inline')` |
| `convertedSessionIds()` | identique | (filtre cohérent : ne renvoie que kind='chat') |
| `overviewKpis()` | counts toutes sessions | counts kind='chat' uniquement |
| `businessFunnel()` | counts toutes sessions | counts kind='chat' uniquement |
| `careOverview()` | leads sans filtre | leads source IN (chat_widget, inline) |
| `recentEvents()` | (no change, events table indépendante) | (no change) |

## 3. Couches affectées

### 3.1 Backend (cœur du fix)

- **Schema** : `chat_session.kind` ajouté, contrainte CHECK, index.
- **Repos** :
  - `sessionRepo.create()` : insert avec `kind: 'chat'` explicite (par sécurité — le default DB couvre, mais on est explicite).
  - `wizardSessionRepo.ensureForWizard()` : insert avec `kind: 'wizard_pivot'`.
- **Queries** : 7 queries dans `adminQueries.*` filtrées.
- **Routes API** : nouveau `POST /api/admin/chat/cleanup-ghosts`.
- **Feature flag** : `isChatAdminFiltersV2Enabled()` gate.

### 3.2 Frontend (cosmétique et UX)

- `ChatConversationsPage` : ajout toggle "Inclure sessions sans messages" (debug).
- `ChatLeadsPage` : ajout badge `<SourceBadge>` par ligne.
- `ChatAdminNav` : annotation visuelle si filtres V2 actifs.

### 3.3 Data layer

- Migration `0XYZ_chat_session_kind.sql` : ADD COLUMN + CHECK + INDEX + backfill.
- Script `scripts/backfill-chat-session-kind.ts` : variante TypeScript pour environnements sans psql.

### 3.4 Tests

- Unit (vitest) : queries, repos, feature flag, schema invariants.
- Intégration (MSW) : flows admin avec DB in-memory.
- E2E (Playwright) : scénarios `@chat-purity` × 3.
- Smoke (Node 20) : `pnpm tsx scripts/smoke-chat-purity.ts`.

### 3.5 Monitoring

- Sentry : capter erreurs query si `kind` enum invalide.
- Logs : `logger.info('chat.session.create', { kind })` + Plausible event.
- Dashboard `/admin/chat/audit` : compteur ghosts / vrais sessions / pollution rate.

## 4. Diagramme de séquence — visite typique avec chat + wizard

```
Visitor          Widget Chat          Wizard /kit          API                  DB
   │                 │                    │                  │                   │
   │ Visit /kit      │                    │                  │                   │
   ├────────────────►│                    │                  │                   │
   │                 │ GET /api/chat/    │                  │                   │
   │                 │   session         │                  │                   │
   │                 ├──────────────────────────────────────►│                   │
   │                 │                    │                  │ INSERT chat_session│
   │                 │                    │                  │  id=cs_a, kind='chat'│
   │                 │                    │                  ├──────────────────►│
   │                 │ session={cs_a,...}│                  │                   │
   │                 │◄──────────────────────────────────────┤                   │
   │                 │                    │                  │                   │
   │                 │                    │ User fills form  │                   │
   │                 │                    │ POST /api/checkout/lead             │
   │                 │                    │ { sessionId: s_b, ... }             │
   │                 │                    ├─────────────────►│                   │
   │                 │                    │                  │ INSERT chat_session│
   │                 │                    │                  │  id=s_b,           │
   │                 │                    │                  │  kind='wizard_pivot'│
   │                 │                    │                  ├──────────────────►│
   │                 │                    │                  │                   │
   │                 │                    │                  │ INSERT chat_lead   │
   │                 │                    │                  │  session_id=s_b,   │
   │                 │                    │                  │  source='wizard_kit'│
   │                 │                    │                  ├──────────────────►│
   │                 │                    │ lead={cl_z,...} │                   │
   │                 │                    │◄─────────────────┤                   │
   │                 │                    │                  │                   │
                                          ★ Admin opens /admin/chat/conversations
                                          ★ Sees ONLY cs_a (kind='chat', with messages)
                                          ★ s_b filtered out (kind='wizard_pivot')
                                          ★ Lead apparait dans /admin/leads global
                                          ★ Lead PAS apparait dans /admin/chat/leads
                                            (source='wizard_kit' filtered out)
```

## 5. Invariants à respecter

- **I1** : `chat_session.kind` ne peut pas être NULL (NOT NULL constraint).
- **I2** : `chat_session.kind` doit appartenir à l'enum (CHECK constraint).
- **I3** : pour `kind='chat'`, on doit avoir au moins 1 `chat_message` dans la session (post-init du widget).
- **I4** : pour `kind='wizard_pivot'`, on doit avoir au moins 1 `chat_lead` rattaché (sinon orphelin → archivage).
- **I5** : `chat_lead.source IN ('chat_widget', 'inline')` ↔ `chat_session.kind = 'chat'` (cohérence cross-table).
- **I6** : feature flag `CHAT_ADMIN_FILTERS_V2=false` → comportement legacy strictement identique à l'avant.

## 6. Cas limites considérés

| Cas | Traitement |
|---|---|
| Session chat avec lead `inline` (capture inline) | Reste `kind='chat'`, lead `source='inline'`. Visible dans /admin/chat. |
| Wizard sans lead créé (form abandonné après step 0) | `kind='wizard_pivot'` sans lead → orphelin. Archivé par cleanup endpoint > 30j. |
| Admin manuel crée un lead (source='admin') | session_id pointe vers row existante (FK). `source='admin'` PAS dans le filtre par défaut. Doit être visible via filtre admin spécifique. |
| Lead newsletter standalone (sans session) | Pas applicable — le schéma exige `session_id NOT NULL`. Donc le code newsletter doit créer une session pivot (`kind='system'`). |
| Migration partielle (50 % des rows ont kind, 50 % pas) | Impossible : NOT NULL DEFAULT 'chat' garantit que la colonne est remplie immédiatement. |
| Rollback après prod | `CHAT_ADMIN_FILTERS_V2=false` → queries reviennent legacy. Données restent (colonne `kind` continue d'être remplie mais ignorée). |
