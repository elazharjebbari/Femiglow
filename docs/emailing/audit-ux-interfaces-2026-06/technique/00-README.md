# Volet technique — mise en œuvre du nouveau système d'interfaces emailing

> Ce volet transforme l'audit (`../01-synthese-executive.md`, matrice
> `../03-matrice-problemes.csv`, backlog `../04-backlog-ameliorations.yaml`)
> en **programme d'implémentation industrialisé** : architecture cible, modèle
> de données, plans de conception/développement/action, **stratégie de tests
> UI-first de niveau « grande agence »** (MSW + Vitest composant en masse,
> Playwright pour les parcours, oracles du point de vue opérateur), un
> sous-dossier par fonctionnalité avec batterie ultra-dense, et le runbook
> qui pilote l'exécution avec boucles de correction.

## Arborescence

| Chemin | Contenu | Format |
|---|---|---|
| `01-architecture-cible.md` | Architecture frontend/backend/data cible, principes, découpage en couches | md |
| `02-modele-donnees.md` | Plan data : colonnes/tables nouvelles, migrations additives, compatibilité | md |
| `03-plan-conception.md` | Processus de conception (wireframes→spec→revue), design tokens, critères d'acceptation UX | md |
| `04-plan-developpement.md` | Organisation du delivery : rôles, branches, definition of done, revues, CI | md |
| `05-strategie-tests.md` | **La pièce maîtresse** : pyramide UI-first, conventions MSW/Vitest/Playwright/axe, anti-flakiness, quality gates | md |
| `06-inventaire-fonctionnalites.csv` | Énumération EXHAUSTIVE des fonctionnalités (existantes/améliorées/nouvelles) → dossier de tests | csv |
| `07-plan-action-global.yaml` | Plan d'action exécutable : phases, étapes avec tests, boucles de correction, gates | yaml |
| `08-runbook.md` | Runbook opérateur qui PILOTE le plan d'action (commandes, oracles, journal) | md |
| `09-charte-ux-qualite.md` | **Barème relevé (2026-06-20)** : design haut calibre (tokens, primitives, états dessinés, responsive, non-régression visuelle), assistance à la saisie (autocomplétion partout), 8 dimensions de code → **gates G10–G15** | md |
| `10-inventaire-assistance.csv` | Inventaire transverse de l'assistance à la saisie (1 ligne/champ : mécanisme, validation inline, justification si non) — gate G11 | csv |
| `diagrammes/architecture-cible.puml` | Vue en couches + flux de test | puml |
| `modeles-code/` | Code de référence FONCTIONNEL (gold standard) : test composant MSW, spec Playwright, builders | tsx/ts |
| `fonctionnalites/F01…F10/` | **Un sous-dossier par fonctionnalité/chantier** (voir tableau ci-dessous) | mixte |

## Sous-dossiers fonctionnalités

Chaque dossier `fonctionnalites/Fxx-*/` contient le même quintuple :

1. `01-description.md` — fonctionnement **optimal** détaillé (UI, UX, design,
   data, backend) + tout ce qui doit être vérifié, du point de vue opérateur.
2. `02-spec-technique.yaml` — composants, props, routes API, schémas, états,
   événements, erreurs (contrat machine-readable).
3. `03-batterie-tests.csv` — batterie ultra-dense : unité / composant-MSW /
   intégration / E2E Playwright / a11y, avec oracles binaires.
4. `04-scenarios-metier.md` — scénarios métier complexes et réalistes
   (journées d'opérateur multi-écrans), mappés vers les E2E.
5. `05-plan-implementation.md` — étapes de dev AVEC tests à chaque étape
   (rouge→vert), risques, rollback.

| Dossier | Chantier audit | Périmètre |
|---|---|---|
| `F01-socle-feedback/` | C1 | ConfirmDialog, ToastProvider, EmptyState, Freshness, Wizard partagé, StatusBadge unifié, garde isDirty |
| `F02-navigation/` | C2 | Barre d'onglets persistante, badges compteurs, breadcrumb, palette enrichie |
| `F03-dashboard/` | C3a | KPI fenêtrés, auto-refresh, tri-état livraison, sparklines, santé |
| `F04-cockpit-transactionnel/` | C3b | Recherche/filtres, sélection globale, bulk, export serveur, vues, détail |
| `F05-campagnes/` | C4 | Wizard 6 étapes résilient, autosave, test send, TZ, orphelines, métriques |
| `F06-automations/` | C5 | Vue de flux, timeline instrumentée, dry-run, replay, R-031 |
| `F07-templates/` | C6 | Éditeur (CodeMirror, variables, mobile), autosave, versions/diff, delete |
| `F08-audiences/` | C7 | Rule builder validé, tags neutralisés, drift snapshots, modes documentés |
| `F09-suppression-events/` | C8 | Ajout manuel, filtres, bulk, export ; events corrélés |
| `F10-listmonk-observabilite/` | C9 | Health checks, sync persistée, dégradations honnêtes |

## Chiffres du programme (batteries livrées, statut `a_implementer`)

| Dossier | Tests | Dossier | Tests |
|---|---|---|---|
| F01 socle | 78 | F06 automations | 108 |
| F02 navigation | 63 | F07 templates | 122 |
| F03 dashboard | 94 | F08 audiences | 102 |
| F04 cockpit | 144 | F09 suppression-events | 102 (+1 note) |
| F05 campagnes | 149 | F10 listmonk | 64 |

**Total : 1 026 cas de test** — répartition conforme à la pyramide UI-first :
**618 composant-MSW (60 %)**, 216 unitaires, 112 intégration, 47 E2E Playwright,
33 a11y axe. S'ajoutent les ~1 700 tests emails existants maintenus verts (G2).

## Règles d'or du programme (résumé)

1. **UI-first** : la masse des tests est au niveau composant + MSW, écrite du
   point de vue de l'opérateur (ce qu'il voit, clique, lit) — jamais sur les
   détails d'implémentation. Requêtes réseau TOUJOURS mockées au contrat.
2. **Zéro faux succès** : chaque action réseau testée sur la grille
   `200 / 401 / 422 / 500 / hang / network-error` (helper `emailsFailWith`).
3. **Aucun test contre la prod** ([[deploy-infra-single-instance]]) : unit/
   composant en jsdom, intégration sur `femiglow_test*`, E2E sur instance dédiée.
4. **Boucle de correction systématique** : toute étape du plan d'action se
   termine par run de batterie → triage → fix → re-run → gate (cf. runbook §4).
5. **Non-régression** : la base existante (~1 700 tests emails) reste verte à
   chaque étape ; tout bug corrigé reçoit son test nominatif (`regression_ref`
   = ID de la matrice d'audit).
6. **Barème relevé (intransigeance UX + qualité)** : au-delà de la correction,
   chaque écran refondu satisfait `09-charte-ux-qualite.md` — design de très
   haut calibre (tokens uniques, primitives socle, états dessinés, responsive,
   snapshots visuels), **assistance à la saisie partout** (autocomplétion,
   smart defaults, validation inline), et les 8 dimensions de code (modulaire,
   évolutif, déboggable, maintenable, sécurisé, fiable, fonctionnel, optimal)
   érigées en **gates G10–G15** bloquants. Couches de batterie `D` (design) et
   `S` (sécurité) s'ajoutent à `U/C/I/E/A`.
