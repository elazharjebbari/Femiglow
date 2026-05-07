# A2 — Modèle de données

## ERD

```
                                       ┌─────────────────┐
                                       │ admin_users     │
                                       │  (existant)     │
                                       └────────┬────────┘
                                                │
                                                │ author_id
                                                ▼
┌─────────────────────┐ 1   n  ┌─────────────────────────┐
│ site_components     │────────│ component_field_bindings│
│  (existant, +fields)│        │  (statut, value, locale)│
└──────────┬──────────┘        └────────────┬────────────┘
           │                                │ 1
           │ 1                              │
           │                                │ n
           │                                ▼
           │                       ┌──────────────────────────┐
           │                       │ component_field_history  │
           │                       │  (append-only versioning)│
           │                       └──────────────────────────┘
           │
           │ n           (existant)            (existant)
           ├──────► component_media_bindings ────► media
           │
           └──────► component_animation_bindings ─► component_animations
```

## Table : `site_components` (extension)

> Ajout du champ `fields: ComponentFieldDefinition[]`. La table reste
> synchronisée par `seed-pipeline.ts` à partir du registre TS.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `fields` | jsonb (`ComponentFieldDefinition[]`) | NOT NULL DEFAULT `[]` | Définition des champs éditoriaux. Source de vérité = registry TS. |

**Aucune autre colonne ne change.**

## Type : `ComponentFieldDefinition` (TS, registre)

```ts
type FieldType =
  | 'text'         // string court (titre, kicker, label)
  | 'multiline'    // string multiligne (excerpt, paragraphe)
  | 'rich-text'    // markdown sanitizé (body éditorial)
  | 'cta'          // { label, href, variant?, icon? }
  | 'link'         // { href, label?, external? }
  | 'icon'         // string (clé d'icône autorisée)
  | 'color-token'  // 'creme' | 'champagne-soft' | …
  | 'number'       // n
  | 'boolean'      // bool
  | 'enum'         // value parmi config.options
  | 'list'         // (List<T>) tableau du type config.itemType
  | 'record'       // (Record<{...}>) sous-objet typé via config.shape
  | 'kicker'       // alias text + style
  | 'quote'        // { text, author }
  | 'breadcrumb-segment'; // { label, href }

interface FieldTypeConfig {
  // text/multiline/rich-text
  minLength?: number;
  maxLength?: number;
  placeholder?: string;

  // rich-text
  allowedTags?: string[];   // sanitization
  allowedHrefSchemes?: ('http'|'https'|'mailto'|'tel')[];

  // cta
  variants?: ('primary'|'secondary'|'ghost'|'inline')[];

  // icon
  iconRegistry?: string;    // 'lucide' | 'femiglow-curated'

  // color-token
  tokenSet?: 'background'|'text'|'border'|'all';

  // number
  min?: number; max?: number; step?: number;

  // enum
  options?: { value: string; label: string }[];

  // list
  itemType?: FieldType;
  itemConfig?: FieldTypeConfig;
  minItems?: number; maxItems?: number;

  // record
  shape?: Record<string, { type: FieldType; config?: FieldTypeConfig; required?: boolean }>;
}

interface ComponentFieldDefinition {
  /** Clé stable, ex 'title', 'subtitle', 'cta'. Jamais renommée. */
  key: string;
  label: string;            // affiché en admin
  type: FieldType;
  required: boolean;        // si true, defaultValue obligatoire
  /** Valeur par défaut. Source de vérité éditoriale tant qu'un binding
   *  publié ne l'a pas surchargée. */
  defaultValue?: unknown;
  description?: string;     // help text en admin
  /** Section logique pour grouper les champs en admin (Tabs/Accordéons). */
  group?: string;           // ex 'Hero', 'CTA', 'Footer'
  /** Ordre d'affichage en admin (asc). Défaut : ordre de déclaration. */
  order?: number;
  config?: FieldTypeConfig;
  /** Indique au rendu si on doit pouvoir 'fall back' silencieusement
   *  (true) ou afficher un placeholder dev (false). Défaut: true. */
  fallbackToDefault?: boolean;
}
```

## Table : `component_field_bindings`

> Une ligne = la **valeur courante** (draft, published, ou scheduled)
> d'un champ d'un composant pour une locale donnée. Plusieurs lignes
> peuvent coexister pour le même couple `(componentId, fieldKey, locale)` :
> au maximum **une seule** par statut.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | text | PK | `cfb_<uid>` |
| `componentId` | text | FK `site_components.id` ON DELETE CASCADE | |
| `fieldKey` | text | NOT NULL | Doit matcher `ComponentFieldDefinition.key`. |
| `locale` | text | NOT NULL DEFAULT `'fr'` | BCP-47. Forcé `'fr'` en v1. |
| `value` | jsonb | NOT NULL | Valeur typée selon `field.type` (cf. encodage ci-dessous). |
| `status` | enum `field_binding_status` | NOT NULL DEFAULT `'draft'` | `draft`, `published`, `scheduled`, `archived`. |
| `version` | integer | NOT NULL | Auto-incrémenté par `(componentId, fieldKey, locale)`. |
| `publishedAt` | timestamp | | Set à la transition vers `published`. |
| `scheduledAt` | timestamp | | Date cible si `status='scheduled'`. |
| `notes` | text | | Note interne facultative. |
| `authorId` | text | FK `admin_users.id` ON DELETE SET NULL | Auteur de la version. |
| `createdAt` | timestamp | NOT NULL DEFAULT now() | |
| `updatedAt` | timestamp | NOT NULL DEFAULT now() | |

### Index

```sql
CREATE UNIQUE INDEX cfb_publish_uniq
  ON component_field_bindings (componentId, fieldKey, locale)
  WHERE status = 'published';

CREATE UNIQUE INDEX cfb_draft_uniq
  ON component_field_bindings (componentId, fieldKey, locale)
  WHERE status = 'draft';

CREATE INDEX cfb_lookup
  ON component_field_bindings (componentId, fieldKey, locale, status);

CREATE INDEX cfb_scheduled
  ON component_field_bindings (status, scheduledAt)
  WHERE status = 'scheduled';
```

### Encodage `value` (jsonb)

```jsonc
// type=text       → { "v": "Le rituel du soir." }
// type=multiline  → { "v": "ligne 1\nligne 2" }
// type=rich-text  → { "v": "## Sous-titre\nUn paragraphe…" }    // markdown
// type=cta        → { "label": "Découvrir", "href": "/rituel", "variant": "primary" }
// type=link       → { "href": "/rituel", "label": "Découvrir", "external": false }
// type=icon       → { "v": "sun" }
// type=color-token → { "v": "creme-warm" }
// type=number     → { "v": 5 }
// type=boolean    → { "v": true }
// type=enum       → { "v": "morning" }
// type=list       → { "items": [<itemValue>, …] }
// type=record     → { "fields": { "<key>": <fieldValue>, … } }
// type=kicker     → { "v": "Notre rituel" }
// type=quote      → { "text": "…", "author": "Salma" }
// type=breadcrumb-segment → { "label": "Maison", "href": "/maison" }
```

L'enveloppe constante `{ "v": … }` (pour les scalaires) ou typée
(pour les composés) facilite l'évolution : ajouter `style` à un
`text` plus tard ne casse pas les lignes existantes.

## Table : `component_field_history`

> Append-only. Une ligne par version créée d'un binding (transition
> draft→published, édition d'une version archivée, etc.).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | text | PK | `cfh_<uid>` |
| `bindingId` | text | FK `component_field_bindings.id` ON DELETE CASCADE | |
| `version` | integer | NOT NULL | Snapshot de la version. |
| `value` | jsonb | NOT NULL | Snapshot de la valeur. |
| `status` | enum `field_binding_status` | NOT NULL | Statut au moment du snapshot. |
| `actorId` | text | FK `admin_users.id` ON DELETE SET NULL | Qui a fait l'opération. |
| `action` | enum `field_history_action` | NOT NULL | `create`, `update`, `publish`, `unpublish`, `restore`, `archive`. |
| `notes` | text | | |
| `createdAt` | timestamp | NOT NULL DEFAULT now() | |

**Politique de rétention** : conservation 90 jours. Au-delà, purge
automatique cron mensuel (cf. `runbook/05-incident-response.md`).

## Enums

```ts
type FieldBindingStatus = 'draft' | 'published' | 'scheduled' | 'archived';
type FieldHistoryAction = 'create' | 'update' | 'publish' | 'unpublish' | 'restore' | 'archive';
```

## Invariants

### I1 — Au plus un `published` par triplet

À tout instant, pour un `(componentId, fieldKey, locale)`, il existe
**au plus un** binding `status='published'`. Garanti par index unique.

### I2 — Au plus un `draft` par triplet

Idem pour `draft`. Garanti par index unique. Si l'admin ré-ouvre un
brouillon, on **réutilise** la ligne `draft` existante.

### I3 — Le `version` est strictement croissant par triplet

Chaque transition vers une nouvelle valeur incrémente `version`. La
ligne historisée pointe sur l'ancien `version`. Pas de trou.

### I4 — `scheduledAt` requis si `status='scheduled'`

Garanti par contrainte CHECK SQL.

### I5 — `publishedAt` set par le serveur, jamais par le client

L'admin n'envoie jamais `publishedAt`. Le serveur le set au moment
du `POST /publish`.

### I6 — Si `defaultValue` est absent et `required=true`, le composant ne *résout pas*

Le résolveur lève une erreur en dev (panneau rouge dev), affiche un
placeholder muet en prod. Cf. A3.

### I7 — Soft-delete uniquement

Ni `component_field_bindings` ni `component_field_history` n'ont de
suppression physique. `archive` = changement de statut.

## Migration depuis l'existant

L'existant n'a aucun champ éditorial en DB. Stratégie en 2 temps :

1. **Phase 1** : ajouter les tables + le pipeline de seed. Toutes
   les lignes seedées en `status='published'` à la valeur `defaultValue`
   du registre. **Le rendu public ne change pas** : il continue de
   lire la valeur comme avant (cf. A3 : la cascade tombe sur
   `defaultValue` si pas de binding).

2. **Phase 2** : pour chaque composant, on déclare ses fields dans
   le registre en y mettant la valeur actuellement codée en dur
   comme `defaultValue`. Puis on remplace les littéraux par
   `<ComponentField>`. Le rendu reste identique tant qu'aucun admin
   n'a touché aux valeurs.

Cf. `runbook/04-rollout.md` pour le détail composant par composant.

## Statistiques attendues

À régime de croisière (6 mois après mise en production) :

- ~30 composants en registre.
- ~8 fields par composant en moyenne.
- ~240 bindings `published` (1 par couple).
- ~30 bindings `draft` (concurrents).
- ~5 bindings `scheduled` à un moment donné.
- ~5 000 lignes d'historique (purge à 90 j).

Volume négligeable pour Postgres ; la perf vient du cache RSC, pas
de la DB.

## Croisements avec l'existant

| Existant | Lien |
|----------|------|
| `siteComponents` | colonne `fields` ajoutée |
| `componentMediaBindings` | inchangé, coexiste |
| `componentAnimationBindings` | inchangé, coexiste |
| `media` | inchangé |
| Tag `unstable_cache` | `components` reste, on ajoute `components:fields:<key>` |
| `revalidateTag('components')` | continue de tout invalider (option nucléaire) |
| `seed-pipeline.ts` | **étendu** pour insérer aussi les bindings `published` initiaux |
