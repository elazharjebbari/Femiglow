# 02 — Design & Conception

Architecture cible détaillée + data model + URL strategy + flow diagrams.

## Fichiers

| Fichier | Contenu | Format |
|---|---|---|
| [`architecture-cible.puml`](./architecture-cible.puml) | Diagramme d'architecture complet (couches) | PlantUML |
| [`data-model.md`](./data-model.md) | Schema DB pour i18n (extensions component_field_bindings, legal_pages, etc.) | Markdown + SQL |
| [`translation-keys-schema.json`](./translation-keys-schema.json) | JSON Schema des messages | JSON |
| [`url-strategy.md`](./url-strategy.md) | Path-based routing détaillé + cas limites | Markdown |
| [`locale-detection.md`](./locale-detection.md) | Algo de détection (path > cookie > header > IP > default) | Markdown |
| [`flow-diagrams.puml`](./flow-diagrams.puml) | 6 flows utilisateurs (visit, switch, edit admin, ...) | PlantUML |
| [`api-contracts.md`](./api-contracts.md) | Signatures des helpers next-intl + custom | Markdown |
| [`naming-conventions.md`](./naming-conventions.md) | Conventions clés (namespace.subkey) + fallback | Markdown |
| [`sample-messages-files.yaml`](./sample-messages-files.yaml) | Exemple messages fr/ar/en | YAML |

## Principes design

1. **Type-safety** : compile-time check via TypeScript module augmentation
2. **Fallback chain** : si AR manque clé → FR (jamais clé brute affichée à l'utilisateur)
3. **Separation of concerns** :
   - Messages **statiques** (UI, copy marketing) → JSON files (`messages/`)
   - Messages **dynamiques** (content CMS) → DB (`component_field_bindings.locale`)
4. **DRY** : 1 namespace par section (`marketing.hero.title`, `wizard.lead.label`)
5. **No magic** : pas d'inférence sur des strings, tout en clé explicite
6. **Future-proof** : architecture supporte 1 → 50 locales sans refonte
