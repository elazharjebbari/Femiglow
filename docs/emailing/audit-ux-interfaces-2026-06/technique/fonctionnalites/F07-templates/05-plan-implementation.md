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

---

## Enrichissement barème relevé (2026-06-20) — gates G10–G15

> Référence : ../../09-charte-ux-qualite.md. Ces exigences s'ajoutent au plan
> ci-dessus et conditionnent le gate de phase (cf. 07-plan-action-global.yaml,
> 08-runbook.md §5). Nouvelles couches de batterie à créer : **F07-D-*** (design)
> et **F07-S-*** (sécurité).

### Design haut calibre (G10)
- **Écran éditeur 3 zones** (code `CodeEditor` / preview iframe / panneau variables) : aucun layout n'est dessiné aujourd'hui. Spécifier la grille desktop (3 colonnes, zone code dominante, panneau variables latéral), la densité et la hiérarchie typo (titre template / slug verrouillé / champs sujet-preheader). Tokens à figer : échelle typo, espacement 4/8px, couleurs sémantiques `success/warning/danger/neutre` + paire `diff-add/diff-remove`.
- **Responsive éditeur aux 3 breakpoints** : <1024px le panneau variables bascule en drawer déclenchable, la preview passe en onglet ; le code reste éditable. Aujourd'hui seul l'iframe (375px mobile, TPL-04) est responsive, pas l'interface admin. Snapshot `F07-D-*` à 768px et 1280px.
- **Diff de versions (TPL-05) niveau GitHub** : au-delà de « ajouts vert / suppressions rouge », dessiner gouttière de numéros de ligne, marqueurs +/-, compteur (N ajouts / M suppressions), navigation hunk suivant/précédent, et bascule côte-à-côte / inline. Snapshot visuel du diff sur htmlSource multi-hunks.
- **Panneau variables (TPL-02)** : dessiner la distinction des 6 groupes (identité/commerce/dates/urls/trigger/custom) avec en-têtes + icônes, le badge d'état par variable (`résolu` / `vide` / `selon automation`), le tooltip de valeur complète au survol (la troncature ~24 car est le seul état spécifié), et l'action clic (insertion au curseur vs copie).
- **États vide / chargement / erreur dessinés** : skeleton de la preview iframe pendant le POST preview, état vide de la liste de versions, état « aucune variable résolue » du panneau, état initial éditeur vierge, et tooltip explicatif du cadenas slug immuable (F07-C-104). Aujourd'hui seul `placeholder sujet —` est dessiné.
- **Micro-interactions** : transition de bascule Desktop/Mobile (la spec dit « instantanée » = anti-micro-interaction à corriger), surlignage de la ligne insérée au curseur, highlight de l'item actif de l'autocomplete `{{`, pulsation discrète de l'indicateur autosave (Freshness), toast test-send. Respecter `prefers-reduced-motion`.
- **Snapshots visuels `F07-D-*` à créer** : éditeur 3 colonnes (desktop + 768px), panneau variables (groupes + états badge), diff multi-hunks. Revue design signée avant merge des Lots 5/6.

### Assistance à la saisie (G11)
- **Champ slug (création + duplication)** → smart_default + inline_validation : slugification live depuis `name` (« Bienvenue J0 » → `bienvenue-j0`), validation inline du pattern `^[a-z][a-z0-9-]*$`, check de disponibilité débouncé AVANT le POST (aujourd'hui le 409 n'arrive qu'au POST). Test : saisie nom dérive le slug ; slug pris → message sous le champ sans soumettre ; caractère invalide rejeté inline.
- **Champ recipient (test-send)** → smart_default + autocomplete : pré-remplir l'email de l'admin courant, autocompléter sur l'historique des derniers destinataires de test, validation email inline (aujourd'hui seul le 422 serveur est testé). Test : défaut = admin connecté ; frappe filtre les destinataires récents.
- **Champ contextEmail (preview ET test-send)** → autocomplete combobox de leads : recherche serveur paginée, item = email + nom + nb commandes (cas central SM-F07-01/03 saisis à la main). Test : frappe « fat » → `fatima@example.com` avec « 3 commandes » ; sélection remplit contextEmail ; clavier flèches/Entrée ; a11y combobox (role, aria-activedescendant).
- **Champ customVars (JSON brut)** → token_insert + inline_validation : bouton Prettify, autocomplétion des clés `customVars.*` référencées dans `htmlSource`, signalement des clés utilisées mais absentes du JSON (et inversement). Test : `{{customVars.promo}}` absent du JSON → avertissement ; Prettify reformate sans altérer la valeur.
- **Éditeur htmlSource** → token_insert : étendre l'autocomplete au-delà de `{{` aux helpers Handlebars (`#if`, `#each`) et vérifier qu'elle filtre AUSSI sur `customVars.*` (pas seulement variables système). Lint : signaler `#each`/`#if` non fermé en plus du `{{` non fermé. Test : autocomplete propose `customVars.promo` du JSON courant.
- **Champ recherche de la liste (TPL-12)** → autocomplete : suggestions de slugs existants + surlignage du terme dans les résultats (aujourd'hui substring nu). Test : surlignage du terme tapé.
- **Champ message de version (F07-C-058)** → suggestions : pré-remplissage dérivé du diff (« modif sujet + html »). Test : message proposé reflète les champs modifiés.
- Rows correspondantes ajoutées à **10-inventaire-assistance.csv** (`F07-editor`/`F07-liste`) : slug, recipient, contextEmail, customVars, htmlSource, recherche, message de version — toutes `assiste_cible=oui`, aucun champ en saisie nue non justifié.

### Sécurité (G12) — batterie F07-S-*
- **Authz exhaustive** : tests d'intégration `requireAdmin` (401/403) sur TOUTES les routes du périmètre, pas seulement test-send/delete — `POST /preview`, `GET /versions`, `POST /versions` (la couverture actuelle est asymétrique : F07-C-045 ne teste que l'UI). → `F07-S-*`.
- **Anti-abus test-send** : rate-limit par admin (N épreuves/heure), allowlist de domaines optionnelle, plafond d'épreuves — la route insère en outbox + `attemptSend` un mail réel vers n'importe quelle adresse. Test : dépassement quota → 429 sans insert outbox ; domaine hors allowlist → 422. → `F07-S-*`.
- **Accès PII via contextEmail** : `buildEmailContext` résout `orderCount/totalSpent/lastOrderId` d'un lead réel arbitraire ; cloisonner et auditer cet accès (log de qui rend le PII de qui). → `F07-S-*`.
- **Sanitization HTML opérateur** : conserver la batterie XSS verte (gate existant) MAIS tracer les vecteurs retirés au rendu (cf. observabilité) ; le lint éditeur reste indicatif.
- **Brouillon localStorage** : pas de PII en clair durable sur poste partagé — TTL/purge des brouillons anciens + champ `schemaVersion` (purge silencieuse si shape inconnue).
- **Concurrence d'édition** : au `POST /versions`, comparer `baseVersionId` à `activeVersionId` courant ; divergence → 409 « la version a changé depuis le chargement », brouillon conservé. Test I- : version modifiée en DB pendant l'édition → 409. → `F07-S-*`.
- Batteries à écrire : `F07-S-001..` (authz routes), `F07-S-010..` (rate-limit/allowlist test-send), `F07-S-020..` (audit PII contextEmail), `F07-S-030..` (conflit d'édition 409).

### Observabilité / débogabilité (G14)
- **Route test-send** : émettre un log structuré `template.test_send` (sans champ `event`) `{ actorId, slug, outboxId, recipientHash, contextEmailHash, attemptSendOk, latencyMs, correlationId }`. Test : un test-send émet le log corrélé ; le chemin d'échec `attemptSend` est tracé.
- **Échecs silencieux côté client** : remonter en télémétrie `template.editor.load_error` (fallback CodeMirror → textarea, aujourd'hui géré UX mais jamais mesuré) et `template.draft.quota_exceeded` (QuotaExceededError localStorage). Test : `onLoadError` et `QuotaExceededError` émettent chacun une trace.
- **Sanitization** : log structuré `template.sanitize.stripped` listant les vecteurs retirés au rendu preview/test-send (debug prod « quel HTML opérateur a été nettoyé »).
- **Correlation-id** : relier le POST test-send au `outboxId` créé via un `correlationId` propagé ; chaque chemin d'erreur (422/429/500) tracé et testé, pas seulement le succès.

### Performance / optimal (G13)
- **Budget bundle par ajout** (pas seulement CodeMirror +150 kB) : budget séparé chiffré pour la lib `diff` et pour le module d'autocomplete ; le `next build` échoue au dépassement.
- **Latence preview** : budget p95 < 800 ms sur `htmlSource` à la borne max (200000 car) — render + sanitize synchrones ; timeout serveur défini. Test perf dédié au gros HTML.
- **Latence diff** : budget < 300 ms sur htmlSource 200k ; borner l'algorithme ligne par ligne. Test perf à la borne max du schéma.
- **Débounce** : preview 600 ms (existant) ; autosave 1000 ms (existant) ; ajouter débounce sur le check de disponibilité du slug. Pas de re-fetch à la bascule preview Desktop/Mobile (style du conteneur, pas remount iframe).
- **Liste de versions** : mémoïsation/virtualisation si un template ancien a des dizaines de versions (la factory ne teste que 7).

### Modularité / évolutivité / concurrence (G15)
- **Contrat hook `useTemplateDraft`** : figer entrées/sorties typées + événements émis comme contrat vérifiable ; test anti-duplication prouvant que F07 RÉUTILISE le socle (ConfirmDialog, EmptyState, Freshness, Toast, `use-dirty-guard` SOC-F07) au lieu de réimplémenter.
- **Contrat `insertAtCursor`** : test que l'insertion ET l'autocomplete `{{` se comportent IDENTIQUEMENT en textarea ET en CodeMirror (aujourd'hui seul l'autosave/insertion de base est testé deux modes, pas l'autocomplete).
- **Panneau variables dérivé** : remplacer F07-U-018 (« exactement les 20+ attendues », anti-évolutif) par un test de DÉRIVATION depuis `variablesResolvedMap` (injecter une variable → elle apparaît sans modif UI) + un test de régression ciblé sur le retrait `city/address`.
- **Versionnage du schéma brouillon** : champ `schemaVersion` dans le draft localStorage ; lecture d'une shape inconnue → purge silencieuse sans crash. Test : draft d'ancienne forme → pas de restauration.
- **Diff couvre customVars (4e champ)** : la restauration charge 4 champs mais le diff n'en porte que 3 → une version ne différant que par `customVars` passe inaperçue (régression silencieuse). Étendre le diff + test.
- **Concurrence / TOCTOU** : idempotence test-send réelle (la clé `tpl-test:<id>:<recipient>:<tsMs>` change à chaque ms — l'oracle « double-clic = 1 POST » repose sur le disabled UI, pas sur la clé) → test d'intégration de rejeu réseau ; conflit d'édition multi-admin via le 409 `baseVersionId` (cf. G12) ; cohérence toast (« Épreuve en file » si `attemptSend` KO + outbox pending, pas « envoyée » trompeur).
