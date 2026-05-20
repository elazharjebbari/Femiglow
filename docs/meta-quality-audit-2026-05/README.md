# Audit qualité Meta Pixel + CAPI — Plan d'exécution complet

> **Contexte** : Meta Events Manager a signalé 2 dégradations qualité le 2026-05-18 :
> 1. Purchase value/currency à **81 %** (au lieu de ≥ 95 %) — 37 campagnes affectées.
> 2. Couverture CAPI ViewContent insuffisante — **7 881 events de moins** côté serveur que côté Pixel sur 7 jours.
>
> Cet ensemble de docs **décrit la correction complète** : design, dev, tests, runbook.
> Exécution prévue dans le worktree isolé `/.claude/worktrees/webhook` (branche dédiée + DB séparée).

## Index des documents

| # | Fichier | Contenu |
|---|---|---|
| **0** | [`AUDIT-META-QUALITY.md`](./AUDIT-META-QUALITY.md) | Audit initial — analyse, root causes, comparaison d'approches, choix recommandé |
| **1** | [`01-design-conception.md`](./01-design-conception.md) | Architecture cible — backend, frontend, data, UI/UX, modules |
| **2** | [`02-plan-dev-action.md`](./02-plan-dev-action.md) | Plan d'action détaillé — 3 phases, ~25 étapes, gates de test intercalés |
| **3** | [`03-tests-strategy.md`](./03-tests-strategy.md) | Stratégie de tests — Vitest unit, MSW providers, Playwright E2E, smoke prod |
| **4** | [`04-runbook.md`](./04-runbook.md) | Runbook d'exécution — commandes pas-à-pas, validations, rollback |

## Principes d'ingénierie

Ce chantier respecte 7 principes durs :

1. **Non-régressif** : chaque étape termine sur build + typecheck + tests verts. Aucune étape ne casse une autre.
2. **Modulaire** : enricher, guard, server-emit, deriveEventId sont chacun des **fonctions pures isolées** avec leur propre fichier + test.
3. **Robuste** : fail-closed côté Purchase (skip + log plutôt qu'envoyer un event corrompu), fail-open côté ViewContent (mieux 1 fois extra que 0 fois).
4. **Fiable** : event_id déterministe = dédup correcte côté Meta même en cas de re-fire.
5. **Maintenable** : aucune logique dupliquée entre call-sites, helpers réutilisables pour les futures pages produit.
6. **Pertinent** : on traite la root cause Zod laxiste + asymétrie client-only, pas les symptômes.
7. **Fonctionnel** : chaque phase a une **assertion observationnelle prod** (vue SQL ou Meta Events Manager) pour confirmer le succès.

## Estimation effort

| Phase | Durée dev | Durée observation | Cible |
|---|---|---|---|
| **P1** — Quick wins Purchase value/currency | ~3 h | 24 h | Qualité Purchase 81 % → ≥ 97 % |
| **P2** — Server-side ViewContent fire | ~5 h | 7 j | Couverture CAPI ViewContent ≥ 95 % |
| **P3** — Durcissement (schéma strict + dedup persist) | ~2 h | post-P1+P2 stables | Verrou définitif |
| **Total** | **~10 h dev** | — | — |

## Critères de done

- [ ] Branche `feat/meta-quality-fix` mergée sur master après les 3 phases.
- [ ] Vue SQL `v_purchase_quality` montre ≥ 97 % qualité sur 24 h post-déploiement P1.
- [ ] Meta Events Manager affiche ≥ 95 % de match CAPI/Pixel sur ViewContent 7 j post-P2.
- [ ] Aucune régression sur les autres pixels (Snap, TikTok, GA4) — leurs counts restent dans ±5 % d'avant.
- [ ] Coverage unit tests sur `lib/tracking/` ≥ 90 % (vitest --coverage).

---

> **Convention de référence** : ce dossier suit la convention `composition-reveal-optim-2026-05/` (multi-fichiers, numérotés, README index, runbook séparé).
