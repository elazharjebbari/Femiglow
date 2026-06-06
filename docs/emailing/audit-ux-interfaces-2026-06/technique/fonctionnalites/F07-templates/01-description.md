# F07 — Templates HTML : fonctionnement optimal détaillé

> Périmètre : `/admin/emails/templates` (liste + éditeur). Couvre TPL-F01..F12 de
> l'inventaire, problèmes audit `TPL-01..TPL-14`. Doctrine de tests : §05. La
> **non-régression de la sanitization DOMPurify** (TPL-F11) est un **gate
> sécurité** : aucune évolution de cet écran ne doit affaiblir `sanitizeEmailHtml`.

Code de référence (existant) :
- UI : `src/components/admin/emails/templates/TemplateEditor.tsx` (+ formulaire de
  création inline dans la page `app/admin/emails/templates/new`).
- Rendu : `src/lib/mail/templates/custom/{render,context-resolver,sanitize,schemas}.ts`.
- API : `src/app/api/admin/emails/templates/route.ts` (+ `[id]/route.ts`,
  `[id]/preview/route.ts`, `[id]/versions/route.ts`). **À CRÉER** :
  `[id]/test-send/route.ts`.

---

## 1. Autosave localStorage + restauration proposée + garde dirty (TPL-01 — priorité 1)

**Problème actuel** : aucune protection. Une fermeture d'onglet, un crash navigateur
ou un clic « retour » perd l'intégralité du travail non enregistré. L'opérateur
travaille parfois 1-2 h sur un template avant de créer une version.

### 1.1 Brouillon localStorage

- **Clé** : `femiglow:tpl-draft:<templateId>` (un brouillon distinct par template ;
  jamais de collision entre deux templates édités).
- **Contenu sérialisé** (JSON) :
  ```json
  {
    "subjectTmpl": "...",
    "preheaderTmpl": "...",
    "htmlSource": "...",
    "customVars": "<la chaîne JSON brute du champ, PAS l'objet parsé>",
    "savedAt": 1717689600000,
    "baseVersionId": "<activeVersionId du template au moment du chargement>"
  }
  ```
  `customVars` est stocké en chaîne brute pour préserver un JSON en cours de frappe
  (potentiellement invalide) — on ne perd pas la saisie de l'opérateur.
- **Fréquence** : écriture **debouncée à 1000 ms** après la dernière frappe (toute
  modification d'un des 4 champs). Pas d'écriture par frappe (I/O localStorage
  synchrone). Indicateur visible « ✓ Brouillon auto-enregistré il y a Ns » (Freshness
  socle F04, recalcul de l'âge).
- **Écriture uniquement si dirty** : si l'état revient identique à la version DB, le
  brouillon est **purgé** (pas de faux « brouillon en attente »).

### 1.2 Dialogue de restauration au chargement

Au montage de l'éditeur, on lit la clé. On propose la restauration **si et seulement
si** :
1. un brouillon existe pour ce `templateId`, ET
2. son contenu **diffère** de la version DB chargée, ET
3. `savedAt` est **postérieur** à `template.updatedAt` (le brouillon est plus récent
   que la dernière version enregistrée — sinon le brouillon est obsolète, on le
   purge silencieusement).

Le dialogue (ConfirmDialog socle, **pas** un brouillon appliqué d'office) affiche :
« Un brouillon non enregistré de ce template existe (modifié il y a N min). Le
restaurer ? » avec **Restaurer** / **Ignorer**.
- **Restaurer** → l'état des 4 champs prend les valeurs du brouillon ; le brouillon
  reste en localStorage jusqu'au prochain save.
- **Ignorer** → on **conserve l'état DB** et on **purge** le brouillon (l'opérateur a
  tranché ; on ne re-proposera pas au prochain F5).

### 1.3 Purge après enregistrement

À un **POST /versions réussi** (`res.ok`), le brouillon est purgé (`removeItem`) : la
version DB devient la référence, l'indicateur autosave disparaît, le bouton repasse
« Aucun changement ».

### 1.4 Garde dirty (use-dirty-guard socle SOC-F07)

- **beforeunload** : tant que `isDirty`, un `beforeunload` armé déclenche le prompt
  natif du navigateur (« modifications non enregistrées »). Désarmé dès que propre.
- **navigation in-app** : interception de la navigation Next (lien « ← Templates »,
  clic onglet) → ConfirmDialog « Quitter sans enregistrer ? Vos modifications non
  enregistrées seront conservées en brouillon local. » — le brouillon localStorage
  rend cette garde *non destructrice* (on ne perd rien même en confirmant).

**À vérifier (oracles opérateur)** : frappe → après 1 s la clé localStorage contient
la frappe ; F5 avec brouillon plus récent → dialogue ; Ignorer → état DB + clé purgée ;
Restaurer → champs = brouillon ; save → clé purgée ; dirty → beforeunload armé,
propre → désarmé.

---

## 2. Panneau « variables disponibles » complet (TPL-02 / TPL-07)

**Problème actuel** : 5 boutons codés en dur (`SAMPLE_VARS`), valeurs non résolues,
insertion **en fin de source** (`s + {{var}}`), aucune autocomplétion. Le moteur
expose 20+ variables.

### 2.1 Source = `variablesResolved` du preview

La route preview retourne déjà `variablesResolved` (clés du contexte résolu, hors
`trigger` nested). **Évolution requise** : la route doit renvoyer un **objet
clé→valeur résolue** (`variablesResolvedMap`), pas seulement les clés, afin d'afficher
la valeur réelle (ex. `orderCount=3`, `totalSpent=1 240 MAD`). Le panneau se nourrit
de cette map à chaque preview réussie — il **reflète le contexte courant** (lead réel
saisi ou mock).

### 2.2 Groupes

Le panneau range les variables par groupe (ordre stable) :
- **Identité** : `firstName fullName email phone country language`
- **Commerce** : `lastOrderId lastOrderDate lastOrderTotal orderCount totalSpent`
- **Dates** : `today tomorrow dayOfWeek currentMonth currentYear`
- **URLs** : `unsubscribeUrl shopUrl accountUrl siteUrl`
- **Trigger** : `trigger.eventName trigger.properties` (libellés documentés, valeur
  « (selon l'automation) » en preview hors automation)
- **Custom** : `customVars.*` (les clés du JSON customVars courant)

Chaque entrée affiche `nom` + `= valeur résolue tronquée` (max ~24 car., ellipse).
`city`/`address` sont **retirés** (TPL-11 ; toujours vides faute de colonne leads).

### 2.3 Insertion AU CURSEUR (TPL-07)

Un clic sur une variable insère `{{nom}}` **à la position du curseur** dans l'éditeur,
**pas** en fin de source :
- mode textarea : via `selectionStart`/`selectionEnd` (remplace la sélection
  éventuelle, repositionne le curseur après l'insertion).
- mode CodeMirror : via l'API de transaction (`dispatch` d'un `insert` à la position
  courante).

### 2.4 Autocomplétion sur `{{`

Quand l'opérateur tape `{{`, une liste filtrable apparaît sous le curseur :
- filtre **par préfixe** sur ce qui suit `{{` (ex. `{{fir` → `firstName`),
- `↵`/clic insère la variable complète + ferme `}}`,
- **Échap** ferme la liste sans rien insérer,
- liste vide si aucun match (pas de pop-up fantôme).

**À vérifier** : les 20+ variables listées et groupées ; valeur résolue affichée ;
clic insère au curseur (preuve : insertion au milieu, pas en fin) ; `{{fir` filtre à
`firstName` ; Échap ferme.

---

## 3. Éditeur CodeMirror HTML/Handlebars lazy + lint (TPL-03)

**Problème actuel** : `<textarea>` nu, pas de coloration, pas de lint.

- **Chargement lazy** : CodeMirror (`@codemirror/*`) chargé via `dynamic`/import()
  côté client uniquement (`ssr: false`) — budget bundle **+150 kB max** sur ce
  chunk, hors du bundle initial.
- **Coloration** : HTML + interpolations Handlebars `{{ }}` distinguées.
- **Lint inline** :
  - **expression Handlebars non fermée** : `{{notClosed` sans `}}` → diagnostic
    « l.N : expression non fermée » (gutter + soulignement).
  - **HTML invalide** : balise non fermée signalée (best-effort, non bloquant).
  - Le lint est **indicatif** (n'empêche pas le save ; la barrière dure reste la
    sanitization serveur).
- **Fallback textarea** : si le chargement du module CodeMirror **échoue** (réseau,
  chunk 404), l'éditeur **retombe sur le `<textarea>` actuel** sans casser l'écran
  (l'opérateur peut toujours éditer). Insertion au curseur et autosave fonctionnent
  dans les deux modes.

**À vérifier** : `{{notClosed` signalé ; HTML invalide signalé ; échec de chargement
CodeMirror → textarea éditable présent (pas d'écran blanc).

---

## 4. Preview Desktop / Mobile 375 px (TPL-04)

**Problème actuel** : preview desktop only, iframe pleine largeur.

- Toggle **[💻 Desktop] / [📱 Mobile 375px]** au-dessus de l'iframe.
- **Même `srcDoc`** dans les deux modes (on ne re-fetch PAS le preview ; seule la
  **largeur du conteneur iframe** change : 100 % vs `375px` centré). Bascule
  instantanée, sans requête réseau.
- `sandbox="allow-same-origin"` inchangé (pas de `allow-scripts`).
- Debounce preview inchangé : **600 ms** (cf. §05 anti-flake).
- Contexte : `[lead@ex.com]` (lead réel) ou mock `preview-mock@femiglow.local`.

**À vérifier** : toggle Mobile → largeur du conteneur = 375 px ; toggle Desktop →
pleine largeur ; aucun POST preview émis par la bascule de mode.

---

## 5. Versions + diff côte à côte avant restauration (TPL-05)

**Problème actuel** : restauration via `confirm()` natif, aucun diff. L'opérateur
restaure à l'aveugle.

- Liste des versions (existant) ; chaque version (sauf l'actuelle) propose
  **[voir le diff]** et **[restaurer]**.
- **Diff** ligne par ligne (lib `diff`/`diff-match-patch`, sources brutes), affiché
  **côte à côte** ou inline, sur **sujet + preheader + htmlSource** :
  - lignes ajoutées colorées (vert), supprimées colorées (rouge), inchangées neutres.
- **Restauration** via **ConfirmDialog socle** (remplace le `confirm()` natif) :
  « Restaurer la version vN ? Vos modifications en cours seront remplacées
  (un brouillon local sera conservé). »
  - Restaurer → l'état des 4 champs prend les valeurs de vN.
  - **La version restaurée n'est PAS une nouvelle version** tant qu'on ne fait pas
    « Créer une version » : restaurer = charger dans l'éditeur, save = matérialiser.

**À vérifier** : diff affiche ajouts/suppressions ; restore via ConfirmDialog (Esc =
annule, ne change rien) ; après restore, la liste de versions est **inchangée** tant
qu'on ne save pas ; après save, une **nouvelle** version est créée (numéro incrémenté).

---

## 6. Test send via outbox (TPL-06)

**Problème actuel** : aucun moyen de s'envoyer une épreuve.

- **Route à créer** : `POST /api/admin/emails/templates/[id]/test-send`.
- **Contrat d'entrée** (réutilise `TestSendSchema` existant) :
  `{ recipient: email, contextEmail?: email }`.
- **Comportement** :
  1. `requireAdmin` (401 sinon).
  2. charge le template (404 sinon).
  3. construit le contexte via `buildEmailContext(contextEmail ?? recipient)`,
  4. **rend** le template custom (`renderTemplate` custom → sanitize),
  5. **insère une ligne outbox** (`status='pending'`, `source='template-test'`,
     `template='custom:<slug>'`, `idempotencyKey` **dédiée et unique par envoi** :
     `tpl-test:<id>:<recipient>:<timestampMs>` — chaque clic = un envoi distinct,
     mais une **double-soumission UI** réutilise la clé → **un seul** outbox).
  6. tente l'envoi immédiat (`attemptSend`) ; le cron récupère l'échec.
  7. réponse `{ status: 'queued', outboxId }`.
- **Idempotence** : le bouton est désactivé + `aria-busy` pendant l'appel ; un
  double-clic ne déclenche **qu'un seul** POST (compteur MSW).
- **Toast succès** (socle SOC-F02) : « Épreuve envoyée à `recipient` » avec le
  destinataire visible. Échec → `role="alert"`, destinataire saisi préservé.

**À vérifier** : POST avec `recipient` ; grille réseau 6 cas (200/401/422/500/hang/
network) ; double-clic = 1 POST ; toast succès nomme le destinataire ; en intégration,
une **ligne outbox** est créée avec `source='template-test'`.

---

## 7. Suppression UI + automations bloquantes (TPL-08)

**Problème actuel** : l'API DELETE vérifie déjà les références (409 + `automations`),
mais **aucun bouton** dans l'UI.

- Bouton **Supprimer** (liste + éditeur).
- Sans référence → **ConfirmDialog danger** (saisie de confirmation socle pour le cas
  liste si massif) → DELETE → ligne retirée de la liste + toast.
- **Avec automations bloquantes** → l'API répond **409** avec
  `{ error, automations: [{ id, slug, name, active }] }`. L'UI affiche un dialogue
  **pédagogique listant les slugs bloquants** (+ liens vers chaque automation) :
  « Impossible de supprimer : utilisé par welcome-flow, vip-flow. Détachez ce template
  de ces automations d'abord. » Le template **reste** dans la liste.

**À vérifier** : delete sans ref → liste raccourcie ; delete avec ref → 409 → dialogue
liste les slugs + liens, template toujours présent.

---

## 8. Dupliquer (TPL-09)

- Bouton **Dupliquer** (liste + éditeur) → crée un nouveau template
  `slug = <slug>-copie` (kebab, dédupliqué si collision : `-copie-2`…), `name = "<name>
  (copie)"`, même `subjectTmpl/preheaderTmpl/htmlSource/customVars`, **v1** initiale.
- Redirige vers l'éditeur du nouveau template, toast « Template dupliqué ».
- En cas de collision de slug irrésolue → message d'erreur, pas de doublon créé.

**À vérifier** : dupliquer → nouveau template avec slug suffixé + redirection ; le
template source est inchangé.

---

## 9. Bannière « utilisé par N automations actives » (TPL-14)

- En tête de l'éditeur, bannière conditionnelle alimentée par
  `findAutomationsUsingTemplate(slug)` filtré sur `active === true` :
  - **0 active** → pas de bannière.
  - **1 active** → « ⚠ Utilisé par 1 automation active (welcome-flow) — vos
    modifications s'appliqueront aux prochains envois. [voir] ».
  - **N actives** → « ⚠ Utilisé par N automations actives (slugs…) ».
- Les automations **inactives** qui référencent le template ne déclenchent PAS la
  bannière d'avertissement (mais bloquent quand même la suppression — distinction
  importante).

**À vérifier** : 0 → pas de bannière ; 1 → « 1 automation active » + slug ; N → compte
exact + liste des slugs + lien.

---

## 10. Liste : recherche + tri (TPL-12)

**Problème actuel** : table nue, ni recherche ni tri.

- Champ **Rechercher slug/nom** (filtre substring, insensible à la casse, sur slug
  ET nom).
- **Tri** par colonnes (Slug / Nom / Sujet / Modifié) avec `aria-sort`.
- EmptyState socle (SOC-F03) si la recherche ne renvoie rien.

**À vérifier** : recherche filtre sur slug et nom ; tri par « Modifié » ordonne par
date ; recherche sans résultat → EmptyState.

---

## 11. Contexte preview : retrait city/address fantômes (TPL-11)

- `context-resolver.ts` renvoie aujourd'hui `city: ''` et `address: ''` (pas de
  colonne leads). Ces variables sont **retirées** du contexte exposé et du panneau —
  elles ne doivent **jamais** apparaître comme variable « disponible » (elles
  rendaient toujours vide → faux signal).
- `trigger.*` reste documenté (groupe Trigger).

**À vérifier** : `city`/`address` absents du panneau variables et de
`variablesResolved`.

---

## 12. NON-RÉGRESSION sanitization DOMPurify (TPL-F11 — GATE SÉCURITÉ)

`sanitizeEmailHtml` (`custom/sanitize.ts`) est la **barrière dure**. Le lint éditeur
est *indicatif* ; il **ne remplace jamais** le sanitize serveur. Toute évolution F07
(CodeMirror, autocomplete, test-send, dupliquer) doit **réexécuter la batterie XSS**
et la garder verte. Vecteurs neutralisés obligatoires (réf. `__qa__/sanitize-hostile`)
— chacun vérifié dans **les deux contextes** (email final + pipeline preview via
`{{{var}}}`), oracle « la charge active ne survit pas » :

| # | Vecteur | Charge type | Oracle |
|---|---------|-------------|--------|
| 1 | `<script>` | `<script>alert(document.cookie)</script>` | aucun `<script` |
| 2 | handler `on*` | `<img onerror=…>`, `onclick`, `onmouseover` | aucun `on…=` |
| 3 | `javascript:` | `<a href="javascript:…">` | aucun `javascript:` |
| 4 | `<iframe>` / `<object>` / `<embed>` | `<iframe src=//evil>` | aucun de ces tags |
| 5 | `<form>`/`<input>`/`<button>` | formulaire de phishing | aucun de ces tags |
| 6 | CSS `expression()` | `style="width:expression(…)"` | aucun `expression(` |
| 7 | CSS `@import` distant | `<style>@import url(//evil)</style>` | aucun `@import` |
| 8 | `data:` non-image | `<a href="data:text/html,…">` / `data:text/html` sur src | aucun `data:text/html` |
| 9 | `<base>` (détournement liens) | `<base href="//evil/">` | aucun `<base` |
| 10 | meta refresh | `<meta http-equiv="refresh">` | aucun `http-equiv=refresh` |
| 11 | `vbscript:` | `<a href="vbscript:…">` | aucun `vbscript:` |
| 12 | entité encodée | `<a href="&#x6a;avascript:…">` | pas de ranimation du vecteur |
| 13 | `<svg onload>` + script imbriqué | `<svg onload=…><script>…</script>` | aucun `<svg`/`onload`/`<script` |
| 14 | imbrication malformée | `<scr<script>ipt>…</scr</script>ipt>` | aucun `<script` |

Préservation (preuve qu'on ne sur-nettoie pas) : `a[href=https]`, `strong`, `br`,
`table`/`td`, `img[src=https]`, `img[src=data:image/png]`, `style` couleur,
`target`/`rel`, `aria-label`.
