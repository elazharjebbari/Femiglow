# F04 — Cockpit transactionnel : fonctionnement optimal

> Périmètre : `/admin/emails/transactional` — l'écran le plus dense de la
> section. Référence audit : `interfaces/11-transactionnel.md`. Inventaire :
> `CKP-F01..CKP-F15`. Code : `components/admin/emails/cockpit/*`,
> `lib/mail/transactional/{filters-parser,search,bulk-actions,summary}.ts`,
> `app/api/admin/emails/transactional/*`.
>
> Doctrine F04 : **honnêteté du périmètre**. Chaque action de masse, chaque
> compteur, chaque export DOIT dire à l'opérateur sur QUOI exactement il agit.
> Le mode de défaillance redouté est le *faux sentiment d'exhaustivité* : croire
> qu'on a relancé 5 312 emails alors que seuls les 50 de la page sont partis.

---

## 0. Carte des capacités

| Réf | Capacité | État | Statut F04 |
|---|---|---|---|
| CKP-F01 | Grammaire de filtres (parser) | existant | **non-régression** |
| CKP-F02 | Autocomplétion entités (templates/destinataires/sources) | existant | **non-régression** |
| CKP-F03 | Erreurs de parsing visibles | nouveau | CKPT-03 |
| CKP-F04 | Tri de colonnes (aria-sort) | existant | **non-régression** |
| CKP-F05 | Sélection multiple + **globale par filtre** (Gmail) | amélioré | CKPT-04 |
| CKP-F06 | Bulk retry par ids + **par filtre** (cap + dry-count) ; raisons traduites | amélioré | CKPT-02 |
| CKP-F07 | Bulk suppress (adresses distinctes) | existant | **non-régression** |
| CKP-F08 | **Export CSV serveur** streamé `POST /export` | nouveau | CKPT-01 (critique) |
| CKP-F09 | Reap-stuck — feedback statut résultant | amélioré | CKPT-07 |
| CKP-F10 | Vues sauvegardées (système + perso, CRUD) | existant | **non-régression** |
| CKP-F11 | KPI header — sparklines, seuils, **tooltips** | amélioré | CKPT-05/06 |
| CKP-F12 | Pagination — offset 50/page + **saut de page** | amélioré | CKPT-12 |
| CKP-F13 | Page détail — **timeline pédagogique** + retour sticky | amélioré | CKPT-08/09 |
| CKP-F14 | Quick filters (DLQ / Soft bounces / Reap) | existant | **non-régression** |
| CKP-F15 | **Bannière contexte santé** `?from=health` | nouveau | DASH-12 |

---

## 1. Existant à NON-RÉGRESSER

### 1.1 Grammaire de filtres (CKP-F01)
Le parser (`filters-parser.ts`) accepte, séparés par des espaces (ET implicite,
pas de OU en V1) :

- `status:VALUE[,VALUE...]` → enum `OutboxStatus` ; liste séparée par virgules.
- `to:EMAIL_OU_GLOB` → `user@x.y` (égalité exacte) | `*@bad.tld` | `fatima*`
  (glob → `ILIKE`, `*`→`%`).
- `template:SLUG_OU_GLOB`, `source:SOURCE` → idem glob.
- `after:DATE` / `before:DATE` → ISO `2026-05-01`, mots-clés `today`/`yesterday`/
  `now`, offsets relatifs `-7d` / `-1h` / `-30m` / `-90s`.
- `attempts:OP_NUM` → `>3` | `<=2` | `=5` | `0` (opérateur par défaut `=`).
- `has:error` → drapeau booléen (`lastError IS NOT NULL`).
- Tout token non reconnu (clé inconnue, ou pas de `:`) devient du **freetext**
  (recherche email/nom/template). Les guillemets doubles permettent les valeurs
  à espaces ; `\:` échappe un `:` littéral.

Invariant : `parseFilters` est **pur et déterministe** (param `now` injectable),
sérialisable URL via `serializeFilters`/`deserializeFilters`. Le round-trip
`query → params → query` doit être stable. **Ne PAS dupliquer ce parser** ni le
compilateur SQL (`search.ts`) : les nouvelles routes serveur (export,
bulk-by-filter) réutilisent EXACTEMENT `parseFilters` + `buildWhere`.

### 1.2 Autocomplétion (CKP-F02)
Palette ⌘K : suggestions templates / destinataires / sources avec debounce +
abort de la requête précédente. Non-régression : pas de course (la dernière
frappe gagne), pas de fuite de requête annulée dans les résultats affichés.

### 1.3 Tri (CKP-F04)
Colonnes Date / Statut / Template / Tentatives. `aria-sort` reflète la direction
RÉELLE (`ascending`/`descending`/`none`). Cliquer une colonne déjà active bascule
desc↔asc (Date). Changer le tri ramène à la page 1 (offset 0).

### 1.4 Vues sauvegardées (CKP-F10)
Système (lecture seule) + perso (CRUD complet). `handleSelectView` reconstruit
une requête Cmd-K depuis le `filterState` persisté, la re-parse, applique filtres
+ tri, reset page 1. Création : POST `/api/admin/emails/views`. Rename : PATCH.
Delete : DELETE (confirmation). Non-régression : pas de mutation optimiste sur
échec réseau (la vue reste telle quelle, message visible).

### 1.5 Bulk retry/suppress par ids (CKP-F06/F07)
`POST /bulk-retry` / `/bulk-suppress`, corps `{ ids }` (cap 500). Feedback
HONNÊTE : « 2 relancés · 1 ignoré (wrong_status) ». Suppress compte les
**adresses distinctes**. Sélection conservée sur échec ; bouton Réessayer rejoue
la MÊME action ; verrou anti-double-soumission (`bulkBusy`).

### 1.6 KPI header (CKP-F11), reap-stuck (CKP-F09), pagination (CKP-F12)
Voir §2.7, §2.8, §2.9 pour les évolutions ; le comportement existant
(auto-refresh 5 s, cartes cliquables → filtre, seuils failed≥5/hard>0, presets
DLQ/Soft bounces, Précédent/Suivant) reste intact.

---

## 2. Nouvelles capacités — fonctionnement optimal détaillé

### 2.1 Erreurs de parsing VISIBLES (CKP-F03 / CKPT-03)

**Problème corrigé** : `parseFilters` produit déjà un tableau `errors[]`
(`{ position, raw, message }`) qui n'était jamais montré — un filtre fautif était
silencieusement avalé en freetext.

**Comportement optimal** :
- Dès qu'une erreur de parsing existe, l'input ⌘K porte un **liseré rouge**
  (`aria-invalid="true"`) ET une **section warning** (`role="alert"`) liste UNE
  ligne par erreur, formulée par type :
  - `attempts:abc` → « `attempts:abc` ignoré — attendu : `>N`, `<N`, `=N`. »
  - `status:plop` → « Statut inconnu : `plop`. Statuts valides : failed, dlq,
    delivered… »
  - `after:32/13` → « Date invalide : `32/13`. Formats : `2026-05-01`, `today`,
    `-7d`. »
  - `has:foo` → « `has:` n'accepte que `error`. »
  - valeur manquante (`status:`) → « Valeur manquante pour `status:`. »
- Les filtres VALIDES du même input sont quand même appliqués (parsing partiel) :
  la section warning n'empêche PAS la recherche sur ce qui est interprétable.
- Oracle binaire : un input contenant `attempts:abc` affiche le warning ET le
  liseré ; un input 100 % valide n'affiche NI l'un NI l'autre.

### 2.2 Sélection globale par filtre — pattern Gmail (CKP-F05 / CKPT-04)

**Deux modes de sélection mutuellement exclusifs :**

- **mode `page`** (existant) : un `Set<id>` de lignes cochées de la page courante
  (checkbox, shift-clic pour intervalle, « tout cocher » la page). Cap visuel
  ≤ 50.
- **mode `filter`** (nouveau) : la sélection désigne **les N résultats du filtre**
  (pas une liste d'ids), même au-delà de la page. Représentée par `{ mode:
  'filter', total, filterSnapshot }`.

**Transition page → filter (UI exacte).** Quand on coche « tout » la page ET que
`total > rows.length`, une **bannière d'amorce** apparaît :
> « Les 50 emails de cette page sont sélectionnés. **[Sélectionner les 5 312
> emails correspondant aux filtres]** »

Cliquer le lien bascule en mode `filter`. La bannière devient :
> « ✓ 5 312 emails sélectionnés (filtre : `status:failed after:-7d`) **[annuler]** »

Le lien d'amorce **n'apparaît QUE si `total > rows.length`** (un filtre tenant sur
une page n'a pas besoin de sélection globale).

**Sémantique de survie — règles dures :**

1. **Changement de page** : la sélection-filtre **SURVIT** (elle ne dépend pas
   des lignes visibles, c'est une intention « tous les résultats »). Le compteur
   reste « 5 312 ».
2. **Changement de filtre** (nouvelle saisie ⌘K, quick filter, clic carte KPI,
   sélection d'une vue, effacer) : la sélection-filtre est **ANNULÉE** avec un
   **toast info** : « Sélection globale annulée — les filtres ont changé. » On
   retombe en mode `page` vide. Justification : une sélection « tous les
   résultats du filtre A » n'a aucun sens sous le filtre B.
3. **Changement de tri** : la sélection-filtre survit (le tri ne change pas
   l'ensemble, seulement l'ordre).
4. **annuler** : retour mode `page` vide, sans toast.
5. **Décochage d'une ligne** en mode `filter` : la sélection globale est rompue
   (Gmail-like) → retour mode `page` avec les autres lignes de la page cochées,
   sauf celle décochée. (Comportement « j'ai changé d'avis sur l'exhaustivité ».)

**Quelles actions consomment quel mode :**
- mode `page` → actions **par ids** (`/bulk-retry`, `/bulk-suppress` avec
  `ids[]`), export **par ids** ou page.
- mode `filter` → actions **par filtre** (`/bulk-retry-by-filter`,
  export serveur sur `filterState`). Le bouton est libellé avec le total :
  « Retry (5 312) », « Exporter CSV (serveur, ~5 312 lignes) ».

### 2.3 Export CSV SERVEUR streamé (CKP-F08 / CKPT-01 — critique)

**Problème corrigé** : l'export client (`buildCsv` + Blob) n'exporte QUE les
lignes de la page visible, sans le dire → l'opérateur croit exporter « tout ».

**Comportement optimal :**
- Route `POST /api/admin/emails/transactional/export`, corps = le **filterState
  du moment** (`{ filters, freetext, sort }`, PAS de pagination).
- Réponse `text/csv; charset=utf-8` **streamée** (ReadableStream / keyset
  pagination interne) : pas de matérialisation de 100 000 lignes en mémoire.
- En-têtes : `Content-Disposition: attachment; filename="emails-transactionnels-
  2026-06-06.csv"` (nom **daté** du jour), `Content-Type` ci-dessus,
  `Cache-Control: no-store`.
- Format : **BOM UTF-8** (`U+FEFF`) en tête (Excel FR lit les accents) +
  en-têtes RFC 4180 + une ligne par email. Échappement RFC 4180 : tout champ
  contenant `,` `"` `\r` `\n` est entouré de guillemets, guillemets internes
  doublés. Sujet contenant `« Bonjour, "vous" »` ressort
  `"Bonjour, ""vous"""`.
- **Pagination keyset stable** : tri par `(createdAt, id)` pour que des insertions
  concurrentes pendant le stream ne provoquent NI saut NI doublon de ligne (un
  OFFSET classique dériverait).
- **Cap 100 000 lignes** : au-delà, le stream s'arrête à 100 000 et le serveur a
  émis l'info au client (compte estimé avant lancement). L'UI affiche alors :
  « Export limité aux 100 000 premières lignes — affinez les filtres pour un
  export complet. »
- **Libellé honnête côté UI** : tant que le filtre tient sur la page, bouton
  « Exporter CSV (page) » (chemin client conservé) ; dès qu'une sélection-filtre
  ou un total > page existe, bouton « Exporter CSV (serveur, ~N lignes) » qui
  POST `/export`.
- Pendant le stream : bouton `aria-busy`, libellé « Préparation de l'export… »,
  AUCUN second POST sur double-clic.

### 2.4 Bulk retry PAR FILTRE + dry-count (CKP-F06 / CKPT-02)

**Comportement optimal :**
- Route `POST /api/admin/emails/transactional/bulk-retry-by-filter`, corps =
  `{ filterState, dry_run }`.
- **Dry-count préalable obligatoire** : avant toute mutation, l'UI POST avec
  `dry_run: true` → réponse `{ count }` (combien d'emails ÉLIGIBLES au retry
  matchent le filtre, càd statut ∈ {failed, dlq, bounced_soft} ∩ filtre). L'UI
  ouvre un ConfirmDialog : « **5 312 emails seront relancés** — confirmer ? ».
- Sur confirmation, second POST `dry_run: false` → mutation réelle, réponse
  `{ retried, skipped[] }`. `skipped[]` agrège les raisons traduites (cf. §2.5).
- **Cap dur 10 000** : si le dry-count > 10 000, l'UI bloque l'exécution et
  affiche « 12 480 emails correspondent — au-delà de 10 000, affinez le filtre
  (ex. resserrez la fenêtre `after:`). » (Pas de mutation partielle silencieuse.)
- **Réutilisation du compilateur** : `bulk-retry-by-filter` réutilise
  `buildWhere` de `search.ts` → l'ensemble ciblé est, par construction, IDENTIQUE
  à celui que `/search` renverrait pour le même filtre (test d'intégration
  « MÊME ensemble »). Dupliquer le compilateur est **INTERDIT**.
- Feedback identique au bulk par ids : « 5 290 relancés · 22 ignorés (statut non
  relançable) ».

### 2.5 Raisons de skip traduites (CKPT-02)

Map FR unique (source de vérité, réutilisée par l'UI et l'agrégation serveur) :

| code interne | libellé FR opérateur |
|---|---|
| `not_found` | non trouvé |
| `wrong_status` | statut non relançable |
| `suppressed` | adresse en liste de suppression |
| `cap_exceeded` | au-delà du plafond de tentatives |

Le feedback bulk n'affiche JAMAIS le code anglais brut. Oracle : « 1 ignoré
(statut non relançable) », jamais « (wrong_status) ».

### 2.6 Tooltips et explications de compteurs (CKPT-05 / CKPT-06)

- **« 5 000+ »** (total tronqué, `window: 'truncated'`) porte un `title` /
  tooltip accessible : « Plus de 5 000 résultats — le compte exact n'est pas
  calculé (perf). Affinez les filtres. »
- **Sparkline « En file » vide** : au lieu d'un graphe plat (≈ bug), un
  placeholder « — » avec `title` « Pas de série temporelle pour la file
  d'attente — c'est un instantané, pas un cumul. »
- Tooltips des seuils KPI : « Alerte dès 5 échecs sur la fenêtre » / « Toute
  hard bounce est signalée ».

### 2.7 Reap-stuck — statut résultant (CKP-F09 / CKPT-07)

Feedback enrichi : « N envois bloqués libérés → re-mis en file (ou DLQ si plafond
de tentatives atteint). » Cas 0 : « Aucun envoi bloqué à libérer. » L'opérateur
sait OÙ sont repartis les messages, pas juste qu'« il s'est passé quelque chose ».

### 2.8 Saut de page (CKP-F12 / CKPT-12)

Pagination enrichie : `[Précédent] [Aller à : __] / 12 [Suivant]`. Saisir un
numéro de page navigue à `offset = (page-1) * 50`. Bornes : page < 1 → ramenée à
1 ; page > dernière → ramenée à la dernière ; valeur non numérique → ignorée
(input revient à la page courante, pas de navigation). En mode `truncated`,
la borne haute est la dernière page calculable (5 000/50 = 100).

### 2.9 Bannière contexte santé `?from=health` (CKP-F15 / DASH-12)

Quand l'URL porte `?from=health` (deep-link depuis un check HealthBadge du
dashboard), une bannière info s'affiche en tête : « Vous arrivez depuis le
contrôle santé (raison : `webhook muet depuis 14 min`, relevé à 09:12). »
Bouton **[fermer]** la masque (et retire `from` de l'URL pour ne pas la
réafficher au refresh). Absente si `from` ≠ `health`.

### 2.10 Page détail — timeline pédagogique + retour sticky (CKP-F13)

- **Légende** : « 📡 webhook Stalwart · ⚙ app ». Chaque évènement timeline porte
  son badge source : `delivery.*` (webhook) → 📡 ; transitions applicatives
  (sent, queued) → ⚙.
- **Explication « sent stagnant »** : si le dernier état est `sent` sans
  `delivered` ultérieur, un encart ⓘ : « Un mail peut rester "Envoyé" si le
  destinataire est une boîte locale (`delivery.completed` non suivi) ou si le
  webhook est muet. »
- **Retour sticky** : lien « ← Transactionnel » répété et collant en bas de page
  (CKPT-09) pour ne pas remonter tout le détail.
- Non-régression : deep-link suppression (`?email=`) si statut `suppressed`,
  métadonnées, snapshot HTML, payload JSON, RetryButton si éligible.

---

## 3. Invariants transverses (oracles binaires)

1. **Zéro faux succès** : un feedback succès (`role="status"`) n'apparaît QUE sur
   `res.ok`. Tout échec → `role="alert"` visible, sélection/saisie PRÉSERVÉE.
2. **Honnêteté du périmètre** : tout bouton de masse dit sur combien d'emails il
   agit (ids vs filtre vs page), avec le compte exact.
3. **Anti double-soumission** : action en vol → boutons `aria-busy`+disabled, un
   SEUL POST sur double-clic.
4. **Pas de duplication de logique** : parser et compilateur SQL réutilisés tels
   quels par les routes serveur ; un test d'intégration prouve l'égalité des
   ensembles `search` vs `bulk-retry-by-filter`.
5. **Survie de sélection** : changement de filtre annule la sélection-filtre
   (toast info) ; changement de page/tri la conserve.
