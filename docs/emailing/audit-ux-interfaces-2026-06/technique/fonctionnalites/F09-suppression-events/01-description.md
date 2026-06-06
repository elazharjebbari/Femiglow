# F09 — Suppression & Events : fonctionnement optimal

> Deux écrans du chantier C8, partageant le dossier de tests `F09-suppression-events`.
>
> **A. Liste de suppression** `/admin/emails/suppression` — la barrière de
> délivrabilité : toute adresse qui y figure est bloquée pour TOUS les envois
> (transactionnel ET campagnes). Tout faux retrait est un incident de
> conformité ; tout faux ajout coupe un destinataire. C'est pourquoi chaque
> mutation est **audit-loggée** et chaque geste destructif passe par le socle
> (ConfirmDialog + toast + EmptyState — F01).
>
> **B. Events (debug)** `/admin/emails/events` — la table `user_event`
> (pipeline générique, **distincte** de `email_event`). Outil d'enquête : on y
> remonte d'un comportement (clic, ouverture, abandon) vers l'envoi
> transactionnel ou la campagne qui l'a déclenché.

Refs audit traitées : **SUP-01..SUP-07**, **EVT-01..EVT-05**.
Inventaire : SUP-F01..SUP-F07, EVT-F01..EVT-F03.

---

## A. Liste de suppression

### A.0 Modèle de données (rappel — source de vérité)

Table `email_suppression` : `email` (PK, normalisé lowercase/trim), `reason`
(enum ×7), `detail` (texte libre, nullable), `since` (timestamp), `source`
(enum ×4).

**Raisons (`reason`) et leurs implications opérateur :**

| slug | libellé FR | source typique | détail attendu |
|---|---|---|---|
| `hard_bounce` | Bounce permanent | webhook Stalwart | facultatif (code SMTP) |
| `soft_bounce_repeated` | Bounces soft répétés | Stalwart | facultatif |
| `complaint` | Plainte | Stalwart / Listmonk (FBL) | facultatif |
| `unsubscribe` | Désinscription | flux public / Listmonk | facultatif |
| `manual_admin` | Action admin | **ajout manuel** | **OBLIGATOIRE** |
| `cndp_request` | Demande CNDP | ajout manuel | facultatif (recommandé) |
| `invalid_format` | Format invalide | import / validation | facultatif |

**Sources (`source`) ×4 :** `stalwart`, `listmonk`, `manual`, `cndp`.

**Allowlist interne R-009** (`lib/mail/suppression.ts`,
`MAIL_INTERNAL_ALLOWLIST`, défauts `info@femiglow-maroc.com` +
`@femiglow-maroc.com`) : une adresse interne n'est **jamais** considérée
suppressée (court-circuit AVANT le lookup DB) et n'est **jamais** affichée
dans la liste. Elle ne doit pas non plus pouvoir y être **ajoutée**.

### A.1 Dialog d'ajout manuel (SUP-F03 / SUP-02)

Ouvert par `[+ Ajouter une adresse]`. C'est un `ConfirmDialog` du socle (focus
trap, Esc=annule, focus initial sur Annuler, retour focus au déclencheur).

**Champs :**

1. **Email** (`*`) — `type=email`, requis, trim+lowercase à la soumission,
   3–320 caractères, format email valide. Erreur inline si vide/mal formé.
2. **Raison** (`*`) — `<select>` des 7 raisons, libellés FR. Défaut :
   `manual_admin` (le cas d'usage dominant d'un ajout manuel).
3. **Détail** — `<textarea>`. **Obligatoire si et seulement si
   `reason === 'manual_admin'`** ; facultatif pour les 6 autres raisons.
   - Quand obligatoire : le champ porte `aria-required="true"`, son label
     affiche `*`, et le bouton Ajouter est **désactivé** tant que le détail est
     vide (trim). Message inline si soumission tentée vide :
     « Le détail est obligatoire pour une suppression manuelle. »
   - **POURQUOI** : une suppression `manual_admin` est un blocage décidé par un
     humain, sans trace automatique (pas de bounce, pas de plainte FBL). Sans
     le motif écrit, personne ne peut, des mois plus tard, savoir POURQUOI
     l'adresse a été bloquée ni si le retrait est légitime. Le détail est la
     **traçabilité** de la décision (« demande téléphonique du 06/06, ticket
     #4821 », « plainte WhatsApp, voir capture »).
4. **Source** — implicite : un ajout manuel via cette UI pose
   `source = 'manual'` (sauf raison `cndp_request` → `source = 'cndp'`, voir
   SM-F09-03). Non éditable par l'opérateur (évite l'incohérence
   source/raison).

**Rappel pédagogique** affiché dans le dialog : « Cette adresse sera bloquée
pour les envois transactionnels ET les campagnes. »

**Soumission** → `POST /api/admin/emails/suppression` (voir spec). Résultats :
- **succès** → toast succès « <email> ajouté à la liste de suppression. »,
  dialog fermé, liste rafraîchie, la nouvelle ligne **visible** (en tête si le
  tri `since desc` la place là, sinon visible après reset des filtres).
- **422 détail manquant** → erreur inline dans le dialog (resté ouvert),
  saisie préservée.
- **409 allowlist** (adresse interne) → message dédié, **distinct** du doublon :
  « Adresse interne protégée : <email> ne peut pas être ajoutée à la liste de
  suppression (allowlist R-009). » Dialog reste ouvert, saisie préservée.
- **409 doublon** (déjà présente) → message : « <email> est déjà dans la liste
  de suppression. » Dialog reste ouvert.

### A.2 Filtres combinables (SUP-F02 / SUP-03)

Trois filtres branchés sur l'API existante (`q`, `reason`, `source`) :

- **Recherche email** (`q`) : sous-chaîne ILIKE, casse-insensible, wildcards LIKE
  échappés côté serveur.
- **Raison** : `<select>` « Toutes » + 7 raisons.
- **Source** : `<select>` « Toutes » + 4 sources.

**Combinables** : email + raison + source s'AND-ent (un seul GET porte les 3
params). Le placeholder mensonger « Filtrer par email, raison ou source… »
(SUP-05 audit) est corrigé : la recherche texte ne filtre QUE l'email,
explicitement libellée « Filtrer par email ».

**URL persistée** : `?email=&reason=&source=&offset=` ; rechargement (F5) /
partage de lien restitue exactement la vue. Un bouton **Réinitialiser** efface
les 3 filtres + remet `offset=0`. Tout changement de filtre remet `offset=0`.

### A.3 Retrait unitaire migré au socle (SUP-F04 / TRV-01) — **écran PILOTE P1.5**

L'existant utilise `window.confirm` (3 lignes) + un bandeau `role=status` /
`role=alert` maison. La migration remplace :
- `window.confirm` → **ConfirmDialog** (variante danger, libellé verbe
  « Retirer », conséquences explicites « pourra de nouveau recevoir des emails
  transactionnels ET campagnes ») ;
- bandeau succès maison → **toast** succès (auto-dismiss 4 s) ;
- état vide maison → **EmptyState** (variantes `empty` / `filtered`).

C'est l'**écran pilote** du socle : il valide les invariants F01 sur un écran
réel avant généralisation. Comportement préservé : **ligne conservée sur
erreur**, zéro faux succès (feedback succès seulement sur `res.ok`),
anti-double-clic.

### A.4 Retrait en masse (SUP-F05 / SUP-04)

- **Sélection** : checkbox par ligne + checkbox « tout sélectionner » (la page
  courante). Compteur « N sélectionnées ».
- **Barre d'action** (bulk bar) apparaît dès ≥ 1 sélection : « N sélectionnées
  [Retirer les N adresses…] ».
- **Confirmation unique** : un seul `ConfirmDialog` pour les N (pas N confirm).
  Le corps affiche le **nombre** : « Retirer 23 adresses de la liste de
  suppression ? Elles pourront de nouveau recevoir des emails. » Variante danger.
- **Soumission** → `POST /api/admin/emails/suppression/bulk-remove`
  `{ emails: [...] }`.
- **Résultat partiel HONNÊTE** : la réponse `{ removed: number, notFound: string[] }`.
  Feedback : « 21 retirées · 2 introuvables (déjà absentes). » Jamais
  « 23 retirées » si seulement 21 l'ont été. Liste rafraîchie ; sélection vidée
  sur succès.
- **Échec réseau** : la **sélection est préservée** (l'opérateur peut réessayer
  sans tout re-cocher), message `role=alert`, aucun faux succès.
- **Audit-log** : un événement `mail.suppression.bulk_remove` par appel, avec la
  liste des emails et le compte effectif (sécurité délivrabilité).

### A.5 Export CSV de la liste filtrée (SUP-F06 / SUP-06)

- Bouton `[⬇ Export CSV]`. → `GET /api/admin/emails/suppression/export?<mêmes
  filtres que la liste>`.
- **Exporte la liste FILTRÉE** (pas seulement la page courante) : les params
  `email/reason/source` sont propagés ; pas de `limit/offset`.
- **Colonnes** : `email,reason,reason_label,source,source_label,detail,since`.
  `reason`/`source` = slugs (réimportables) ; `*_label` = libellés FR (lisibles).
  `detail` échappé RFC4180 (guillemets doublés, champ entre `"` si virgule /
  saut de ligne / guillemet).
- **BOM UTF-8** en tête (`﻿`) → accents corrects à l'ouverture Excel.
- **Nom de fichier daté** : `Content-Disposition: attachment;
  filename="suppression-YYYY-MM-DD.csv"`.
- Libellé honnête : si la liste filtrée est volumineuse, l'export reflète
  exactement le filtre courant (mêmes conditions WHERE que le GET liste).

### A.6 Allowlist — comportement EXACT (SUP-F07 / R-009, non-régression)

- **À l'ajout** : `POST` d'une adresse interne (exacte ou domaine
  `@femiglow-maroc.com`) → **REFUSÉ 409** message « Adresse interne protégée ».
  L'adresse n'entre jamais dans la table via l'UI.
- **Au retrait / au check d'envoi** : `isSuppressed('info@femiglow-maroc.com')`
  retourne **toujours `false`** (court-circuit), même si une ligne interne
  existait en base (legacy) — l'envoi des notifications internes n'est jamais
  bloqué.
- **À l'affichage** : les adresses internes ne figurent jamais dans la liste
  (invisibles).
- Non-régression intégration : `addSuppression` (couche lib) doit refuser une
  adresse interne ; `isSuppressed` doit bypasser ; `findSuppressed` ne renvoie
  jamais une interne.

---

## B. Events (debug)

### B.1 Titre désambiguïsé

Renommer le titre « Events utilisateur (pipeline `user_event`) » pour lever
l'ambiguïté avec `email_event` (timeline du cockpit). Sous-titre rappelant que
ce pipeline est **distinct** des events email.

### B.2 Filtres nom d'event + email (EVT-F02 / EVT-04)

Deux filtres ajoutés aux filtres source existants :
- **Nom d'event** : sous-chaîne (`cart_*` → tous les events dont le nom contient
  `cart`). ILIKE casse-insensible.
- **Email** : sous-chaîne de l'adresse.
Combinables avec le filtre `source` existant. URL persistée
(`?source=&event=&email=&window=`).

### B.3 Fenêtre temporelle cohérente (EVT-F02 / EVT-03)

Le bug audit : le « Total 24h » et le « Top events (24h)» sont fenêtrés à 24 h,
mais le stream « 100 derniers » n'a **aucune** fenêtre → il peut afficher des
events vieux de plusieurs jours sous des compteurs 24 h (incohérence).

**Cible** : un toggle de fenêtre `(24 h ▼)` partagé, avec au moins deux valeurs :
- **24 h** (défaut) : le stream est borné `ts >= now-24h` → **cohérent** avec
  les compteurs.
- **Tout** : explicitement « sans fenêtre » (le stream peut remonter loin),
  affiché clairement pour que l'opérateur sache qu'il sort du périmètre 24 h.

Sémantique : quand `window=24h`, AUCUNE ligne du stream n'a `ts < now-24h`.
Quand `window=all`, l'en-tête indique « fenêtre : tout » (pas de promesse 24 h).

### B.4 Expand JSON (EVT-F03 / EVT-02)

Le `JSON.stringify(properties)` tronqué (`max-w-md truncate`) devient un
`<details>` (chevron « ▸ propriétés (N clés) ») :
- replié : résumé « N clés » ;
- déplié : JSON **formaté** (`JSON.stringify(properties, null, 2)`), contenu
  **complet** (aucune troncature), dans un bloc `<pre>` scrollable.
- 0 clé → « — » (pas de chevron).

### B.5 Corrélation outbox / campagne (EVT-F03 / EVT-01)

Règle de corrélation — **quelles clés de `properties` déclenchent un lien** :

| clé présente dans `properties` | lien généré |
|---|---|
| `outbox_id` (valeur non vide) | → `/admin/emails/cockpit/<outbox_id>` (détail transactionnel), libellé « voir l'envoi » |
| `campaign_id` (valeur non vide) | → `/admin/emails/campaigns/<campaign_id>` (détail campagne), libellé « voir la campagne » |

- Les deux peuvent coexister (deux liens).
- **Aucune** des deux clés / valeur vide / nulle → **aucun lien** (juste le JSON).
- La valeur du lien est l'identifiant brut de la propriété ; aucune
  fabrication d'id si la clé est absente (pas de lien deviné).

### B.6 Responsive (EVT-F02 / EVT-05)

Le conteneur de la table du stream porte `overflow-x-auto` (déjà présent sur la
table « Top events » — à généraliser au stream). Oracle : le wrapper de la
table « 100 derniers events » a la classe `overflow-x-auto` → pas de débordement
horizontal cassé sur petit écran.

---

## C. Ce qui doit être vérifié (synthèse des oracles)

1. Dialog d'ajout : détail requis ssi `manual_admin` ; les 6 autres raisons
   acceptent un détail vide ; bouton désactivé tant que requis manquant.
2. 422 détail manquant / 409 allowlist (message dédié) / 409 doublon (message
   distinct) sont visuellement distinguables par l'opérateur.
3. Filtres `email`+`reason`+`source` combinables, URL persistée, reset.
4. Bulk : sélection page/tout, ConfirmDialog avec **nombre**, résultat partiel
   honnête `{removed,notFound}`, sélection préservée sur échec, audit-log émis.
5. Export : filtres appliqués, BOM présent, RFC4180, nom de fichier daté.
6. Allowlist : refus à l'ajout (UI + lib), bypass `isSuppressed`, invisible.
7. Retrait unitaire migré au socle (pilote P1.5) : ConfirmDialog/toast/EmptyState,
   ligne préservée sur erreur, zéro faux succès.
8. Events : filtres nom/email, fenêtre 24h vs tout cohérente, expand JSON
   complet, corrélation par clé exacte, `overflow-x-auto` présent.
9. Grille réseau 6 cas (200/401/422/500/hang/network) pour CHAQUE action :
   ajout, bulk-remove, export, retrait unitaire.
10. a11y : axe 0 serious/critical sur les deux écrans.
