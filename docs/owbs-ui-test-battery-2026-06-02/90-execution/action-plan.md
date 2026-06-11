# 90 — Plan d'action global (exécuter la batterie)

> On ne vise **pas** un nombre de tests : on vise la **robustesse** (chaque risque
> high couvert) et le **réalisme** (parcours métier verts). Exécution par **vagues**,
> chaque vague pilotée par le [`runbook.md`](runbook.md) avec sa
> [`boucle de correction`](correction-loop.md).

## 0. Pré-vague — Harness partagé (bloquant)
- Créer `src/test/msw/handlers/owbs-ui.ts` (catalogue MSW, cf. tooling).
- Créer `e2e/_helpers/owbs.ts` (`openWizard`, `fillLead`, `fillAddress`, `throttle/abortOnce`, `measureTransition`, `captureBeacon`).
- Fixtures synthétiques + allowlist gitleaks du dossier.
- **Gate** : un test pilote (F01-S10) vert via les helpers.

## 1. Vagues (ordre = valeur × risque)

| Vague | Modules | Pourquoi en premier | Sortie |
|---|---|---|---|
| **V1 — Parcours nominal & optimiste** | F01, F02, F12 | cœur UX + parité legacy (anti-régression) | l'acheteuse avance sans gel ; flag OFF intact |
| **V2 — Robustesse réseau & zéro-perte** | F03, F04, F06 | le différenciateur d'OWBS (ne rien perdre) | retry/backoff/beacon/reload prouvés |
| **V3 — États dégradés & a11y/i18n** | F05, F08, F09 | qualité perçue + inclusion | indicateur non bloquant, AR/RTL, axe 0 |
| **V4 — Chat** | F07 | 2ᵉ funnel + valeur ROAS | succès immédiat + tracking valorisé |
| **V5 — Opérateur (admin)** | F10, F11 | **zone la moins testée** + GAP outbox | leads visibles ; outbox supervisable |
| **V6 — Sécurité & intégrité** | F13, F14 | invariants de confiance métier | rate-limit, idempotence, attribution |

Chaque vague :
1. Écrire les scénarios **P0** puis **P1** de ses modules (RTL → MSW → Playwright).
2. Faire passer au **vert** (boucle de correction sur chaque rouge réel).
3. Vérifier la **non-régression** du périmètre + `tsc`/`eslint`/gitleaks.
4. **Gate de vague** (cf. quality-gates) avant la suivante.

## 2. Règles d'écriture (rappel)
- Sélection par rôle/nom/`data-testid` ; oracle perceptible ; déterminisme.
- Un **garde-fou** par bug réel découvert (rouge utile avant fix).
- a11y + i18n systématiques sur les écrans concernés.

## 3. Décisions de build à trancher en cours de route
- **F05** : construire `WizardSyncIndicator` (recommandé) — c'est du code produit par la batterie.
- **F11** : construire la vue admin outbox **ou** acter la procédure SQL (RSK-15 high).
- **F08-S13** : déplacer le focus sur le titre d'étape si l'annonce a11y manque.

## 4. Critère de fin (release de la batterie)
- 100 % des fonctionnalités de l'inventaire ont ≥ 1 scénario P0 vert.
- Tous les risques `severity=high` couverts et verts.
- Zéro-perte prouvé chromium **+** webkit ; double-conversion impossible.
- Admin : lead optimiste visible ; effet `dead` détectable + rejouable.
- Boucle de correction convergée (0 défaut S1/S2 ouvert).
- Rapport final consigné ([`reporting-and-dashboards.md`](reporting-and-dashboards.md)).
