# Architecture cible — interfaces emailing admin

## 1. Principes directeurs

1. **RSC pour la donnée, client pour l'interaction** (déjà la norme du repo) :
   les pages restent des Server Components `force-dynamic` qui hydratent des
   composants clients ; toute mutation passe par server actions (`'use server'`)
   ou routes API admin existantes — on n'introduit AUCUN nouveau paradigme.
2. **Un socle UI partagé avant tout** : les composants C1 (`ConfirmDialog`,
   `ToastProvider`, `EmptyState`, `Freshness`, `Wizard`, `Pill`) vivent dans
   `src/components/admin/emails/ui/` et sont les SEULS autorisés pour leurs
   usages — règle lint (voir §5).
3. **Contrats API stables et testables** : chaque nouvel endpoint a son schéma
   Zod partagé (`lib/mail/**/schemas.ts`), consommé par la route, le client ET
   les handlers MSW (une seule source de vérité de forme).
4. **Migrations additives uniquement** (single-instance, ~2 s de restart, pas
   de blue-green) : nouvelles colonnes nullable/DEFAULT, jamais de DROP/RENAME
   dans ce programme. Cf. `02-modele-donnees.md`.
5. **Observabilité par construction** : toute nouvelle action émet un log
   `logger.info('<domaine>.<action>', fields)` — interdiction du champ `event`
   dans fields (collision logger documentée, cf. mémoire projet).

## 2. Vue en couches

```
┌────────────────────────────────────────────────────────────────────────────┐
│ NAVIGATION (C2)   app/admin/emails/layout.tsx                              │
│   <EmailsTabs/> + <GlobalCommandPalette/> + <ToastProvider/> (C1)          │
├────────────────────────────────────────────────────────────────────────────┤
│ PAGES RSC (une par section)                                                 │
│   fetch serveur (queries lib/admin/emails/*) → hydrate clients              │
├────────────────────────────────────────────────────────────────────────────┤
│ COMPOSANTS CLIENTS de section                                               │
│   TransactionalCockpit · CampaignWizard · AutomationWizard/FlowView ·       │
│   TemplateEditor · AudienceWizard · SuppressionList · EventsDashboardView   │
│        ▲ consomment exclusivement ▼                                         │
│ SOCLE UI (C1)  components/admin/emails/ui/                                  │
│   ConfirmDialog · Toast · EmptyState · Freshness · Wizard · Pill ·          │
│   use-dirty-guard · tokens sémantiques                                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ACCÈS DONNÉES                                                               │
│   server actions wizard/automation/template  ·  routes /api/admin/emails/*  │
│   schémas Zod partagés (source des handlers MSW de test)                    │
├────────────────────────────────────────────────────────────────────────────┤
│ DOMAINE  lib/mail/*  (outbox, campaigns, automation, audiences, templates,  │
│   suppression, listmonk, webhooks)  — INCHANGÉ sauf points listés en §4     │
├────────────────────────────────────────────────────────────────────────────┤
│ DATA  Drizzle/Postgres (schema-emails.ts) · Listmonk API · Stalwart webhook │
└────────────────────────────────────────────────────────────────────────────┘
```

Diagramme rendu : `diagrammes/architecture-cible.puml`.

## 3. Nouveaux modules frontend

| Module | Rôle | Consommateurs |
|---|---|---|
| `ui/ConfirmDialog.tsx` | dialog accessible (focus trap, Esc, variante danger, saisie de confirmation optionnelle) | remplace les 9 `window.confirm` |
| `ui/toast.tsx` (`ToastProvider`, `useToast`) | succès auto-dismiss 4 s / erreur persistante + action | toutes mutations |
| `ui/EmptyState.tsx` | icône+titre+cta | toutes listes |
| `ui/Freshness.tsx` | âge relatif + TZ + auto-refresh optionnel (`visibilitychange`-aware) | dashboard, détail campagne, cockpit |
| `ui/Wizard.tsx` + `useWizard` | étapes cliquables ≤ validées, persistance étape, Ctrl+←/→, focus management | campagnes, automations, audiences |
| `ui/Pill.tsx` + maps de domaine | pastille sémantique unique (`tone: success/warning/danger/info/neutral`) | tous les badges de statut |
| `ui/use-dirty-guard.ts` | beforeunload + interception navigation | éditeur template, wizards |
| `EmailsTabs.tsx` | barre d'onglets + badges compteurs (endpoint `/api/admin/emails/nav-counters`) | layout |
| `automation/FlowView.tsx` | rendu arborescent des steps (read-only V1) | revue wizard + détail automation |
| `templates/CodeEditor.tsx` | wrapper CodeMirror (lazy: `next/dynamic`, fallback textarea) | TemplateEditor |

## 4. Nouveaux contrats backend (résumé — détail dans chaque `02-spec-technique.yaml`)

| Endpoint / action | Méthode | Rôle | Dossier |
|---|---|---|---|
| `/api/admin/emails/nav-counters` | GET | compteurs onglets (dlq, runs erreur, sync KO) — cache 30 s | F02 |
| `/api/admin/emails/transactional/export` | POST | export CSV **serveur** streamé sur filtres (pas d'ids) | F04 |
| `/api/admin/emails/transactional/bulk-retry-by-filter` | POST | retry de l'ensemble des résultats d'un filtre (cap 10 000, dry-count d'abord) | F04 |
| `summary?window=24h\|7d\|30d` (extension) | GET | fenêtres dashboard + série queued | F03 |
| action `sendCampaignTestViaOutbox` | server action | test send corps libre via pipeline transactionnel | F05 |
| action `saveWizardProgress` | server action | autosave debounced (payload partiel + `wizard_step`) | F05 |
| `/api/admin/emails/automation/[id]/dry-run` | POST | exécution simulée avec trace | F06 |
| action `resetAndReplayRun` | server action | replay depuis step 0 | F06 |
| action `softDeleteAutomation` | server action | remplace `deleteAutomation` (R-031) : `deleted_at` + refus si runs actifs | F06 |
| `/api/admin/emails/templates/[id]/test-send` | POST | épreuve via outbox | F07 |
| `/api/admin/emails/suppression` | POST | ajout manuel (raison+détail obligatoires) | F09 |
| `/api/admin/emails/suppression/bulk-remove` | POST | retrait en masse (audit-loggé) | F09 |
| `/api/admin/emails/suppression/export` | GET | CSV | F09 |
| check Listmonk dans `checkEmailingInfraHealth` | lib | ping + âge dernier sync OK | F10 |

Tout endpoint d'écriture : `requireAdmin()` + audit-log + schéma Zod + réponse
d'erreur normalisée `{ error: { code, message } }`.

## 5. Garde-fous d'architecture (anti-dérive)

- **Règle ESLint locale** (`no-restricted-syntax`) : interdire `window.confirm`,
  `window.alert` et tout `toLocaleString` direct dans `src/components/admin/emails/**`
  et `src/app/admin/emails/**` (obligation de passer par `ui/`).
- **Test de contrat statique** : un test unitaire échoue si un statut existe
  dans `schema-emails.ts` sans entrée `STATUS_META` (verrouille TRV-07).
- **Piège RSC** : `next build` obligatoire en CI emails (les violations
  `'use client'`→server-only sont invisibles à tsc/vitest — leçon QA 2026-06).
- **Budget de bundle** : CodeMirror chargé en dynamic import ; gate CI si la
  page templates dépasse +150 kB gz par rapport à la baseline.

## 6. Compatibilité & non-régression

- Les composants legacy restent en place jusqu'au switch par écran (pas de
  big-bang) : chaque chantier remplace l'écran derrière sa route, l'ancienne
  implémentation est supprimée dans le MÊME commit que le passage au vert de
  sa batterie (pas de double maintenance).
- Les ~1 700 tests existants font partie du gate de CHAQUE étape ; les tests
  qui encodent un comportement modifié sont mis à jour dans le commit du
  changement, jamais désactivés (`.skip` interdit par convention de revue).
