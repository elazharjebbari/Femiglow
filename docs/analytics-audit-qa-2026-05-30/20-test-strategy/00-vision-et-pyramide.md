# 20.00 — Vision & pyramide de tests

## 1. Philosophie (standard agence)

> On teste le **comportement observable par l'opérateur**, pas l'implémentation. Chaque test part
> d'un **geste** (ouvrir un onglet, changer un filtre, exporter, rafraîchir, dériller) et vérifie
> une **conséquence** (chiffres justes, état correct, accessibilité). Un test qui passe doit
> **garantir** que l'opérateur ne sera pas trompé.

Trois exigences non négociables, dans l'esprit d'une grande ESN (Accenture/Capgemini/TCS/Infosys) :

1. **Robustesse** : aucun test « flaky ». Données déterministes (faker seedé), horloge figée
   (`now` injectée), réseau mocké (MSW), pas de dépendance à l'ordre d'exécution.
2. **Traçabilité** : chaque cas de test porte un ID relié à une fonctionnalité (`FN-*`) et, le cas
   échéant, à un finding (`AF-*`/`F-*`). Couverture pilotée par la `matrice-couverture.csv`.
3. **Valeur métier** : au-delà des cas unitaires, des **scénarios métier complets** modélisent un
   usage réel (« la fondatrice analyse la semaine et exporte »).

## 2. Pyramide (orientée UI mais équilibrée)

```
            ╱╲   E2E Playwright (UI / opérateur)  ── le cœur de la demande
           ╱  ╲   parcours réels, filtres, exports, drill-down, a11y
          ╱────╲  ~ scénarios métier + non-régression des findings
         ╱      ╲ Intégration MSW + composant (RTL + handlers)
        ╱        ╲  dashboards câblés a des réponses API réalistes
       ╱──────────╲ Unitaire Vitest (queries, format, filtres, attribution)
      ╱            ╲  justesse des calculs — la "vérité" des chiffres
     ╱──────────────╲
```

- **Base — Vitest unitaire** : la **justesse des chiffres** (queries `funnel/cta/checkout`,
  `attribution`, `format`, `resolveRange`, percentiles). C'est là qu'on verrouille AF-02, AF-03,
  AF-04, les findings de calcul. Rapide, exhaustif sur les edge cases.
- **Milieu — Composant + MSW** : on monte un Dashboard avec Testing Library, on **branche MSW** sur
  `/api/admin/analytics/*` pour renvoyer des réponses contrôlées, et on vérifie le **rendu** et les
  **états** (loading/empty/error) + le **refetch** sur changement de filtre (verrou AF-01 au niveau
  composant).
- **Sommet — Playwright** : le **point de vue opérateur** complet sur l'app réelle (ou mockée au
  niveau réseau). Parcours, persistance URL/localStorage, exports (téléchargement), drill-down,
  a11y (axe), responsive, RTL. C'est le filet de sécurité demandé.

## 3. Répartition cible par système

| Système | Vitest (justesse) | Composant+MSW (états/refetch) | Playwright (opérateur) |
|---|---|---|---|
| Funnel | médianes, cumul, sankey | refetch 3 endpoints, empty/error | changer filtres, lire drop-off, table |
| CTA | attribution, **revenu MAD** | refetch, badge isDeleted | revenu correct, top messages/pages |
| Checkout | percentiles, abandons, **progression** | refetch, histogramme | stepper, erreurs, export |
| Insights | aggregate, share/bounce | refetch toutes vues, drawer | refresh+lock, exports CSV/PNG, drill-down |
| Transverse | filtres, format, fuseau | primitives en interaction | navigation onglets, persistance, a11y |

## 4. Définition de « test robuste » (critères d'acceptation d'un test)

- [ ] **Déterministe** : faker seedé, `now` figée, MSW (pas de vrai réseau/DB), pas de `sleep`.
- [ ] **Isolé** : `resetForTests`/`server.resetHandlers()` entre chaque cas ; pas d'état partagé.
- [ ] **Orienté comportement** : assertions sur ce que voit l'opérateur (texte, rôle ARIA, valeur),
      pas sur des détails internes.
- [ ] **Lisible** : nommage `FN-xxx — <geste> -> <attendu>` ; Arrange/Act/Assert clair.
- [ ] **Anti-régression** : tout finding du registre a **au moins un** test qui échoue avant le fix
      et passe après.
- [ ] **Accessible** : les cas UI clés passent `axe` sans violation critique.

## 5. Indicateurs de succès de la batterie

- 100 % des findings P0/P1 couverts par un test de non-régression (cf. `findings-register.csv`).
- 100 % des fonctionnalités `FN-*` ont ≥ 1 test à leur niveau primaire (cf. `matrice-couverture.csv`).
- Couverture lignes des `lib/analytics/**` ≥ cible (`config/coverage-targets.yaml`).
- Suite e2e analytics verte et **stable** (0 flaky sur 3 exécutions consécutives).
