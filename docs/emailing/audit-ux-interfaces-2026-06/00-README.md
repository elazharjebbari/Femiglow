# Audit UX/UI — Interfaces de gestion des emails (2026-06-06)

> Audit intégral des 9 interfaces d'administration emailing de `/admin/emails/*`
> (code au commit `3447177`, master). Couvre : UI, UX, design, flux, fonctionnalités,
> états (loading/empty/error), accessibilité, i18n, écarts spec/implémentation,
> code mort/stubs — puis, pour chaque interface, des **améliorations proposées
> illustrées par wireframes** (état actuel → état cible).

## Comment naviguer ce dossier

| Fichier | Contenu | Format |
|---|---|---|
| `01-synthese-executive.md` | Constat global, scoring par interface, top 10 problèmes transverses | md |
| `02-inventaire-interfaces.json` | Inventaire machine-readable : routes, composants, APIs, features par interface | json |
| `03-matrice-problemes.csv` | **Matrice intégrale des 111 problèmes** identifiés (ID, sévérité, fichier:ligne, reco) | csv |
| `04-backlog-ameliorations.yaml` | Backlog priorisé en 10 chantiers (P0/P1/P2, effort, dépendances) | yaml |
| `05-design-system-conventions.txt` | Conventions visuelles observées + incohérences + tokens cibles | txt |
| `diagrammes/navigation.puml` | Carte de navigation actuelle vs cible | puml |
| `diagrammes/cycle-vie-transactionnel.puml` | Machine d'états outbox (11 statuts) telle qu'exposée à l'admin | puml |
| `diagrammes/cycle-vie-campagne.puml` | Machine d'états campagne + sync Listmonk | puml |
| `diagrammes/flux-automation.puml` | Flux automation : wizard → engine → runs (avec les gaps UI/engine) | puml |
| `interfaces/10-dashboard.md` | Dashboard `/admin/emails` — état actuel + wireframes + améliorations | md |
| `interfaces/11-transactionnel.md` | Cockpit transactionnel — idem | md |
| `interfaces/12-campagnes.md` | Campagnes (liste/détail/wizard 6 étapes) — idem | md |
| `interfaces/13-automations.md` | Automations (wizard 4 étapes, runs) — idem | md |
| `interfaces/14-templates.md` | Templates HTML (éditeur 3 colonnes, versions) — idem | md |
| `interfaces/15-audiences.md` | Audiences (rule builder, snapshots) — idem | md |
| `interfaces/16-suppression-events.md` | Suppression + Events (debug) — idem | md |
| `interfaces/17-listmonk.md` | Intégration Listmonk (iframe, sync, touchpoints) — idem | md |
| `technique/` | **Volet de mise en œuvre** : architecture cible, plan data, plans conception/dev/action, stratégie de tests UI-first, code modèle, runbook pilote, et **10 sous-dossiers fonctionnalités** (description optimale + spec YAML + batterie de 1 026 tests + scénarios métier + plan d'implémentation) | mixte |

## Conventions de lecture

- **IDs problèmes** : `DASH-xx` (dashboard), `CKPT-xx` (cockpit transactionnel), `CAMP-xx`
  (campagnes), `AUTO-xx` (automations), `TPL-xx` (templates), `AUD-xx` (audiences),
  `SUP-xx` (suppression), `EVT-xx` (events), `LMK-xx` (Listmonk), `TRV-xx` (transverse).
  La matrice CSV est la source de vérité ; les fiches interfaces y renvoient.
- **Sévérité** : `critique` (bloque/induit en erreur l'opérateur), `majeure` (friction
  forte ou feature attendue absente), `mineure` (polish), `info` (constat).
- **Wireframes** : ASCII, fidèles au DOM réel (libellés verbatim). `[btn]` = bouton,
  `(◉)/( )` = radio, `[x]/[ ]` = checkbox, `▼` = select, `⠿` = drag handle (cible).

## Périmètre & méthode

- Lecture exhaustive du code : `apps/web/src/app/admin/emails/**`,
  `apps/web/src/components/admin/emails/**`, `apps/web/src/app/api/admin/emails/**`,
  `apps/web/src/lib/mail/**`, `apps/web/src/lib/admin/emails/**` (8 passes parallèles).
- Croisement avec les specs existantes (`docs/emailing/04-frontend-admin.md`,
  `05-ui-ux-design.md`, `06-wizard-specification.md`) pour les écarts spec/implém.
- Hors périmètre : Listmonk natif (UI tierce), pages publiques (unsubscribe — citée
  uniquement comme flux alimentant la suppression), performances serveur.

## État de référence du système (contexte)

Au 2026-06-06 : infra emailing 100 % câblée (timers systemd, webhook Stalwart E2E
opérationnel depuis le 2026-06-05, filtre events). Le statut `delivered` commence
seulement à être alimenté → plusieurs interfaces affichent encore des compteurs
« Livrés » à 0 ou « n/d », ce qui pèse sur la lisibilité (cf. TRV-06, CAMP-02).
