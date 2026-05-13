# Tracking improvement — Statut d'implémentation

> Snapshot post-implémentation des 4 chantiers, à jour du commit head sur
> la branche `feat/tracking-improvement`. À mettre à jour à chaque
> nouveau déploiement.

## Décision majeure de scope

**Google Ads server-side CAPI hors scope** (décidé en démarrage de
session 2026-05-13). Conséquences :

- Phase 3 (`phase-3-google-ads-server`) **entièrement skippée**
- Tâches abandonnées : T15, T16, T17, T18 du `dev-plan.csv`
- T19 (`resolveEventCategory`) et T20 (dispatcher propagate event_id) ont été réaffectés à Phase 6 et Phase 4 respectivement
- Critères de succès C1.F.1, C1.F.2, C1.F.3, C1.T.1-4 → reportés à un cycle futur

## Statut par chantier

### Chantier 1 — Pipeline conversion

| Critère | État | Notes |
|---|---|---|
| C1.F.1 — purchase server-side Google Ads | ⏭ skippé | Décision scope |
| C1.F.2 — déduplication event_id | ✅ structurel | event_id propagé, déduplication côté providers OK ; pas testé en prod sans CAPI |
| C1.F.3 — résilience ad-blocker | ⏭ skippé | Pas de fallback server |
| C1.F.4 — form_start au premier focus /kit + /commander | ✅ livré | T10/T11 wired |
| C1.F.5 — begin_checkout plus au mount | ✅ livré | T12 dans LeadCaptureStep + CheckoutFlow |
| C1.F.6 — lead_capture isConversion | ✅ livré | T01 dans `/api/track` |

### Chantier 2 — GTM Editor UX

| Critère | État | Notes |
|---|---|---|
| C2.F.1 — bouton Importer Providers | ✅ livré | T25 dans GtmConfigForm |
| C2.F.2 — SyncIndicator ✅/⚠ | ✅ livré | T24 nouveau composant |
| C2.F.3 — bouton Modifier ouvre form pré-rempli | 🟡 partiel | Form accepte `initial` + `seedFrom='version'` ; UI host à raccrocher au listing |
| C2.F.4 — Sauvegarder modif crée nouvelle version | ✅ structurel | `gtmConfigStore.clone()` opérationnel + note D-003 dans le form |
| C2.F.5 — Récap diff avant sauvegarde | 🟡 partiel | Diff implicite via SyncIndicator par champ ; pas de récap side-by-side dédié |

### Chantier 3 — Catégorisation conversions

| Critère | État | Notes |
|---|---|---|
| C3.F.1-4 — page categorization | ✅ livré | T27 + T29 |
| C3.T.1 — table tracking_event_overrides + FK | ✅ livré | Migration 0030 |
| C3.T.2 — resolveEventCategory + coverage | ✅ livré | T19 + 9 tests unit |
| C3.T.3 — Google Ads adapter utilise resolveEventCategory | ⏭ skippé | Cf. décision scope |

### Chantier 4 — Observabilité

| Critère | État | Notes |
|---|---|---|
| C4.F.1 — page analytics/providers | ✅ livré | T31 + T33 |
| C4.F.2 — Chart "Conversions par jour" | ⏭ différé | recharts non câblé, données numériques suffisent au MVP |
| C4.F.3 — drill-down event échoués | ⏭ différé | Hors itération courante |
| C4.T.1-2 — agg SQL directe + refresh 30s | ✅ livré | UNNEST(providers_dispatched) + setInterval |
| C4.T.3 — Consent Mode v2 propagation | ✅ livré | T34 : gtag + dataLayer + fbq + ttq |

## Migrations DB appliquées

| Migration | But | État |
|---|---|---|
| 0028 | `gclid` column on tracking_events_log + index | ✅ écrite, à appliquer en prod |
| 0029 | enum `google_ads_category` + colonne default + seed | ✅ écrite |
| 0030 | table `tracking_event_overrides` | ✅ écrite |
| 0031 | extend providers config JSONB | ⏭ skippée (scope) |

## Commits livrés (branche `feat/tracking-improvement`)

```
e1ad7db feat(tracking): phase 1 quick wins (T01/T07/T09/T14)
dfdc0f4 feat(tracking): phase 2 migrations 0028-0030 + schema sync
810ef98 feat(tracking): phase 4 form_start emission + begin_checkout refactor
f2aa51a feat(tracking): phase 5 GTM editor UX (T21/T22/T23/T24/T25)
9a884f6 feat(tracking): phase 6 categorization UI (T19/T27/T28/T29/T30)
763885c feat(tracking): phase 7 observability (T31/T32/T33/T34)
89e3a38 test(tracking): phase 8 — clone tests + SyncIndicator + ULTIMATE pipeline e2e scaffold
```

## Tag de rollback

```
git tag pre-tracking-improvement-2026-05-13  # commit afa5393 sur master
```

Procédure rollback : voir `80-runbook/rollback.md`.

## Suite — avant déploiement prod

1. Lancer `pnpm --filter @femiglow/web db:migrate` en staging et vérifier les migrations 0028-0030
2. Lancer la suite Vitest complète et le seul test e2e ULTIMATE en staging
3. Exécuter `bash apps/web/scripts/smoke-tracking.sh https://staging.femiglow-maroc.com`
4. Vérifier `/admin/tracking/events/categorization` charge et l'override persiste
5. Vérifier `/admin/tracking/analytics/providers` charge et refresh 30s

T51 (déploiement prod) et T52 (monitoring 7j) **nécessitent accès prod** et restent à exécuter manuellement par l'équipe ops en suivant `80-runbook/deployment.md`.
