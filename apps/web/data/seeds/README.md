# Data seeds

Fichiers de **données graines** utilisés par les scripts `scripts/seed-*.ts`
pour alimenter une base vide (ou via le runtime boot-seed en mode dev /
`AUTO_SEED=1`).

## Inventaire

| Fichier | Source | Volume | Consommé par |
| --- | --- | --- | --- |
| `delivery-cities-sendit.json` | Export Django table `delivery_gateway.senditcity` | 500 records → 429 villes uniques (dedup par slug, pk le plus petit gagne) | `scripts/seed-delivery-cities.ts`, intégré au boot-seed |

## Conventions

- Format : tableau JSON brut **non transformé** (on évite tout pré-traitement
  hors-process pour garder la pipeline auditable).
- Le **parsing + dedup** vit côté code (`apps/web/src/lib/checkout/delivery/
  cities-importer.ts`) — testable unitairement, sans I/O.
- Le **scribe DB** vit côté code (`apps/web/src/lib/db/queries/delivery-
  cities.ts:bulkUpsertDeliveryCities`) — idempotent, préserve les éditions
  admin (`source !== 'sendit'`).

## Réimporter un fichier mis à jour

1. Remplacer le fichier dans ce dossier (ou commit l'évolution).
2. `pnpm --filter @femiglow/web seed:delivery-cities` (ou bouton « Réimporter »
   dans `/admin/settings/delivery-cities`).
3. Vérifier le summary émis : `inserted`, `updated`, `skipped` (= éditions
   admin préservées) et `preservedSlugs`.

## Pourquoi pas un import direct depuis la DB Django ?

À terme oui — un endpoint sendit côté Django ou un export S3 nightly fera
sens. Pour l'instant le fixture sert de référence stable, et l'admin UI
permet de corriger ponctuellement sans toucher au fichier source.
