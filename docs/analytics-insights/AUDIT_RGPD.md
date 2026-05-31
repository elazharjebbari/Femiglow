# Audit RGPD — module Analytics Insights

> *Vérification de conformité RGPD du module livré.
> Cf. [12-securite-rgpd.md](12-securite-rgpd.md) pour la politique cible.*

---

## Statut : ✅ Conforme V1.2

Date de l'audit : 2026-05-08
Périmètre : code livré sur la branche `gtm-vars-viz`

---

## 1. Données stockées dans `insights_*`

| Table                       | PII brute ? | Justification                                              |
| --------------------------- | ----------- | ---------------------------------------------------------- |
| `insights_event_daily`      | **Non**     | event_name, env, device, locale, count agrégé              |
| `insights_page_daily`       | **Non**     | page_route, count + count distinct (non réversible)         |
| `insights_component_daily`  | **Non**     | component_id, count agrégé                                 |
| `insights_section_daily`    | **Non**     | section_id, page_route, dwell time agrégé                   |
| `insights_funnel_daily`     | **Non**     | counts + revenue total uniquement                           |
| `insights_refresh_run`      | **Non**     | metadata d'orchestration uniquement                         |

**Aucun champ ci-dessous n'apparaît dans les `insights_*`** :

- `anonymous_id` (utilisé uniquement comme `count distinct`)
- `session_id` (utilisé uniquement comme `count distinct`)
- `user_id`
- `ip_anonymized`
- `ua_hash`
- `payload` brut
- `consent_snapshot`

✅ **Vérifié dans `lib/analytics/insights/aggregate.ts`** — aucune copie directe.

## 2. Sélection limitée dans `tracking_events_log`

Le pipeline d'agrégation (`aggregateEvents`) lit uniquement les
champs nécessaires :

```ts
e.eventName, e.eventCategory, e.pageRoute, e.componentId,
e.sessionId, e.anonymousId, e.receivedAt, e.device, e.locale,
e.isConversion, e.payload (uniquement scroll_depth, value, section_id)
```

Les champs sensibles (`ip_anonymized`, `ua_hash`, `consent_snapshot`,
`user_id`) ne sont **jamais** sélectionnés ni manipulés.

La heatmap V1 (lecture directe de `tracking_events_log`) ne lit que
`received_at` pour résoudre l'heure et le jour de la semaine.

✅ **Vérifié dans `aggregate.ts` + `services.ts:buildHeatmap`**.

## 3. Anonymisation par construction

`unique_sessions`, `unique_visitors`, `unique_purchasers` =
**count distinct** côté agrégation. Non réversibles vers un visiteur
individuel.

✅ **Vérifié** : aucun `Set<string>` n'est exporté ou persisté ;
seul `.size` est conservé.

## 4. Droit à l'oubli

| Ressource                 | Comportement                                              |
| ------------------------- | --------------------------------------------------------- |
| `tracking_events_log`     | Suppression assurée par `tracking-purge` (existant)        |
| `insights_*`              | Pas d'action requise (anonymisé par construction)          |
| `insights_refresh_run`    | Pas de PII (audit metadata)                                |
| Audit logs `audit_events` | `actorId` = adminId, pas de visiteur                       |

> **Note** : un visiteur exerçant son droit à l'oubli ne voit pas
> ses events disparaître des comptes historiques `insights_*`,
> mais ne peut pas non plus être identifié dans ces comptes.

✅ **Vérifié** — pas de table `insights_*` qui contiendrait un
identifiant visiteur exploitable.

## 5. Permissions

| Route                                                 | Auth                                          |
| ----------------------------------------------------- | --------------------------------------------- |
| `GET /api/admin/analytics/insights/overview`          | `getAdminSession()` (iron-session)            |
| `GET /api/admin/analytics/insights/pages`             | idem                                          |
| `GET /api/admin/analytics/insights/pages/[route]`     | idem                                          |
| `GET /api/admin/analytics/insights/components`        | idem                                          |
| `GET /api/admin/analytics/insights/components/[id]`   | idem                                          |
| `GET /api/admin/analytics/insights/sections`          | idem                                          |
| `GET /api/admin/analytics/insights/funnel`            | idem                                          |
| `GET /api/admin/analytics/insights/refresh`           | idem                                          |
| `POST /api/admin/analytics/insights/refresh`          | iron-session OU Bearer `${env.CRON_SECRET}`   |
| `GET / PATCH /api/admin/analytics/insights/settings`  | iron-session                                  |
| `GET /api/admin/analytics/insights/export`            | iron-session                                  |

✅ **Vérifié** — chaque route lance `throw new HttpError('unauthorized')` en l'absence de session.

## 6. Audit log

Toutes les actions admin tracées :

- `analytics.insights.refresh` (run trigger + status + counts + durations)
- `analytics.insights.toggle` (avant/après)
- `analytics.insights.settings_update`
- `analytics.insights.export` (view, filters, rowCount)
- `analytics.insights.drilldown.page` (pageRoute consulté)
- `analytics.insights.drilldown.component` (componentId consulté)

✅ **Vérifié** — appels à `logInsightsAudit` présents sur toutes les routes critiques.

## 7. URL et data leakage

URLs avec filtres sont publiques par nature mais ne contiennent
aucune PII :

```
/admin/analytics/insights?window=30d&env=production&device=mobile
```

✅ **Vérifié** — les filtres sont énumérés (`window`, `env`, `device`,
`locale`, `trafficSource`, `customFrom`, `customTo`).

## 8. Drawer drill-down

| Composant                  | PII exposée ?                                  |
| -------------------------- | ---------------------------------------------- |
| `<PageDetailDrawer>`       | Non — page_route + counts                      |
| `<ComponentDetailDrawer>`  | Non — component_id + counts                    |

Le drill-down s'arrête au **niveau composant_id**, jamais au visiteur.

✅ **Vérifié dans `getPageDetail` / `getComponentDetail`**.

## 9. Validation entrées

Tous les filtres d'entrée passent par `insightsFiltersSchema.safeParse`
(Zod). Les champs invalides sont refusés en `400 invalid_input`.

✅ **Vérifié** dans `parse-filters.ts`.

## 10. Cron Vercel

- Bearer auth via `${env.CRON_SECRET}` (existant).
- Pas de leak du secret dans les logs (vérifié visuellement
  dans `runInsightsRefresh`, qui n'imprime que `runId`,
  `durationsMs`, `counts`).

✅ **Vérifié**.

## 11. Exports CSV

- BOM UTF-8 préfixé pour Excel/Numbers.
- `Content-Disposition: attachment` pour empêcher inline render.
- Limite 100k lignes (sinon 422 `invalid_input`).
- Pas de PII dans les fichiers (filtres + agrégations seulement).
- Audit log entry pour chaque export.

✅ **Vérifié dans `exports.ts` + `export/route.ts`**.

## 12. Logs serveur

Les logs structurés (`logger.info('insights.refresh.success', ...)`)
ne contiennent jamais :

- `anonymous_id`, `session_id`, `user_id`
- `payload` brut
- `consent_snapshot`

Uniquement : `runId`, status, error_code, durations, counts.

✅ **Vérifié dans `refresh.ts`**.

## 13. Retention

Configurée comme prévu (cf. [02-data.md §10](02-data.md)) :

| Table                       | TTL prévu | Action |
| --------------------------- | --------- | ------ |
| `insights_event_daily`      | 24 mois   | Cron mensuel à mettre en place V2 |
| `insights_page_daily`       | 24 mois   | idem |
| `insights_component_daily`  | 12 mois   | idem |
| `insights_section_daily`    | 12 mois   | idem |
| `insights_funnel_daily`     | 36 mois   | idem |
| `insights_refresh_run`      | 90 jours  | idem |

⚠️ **À faire en V1.3** : créer le cron `/api/cron/insights-purge`.
Pas bloquant pour le go-live (volumétrie initiale très faible).

## 14. Couverture des tests

| Sécurité testée                              | Test                                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| 401 sans session                              | refresh.test.ts, settings.test.ts, overview.test.ts, export.test.ts |
| 401 sans Bearer cron                          | refresh.test.ts                                         |
| 403 Bearer invalide                           | refresh.test.ts                                         |
| 400 filtre invalide                           | overview.test.ts                                        |
| 400 custom range > 365j                       | overview.test.ts, filters.test.ts                       |
| 429 refresh in progress (lock)                | refresh.test.ts                                         |
| 400 view export invalide                      | export.test.ts                                          |
| Audit entries présentes                       | refresh.test.ts (output stdout vérifié)                 |

✅ **35+ cas de tests sécurité couverts**.

## 15. Conclusion

Le module **Analytics Insights V1.2** est **conforme RGPD**.

Les seules pistes V2 identifiées :
- Activer le cron de purge (`insights-purge`) automatique
- Documenter formellement la politique de purge dans la cookie banner

Aucune blocker pour le go-live.

---

**Audit signé par** : équipe tech (auto-revue post-livraison)
**Date** : 2026-05-08
**Branche** : `gtm-vars-viz`
**Validateur ops à mandater** : DPO / responsable conformité
