# Locale Switcher V2 — « Le voile de langue »

> **Dossier de delivery intégral** : conception → design → data → backend → frontend → admin → tests → plan d'action → runbook.
> Objet : un changement de langue (FR / AR / EN, AR = RTL) **propre, élégant, sans rechargement**, sur **tout le site client ET l'admin**, qui **améliore l'expérience et le taux de conversion**, dans la sobriété de la charte FemiGlow.
>
> Base de réflexion : [`../i18n-strategy-2026-05/05-ui-ux-design/locale-switcher-v2-conversion-dossier.md`](../i18n-strategy-2026-05/05-ui-ux-design/locale-switcher-v2-conversion-dossier.md) (analyses comparatives + proposition finale).
> Ce dossier-ci transforme cette proposition en **plan exécutable, testé, non régressif**.

---

## 0. Comment lire ce dossier

Chaque sous-dossier décrit **un aspect**, avec :
1. **Le fonctionnement optimal visé** (ce qui doit se passer, idéalement).
2. **Les éléments à vérifier / tester** (sous tous les angles : fonctionnel, perf, a11y, RTL, régression, sécurité, data).
3. Des fichiers au **format le plus parlant** pour le contenu (`.md` narratif, `.puml` diagrammes, `.json`/`.yaml` contrats, `.csv` matrices/plans, `.txt` checklists brutes).

**Ordre de lecture recommandé** : `00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09`.
**Ordre d'exécution** : piloté par [`09-runbook/runbook.md`](09-runbook/runbook.md), qui orchestre [`08-plan-action/plan-action.md`](08-plan-action/plan-action.md).

---

## 1. Arborescence

```
docs/locale-switcher-v2/
├── README.md                         ← vous êtes ici (index + contrat partagé)
├── CONTRACT.md                       ← SOURCE DE VÉRITÉ (vocabulaire, tokens, schémas, events)
├── 00-vision/
│   ├── overview.md                   ← problème, ambition, périmètre client+admin
│   ├── goals-kpis.md                 ← objectifs UX/conversion + KPI mesurables
│   └── scope-raci.csv                ← périmètre In/Out + responsabilités
├── 01-conception/
│   ├── decisions-adr.md              ← ADR (choix d'architecture tranchés)
│   ├── architecture.puml             ← vue composants client + admin + backend
│   ├── sequence-switch.puml          ← séquence d'une bascule sans reload
│   ├── sequence-nudge.puml           ← séquence du nudge contextuel
│   └── state-machine.puml            ← machine à états de la transition
├── 02-design-ui-ux/
│   ├── design-tokens.json            ← motion / couleurs / typo / espacements
│   ├── components-spec.md            ← specs visuelles des variantes
│   ├── rtl-choreography.md           ← chorégraphie du retournement LTR↔RTL
│   ├── interaction-states.csv        ← états (idle/hover/focus/open/active…)
│   └── accessibility-checklist.md    ← WCAG, clavier, SR, reduced-motion
├── 03-data/
│   ├── config-schema.yaml            ← config admin-éditable (Zod-mappable)
│   ├── admin-config-model.md         ← modèle de données + migration
│   ├── events-telemetry.json         ← contrat des events analytics
│   └── fixtures.json                 ← jeux de données de test
├── 04-backend/
│   ├── api-contracts.md              ← endpoints config + détection
│   ├── endpoints.openapi.yaml        ← contrat OpenAPI
│   └── server-detection.md           ← résolution Accept-Language (nudge, no-flash)
├── 05-frontend/
│   ├── component-architecture.md     ← arbre composants + responsabilités
│   ├── use-locale-transition.md      ← spec du hook (cœur no-reload)
│   └── integration-points.md         ← points de montage client + admin
├── 06-admin/
│   ├── admin-feature-spec.md         ← UI admin de pilotage du switcher
│   └── admin-permissions.md          ← rôles, garde-fous, audit
├── 07-tests/
│   ├── test-strategy.md              ← stratégie pyramidale + critères de robustesse
│   ├── vitest-plan.csv               ← plan unit/intégration (Vitest)
│   ├── playwright-plan.csv           ← plan E2E (Playwright) FR/AR/EN + RTL
│   ├── msw-handlers.md               ← handlers MSW (mocks réseau)
│   └── coverage-matrix.csv           ← matrice exigence ↔ test (traçabilité)
├── 08-plan-action/
│   ├── plan-action.md                ← étapes détaillées (chaque étape = code + test)
│   ├── backlog.csv                   ← backlog ordonnancé (lots L0…Ln)
│   └── dependencies.puml             ← graphe de dépendances des lots
└── 09-runbook/
    ├── runbook.md                    ← exécution pas-à-pas du plan
    ├── test-loop.md                  ← boucle batterie de tests → correction → re-vérif
    ├── rollback.md                   ← procédure de repli
    └── delivery-checklist.txt        ← checklist finale de livraison
```

---

## 2. Principes de qualité (non négociables)

| Principe | Traduction concrète |
|---|---|
| **Robuste / fiable** | Tout chemin a un fallback (View Transitions → voile framer → application directe → reload de secours hors-ligne). Aucun état « cassé ». |
| **Non régressif** | Le wizard checkout (CHA-231), le scan i18n (`0` latin /ar, `0` FR-leak), et le SEO hreflang restent intacts. Tests de garde dédiés. |
| **Modulaire** | 1 hook (`useLocaleTransition`) + 1 composant (`LocaleSwitcher`) + 1 config. Aucune logique dupliquée client/admin. |
| **Maintenable / débogable** | Tokens centralisés (`design-tokens.json`), config typée (`config-schema.yaml`), events nommés (`events-telemetry.json`), ADR tracés. |
| **Fonctionnel d'abord** | Chaque étape du plan se termine par un test **vert** avant la suivante. La boucle test→fix→re-vérif est obligatoire (runbook). |
| **Accessible** | WCAG 2.1 AA, clavier complet, `aria-live` de bascule, `prefers-reduced-motion`, sans-JS dégradé. |
| **Sobre (charte)** | Switcher = neutres uniquement, aucun pop chaud, aucune pulse ; motion 280–560 ms, courbes douces. |

> **Critère de robustesse (pas le nombre de tests)** : on vise la **couverture des chemins et des angles** (fonctionnel, RTL, a11y, perf, régression, data, sécurité, hors-ligne), pas un compteur. Voir [`07-tests/test-strategy.md`](07-tests/test-strategy.md).

---

## 3. Le contrat partagé

Toute la conception s'appuie sur **un seul** fichier source de vérité : [`CONTRACT.md`](CONTRACT.md).
Il fige : le **vocabulaire**, les **noms de composants/hooks/events**, les **clés de config**, les **tokens**, les **invariants**. Tout fichier de ce dossier (et tout code produit) doit s'y conformer. En cas de divergence, **`CONTRACT.md` fait foi**.

---

## 4. Statut & portée

- **Client (website)** : header, drawer mobile, footer, nudge contextuel, transition no-reload.
- **Admin** : page de pilotage (activer/désactiver une locale, libellés endonymes, activer le nudge, ordre, prévisualisation), derrière permission, avec audit.
- **Backend** : endpoints de config (lecture publique cachée + écriture admin), résolution serveur de la langue suggérée (sans flash).
- **Data** : table de config + contrat d'events analytics.
- **Tests** : Vitest (unit/intégration) + Playwright (E2E FR/AR/EN + RTL) + MSW (mocks réseau) + axe (a11y) + garde-fous de non-régression.
