# F07 — Plan d'implémentation (phase P3.4 « templates »)

> Ordre **imposé par la sécurité du travail de l'opérateur** : on protège d'abord
> contre la perte de données (autosave + garde), puis on livre les gains à coût
> marginal (variables déjà servies par l'API, mobile trivial), puis test-send,
> puis le morceau lourd (CodeMirror), puis le confort (diff/delete/dupliquer/
> liste). Chaque lot est livrable et **rollbackable** indépendamment.

Gates par PR (rappel §05) : G1 batterie F07 verte · G2 suite emails verte ·
G5 tsc+lint+`next build` · G6 axe 0 serious/critical · G7 grille réseau 6/6 sur
chaque action · **G-SEC** : la batterie XSS (`F07-U-089..103` + `__qa__/
sanitize-hostile`) reste verte à CHAQUE lot.

---

## Lot 1 — Autosave + restauration + garde dirty (TPL-01) — PRIORITÉ ABSOLUE

**Pourquoi d'abord** : zéro risque fonctionnel, protège immédiatement le travail.
Aucune dépendance serveur.

- Hook `useTemplateDraft(templateId, state)` : write debouncé 1000 ms en
  localStorage (clé `femiglow:tpl-draft:<id>`), purge si propre, purge au save.
- Dialogue de restauration au montage (ConfirmDialog socle) gardé par les 3
  conditions (existe / divergent / `savedAt > updatedAt`).
- Branchement `use-dirty-guard` (SOC-F07) : beforeunload + nav in-app.
- Tests : `F07-C-001..016`.

**Rollback** : feature non couplée au reste ; retrait du hook + du dialogue
restaure le comportement actuel (sans perte, le brouillon n'est jamais
destructeur).

**Risque** : *conflit autosave ↔ restore* — l'autosave ne doit pas réécrire le
brouillon AVANT que le dialogue de restauration ait été tranché (sinon il écrase
le brouillon avec l'état DB monté). Mitigation : suspendre l'écriture jusqu'à
résolution du dialogue de restauration au premier montage.

---

## Lot 2 — Panneau variables complet + autocomplete + retrait city/address (TPL-02/07/11)

**Pourquoi ensuite** : la donnée est **déjà servie** par l'API preview
(`variablesResolved`) ; il ne reste qu'à exposer la **map valeur résolue**.

- API : étendre la réponse preview avec `variablesResolvedMap` (clé→valeur) ;
  retirer `city`/`address` du contexte (`context-resolver.ts`).
- UI : panneau groupé (identité/commerce/dates/urls/trigger/custom), valeur
  tronquée, **insertion au curseur** (`selectionStart`), autocomplete sur `{{`.
- Tests : `F07-C-017..029`, `F07-U-018`, `F07-I-112`.

**Rollback** : la map est additive (le `variablesResolved[]` reste) ; revenir au
panneau 5-boutons est un revert UI isolé.

**Risque** : insertion au curseur en mode textarea ≠ CodeMirror — on livre l'API
`insertAtCursor` côté éditeur (textarea d'abord), CodeMirror la branchera au Lot 5.

---

## Lot 3 — Preview Desktop/Mobile 375px (TPL-04) — trivial

- Toggle de largeur de conteneur iframe (même `srcDoc`, pas de re-fetch).
- Tests : `F07-C-038..041`, `F07-A-117`.

**Rollback** : retrait du toggle, iframe pleine largeur.

**Risque** : *fuite mémoire iframe* — éviter de remonter l'iframe à chaque
bascule (changer le style du conteneur, pas la clé React de l'iframe), sinon
re-création + reflow inutiles.

---

## Lot 4 — Test send via outbox (TPL-06)

- Route **nouvelle** `POST /[id]/test-send` (`TestSendSchema` existant) : render
  custom → sanitize → insert outbox `source='template-test'` → `attemptSend` →
  `{ status:'queued', outboxId }`. Idempotency key dédiée par envoi.
- UI : bouton **Tester** (anti double-soumission, toast succès nommant le
  destinataire).
- Tests : `F07-C-064..071`, `F07-I-106..108`, contrat MSW↔réel.

**Rollback** : retrait du bouton (la route peut rester, inerte).

**Risque** : ne PAS router le test-send via `sendTransactional` (clavé sur le
catalog des slugs *registered* — un template custom n'y est pas) ; insérer la
ligne outbox directement avec `template='custom:<slug>'`.

---

## Lot 5 — Éditeur CodeMirror lazy + lint (TPL-03) — LE PLUS LOURD

**Pourquoi tard** : poids bundle, risque SSR, doit hériter de l'API
`insertAtCursor` (Lot 2) et de l'autosave (Lot 1).

- Composant `CodeEditor` chargé en `dynamic(..., { ssr:false })`, **budget
  +150 kB max** sur son chunk (vérifié au `next build`).
- Lint : expression Handlebars non fermée + balise HTML non fermée (indicatif).
- **Fallback textarea** si le chargement échoue (`onLoadError`).
- Tests : `F07-C-030..036`.

**Rollback** : le fallback textarea EST le composant actuel → désactiver le
chargement CodeMirror ramène l'écran à l'état antérieur sans perte.

**Risque** : *CodeMirror + SSR* — tout import statique casse le build serveur ;
n'importer le module QUE côté client via `dynamic`/`import()`. Tester explicitement
le chemin `onLoadError → textarea` (`F07-C-033`).

---

## Lot 6 — Diff + restore ConfirmDialog + delete + dupliquer + liste (TPL-05/08/09/12)

**Pourquoi en dernier** : confort, faible risque, dépend du reste pour les tests
d'enchaînement.

- Diff (lib `diff`, sources brutes) côte à côte ; restore via ConfirmDialog
  (remplace `confirm()` natif) ; restore != nouvelle version.
- Delete UI : ConfirmDialog + gestion **409** (liste des slugs bloquants + liens) ;
  bannière usage actif (TPL-14).
- Dupliquer (slug suffixé dédupliqué) ; recherche + tri liste + EmptyState.
- Tests : `F07-C-051..088`, `F07-I-109..111`, `F07-E-118..122`, a11y
  `F07-A-114..116`.

**Rollback** : chaque sous-feature est un bouton/section isolé ; retrait
indépendant.

**Risque** : *diff sur gros html* — borner l'algorithme ligne par ligne ; ne pas
diff-er les sources rendues (sanitizées) mais les **sources brutes**.

---

## Tableau récapitulatif

| Lot | Périmètre | Tests | Budget/risque clé | Rollback |
|---|---|---|---|---|
| 1 | autosave + garde dirty | C-001..016 | conflit autosave/restore | retrait hook (non destructif) |
| 2 | variables + autocomplete + city/address | C-017..029, U-018, I-112 | insertion curseur | revert UI ; map additive |
| 3 | preview mobile | C-038..041, A-117 | fuite mémoire iframe | retrait toggle |
| 4 | test-send | C-064..071, I-106..108 | ne pas passer par sendTransactional | retrait bouton |
| 5 | CodeMirror lazy + lint | C-030..036 | SSR + bundle 150 kB | fallback = textarea actuel |
| 6 | diff/delete/dupliquer/liste | C-051..088, I-109..111, E-118..122 | diff gros html | sous-features isolées |

**Gate sécurité transverse (tous les lots)** : `F07-U-089..103` +
`__qa__/sanitize-hostile` verts. Le lint éditeur (Lot 5) est **indicatif** et ne
remplace JAMAIS `sanitizeEmailHtml` serveur.
