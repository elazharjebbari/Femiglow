# F08 — Audiences — fonctionnement optimal

> Périmètre : AUD-F01..AUD-F11 (`/admin/emails/audiences`). Cœur du chantier C7.
> Fichiers : `components/admin/emails/audiences/{AudienceWizard,AudienceRulesBuilder,
> RuleEditor,AudiencePreview,SnapshotsPanel,ExclusionFlagsFieldset,CountryMultiSelect,
> AudienceDetailActions}.tsx`, `lib/mail/audiences/{rules-compiler,rules-types,preview,
> snapshot,snapshot-members,purge}.ts`, `app/api/admin/emails/audiences/**`.
> Problèmes d'audit verrouillés : AUD-01..AUD-13.
>
> Deux lecteurs : **l'opérateur** (ce qu'il voit/perçoit/peut faire au clavier) et
> **le développeur** (contrats, invariants compilateur/SQL). Tout oracle est binaire
> et observable.

---

## 0. Vue d'ensemble — ce que F08 garantit

L'audience est une **requête de ciblage** (RulesGroup ET/OU récursif sur 15 types de
règles + 4 flags d'exclusion) qui se compile en SQL sur `leads`. Trois surfaces de
lecture : le **builder** (wizard étape 2), la **preview** (taille/échantillon/
breakdown), les **snapshots** (matérialisation figée). F08 referme 13 défaillances
dont **une critique** (AUD-01 : ciblage silencieusement faux par les tags).

Invariant transverse F08 : **aucun ciblage silencieusement faux**. Une règle qui ne
peut pas cibler correctement (tag non livré, code pays inconnu, borne inversée, in
vide) DOIT être visiblement signalée — jamais compilée en un prédicat qui ment.

---

## AUD-F05 — Neutralisation des tags `has_tag` / `not_has_tag` (AUD-01, critique)

### Le problème exact
Le moteur de tags (`lead_tag`, M5.5) n'est pas livré sur cette branche. Aujourd'hui le
builder **propose** « A le tag X » / « N'a pas le tag X », et le compilateur produit un
`EXISTS (SELECT 1 FROM lead_tag …)` / `NOT EXISTS (…)`. Sur une base où `lead_tag` est
vide (ou absente), cela revient à :
- `has_tag` → ne cible **personne** (EXISTS toujours faux) ;
- `not_has_tag` → cible **tout le monde** (NOT EXISTS toujours vrai).

Une opératrice qui crée « clientes VIP » (has_tag=vip) obtient une audience vide sans
le savoir ; pire, « non-VIP » (not_has_tag=vip) envoie à **toute la base**. C'est le
défaut critique AUD-01 : ciblage silencieusement faux.

### Trois surfaces de défense (toutes obligatoires)

**1. Menu d'ajout (`AudienceRulesBuilder` → `AddRuleMenu`)**
- Les deux items de la catégorie « 🏷 Tags » restent **affichés** mais **désactivés**
  (grisés, `aria-disabled="true"`, `disabled`), suffixés du libellé verbatim
  « (bientôt — M5.5) ».
- Un clic dessus **n'ajoute aucune règle** (le `onPick` n'est pas appelé) et le menu
  reste ouvert (ou se ferme sans effet). Aucune autre catégorie n'est affectée : les
  13 autres types restent sélectionnables.
- Au survol/focus, un title/`aria-description` explique : « Le moteur de tags arrive en
  M5.5. Ce critère ne peut pas encore cibler de contact. »

**2. Règle tag déjà présente sur une audience EXISTANTE (`RuleEditor`)**
- Si une audience legacy porte déjà une règle `has_tag`/`not_has_tag` (créée avant la
  neutralisation), son éditeur affiche une **bannière rouge bloquante** au-dessus du
  champ tag, verbatim :
  > ⛔ Critère inactif : le moteur de tags (M5.5) n'est pas livré. Cette règle ne cible
  > actuellement AUCUN contact. Retirez-la ou attendez M5.5.
- La bannière porte `role="alert"`. Le champ tag reste lisible (on ne perd pas la
  donnée) mais l'éditeur ne propose pas d'autocomplétion active.
- Le bouton « ✕ Supprimer ce critère » reste disponible pour retirer la règle morte.
- À la validation de l'étape 2, la présence d'une règle tag déclenche une **erreur
  bloquante** : « Une règle "tag" est inactive (M5.5 non livré). Retirez-la pour
  continuer. » (on ne sauve pas une audience dont on sait le ciblage faux).

**3. Compilateur (`rules-compiler.ts`)**
- `compileRule` pour `has_tag`/`not_has_tag` **ne génère plus** `EXISTS`/`NOT EXISTS`
  sur `lead_tag`. Il retourne un prédicat **sûr et explicite** : `has_tag → FALSE`
  (ne cible personne), `not_has_tag → FALSE` également (on refuse d'élargir à toute la
  base — « ne cibler personne plutôt que tout le monde », même doctrine que le code
  pays inconnu).
- Il **logge un warning** à chaque compilation rencontrant un tag :
  `logger.warn('audience.rules.tag_neutralized', { kind, tag })` — afin que les
  snapshots/previews déclenchés sur audiences legacy laissent une trace côté serveur.
- Doctrine de symétrie : le compilateur et l'UI s'accordent sur FALSE. Quand M5.5
  mergera, on rebranche les vraies subqueries EXISTS et on lève la neutralisation
  (un seul point dans le compilateur + un flag `TAGS_ENABLED`).

> À vérifier : que le compilateur **n'importe plus** `leadTag` pour ces deux kinds ;
> que le warning est émis (champ `event` distinct du nom de log — gotcha logger) ;
> que `not_has_tag` ne compile **pas** en `TRUE`/`NOT EXISTS` (régression de masse).

---

## AUD-F04 — Validations de règles (AUD-02, AUD-05, AUD-07, AUD-09)

### Validations exactes par type de règle

| Type | Opérateurs | Bornes / format | Validation bloquante |
|---|---|---|---|
| `email_pattern` | contains / starts / ends / equals / **in** | `in` = liste de chaînes (chips) | `in` vide → 422 ; chaque chip trim ≠ "" |
| `country` | eq / in | code ISO de la liste fermée (21 pays) | code inconnu = **bloquant** (AUD-07) |
| `consent_marketing` | — (booléen) | oui/non | jamais invalide |
| `created_at` | after / before / between / within | date ISO ; between = [a,b] ; within = `7d/30d/1h` | between : a ≤ b (dates) + 2 bornes saisies |
| `order_count` | gte/lte/gt/lt/eq/**between** | entiers ≥ 0 ; between = [lo,hi] ; since/until dates | between : lo ≤ hi (AUD-02) + 2 bornes |
| `order_total` | idem | **stocké en CENTIMES, saisi en MAD** ; between [lo,hi] | between : lo ≤ hi ; conversion MAD↔cents |
| `has_ordered_product` | — | productId non vide ; since date optionnelle | productId="" → 422 |
| `last_order_at` | after / before / within (pas de between : value scalaire) | date / within | date valide |
| `email_opened` | — | within optionnel ; minCount ≥ 1 ; templateSlug optionnel | minCount entier ≥ 1 si fourni |
| `email_clicked` | — | within ; minCount ≥ 1 ; urlPattern optionnel | idem |
| `received_without_open` | — | threshold ≥ 1 entier ; within requis | threshold ≥ 1 ; within non vide |
| `inactive_since` | — | days entier 0..3650 | bornes Zod |
| `session_count` | gte/lte/gt/lt/eq/between | entier ≥ 0 ; within optionnel | between : lo ≤ hi |
| `has_tag` / `not_has_tag` | — | **neutralisé** (cf. AUD-F05) | présence = bloquant |

### a. Bornes `between` lo ≤ hi + auto-swap (AUD-02)
- Pour tout `between` **numérique** (order_count, order_total, session_count) ET
  **date** (created_at), si `lo > hi` (ou date début > date fin), un message d'erreur
  inline `role="alert"` s'affiche sous le champ, verbatim :
  > ⚠ La borne basse doit être ≤ la borne haute.
  accompagné d'un bouton **« Inverser les bornes »** qui permute lo↔hi (et émet le
  `onChange` avec value=[hi, lo]).
- Cas spécial order_total : la comparaison se fait sur les **centimes** (valeur
  stockée), pas sur l'affichage MAD — mais l'auto-swap reste cohérent à l'affichage.
- Une borne manquante (vide) bloque « Continuer » à l'étape 2 avec le message :
  « Renseigne les deux bornes des critères « entre ». » (préexistant
  `hasIncompleteBetween`, conservé).

### b. Codes pays inconnus BLOQUANTS (AUD-07) + chips
- L'éditeur `country` n'accepte plus de **texte libre**. En `eq` : `CountryAutocomplete`
  (liste fermée). En `in` : `CountryMultiSelect` — chips drapeau+nom (🇲🇦 Maroc ✕),
  sélection depuis la liste fermée `COUNTRIES` (21 pays).
- Source de vérité unique `countries.ts` ↔ `COUNTRY_CALLING_CODE` du compilateur (test
  garde-fou d'alignement). Un code **hors liste** ne peut pas être saisi via l'UI ;
  mais une audience legacy ou un payload direct portant `XX` doit produire à la
  validation de l'étape 2 une **erreur bloquante** :
  > ⚠ Code pays inconnu « XX » — sélectionnez un pays dans la liste.
  (sinon il compile en FALSE → audience vide silencieuse).

### c. Confirmation bascule eq ↔ in si perte de données (AUD-05)
- Passer `in` (N pays sélectionnés) → `eq` ne conserve qu'**un seul** pays. Si N ≥ 2,
  un **ConfirmDialog** s'intercale avant la bascule, verbatim :
  > Ne conserver que 🇲🇦 Maroc ? Les 4 autres pays seront retirés.
  (le premier de la liste est conservé). « Annuler » garde l'opérateur en `in` avec sa
  sélection intacte ; « Confirmer » bascule en `eq` avec value=`MA`.
- Bascule `eq` → `in` : pas de perte, pas de confirmation (le scalaire devient `[v]`).
- Même logique pour les opérateurs numériques `between` → scalaire : la borne haute est
  perdue ; on conserve la borne basse (préexistant, pas de dialog — perte mineure et
  prévisible) ; à documenter dans le hint.

### d. Chips pour `in` (email_pattern et country) (AUD-09)
- `email_pattern operator=in` ne s'édite plus en **CSV texte** mais en chips : un input
  « + ajouter une valeur » ; Entrée/virgule valide une chip ; chaque chip est
  **trimée** ; les **doublons** sont rejetés (pas de chip dupliquée) ; une chip vide
  après trim est ignorée ; ✕ retire une chip. La value envoyée est `string[]`.
- À vérifier : value=[] (toutes chips retirées) → erreur bloquante « Ajoutez au moins
  une valeur ».

### Liste de contrôle (UI/UX/a11y/data)
between lo≤hi numérique · between début≤fin date · auto-swap permute · borne manquante
bloque · code pays inconnu bloque étape 2 · eq→in sans perte · in→eq avec ConfirmDialog
si N≥2 · chip trim · chip doublon rejetée · chip vide ignorée · `in` vide bloque ·
order_total MAD→cents (madToCents) · `role="alert"` sur chaque erreur · navigation
clavier dans les chips (Backspace retire la dernière) · contraste erreur ≥ 4.5:1.

---

## AUD-F03 — Rule builder (15 types + ET/OU récursif) — non-régression (AUD-08)

### Pour l'opérateur
- Menu « + Ajouter un critère » groupé par catégorie (Identité / Commerce / Engagement
  email / Activité / Tags). 13 types ajoutables (les 2 tags grisés).
- Chaque type rend **son** éditeur dédié (cf. `renderEditor`) : opérateur + valeur(s) +
  options. Un `RuleEditor` par règle, dans un cadre titré (label FR du kind).
- Groupes ET/OU **récursifs** jusqu'à profondeur 3 (maxDepth=3 UI ; MAX_DEPTH=4
  compilateur). « + Ajouter un groupe OU/ET » crée un sous-groupe de combinateur
  inverse. ✕ retire un critère ou un sous-groupe.

### Mention ET/OU dès la 1re règle (AUD-08)
- Aujourd'hui le toggle « Combiner : ET/OU » n'apparaît qu'à partir de **2 règles**.
  Cible : la mention du combinateur est visible **dès la 1re règle** (texte
  pédagogique « toutes les conditions (ET) » / « au moins une (OU) »), même si le
  bouton de bascule reste sans effet pratique à 1 règle. Verbatim proposé pour 1 règle :
  > Une seule condition pour l'instant — ajoutez-en d'autres pour les combiner (ET/OU).

### À vérifier (non-régression builder)
- Les **15 types** rendent leur éditeur sans crash (`renderEditor` exhaustif).
- Ajout/suppression/imbrication de groupes sur **3 niveaux** : `rules-group-0/1/2`.
- Bascule du combinateur d'un groupe (`toggleCombinator`) inverse `kind` all↔any.
- `defaultRule(kind)` produit un Rule valide vis-à-vis du Zod pour chaque kind.
- a11y du **builder récursif** : chaque groupe est un `fieldset`/`role=group` avec
  `legend`/`aria-label` annonçant le combinateur ; profondeur annoncée ; les boutons
  ✕ ont un `aria-label` distinct (« Supprimer ce critère » vs « Supprimer ce
  sous-groupe »). axe = 0 violation serious/critical.

---

## AUD-F07 — Preview triple (AUD-13)

### Calculs et sources
- **Taille** (`previewAudienceSize`) : `count(*)::int` sur `leads WHERE compiled.where`,
  dans une transaction bornée par `SET LOCAL statement_timeout = 5000` (5 s).
- **Échantillon** (`previewAudienceSample`, limit 1..50, défaut 10) : `SELECT email,
  name, createdAt … LIMIT n` + count total.
- **Breakdown** (`previewAudienceBreakdown`, AUD-F07/UX-AUD-011) : **deux** counts dans
  la même transaction bornée — `matched` (rules seules, NO_EXCLUSIONS) et `deliverable`
  (rules + exclusions). `excluded = max(0, matched − deliverable)`. L'arithmétique
  affichée DOIT être cohérente : « N ciblés − M exclus = K envoyables » avec
  N − M = K exactement.
- Debounce : **800 ms** après tout changement de `rules`/`exclusionFlags` avant le
  fetch `/preview-size` (anti-rafale de frappe). Bouton « ↻ Rafraîchir » force le fetch
  immédiat.

### Message timeout dédié (AUD-13)
- Aujourd'hui un timeout SQL (statement_timeout 5 s → erreur Postgres) remonte un
  message générique « Erreur : HTTP 500 ». Cible : la route preview-size détecte le
  cas timeout/statement (code Postgres `57014` query_canceled) et renvoie un message
  **dédié**, et l'UI affiche verbatim, en `role="alert"` :
  > ⏱ Requête trop lourde — simplifiez les critères ou créez un snapshot
  > (calcul asynchrone).
- Distinct des autres erreurs (401/422/500) qui gardent leur message propre. L'état
  utilisateur (règles saisies) est préservé ; le compteur précédent n'est pas remplacé
  par un faux « 0 ».

### À vérifier (grille réseau preview)
Pour `/preview-size`, `/preview-sample`, `/preview-breakdown` : 200 nominal · 401 ·
422 · 500 · hang (delay infini → « Calcul en cours… » stable, pas de double POST) ·
network error · **504/timeout → message dédié**. Zéro faux succès. Breakdown :
arithmétique N−M=K vérifiée à l'affichage.

---

## AUD-F08 — Mode d'évaluation documenté (AUD-04)

- Étape 3 (Récap), `fieldset`/`legend` « Comportement à l'envoi », deux radios avec
  texte détaillé verbatim **sous chaque option** :
  - **Re-évaluer au moment de l'envoi (recommandé)** :
    > Les contacts qui rempliront les critères au moment du send seront inclus, même
    > s'ils n'existent pas encore aujourd'hui.
  - **Figer la liste maintenant (snapshot statique)** :
    > Seuls les {N} contacts actuels recevront — reproductible (A/B, conformité), mais
    > ignore les nouveaux inscrits.
- `{N}` = la taille preview courante si disponible, sinon « les contacts actuels ».
- À vérifier : `evaluationMode` (`dynamic` par défaut) est envoyé dans le payload
  POST/PATCH ; les deux textes sont présents et liés à leur radio (`aria-describedby`).

---

## AUD-F10 — Snapshots : drift, fraîcheur, purge, membres paginés (AUD-03, AUD-06, AUD-11)

### Cycle de vie (non-régression)
- `pending → running → done` ; `running → errored` sur exception (zombie reaper 30 min,
  R-012, libère `snapshot_key`). Idempotence par `(audience_id, snapshot_key)` :
  un POST avec la même clé renvoie le snapshot existant (sauf `errored`).
- Auto-refresh **4 s** (`setInterval` → `router.refresh`) tant qu'un snapshot est
  `running`/`pending` ; s'arrête quand tout est `done`/`errored`.
- `errored` : `erroredReason` affiché + bouton **« Relancer »** (nouveau POST manuel),
  anti double-clic (`Relance…` désactivé).

### Drift live/snapshot (AUD-03) — formule exacte
- Pour chaque snapshot `done`, la panneau affiche :
  - **Âge** : « créé il y a Nj » (ou « il y a Nh »/« à l'instant ») dérivé de
    `createdAt` vs `now()`, TZ Africa/Casablanca.
  - **Taille du snapshot** (figée) et **live count** : un appel
    `/preview-size` sur les `rules` courantes de l'audience (la source du live est la
    **même** que la preview — réutilise `previewAudienceSize`), affiché « live : K ».
  - **Écart** : `delta = live − size` ; **pourcentage** `pct = |delta| / max(1, size) ×
    100`. Affichage « ▲ +134, +12 % » (ou ▼). Le `max(1, size)` évite la division par
    zéro sur un snapshot vide.
  - **Surlignage** si `pct > 10 %` : ligne mise en évidence + bandeau
    > ⚠ Écart > 10 % avec l'audience live — [re-snapshoter]
    avec un bouton « re-snapshoter » (= POST snapshot manuel). Seuil = **strictement >
    10 %**.
- Le live count est **coûteux** : il est calculé **une fois** par chargement de page
  (pas par snapshot — toutes les lignes partagent le même live, c'est l'audience qui a
  un seul ciblage live courant) et **pas dans la boucle d'auto-refresh 4 s**.

### Purge affichée (AUD-11)
- `purgeableAfter` (createdAt + 90 j) affiché par ligne : « purge auto le JJ/MM ». Sous
  forme de date FR. Le module `purge.ts` supprime au-delà ; l'UI ne fait qu'**afficher**
  l'échéance pour que l'opérateur sache qu'un snapshot d'archive disparaîtra.

### Membres paginés « Charger plus » (AUD-06)
- Aujourd'hui : 50 premiers seulement, libellé « (50 premiers affichés) ». Cible :
  - Premier chargement `limit=50&offset=0` ; le compteur affiche « K membres (N
    affichés) ».
  - Bouton **« Charger plus »** visible tant que `members.length < total` ; un clic
    fetch `offset = members.length` (limit=50) et **concatène** sans doublon (clé
    `email`). Le compteur « N affichés » s'incrémente.
  - Quand `members.length === total` : le bouton disparaît (« tous affichés »).
  - **Export CSV** : lien `?format=csv` (RFC : guillemets doublés, en-tête `email,name`,
    `Content-Disposition: attachment`). Borné à 500 lignes côté route — au-delà,
    mention « export limité aux 500 premiers ».

### Sémantique exacte du « charger plus »
- L'offset est `members.length` (et non une page logique) → robuste si `total` change
  entre deux clics. La concaténation dédoublonne par `email`. Aucune régression du
  total affiché.

### À vérifier (snapshots)
cycle pending→running→done (auto-refresh 4 s, fake timers) · errored→Relancer ·
âge « il y a Nj » correct (fake clock) · écart % = |live−size|/max(1,size) · surlignage
> 10 % seulement · purge date affichée · charger plus cumule sans doublon · bouton
disparaît à l'épuisement · export CSV lien présent · grille réseau sur membres + retry.

---

## AUD-F09 — Détail + restitution FR (non-régression) + hint R-011

### Pour l'opérateur
- La page détail restitue les règles en **français lisible** (`rulesGroupToLines` →
  `ruleToText`), indentées par niveau, avec le combinateur en tête de groupe (« TOUS
  les critères » / « AU MOINS UN critère »). Cas **imbriqué** : un sous-groupe OU dans
  un groupe ET s'affiche indenté avec son propre combinateur.
- `order_total` est restitué en **MAD** (centsToMad) ; les codes pays sont **traduits**
  (« 🇲🇦 Maroc »). Un kind/operator non couvert retombe sur un libellé générique sans
  crash.
- **Live count** « N contacts envoyables » dans l'entête (preview-size).
- **Hint R-011** présent sur **toute** règle `country`, verbatim :
  > ℹ Ciblage par préfixe téléphonique (E.164) — les leads sans téléphone ne matchent
  > pas ce critère.
  (la règle country est dérivée du préfixe `leads.phone`, pas d'une colonne pays).

### À vérifier
restitution FR du cas imbriqué · order_total en MAD · pays traduits · live count
affiché · hint R-011 présent sur règle pays (et absent sinon).

---

## AUD-F11 — Suppression audience (ConfirmDialog) (TRV-01)

- Aujourd'hui `handleDelete` utilise `window.confirm` (legacy). Cible : remplacer par
  le **ConfirmDialog** du socle (F01), variante `danger`, verbatim :
  > Supprimer cette audience ? Les snapshots existants sont conservés, mais l'audience
  > et son ciblage disparaissent. Action irréversible.
- Focus initial sur « Annuler » ; Esc/backdrop ferment sans agir ; bouton « Supprimer »
  rouge ; busy `Suppression…` + `aria-busy` ; **une seule** requête DELETE sur
  double-clic ; échec → dialog reste ouvert + `role="alert"`, la ligne audience reste.
- Succès → redirige vers `/admin/emails/audiences`.

---

## Données — points de vérification transverses

- **MAD ↔ centimes** : `madToCents(mad)=Math.round(mad*100)`,
  `centsToMad(cents)=cents/100`. order_total saisi 500 MAD → value=50000 ; restitution
  50000 → « 500 MAD ». Arrondi entier ; jamais de flottant en base.
- **Dates / TZ** : toute date affichée (snapshot createdAt, purge, âge) est rendue en
  `Africa/Casablanca` via `Intl.DateTimeFormat('fr-FR')`. Le compilateur normalise les
  dates en ISO + `::timestamptz` (gotcha postgres-js : ne jamais binder un Date JS cru).
- **Compilateur** : aucune string-concat de l'input opérande (paramétrisation Drizzle) ;
  `validateDepth` avant compilation ; code pays inconnu / liste in vide → FALSE (jamais
  TRUE) ; tags → FALSE + warning.

---

## a11y du builder récursif (gate axe 0 serious/critical)

- Chaque `RulesGroup` rendu = `fieldset` avec `legend` annonçant le combinateur
  (« Toutes les conditions (ET) » / « Au moins une condition (OU) ») ; imbrication =
  fieldsets imbriqués (le lecteur d'écran annonce la profondeur).
- Chaque opérateur/valeur a un label accessible (`aria-label` « Opérateur », « Valeur »,
  « Borne basse/haute »). Les chips ont un nom accessible et un bouton ✕ nommé.
- Les items de menu désactivés (tags) : `aria-disabled` + description.
- ConfirmDialog (suppression, bascule eq↔in) : `role="dialog"`, `aria-modal`, focus
  trap, focus rendu au déclencheur.
</content>
</invoke>
