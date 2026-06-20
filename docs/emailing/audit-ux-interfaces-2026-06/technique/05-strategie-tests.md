# Stratégie de tests — UI-first, point de vue opérateur

> Doctrine : **la qualité se mesure là où l'opérateur travaille**. La masse des
> tests est donc au niveau composant (Testing Library + MSW), formulée en
> gestes et perceptions d'opérateur (« je clique sur Retry (3) », « je lis
> "3 relancés · 1 ignoré (statut non relançable)" »), avec un harnais
> Playwright pour les parcours transverses et une base unitaire pour la logique
> pure. Le nombre de tests n'est pas un objectif — la **couverture des modes de
> défaillance** l'est.

## 1. Pyramide (volumes cibles indicatifs sur l'ensemble du programme)

```
            E2E Playwright (~80-120 specs)        parcours métier multi-écrans,
           ────────────────────────────────       a11y pages, dégradations infra
          Intégration routes API (~150-200)       contrats réels ↔ femiglow_test
        ──────────────────────────────────────
       COMPOSANT + MSW (~900-1200)  ◄── LA MASSE  vue opérateur, grille réseau,
      ────────────────────────────────────────────  états, a11y jsdom
     Unitaires (~300-400)                          parsers, schémas Zod, maps,
    ────────────────────────────────────────────── compilateurs, formateurs
```

## 2. Couches — définitions, outils, conventions du repo

### 2.1 Unitaire (Vitest, node)
- Cibles : `filters-parser`, `rules-compiler`, schémas Zod, `kpi-format`,
  maps de statuts, helpers date/TZ, compilateur de trace `_trace`.
- Convention : co-localisés `__tests__/*.test.ts` ; AUCUN mock de module métier
  (on teste la vraie fonction) ; property-based léger (fast-check si déjà
  présent, sinon tables de cas) pour les parsers.

### 2.2 Composant + MSW (Vitest, jsdom) — **couche reine**
- Fichiers `*.msw.test.tsx` (ou `__qa__/*.msw.test.tsx` pour les suites de
  campagne QA) ; serveur partagé `@/test/msw/server` ; lifecycle **par
  fichier** (jamais global — politique `onUnhandledRequest` propre à la suite) :
  ```ts
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  ```
- Handlers : baseline `emailsHandlers` + overrides ; précédence MSW 2.x :
  dans UN MÊME `server.use(...)` le premier matchant gagne ; entre deux
  `server.use()` séparés, le dernier gagne.
- **Grille d'échecs OBLIGATOIRE par action réseau** (helper `emailsFailWith`) :
  `200 nominal · 401 · 422 · 500 · hang (delay infini → état chargement stable,
  pas de double-soumission) · network error`. Oracle central : **zéro faux
  succès** — un échec produit un message `role="alert"` visible, l'état
  utilisateur (sélection, saisie) est PRÉSERVÉ, et le feedback succès
  n'apparaît QUE sur `res.ok`.
- Sélecteurs par ordre de préférence : rôle+nom accessible (`getByRole('button',
  { name: /relancer/i })`) > label > testid (réservé aux compteurs/zones).
  JAMAIS de sélecteur de classe CSS.
- Horloge : `vi.useFakeTimers({ shouldAdvanceTime: true })` +
  `vi.setSystemTime` pour tout test de fraîcheur/debounce/auto-refresh.
- a11y jsdom : `axe` (`src/test/axe.ts`) en smoke sur chaque composant du socle.

### 2.3 Intégration routes API (Vitest, node + Postgres `femiglow_test`)
- Cibles : chaque nouvel endpoint (export, dry-run, suppression POST/bulk,
  nav-counters) + non-régression des existants.
- Vérifie : auth (`requireAdmin` → 401/403), validation Zod (422 avec détail),
  effet DB réel, audit-log émis, forme de réponse EXACTEMENT celle du handler
  MSW (test de **conformité contrat** : la réponse réelle parse avec le même
  schéma Zod que le mock — c'est lui qui empêche les mocks de mentir).

### 2.4 E2E Playwright (instance dédiée worktree + `femiglow_emailqa`, Mailpit)
- Un spec par scénario métier de `04-scenarios-metier.md` (IDs `SM-Fxx-nn`).
- Helpers existants : `e2e/_helpers/{emails-db,mailpit,unsub-token}.ts`.
- Dégradations infra simulées au niveau réseau de l'instance (Listmonk → port
  mort ; webhook silencieux) — suite `emails-degraded.spec.ts` à étendre.
- a11y : axe Playwright par page refondue, gate 0 serious/critical.
- **JAMAIS contre la prod** (pas d'isolation DB — règle absolue).

## 3. Patrons de test imposés (avec référence au code modèle)

Code de référence fonctionnel : `modeles-code/` (à copier-adapter, pas à
réinventer).

### 3.1 « Grille réseau » (modeles-code/exemple-composant-msw.test.tsx)
Chaque bouton qui déclenche un fetch/action a son bloc `describe('<action> —
grille réseau')` de 6 cas. Les cas hang vérifient : libellé « …en cours »,
`aria-busy`, bouton désactivé, AUCUN second POST émis sur double-clic
(compteur de requêtes MSW).

### 3.2 « Conformité de contrat » (modeles-code/exemple-contrat.test.ts)
Pour chaque endpoint : un test qui fait parser la réponse du handler MSW par
le schéma Zod de prod. Toute évolution de schéma casse d'abord ce test —
le mock ne peut pas dériver du réel.

### 3.3 « Parcours opérateur » composant (gros tests scénarisés)
Au-delà des cas unitaires d'écran, chaque Fxx a 3-8 tests composant LONGS qui
déroulent un mini-parcours réaliste dans un seul écran (ex. : « filtrer DLQ →
tout sélectionner → retry → 1 ignoré → corriger le filtre → re-tenter →
succès → la sélection est vidée → le KPI échecs décroît »). Ce sont les tests
qui attrapent les bugs d'enchaînement d'états que les cas atomiques ratent.

### 3.4 « Invariants du socle » (F01)
Tests partagés paramétrés (`describe.each`) appliqués à chaque écran adoptant
le socle : dialog Esc=annule, toast succès disparaît à 4 s, garde dirty
intercepte la navigation, Freshness affiche la TZ. Un écran qui adopte le
socle AJOUTE une ligne au `describe.each` — coût marginal quasi nul.

### 3.5 Données : factories only
Interdiction de littéraux d'objets métier dans les tests (sauf le champ testé) :
tout passe par `emails.factory.ts` + presets. Avantage : une évolution de
schéma se corrige en un point.

## 4. Anti-flakiness (budget : 0 test flaky toléré en CI)

1. Pas de `setTimeout`/`waitForTimeout` — waits sémantiques (`findBy*`,
   `expect.poll`, `toPass`).
2. Horloge contrôlée pour debounce (600 ms preview templates, 800 ms preview
   audiences, 4 s toasts, 5 s auto-refresh) : `vi.advanceTimersByTime`.
3. MSW `delay('infinite')` pour les états de chargement (jamais de course).
4. E2E : états initiaux posés par helpers DB (pas par UI quand évitable),
   `test.step()` pour le triage, retries=1 avec politique « retry = bug ».
5. Tout test flaky détecté : quarantaine `fixme` AVEC ticket dans le journal
   du runbook, délai de correction 48 h — jamais de re-run silencieux.

## 5. Quality gates (chiffrés, bloquants)

| Gate | Seuil | Où |
|---|---|---|
| G1 Batterie du Fxx courant | 100 % vert | chaque PR |
| G2 Suite emails globale | 100 % vert (~1700 existants + nouveaux) | chaque PR |
| G3 Coverage socle `ui/` | ≥ 85 % lignes/branches | CI |
| G4 Coverage écrans refondus | ≥ 80 % lignes | CI |
| G5 tsc + lint + **next build** | 0 erreur | chaque PR |
| G6 axe | 0 violation serious/critical | CI (jsdom) + fin de chantier (E2E) |
| G7 Grille réseau | 6/6 cas présents pour chaque action réseau (vérifié par revue + grep des describe '— grille réseau') | revue |
| G8 E2E scénarios métier de la phase | 100 % vert | fin de phase |
| G9 Contrats | 100 % des endpoints touchés ont leur test de conformité | revue |
| **G10 Design** | checklist design (`09 §A.7`) signée + snapshots visuels 3 viewports verts + verrou couleur (0 classe hors `ui/tokens.ts`) | revue de phase + CI (couche D) |
| **G11 Assistance** | `10-inventaire-assistance.csv` à jour ; 0 champ assistable nu non justifié ; verrou `EntityCombobox` décroissant | revue + CI (cliquet) |
| **G12 Sécurité** | checklist sécurité verte + `/security-review` sur le diff de phase (0 finding bloquant) + batterie `Fxx-S-nnn` verte | fin de phase + PR |
| **G13 Performance** | budgets par écran (bundle gz / requêtes DB / p95 route) non dépassés ; build échoue si bundle hors budget ; EXPLAIN/borne en intégration | CI + intégration |
| **G14 Observabilité** | 100 % des actions d'écriture loguées (`<domaine>.<action>`, sans champ `event`) + correlation-id propagé (test logger espionné) | revue + CI |
| **G15 Modularité** | 0 import croisé inter-sections (lint AST) ; conformité contrats TOTALE (pas seulement endpoints touchés) ; maps exhaustives ; barrel `ui/` | CI + revue |

> Référence détaillée des gates G10–G15 (design haut calibre, autocomplétion
> partout, 8 dimensions de code) : **`09-charte-ux-qualite.md`**.

## 6. Traçabilité batterie ↔ audit ↔ code

- Chaque ligne de `fonctionnalites/Fxx/03-batterie-tests.csv` porte :
  `id` (ex. `F04-C-031`), `couche`, `regression_ref` (ID matrice
  ou `nominal`/`metier`), `statut` (`a_implementer` → `implemente`).
- **Couches** : `U` (unitaire) · `C` (composant+MSW) · `I` (intégration route) ·
  `E` (E2E) · `A` (a11y) · **`D` (design — snapshot visuel/contraste/tokens/
  responsive, gate G10)** · **`S` (sécurité — sanitization/CSV-injection/authz
  exhaustive/rate-limit/redaction PII/concurrence, gate G12)**. Le comptage
  mécanique du runbook accepte donc `[UCIEADS]` dans la regex d'ID.
- Le nom du test dans le code COMMENCE par son ID : `it('F04-C-031 — export
  serveur : 422 affiche le détail de validation', …)` → croisement grep
  bidirectionnel CSV↔code, et le runbook peut compter l'avancement
  mécaniquement (`grep -r "F04-C-" --include="*.test.*" | wc -l`).

## 7. Revue de testabilité des oracles

Un oracle est valide s'il est : (a) observable par l'opérateur OU par le
contrat réseau ; (b) binaire ; (c) indépendant de l'implémentation interne.
Exemples refusés en revue : « le state X vaut Y », « la fonction f est
appelée » (sauf navigation mockée). Exemples valides : « le bouton affiche
"Relance…" et est désactivé », « un POST et UN SEUL est parti vers /bulk-retry
avec ids=[a,b] », « la ligne a@x.com est toujours visible après l'échec ».
