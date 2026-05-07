# Component-Media — modèle de données

## Tables

### `site_components`

Source de vérité des composants éditoriaux du site.

| Colonne                  | Type        | Notes                                                  |
| ------------------------ | ----------- | ------------------------------------------------------ |
| `id`                     | text PK     | `cmp_*` (createId).                                    |
| `key`                    | text UNIQUE | ex. `home-hero`, `journal-article-cinq-minutes`.       |
| `name`                   | text        | Nom humain.                                            |
| `description`            | text        |                                                        |
| `category`               | enum        | hero, card, gallery, banner, section, media-block.     |
| `pageGroup`              | enum        | home, rituel, kit, maison, journal, shared.            |
| `filePath`               | text        | Chemin source — pour debug.                            |
| `slots`                  | jsonb       | `SlotDefinition[]` (key, label, acceptKinds, …).       |
| `defaultSvgFallback`     | text NULL   | Path public, ex. `/svg/hero.svg`.                      |
| `defaultLoadingStrategy` | enum        | eager / viewport / idle / interaction.                 |
| `defaultFetchPriority`   | enum        | high / low / auto.                                     |
| `supportsAnimation`      | bool        |                                                        |
| `metadata`               | jsonb       | Libre. Inclut souvent `animationProfile`.              |

**Sync** : `upsertSiteComponentFromSeed` upsert depuis le registry TS sur la
clé `key`. Pas de delete automatique — un composant retiré du registry reste
en DB jusqu'à action manuelle (cf. runbook).

### `component_media_bindings`

Rattachement d'un `media` à un slot.

| Colonne              | Type        | Notes                                                            |
| -------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                 | text PK     | `bnd_*`.                                                          |
| `componentId`        | text FK     | → `site_components.id`.                                           |
| `slot`               | text        | Doit appartenir à `site_components.slots[].key`.                  |
| `mediaId`            | text FK NULL | → `media.id`. NULL = binding « éteint ».                         |
| `loadingStrategy`    | enum NULL   | Override de la stratégie du composant.                            |
| `fetchPriority`      | enum NULL   | Override.                                                         |
| `priority`           | bool        | Hint Image priority (LCP).                                        |
| `placeholderStrategy`| enum        | svg / blurhash / palette / none.                                  |
| `customAlt`          | text NULL   | Override de `media.alt`.                                          |
| `displayOrder`       | int         | Pour les slots multi.                                             |
| `isActive`           | bool        | **`false` par défaut sur upsert** (rollback safe).                |
| `notes`              | text NULL   | Champ libre admin.                                                |

**Contrainte UNIQUE** : `(componentId, slot)` — un seul binding par slot.
Pour « désactiver sans supprimer » : `setBindingActive(id, false)`.

**Validation business** :

- `slot` doit exister dans `siteComponent.slots` (sinon 400).
- `media.kind` doit être inclus dans `slot.acceptKinds` (sinon 400).
- Avec `mediaId=null` : autorisé, le binding est « éteint » mais persistant
  (utile si on veut conserver l'override `loadingStrategy` pour ce slot).

### `component_animations`

Profils d'animation canoniques. Sept entrées seedées depuis
`animations-registry.ts`.

| Colonne                  | Type        | Notes                                                |
| ------------------------ | ----------- | ---------------------------------------------------- |
| `id`                     | text PK     | `anm_*`.                                              |
| `key`                    | text UNIQUE | none, fade-in, reveal-up, scale-hover, parallax-soft, schema-svg, cross-link. |
| `name`                   | text        | Nom humain.                                           |
| `kind`                   | enum        | none / framer-motion / css / svg.                     |
| `description`            | text        |                                                       |
| `config`                 | jsonb       | Props pour le profil (initial, whileInView, …).       |
| `respectsReducedMotion`  | bool        |                                                       |
| `previewSnippet`         | text NULL   | Code snippet pour la fiche du catalogue.              |

### `component_animation_bindings`

Rattachement composant ↔ animation.

| Colonne       | Type    | Notes                                                              |
| ------------- | ------- | ------------------------------------------------------------------ |
| `id`          | text PK | `anb_*`.                                                            |
| `componentId` | text FK | → `site_components.id`.                                             |
| `animationId` | text FK | → `component_animations.id`.                                        |
| `isDefault`   | bool    | **Au plus un `isDefault=true` par `componentId`** — exclusivité gérée par `upsertAnimationBinding`. |
| `params`      | jsonb   | Override des `config` de l'animation pour ce binding spécifique.    |

**Contrainte UNIQUE** : `(componentId, animationId)` — pas de doublon.

## Relations

```
site_components 1 ── ∞ component_media_bindings  ∞ ── 1 media
                1 ── ∞ component_animation_bindings  ∞ ── 1 component_animations
```

## Index recommandés

- `component_media_bindings (componentId)` — fetch tous les bindings d'un composant.
- `component_media_bindings (mediaId)` — détecter les usages d'un media (delete cascade).
- `component_animation_bindings (componentId, isDefault)` — résolution rapide du default.

## Cache layer

- Tag `components` (Next.js `unstable_cache`).
- Toute mutation invalide via `revalidateTag('components')`.
- TTL implicite = vie du process Next, mais en pratique
  `force-dynamic` sur les routes admin évite le pinning.
