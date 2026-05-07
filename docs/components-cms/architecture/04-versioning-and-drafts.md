# A4 — Versioning, drafts, et scheduling

## Cycle de vie d'un binding

```
                  ┌────────────┐
                  │   (rien)   │
                  └─────┬──────┘
                        │ POST /fields  (PATCH d'un champ jamais touché)
                        ▼
                  ┌────────────┐
                  │   draft    │◄─────────────┐
                  └─────┬──────┘              │
                        │ POST /publish        │
                        ▼                      │
   ┌──────────►  ┌────────────┐                │
   │ POST /unpub │ published  │                │
   │             └─────┬──────┘                │
   │                   │ POST /publish (nouvelle version) │
   │                   ▼                      │
   │             ┌────────────┐                │
   │             │ archived   │                │
   │             └────────────┘                │
   │                                            │
   │       POST /schedule  ┌────────────┐      │
   └────────────────────── │ scheduled  │──────┘
                           └────────────┘
                            │ cron promote (à scheduledAt)
                            ▼
                       (devient published)
```

## Statuts en détail

| Statut | Lit publiquement ? | Visible admin ? | Mutable ? | Indexé ? |
|---|---|---|---|---|
| `draft` | ❌ | ✅ liste « En cours » | ✅ par auteur | unique partial |
| `published` | ✅ | ✅ liste « Publié » | ❌ (publier crée une nouvelle version) | unique partial |
| `scheduled` | ❌ tant que `scheduledAt > now()` | ✅ liste « Programmé » | ✅ tant que pas promu | partial sur (status, scheduledAt) |
| `archived` | ❌ | ✅ historique | ❌ | aucun (lecture rare) |

## Transitions autorisées

| De → À | Endpoint | Effet sur DB |
|---|---|---|
| `(rien)` → `draft` | `PATCH /fields` | INSERT ligne `draft`, INSERT history `create` |
| `draft` → `published` | `POST /fields/publish` | UPDATE ligne `draft` → `published`, ancien `published` → `archived`, INSERT history `publish` x2 |
| `draft` → `scheduled` | `POST /fields/schedule` | UPDATE ligne `draft` → `scheduled` avec `scheduledAt`, INSERT history `schedule` |
| `scheduled` → `published` | cron `promote-scheduled-fields` | UPDATE ligne `scheduled` → `published`, ancien `published` → `archived`, INSERT history `publish` x2 |
| `scheduled` → `draft` | `POST /fields/cancel-schedule` | UPDATE ligne → `draft`, NULL sur `scheduledAt`, INSERT history `unschedule` |
| `published` → `archived` | implicite (autre `publish`) | UPDATE → `archived`, INSERT history `archive` |
| `archived` → `draft` | `POST /fields/restore` | INSERT nouvelle ligne `draft` (la valeur de l'archive devient le brouillon courant), INSERT history `restore` |

> **Pas de transition directe** `published → draft`. Pour modifier un
> champ publié, on crée un brouillon depuis le panneau d'édition (la
> ligne `draft` est créée à la première frappe) puis on republie.

## Versioning

### Numéro de version

`version` est un entier strictement croissant **par triplet
`(componentId, fieldKey, locale)`**. Chaque transition vers une
nouvelle valeur incrémente le numéro :

```
v0 → (registre default, pas de ligne DB)
v1 → première publication
v2 → republication après édition
v3 → restauration depuis archive
…
```

Le brouillon en cours porte la version qu'il **deviendra à publication**
(donc `(max(version) + 1)`).

### Calcul atomique

```sql
-- Lors de la publication d'un draft
WITH next AS (
  SELECT COALESCE(MAX(version), 0) + 1 AS v
  FROM component_field_bindings
  WHERE componentId = $1 AND fieldKey = $2 AND locale = $3
)
UPDATE component_field_bindings
SET status = 'published',
    version = (SELECT v FROM next),
    publishedAt = NOW()
WHERE id = $4 AND status = 'draft';
```

Encadré dans une transaction qui :
1. archive l'ancien `published` du triplet,
2. promeut le `draft`,
3. insère 2 lignes d'history.

### History append-only

Chaque ligne de `component_field_history` est un **snapshot complet**
(`value` + `status` + `version` + `actorId` + `action`). On ne fait
**jamais** de UPDATE sur cette table. La timeline d'un binding se
reconstitue par `SELECT … ORDER BY version, createdAt`.

## Drafts

### Un seul draft par triplet

Garanti par index unique partial. Si un autre admin commence à éditer
le même champ pendant qu'un draft existe :

- s'il **partage** la session de l'admin courant (même tab) : le
  draft est rouvert tel quel ;
- s'il vient d'**un autre admin** : on lui propose
  - **continuer** sur le draft existant (collaboration séquentielle),
  - **reprendre** le `published` comme base (écrase le draft courant
    après confirmation).

UI : dialog modal au chargement de l'écran d'édition, listant l'auteur
et la date du draft existant.

### Auto-save vs. save explicite

- **Pendant l'édition** : auto-save debounced (800 ms) via `PATCH /fields/{fieldKey}` qui met à jour la ligne `draft`.
- **Pour publier** : action explicite via le bouton « Publier ».
- **Auto-save fait du retry** sur erreur réseau (3 essais, backoff 200/600/1500 ms).

### Dirty-tracking

Le formulaire-page maintient un `Map<fieldKey, FieldDirtyState>` :

```ts
type FieldDirtyState = {
  initial: unknown;
  current: unknown;
  saving: boolean;
  savedAt: Date | null;
  error: string | null;
};
```

Cf. F3 pour les détails du form-engine.

## Scheduling

### Programmer une publication

```
POST /api/admin/components/[key]/fields/[fieldKey]/schedule
{ scheduledAt: '2026-03-15T08:00:00Z' }
```

- Le binding `draft` (s'il existe) passe à `scheduled`.
- S'il n'existe pas, l'admin doit d'abord éditer (créer un draft).
- L'API rejette `scheduledAt < now() + 1 minute` (anti-flap).

### Promotion automatique

Cron `/api/cron/promote-scheduled-fields` (toutes les 5 min, header
secret partagé) :

```sql
SELECT id, componentId, fieldKey, locale
FROM component_field_bindings
WHERE status = 'scheduled' AND scheduledAt <= NOW()
ORDER BY scheduledAt
LIMIT 100;  -- batch
```

Pour chaque binding éligible, on exécute la promotion en transaction
(idem `POST /publish`). Si une promotion échoue (validation Zod
remontée du registre, par ex. après changement de schéma), on logue
un signal `field.schedule.failed` et **on laisse la ligne en
`scheduled`** pour intervention manuelle. L'écran admin la marque
en rouge.

### Annulation

```
POST /api/admin/components/[key]/fields/[fieldKey]/cancel-schedule
```

Renvoie `scheduled → draft`, NULL sur `scheduledAt`. History `unschedule`.

## Restauration

```
POST /api/admin/components/[key]/fields/[fieldKey]/restore
{ historyId: 'cfh_…' }
```

Crée un nouveau **draft** dont la valeur est celle du snapshot pointé.
**Ne publie pas** : l'admin doit ensuite cliquer « Publier ». C'est
volontaire — restaurer + publier en un seul clic est trop dangereux.

History `restore` mentionne le `historyId` source.

## Archivage

L'archivage **n'est pas exposé directement** à l'admin. Les bindings
deviennent archived automatiquement quand :

- un `published` est remplacé par un nouveau `published`,
- un `field` disparaît du registre (cf. EC1 dans A3),
- un composant entier est désactivé (`siteComponents.disabledAt` set).

L'admin peut **lister** les archives d'un champ (timeline) et **restaurer**.

## Rétention de l'historique

```
default: 90 jours
override: 365 jours pour rich-text et quote (contenu éditorial coûteux à recréer)
```

Le cron mensuel `/api/cron/purge-field-history` supprime les lignes
au-delà du seuil **sauf** :

- la dernière ligne de chaque binding (dernier état connu),
- les lignes pointant vers un binding `published` actuellement en place.

## Erreurs et conflits

### E1 — Publish d'un draft modifié entre temps

L'admin a chargé le draft avec `updatedAt = T`. À l'envoi, la DB
indique `updatedAt = T'  > T`. Le serveur renvoie `409 Conflict` avec
le draft actuel. L'UI propose **merge** (l'admin compare champ par
champ) ou **reload** (perd ses changements locaux).

### E2 — Publish d'un champ supprimé du registre entre temps

Même mécanique : 409 + message « le champ a été retiré du registre,
le binding sera marqué archived ». L'UI ferme l'éditeur de ce champ.

### E3 — Schedule dans le passé

Renvoyé `400 Bad Request` avec `errorCode = 'schedule.in_past'`.

### E4 — Restore d'un snapshot d'un champ supprimé

Renvoyé `409 Conflict` avec `errorCode = 'field.removed_from_registry'`.

### E5 — Race sur le cron de promotion

Le cron est idempotent : la transaction de promotion vérifie d'abord
`status = 'scheduled' AND scheduledAt <= NOW()`. Si un autre processus
a déjà promu, l'UPDATE retourne 0 rows et on passe au suivant.

## Observabilité

| Événement | Log structuré |
|---|---|
| Publication | `field.published` { componentKey, fieldKey, locale, version, actorId, durationMs } |
| Programmation | `field.scheduled` { componentKey, fieldKey, scheduledAt, actorId } |
| Promotion auto | `field.schedule.promoted` { componentKey, fieldKey, version } |
| Échec promotion | `field.schedule.failed` { componentKey, fieldKey, error } |
| Restauration | `field.restored` { componentKey, fieldKey, fromVersion, toVersion, actorId } |
| Conflit version | `field.conflict` { componentKey, fieldKey, expectedUpdatedAt, actualUpdatedAt } |

Les compteurs sont agrégés dans le panneau dev tools (cf. R5).

## Tests dédiés

- `versioning.spec.ts` (Vitest) — invariants I3, I4 sur transitions.
- `publish-flow.spec.ts` (Vitest + MSW) — happy path PATCH→publish.
- `schedule-flow.spec.ts` (Vitest) — mock du cron, idempotence.
- `restore.spec.ts` (Vitest) — restore from archive.
- `conflict.spec.ts` (RTL + MSW) — UI 409.
- `versioning.e2e.spec.ts` (Playwright) — un parcours bout en bout.

Cf. T2 et T5.
