# F01 — Plan d'implémentation

> Méthode : **test rouge d'abord** (la batterie `03-batterie-tests.csv` est écrite
> avant le code), critère de vert binaire, rollback explicite par lot.
> Lots = jalons du plan d'action global P1.1 / P1.2 / P1.3.
> Convention : chaque `it()` commence par son ID (`it('F01-C-003 — …')`) →
> avancement comptable par `grep -r "F01-" --include="*.test.*" | wc -l`.

---

## Lot P1.1 — Tokens, Pill/STATUS_META, verrouillages (fondation, zéro dépendance)

**Tests à écrire AVANT (rouge)** : F01-U-054..059 (Pill/STATUS_META), F01-U-065..066
(tokens), F01-U-067..068 (verrous lint/grep), F01-C-057, F01-A-060.

**Travail**
1. `ui/tokens.ts` : objet `tokens` (success/danger/warning/info/neutral) avec les
   valeurs gelées (emerald/rose/amber/sky/stone).
2. `ui/Pill.tsx` + `STATUS_META` (outbox) + `CAMPAIGN_STATUS_META`, dérivés des
   enums `schema-emails.ts`. Migrer le `STATUS_META` existant de
   `common/StatusBadge.tsx` vers la forme `{ label, tone }` (remplacer les `cls`
   bg-emerald/bg-rose/bg-blue codés en dur par `tone`).
3. Test de contrat statique : itère sur `emailOutboxStatus.enumValues` et exige une
   entrée `STATUS_META` (F01-U-054).
4. Test AST anti `sage-/red-/blue-` + test grep `window.confirm`/`toLocaleString`.
5. `KpiCards.tsx` : supprimer tout mapping local, consommer `STATUS_META` (DASH-07).

**Critère de vert** : F01-U-054..068 verts ; `KpiCards` et `StatusBadge` rendent le
même libellé/tone pour les 11 statuts ; `next build` OK.
**Risques** : `StatusBadge` est importé en RSC ET client → garder `tokens.ts`/`Pill`
sans `'use client'` (présentationnel pur, importable serveur). Le test AST doit
exclure ses propres fixtures.
**Rollback** : `Pill` est additif ; tant que le switch `KpiCards` n'est pas mergé,
`StatusBadge` legacy reste. Revert = retirer l'import `STATUS_META` dans `KpiCards`.

---

## Lot P1.2 — ConfirmDialog + ToastProvider + EmptyState (le cœur du feedback)

**Tests à écrire AVANT (rouge)** : F01-C-001..015 (dialog), F01-C-016..028 (toast),
F01-C-029..032 (empty), F01-C-069..071 (invariants describe.each).

**Travail**
1. `ui/ConfirmDialog.tsx` + `useConfirm()` : portal, focus trap, Esc/backdrop,
   variante danger, `requireText`, busy/aria-busy, anti double-soumission, alert
   interne sur échec, retour du focus au déclencheur.
2. `ui/toast.tsx` : `ToastProvider` (monté 1× dans `app/admin/emails/layout.tsx`),
   `useToast()` → `success` (4 s annulable), `error` (persistant + `onRetry`), cap
   3, **une seule** region `aria-live="polite"`.
3. `ui/EmptyState.tsx` : variantes `empty`/`filtered`.
4. Harnais `describe.each` d'invariants partagé (réutilisé par les écrans en P3).

**Critère de vert** : F01-C-001..032 + F01-C-069..071 verts ; axe smoke 0
serious/critical (F01-A-015, F01-A-028, F01-A-032) ; `next build` OK.
**Risques** :
- **Collision ToastProvider / aria-live existants** : le cockpit et
  `components/admin/legal/Toast.tsx` + `components/ui/Toast.tsx` exposent déjà des
  live-regions. Le provider emails doit être le SEUL `aria-live=polite` du segment
  `/admin/emails` ; auditer/retirer les live-regions ad hoc des écrans au moment de
  leur adoption (sinon le lecteur d'écran lit en double — F01-C-026).
- Fake timers + timer succès : utiliser `vi.useFakeTimers({ shouldAdvanceTime:true })`
  et tester 3999 ms vs 4000 ms (F01-C-017).
- Portal + focus trap : tester le retour de focus exige un déclencheur réel dans le
  DOM (rendre un bouton ouvreur, pas un appel direct).
**Rollback** : provider et dialog sont additifs ; tant qu'aucun écran ne les
consomme, ils sont inertes. Revert = ne pas monter `ToastProvider` dans le layout.

---

## Lot P1.3 — Freshness + Wizard + use-dirty-guard (interaction durable)

**Tests à écrire AVANT (rouge)** : F01-U-033..035 + F01-C-036..043 (Freshness),
F01-C-044..053 (Wizard), F01-C-061..064 (dirty-guard), F01-C-072.

**Travail**
1. `ui/Freshness.tsx` : âge relatif (formateur pur testable U), TZ via formateur
   central, auto-refresh `visibilitychange`-aware (suspension + reprise + refresh).
   Remplace/absorbe `DashboardFreshness.tsx`.
2. `ui/Wizard.tsx` + `useWizard` : étapes cliquables ≤ validées, Ctrl+←/→, focus
   sur titre, message de validation près du bouton, persistance (`persistKey` +
   `onAutosave`).
3. `ui/use-dirty-guard.ts` : `beforeunload` + interception navigation App Router →
   `ConfirmDialog`.

**Critère de vert** : F01-U-033..035 + F01-C-036..064 + F01-C-072 verts ;
F01-A-043/053 axe OK ; coverage socle `ui/` ≥ 85 % ; `next build` OK.
**Risques** :
- Interception navigation App Router : l'API d'interception (router events) est
  fragile ; tester via navigation mockée (F01-C-062) et valider le vrai
  comportement en E2E (SM-F01-04).
- `beforeunload` en jsdom : on vérifie `preventDefault` appelé, pas l'invite native.
- Freshness : ne JAMAIS réinitialiser l'âge au retour d'onglet sans refresh
  effectif (F01-C-040) — bug honnêteté classique.
**Rollback** : `DashboardFreshness` legacy conservé jusqu'au vert de F01-C-036..043 ;
Wizard/dirty-guard additifs (aucun écran legacy ne les utilise encore).

---

## Adoption — migration des 9 `window.confirm` existants

> Ordre : **écran pilote = Suppression** (geste destructif simple, faible surface),
> puis surfaces croissantes. Chaque migration retire le `window.confirm`, branche
> `ConfirmDialog` + `useToast`, AJOUTE une ligne au `describe.each` d'invariants, et
> supprime le legacy **dans le même commit** que le passage au vert (pas de double
> maintenance). Le test verrou F01-U-067 passe au rouge→vert au fil des migrations.

| # | Fichier (prod) | Geste | Lot d'adoption | Notes |
|---|---|---|---|---|
| 1 | `src/components/admin/emails/cockpit/SuppressionList.tsx` | retrait suppression (1×) | **PILOTE** | F09 SUP-F04 ; le plus simple, valide le socle end-to-end |
| 2 | `src/components/admin/emails/cockpit/RetryButton.tsx` | relance (1×) | cockpit | F04 ; toast résultat « N relancés » |
| 3 | `src/components/admin/emails/cockpit/TransactionalCockpit.tsx` | bulk (3×) | cockpit | 3 `window.confirm` → dont 1 massif (`requireText` si > 50) |
| 4 | `src/components/admin/emails/audiences/AudienceDetailActions.tsx` | suppression audience (1×) | F08 | « snapshots conservés » dans le corps |
| 5 | `src/app/admin/emails/campaigns/[id]/CampaignActions.tsx` | pause/cancel/discard (1×) | F05 | variante danger + toast par action |
| 6 | `src/app/admin/emails/automation/AutomationRowActions.tsx` | cancel run / suppression (1×) | F06 | refus si runs actifs (cf. softDelete) |

(6 fichiers de production = 8 appels `window.confirm`. Les occurrences restantes du
grep initial sont des fichiers de **test** qui encodent l'ancien comportement et
seront mis à jour — jamais `.skip` — dans le commit de migration de leur écran :
`cockpit-bulk-actions.msw.test.tsx`, `TemplateEditor.qa.msw.test.tsx`,
`CampaignDetailPage.ux4.test.tsx`.)

**Critère de fin d'adoption** : F01-U-067 vert (0 `window.confirm`/`window.alert`
dans `components/admin/emails/**` et `app/admin/emails/**` hors tests) ; la règle
ESLint `no-restricted-syntax` est activée et bloquante en CI ; les écrans migrés
figurent dans le `describe.each` d'invariants (F01-C-069..072).
