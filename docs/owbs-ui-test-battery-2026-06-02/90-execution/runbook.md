# 90 — Runbook d'exécution de la batterie

> Pilote l'exécution **vague par vague** jusqu'au vert intégral. Commandes
> exactes : [`commands.txt`](commands.txt). Boucle de correction :
> [`correction-loop.md`](correction-loop.md).

## 0. Pré-requis
- [ ] Branche de travail depuis `feat/owbs-lead-background` (ou master après merge OWBS).
- [ ] DB de test (pglite) + build prod local `:3100` **flag-ON** disponible (cf. §3).
- [ ] Harness partagé créé (pré-vague du plan d'action).

## 1. Boucle invariante (par scénario)
1. Écrire le test (oracle perceptible, sélection par rôle/testid).
2. **Lancer** (cible étroite) → observer rouge **utile** (si garde-fou de bug).
3. Implémenter/corriger (code produit : F05 indicateur, F11 vue, focus a11y…).
4. Re-lancer → vert. **Non-régression** du fichier/dossier.
5. `tsc` + `eslint` + gitleaks. Cocher la matrice.

## 2. Séquence des vagues
| Vague | Commande de validation (cf. commands.txt) | Gate |
|---|---|---|
| V1 | `vitest run` F01/F02 + `playwright` owbs-ui-wizard-* | UX optimiste + parité legacy verts |
| V2 | `vitest run` F03/F04 + `playwright` owbs-ui-network/zeroloss | retry/beacon/reload + **webkit** zéro-perte |
| V3 | `vitest run` F05/F08/F09 (a11y/axe) + e2e degraded/i18n | indicateur non bloquant + axe 0 |
| V4 | `vitest run` F07 (LeadFormBubble.*) | success immédiat + value préservée |
| V5 | `vitest run` admin + e2e admin-leads ; F11 worker + supervision | leads visibles ; outbox supervisable |
| V6 | `vitest run` sync/route + intégration F14 | rate-limit + idempotence + attribution |

## 3. Environnement e2e (build flag-ON)
```
lsof -ti:3100 | xargs -r kill ; sleep 2
CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true pnpm build
CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED=true PORT=3100 pnpm start
```
> Rebuild **obligatoire** après tout changement client testé en e2e (`:3100` sert un build figé).
> Pour les scénarios **legacy** (F12-S02), un build **flag-OFF** séparé est requis.

## 4. Multi-navigateur (gate zéro-perte)
- F04-S03 (beacon webkit, R-07) : élargir le `testMatch` cross-browser et lancer `PLAYWRIGHT_CROSS=1 … --project=webkit`.

## 5. Sortie de vague
- Tous les P0/P1 de la vague verts ; non-régression OK ; défauts S1/S2 = 0 ouverts.
- Mettre à jour le tableau de bord ([`reporting-and-dashboards.md`](reporting-and-dashboards.md)).
- Commit (un par vague ou par module), gitleaks ok.

## 6. Clôture
- Critère de fin du plan d'action atteint → statut dossier `EXECUTED`.
- Rapport final (couverture risques, défauts, décisions de build prises).
