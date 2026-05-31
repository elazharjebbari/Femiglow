# 12 — Sécurité & RGPD

> *PII, droit à l'oubli, audit log, permissions*

---

## 1. Principes

- **Privacy by design** : aucune PII brute n'entre dans `insights_*`.
- **Need-to-know** : permissions par rôle, drill-down borné.
- **Auditabilité** : toute action est tracée.
- **Cookieless friendly** : les events sans consentement statistiques
  ne sont pas comptés en `unique_visitors`.

## 2. Données dans les pré-agrégations

| Champ                  | PII ?                                  | Usage                                         |
| ---------------------- | -------------------------------------- | --------------------------------------------- |
| `event_name`           | Non                                    | dimension                                      |
| `page_route`           | Non (URL canonique sans QS)             | dimension                                      |
| `component_id`         | Non                                    | dimension                                      |
| `count`                | Non                                    | métrique                                       |
| `unique_sessions`      | Non (count distinct, non réversible)    | métrique                                       |
| `unique_visitors`      | Non (count distinct anonymous_id)       | métrique                                       |
| `device`, `locale`     | Non                                    | dimension                                      |
| `env`                  | Non                                    | dimension                                      |

**Ce qui n'est jamais stocké** :
- `anonymous_id` brut
- `session_id` brut
- `user_id`
- `ip_anonymized` brut
- `ua_hash` brut
- `payload` (peut contenir des chiffres financiers, etc.)
- `consent_snapshot`

## 3. Source `tracking_events_log`

La table source contient des champs sensibles (cf. doc tracking).
Notre pipeline d'agrégation ne lit que les colonnes nécessaires :

```sql
SELECT
  event_name, event_category, page_route, component_id,
  date_trunc(...), env, device, locale,
  count(*), count(distinct session_id) -- agrégation, pas exposition
FROM tracking_events_log
```

Les champs sensibles (`ip_anonymized`, `ua_hash`, `payload`,
`consent_snapshot`) ne sont **jamais** sélectionnés par le pipeline
insights.

## 4. Droit à l'oubli

Quand un visiteur exerce son droit à l'oubli :

1. Suppression de ses entrées dans `tracking_events_log`
   (cf. doc tracking).
2. **Pas de suppression dans `insights_*`** : les agrégations sont
   anonymisées par construction (count distinct, pas réversible).
3. Les comptes seront naturellement réajustés au prochain refresh
   incrémental.

> **Important** : un visiteur qui demande l'oubli après un
> refresh ne peut pas voir ses events disparaître des comptes
> historiques (mais ne pourra pas non plus être identifié dans
> ces comptes).

## 5. Permissions

### 5.1 Rôles

| Rôle                     | Accès                                                  |
| ------------------------ | ------------------------------------------------------ |
| `admin`                  | Tout (refresh, settings, exports, drill-down)           |
| `analytics-viewer`       | Lecture seule, drill-down, exports                       |
| `support-agent`          | Overview + Pages seulement, pas de drill-down            |
| Anonyme                  | 401                                                     |

### 5.2 Vérification

```ts
// helper réutilisable
async function requireAnalyticsRole(
  request: Request,
  minRole: 'support-agent' | 'analytics-viewer' | 'admin' = 'analytics-viewer',
): Promise<AdminSession> {
  const session = await getAdminSession(request);
  if (!session) throw new HttpError('unauthorized');
  if (!hasMinRole(session, minRole)) throw new HttpError('forbidden');
  return session;
}
```

## 6. Audit log

Toutes les actions admin enregistrées dans `admin_audit_log` :

| Action                                | Métadonnées                                           |
| ------------------------------------- | ----------------------------------------------------- |
| `analytics.insights.refresh`           | runId, trigger, durations, counts                       |
| `analytics.insights.export`            | view, window, env, rows                                 |
| `analytics.insights.toggle`            | oldState, newState                                       |
| `analytics.insights.settings_update`    | patches (intervalMinutes…)                              |
| `analytics.insights.drilldown.page`    | pageRoute                                                |
| `analytics.insights.drilldown.component` | componentId                                            |

Conservation 90 jours (purge cron existant).

## 7. URL et data leakage

### 7.1 Filtres URL

Les filtres URL sont publics par nature :

```
/admin/analytics/insights?window=30d&env=production&device=mobile
```

Pas de PII dans ces URLs. Pas de risque de partage involontaire.

### 7.2 Drawer drill-down

Le drawer (`<PageDetailDrawer>`, `<ComponentDetailDrawer>`)
expose au max :

- Top events sur la page / le composant (count seul)
- Mini time-series (counts seuls)
- Aucun visiteur identifiable

## 8. Validation entrées

Toutes les routes utilisent Zod en `safeParse` :

```ts
const parsed = insightsFiltersSchema.safeParse(searchParams);
if (!parsed.success) {
  throw new HttpError('invalid_input', parsed.error.message);
}
```

Pas d'injection SQL (Drizzle paramétrise tout).

## 9. Cron Vercel

- Bearer secret `${env.CRON_SECRET}` (existant).
- Si bearer absent → 401.
- Si bearer invalide → 403.
- Logs Vercel ne contiennent jamais le secret.

## 10. Exports

- Fichiers CSV générés à la volée, pas stockés.
- BOM UTF-8 préfixé pour Excel/Numbers.
- `Content-Disposition: attachment` empêche le rendu inline.
- Limite 100k lignes par export pour éviter le DoS.
- Audit log entry pour chaque export.

## 11. Logs

Les logs serveur ne contiennent jamais :
- `anonymous_id`
- `session_id`
- `user_id`
- payload brut

Seulement : route, status, duration, run id, error code.

## 12. Conformité RGPD — checklist

- [ ] Pas de PII brute dans les tables `insights_*`
- [ ] `unique_*` sont `count distinct`, non réversibles
- [ ] Droit à l'oubli s'applique à `tracking_events_log` uniquement
- [ ] Audit log présent pour toutes les actions admin
- [ ] Permissions par rôle vérifiées
- [ ] Validation Zod sur toutes les entrées
- [ ] Bearer secret pour le cron
- [ ] Filtres URL sans PII
- [ ] Drawer drill-down borné au component_id
- [ ] Logs serveur épurés
- [ ] Exports tracés
- [ ] Retention configurée (24/12/36 mois selon tables)

## 13. Lecture suivante

- [00 — Cahier des charges](00-cahier-des-charges.md) §3 pour les
  contraintes RGPD initiales.
- [02 — Couche data](02-data.md) §11 pour les détails RGPD du schéma.
- [11 — Runbook](11-runbook.md) §1 pour les contrôles d'accès opérationnels.
