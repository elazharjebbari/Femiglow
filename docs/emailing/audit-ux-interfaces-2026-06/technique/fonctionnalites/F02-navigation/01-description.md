# F02 — Navigation : barre d'onglets persistante, badges compteurs, breadcrumb, palette

> Périmètre : NAV-F01..NAV-F06 de `06-inventaire-fonctionnalites.csv`.
> Cible : package « CIBLE » de `diagrammes/navigation.puml`.
> Problèmes audit traités : TRV-03 (navigation fragmentée), SUP-01 (Suppression
> orpheline), CAMP-08 (`/campaigns/new` manquant), DASH-10 (palette incomplète),
> DASH-12 (le lien `?from=health` part d'ici — la bannière contexte est traitée
> en F04). Vue opérateur : « je vois où je suis, je vais où je veux en 1 clic,
> et la barre ne me ralentit jamais — même quand les compteurs sont en panne ».

---

## 0. Vue d'ensemble — ce que F02 ajoute au layout

Aujourd'hui `app/admin/emails/layout.tsx` ne monte que la palette ⌘K
(`GlobalCommandPalette`). La navigation inter-sections passe obligatoirement par
un retour au dashboard (7 quick-links), sans état actif, avec des libellés de
retour incohérents. F02 transforme ce layout en **coquille de navigation
persistante** :

1. une **barre d'onglets `EmailsTabs`** (9 sections, état actif par segment
   d'URL, badges compteurs) rendue dans `layout.tsx`, donc visible et stable sur
   toutes les routes `/admin/emails/*` ;
2. des **badges compteurs** alimentés par `GET /api/admin/emails/nav-counters`
   (DLQ, runs en erreur, sync Listmonk KO), cache TTL 30 s, **dégradation
   silencieuse** ;
3. un **breadcrumb harmonisé** « Emails › Section › Objet » sur chaque écran
   (le composant `Breadcrumb` existe déjà — F02 fournit le **mapping
   route→segments** et l'adoption généralisée) ;
4. une **palette ⌘K enrichie** (entrée Suppression réintégrée + placeholder
   explicite Cmd-K/Ctrl-K + actions contextuelles) ;
5. la **route `/campaigns/new`** (redirect vers le flux de création).

Contrainte transverse : **la barre ne doit JAMAIS ajouter de requête bloquante
au rendu RSC**. Les onglets sont rendus immédiatement (structure statique
connue) ; les badges arrivent **après** via un client component qui fetch
`nav-counters` côté navigateur. Une page emails reste affichable même si
`nav-counters` est lent, en erreur ou pend indéfiniment.

---

## 1. Barre d'onglets `EmailsTabs`

### 1.1 Les 9 sections (ordre canonique, immuable)

| # | Clé        | Libellé onglet   | Route de base                    | Badge ?         |
|---|------------|------------------|----------------------------------|-----------------|
| 1 | dashboard  | Dashboard        | `/admin/emails`                  | —               |
| 2 | transactional | Transactionnel | `/admin/emails/transactional`  | DLQ (`dlq`)     |
| 3 | campaigns  | Campagnes        | `/admin/emails/campaigns`        | —               |
| 4 | automation | Automations      | `/admin/emails/automation`       | runs err (`automationErrors`) |
| 5 | audiences  | Audiences        | `/admin/emails/audiences`        | —               |
| 6 | templates  | Templates        | `/admin/emails/templates`        | —               |
| 7 | suppression| Suppression      | `/admin/emails/suppression`      | —               |
| 8 | events     | Events           | `/admin/emails/events`           | —               |
| 9 | listmonk   | Listmonk         | `/admin/emails/listmonk`         | sync KO (`listmonkSyncFailed`) |

L'ordre est figé (cf. PUML cible). L'onglet **Suppression** (#7) est la
réintégration SUP-01 : auparavant ni quick-link ni entrée de barre, seul le
deep-link `?email=` depuis le détail transactionnel le rendait atteignable.

### 1.2 État actif — règle par segment d'URL

L'onglet actif se déduit du **pathname**, par **préfixe de segment**, pas par
égalité stricte :

- on prend le pathname, on retire le préfixe `/admin/emails`, on lit le
  **premier segment restant** ;
- premier segment vide (`/admin/emails` exact) → onglet **dashboard** ;
- premier segment `transactional` (y compris `/transactional/<id>`) → onglet
  **transactional** ; idem pour chaque section et toutes ses sous-routes
  (`/campaigns/new`, `/campaigns/<id>/edit`, `/automation/runs/<id>`, etc.).

L'onglet actif porte `aria-current="page"` et un style visuellement distinct
(non basé sur la couleur seule : soulignement/fond + poids). Un seul onglet actif
à la fois. Une route inconnue sous `/admin/emails/*` (improbable) ne marque
**aucun** onglet plutôt que d'en marquer un faux.

### 1.3 Responsive — overflow horizontal

Sur viewport étroit la barre ne passe pas à la ligne et ne tronque pas : elle
**défile horizontalement** (`overflow-x-auto`, scroll tactile/molette), l'onglet
actif reste atteignable. Pas de menu « … » caché (un onglet caché derrière un
overflow menu redeviendrait non découvrable — anti-pattern SUP-01). Le conteneur
respecte la contrainte `min-w-0` du `<main>` AdminShell (cf. commentaire layout
existant) pour ne pas créer de scroll horizontal au niveau page.

### 1.4 Badges compteurs — comportement

Trois onglets peuvent porter un badge : Transactionnel (DLQ), Automations (runs
en erreur), Listmonk (sync KO). Règles d'affichage :

- **valeur 0 → badge masqué** (pas de pastille « 0 », pas de bruit) ;
- **valeur ≥ 1 → pastille** affichant le nombre ;
- **valeur > 99 → plafonnée à `99+`** ;
- la pastille a un `title`/tooltip explicite (« 3 messages en DLQ »,
  « 2 runs en erreur », « synchro Listmonk en échec ») et un texte accessible
  équivalent (pas seulement une couleur) : le libellé accessible de l'onglet
  devient p.ex. « Transactionnel, 3 en DLQ » ;
- couleur sémantique = token `danger` (DLQ, runs err) / `warning` (sync KO) du
  socle F08 — jamais une couleur brute red/amber dupliquée ;
- **tant que les compteurs ne sont pas arrivés** (premier rendu, fetch en cours)
  → **aucun badge** (pas de skeleton qui ferait sauter la barre) ; les onglets
  sont déjà cliquables.

### 1.5 Rafraîchissement des badges

- Premier fetch `nav-counters` **après** hydratation (client), non bloquant.
- Rafraîchissement périodique **léger** aligné sur le TTL serveur (30 s) ;
  **suspendu quand l'onglet navigateur est caché** (`document.hidden`,
  `visibilitychange`) — même politique que `Freshness`/auto-refresh du socle
  (SOC-F04). Repris au retour au premier plan.
- Pas de `setInterval` qui tourne dans un onglet d'arrière-plan (économie + pas
  de réveil de la DB inutilement).
- Un échec de rafraîchissement **conserve** les derniers compteurs connus si on
  en avait (pas de clignotement vers « pas de badge »), sinon reste sans badge.

### 1.6 À vérifier (UI / UX / design / data / a11y / perf)

- **UI** : 9 onglets dans l'ordre, libellés exacts, actif unique et correct pour
  chaque route paramétrée (table §1.1 × sous-routes).
- **UX** : navigation 1 clic entre sections sans repasser par le dashboard ;
  onglet actif visible partout ; Suppression atteignable.
- **Design** : tokens sémantiques pour les badges ; actif non basé sur la
  couleur seule ; pas de saut de mise en page quand les badges apparaissent.
- **Data** : badges = reflet fidèle de `nav-counters` (0 masqué, plafond 99+).
- **a11y** : `<nav aria-label>`, `aria-current="page"`, badge annoncé en texte,
  navigation clavier complète (Tab atteint chaque onglet ; activation Entrée),
  axe 0 serious/critical.
- **Perf** : **aucune** requête réseau dans le chemin de rendu RSC du layout ;
  fetch badges post-hydratation ; refresh suspendu onglet caché ; un hang de
  `nav-counters` ne bloque NI le rendu NI l'interaction.

---

## 2. Contrat `GET /api/admin/emails/nav-counters`

### 2.1 Forme de la réponse (200)

```json
{
  "dlq": 3,
  "automationErrors": 2,
  "listmonkSyncFailed": 0,
  "generatedAt": "2026-06-06T10:21:00.000Z"
}
```

- `dlq` : nombre de messages outbox en état DLQ (non relançables / mort-lettre).
- `automationErrors` : nombre de runs d'automation en statut erreur (fenêtre
  alignée sur la définition métier du HealthBadge — runs `errored` actifs).
- `listmonkSyncFailed` : 1 (ou n) si au moins un lien campagne a `last_sync_ok =
  false` / dernière tentative en échec (cf. LMK-F04), 0 sinon.
- `generatedAt` : ISO 8601 UTC, horodatage de calcul (sert au tooltip de
  fraîcheur éventuel et à la conformité de contrat).

Tous les compteurs sont des entiers ≥ 0. Le **client** applique le plafond
visuel `99+` ; l'API renvoie la valeur réelle (un capage serveur optionnel à
1000 est admis pour éviter un COUNT massif, documenté côté handler).

### 2.2 Méthode, auth, codes

- **GET** uniquement. `runtime = 'nodejs'`.
- `await requireAdmin('/api/admin/emails/nav-counters')` → non authentifié =
  **401** (route API) ; pas de redirect HTML.
- **200** : corps conforme au schéma Zod `navCountersSchema`.
- **500** : erreur interne (DB injoignable, etc.) — corps `{ error: string }`.
  Le client **dégrade silencieusement** : onglets sans badge, toujours
  cliquables, aucun toast bloquant.

### 2.3 Cache — TTL 30 s **explicite** (gotcha)

- Les compteurs sont calculés via `unstable_cache(fn, keyParts, { revalidate:
  30 })`. **Le `revalidate` est OBLIGATOIRE et explicite** : `unstable_cache`
  **sans TTL** garde la valeur indéfiniment (gotcha déjà rencontré sur les
  i18n bindings / analytics insights — cf. MEMORY) et figerait les badges. Tag
  de cache `emails-nav-counters` pour invalidation ciblée éventuelle.
- Conséquence testable : **deux appels à moins de 30 s ⇒ une seule requête DB**.
- La route reste `dynamic = 'force-dynamic'` au sens auth (session par requête),
  mais le **calcul des compteurs** est mémoïsé 30 s ; l'auth, elle, n'est jamais
  cachée (un 401 doit rester un 401).

### 2.4 Pas d'impact RSC

`nav-counters` n'est **jamais** appelé pendant le rendu serveur du layout ou
d'une page. Il est consommé exclusivement par le client component des badges.
Ainsi le coût de la barre sur le TTFB des pages emails est nul.

---

## 3. Breadcrumb harmonisé « Emails › Section › Objet »

Le composant `Breadcrumb` (présentationnel RSC, `aria-current="page"` sur le
dernier segment) existe déjà. F02 fournit **le mapping route→segments** et
l'**adoption sur tous les écrans**, en remplacement des back-links divergents
(« ← Dashboard », « ← Dashboard emails », ou absence — TRV-03).

### 3.1 Règles de construction

- **Segment 0 (racine)** : toujours `EMAILS_ROOT` = `{ label: 'Emails', href:
  '/admin/emails' }`. Libellé racine canonique unique.
- **Segment 1 (section)** : libellé = libellé d'onglet de la section (Tableau
  §1.1), `href` = route de base de la section. Absent sur le dashboard lui-même
  (sur `/admin/emails`, le breadcrumb est simplement « Emails », page courante).
- **Segment 2+ (objet / sous-page)** : libellé contextuel, dernier segment sans
  `href` (page courante, `aria-current="page"`).

### 3.2 Mapping par route (canonique)

| Route                                   | Breadcrumb                                              |
|-----------------------------------------|--------------------------------------------------------|
| `/admin/emails`                         | Emails                                                  |
| `/admin/emails/transactional`           | Emails › Transactionnel                                 |
| `/admin/emails/transactional/<id>`      | Emails › Transactionnel › Message <id>                  |
| `/admin/emails/campaigns`               | Emails › Campagnes                                      |
| `/admin/emails/campaigns/new`           | Emails › Campagnes › Nouvelle campagne                  |
| `/admin/emails/campaigns/<id>`          | Emails › Campagnes › <nom campagne>                     |
| `/admin/emails/campaigns/<id>/edit`     | Emails › Campagnes › <nom> › Édition                    |
| `/admin/emails/automation`              | Emails › Automations                                    |
| `/admin/emails/automation/new`          | Emails › Automations › Nouvelle automation             |
| `/admin/emails/automation/<id>/edit`    | Emails › Automations › <nom> › Édition                  |
| `/admin/emails/automation/runs`         | Emails › Automations › Runs                             |
| `/admin/emails/automation/runs/<id>`    | Emails › Automations › Runs › Run <id>                  |
| `/admin/emails/audiences`               | Emails › Audiences                                      |
| `/admin/emails/audiences/new`           | Emails › Audiences › Nouvelle audience                  |
| `/admin/emails/audiences/<id>`          | Emails › Audiences › <nom audience>                     |
| `/admin/emails/templates`               | Emails › Templates                                      |
| `/admin/emails/templates/new`           | Emails › Templates › Nouveau template                   |
| `/admin/emails/templates/<id>/edit`     | Emails › Templates › <nom> › Édition                    |
| `/admin/emails/suppression`             | Emails › Suppression                                    |
| `/admin/emails/events`                  | Emails › Events                                         |
| `/admin/emails/listmonk`                | Emails › Listmonk                                       |

Le libellé d'objet (`<nom campagne>`, `Message <id>`…) est fourni par la page
(données déjà chargées côté serveur) — le breadcrumb ne déclenche **aucun**
fetch supplémentaire. Si le nom n'est pas disponible, fallback sur l'identifiant
tronqué (jamais d'objet vide).

### 3.3 a11y breadcrumb

`<nav aria-label="Fil d'Ariane">`, liste ordonnée, séparateurs `›` en
`aria-hidden`, dernier segment `aria-current="page"` et non cliquable. (Déjà
satisfait par le composant ; F02 ne régresse pas.)

---

## 4. Palette ⌘K enrichie

Base existante : `GlobalCommandPalette` (registry de commandes, fuzzy filter,
nav clavier ↑↓/Entrée, Esc/clic backdrop ferment, `role="dialog"` +
`aria-modal`, `role="listbox"`/`option`).

### 4.1 Entrées ajoutées / corrigées

- **Suppression** (réintégration DASH-10/SUP-01) : entrée Navigation
  `{ id: 'nav-suppression', label: 'Suppression', href:
  '/admin/emails/suppression' }` — la palette doit la **trouver** (recherche
  « suppr » / « suppression »).
- **Runs** d'automation : `{ id: 'nav-automation-runs', label: 'Runs
  automations', href: '/admin/emails/automation/runs' }`.
- Vérifier la présence des 9 sections en Navigation (dont Listmonk, Events).
- Actions « Nouvelle … » existantes conservées (campagne/automation/audience/
  template) ; `Nouvelle campagne` pointe sur `/admin/emails/campaigns/new`
  (cohérent avec NAV-F06).

### 4.2 Placeholder Cmd-K / Ctrl-K

Le placeholder de l'input doit mentionner explicitement le raccourci de la
plateforme : « Rechercher… (Cmd-K / Ctrl-K) » (aujourd'hui « (Cmd-K) » seul).
Texte testable, peu importe la plateforme détectée — les **deux** libellés
acceptés tant que l'utilisateur retrouve son raccourci.

### 4.3 Raccourcis / ouverture

- ⌘K (mac) **et** Ctrl-K (autres) ouvrent/ferment (déjà géré).
- Esc ferme ; focus revient à un point stable.
- Toujours montée dans `layout.tsx` → disponible sur toutes les routes emails.

---

## 5. Route `/campaigns/new` (NAV-F06, CAMP-08)

`/admin/emails/campaigns/new` doit exister et **rediriger** vers le flux de
création de campagne (cohérence avec `/automation/new`, `/audiences/new`,
`/templates/new` qui existent déjà). Implémentation : un `page.tsx` server qui
`redirect()` vers la cible canonique du flux de création (ou rend directement le
formulaire inline `CreateCampaignForm` si c'est la cible retenue par F05 — le
contrat F02 est : **`/campaigns/new` ne renvoie jamais un 404**, et la palette +
le breadcrumb sont cohérents avec cette route).

---

## 6. Dégradations & quick-links dashboard

- **`nav-counters` 500 / hang / network error** : onglets rendus, **sans
  badge**, **pleinement cliquables**, aucun toast bloquant, aucun blocage du
  rendu RSC. C'est l'invariant central de F02 (« je travaille quand même »).
- **Quick-links dashboard redondants** : une fois la barre persistante en place,
  les 7 quick-links de section du dashboard deviennent redondants. F02 prévoit
  leur retrait (étape finale du plan), en conservant **transitoirement** le
  quick-link Suppression jusqu'à validation de la découvrabilité par onglet
  (NAV-F04 : « onglet + palette + (transitoire) quick-link dashboard »).
