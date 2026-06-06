# F05 — Campagnes — fonctionnement optimal

> Périmètre : CMP-F01..CMP-F14 (sauf CMP-F03/CMP-F05 wizard é1/é3 dont la logique
> de socle est portée par F01 ; les étapes elles-mêmes restent décrites ici).
> Fichiers : `app/admin/emails/campaigns/**`,
> `components/admin/emails/wizard/CampaignWizard.tsx`,
> `lib/admin/emails/wizard-actions.ts`,
> `lib/mail/campaigns/listmonk-{status-sync,sync}.ts`.
> Problèmes d'audit verrouillés : CAMP-01, CAMP-02, CAMP-03, CAMP-04, CAMP-06,
> CAMP-07, CAMP-08, CAMP-09, CAMP-10, CAMP-11, CAMP-12, CAMP-13 (n/d only),
> CAMP-15, CAMP-16. CAMP-05 (stepper cliquable) et CAMP-14 (raccourcis clavier)
> sont fournis par le **Wizard partagé (SOC-F05)** et seulement *consommés* ici.
>
> Deux lecteurs : **l'opérateur** (ce qu'il voit/perçoit/peut faire) et **le
> développeur consommateur** (l'action à appeler, les invariants garantis). Les
> oracles sont binaires et observables en vue opérateur (cf. 05-strategie-tests
> §7).

---

## 0. Vue d'ensemble du parcours

```
Liste ──[+ Créer | /new]──▶ draft ──▶ Wizard 6 étapes (autosave 2s)
                                          │
                          (reprise via wizard_step après F5 / autre poste)
                                          ▼
                              é6 Vérification ──▶ finalize ──▶ scheduled | sending
                                          │                          │
                              (estimation KO ×3 → fallback)     poll Listmonk
                                                                     ▼
                                                            sent | paused | cancelled | failed
```

Trois écrans : **Liste** (RSC, filtres URL), **Wizard** (client, route
`/[id]/edit` + nouvelle route `/new`), **Détail** (RSC + barre d'actions client).

---

## CMP-F01 / CMP-F16 — Liste : recherche, filtres, pagination

### Pour l'opérateur
- Table 20 lignes/page (`?q=&status=&page=`). Colonnes : Nom, Sujet, Statut
  (Pill unifié SOC-F06), Audience, Date, Actions.
- Recherche `q` sur nom OU sujet (RSC, submit URL — pas de debounce serveur).
- Filtre statut : « Tous » + les 7 statuts. La sélection est reflétée dans l'URL
  (partageable, survit au F5).
- Pagination Précédent/Suivant + numéro de page ; jamais de page hors bornes.
- Ligne `draft` → action **Continuer** (vers le wizard) ; ligne terminale →
  **Voir** + **Dupliquer**.
- Liste vide / aucun résultat de filtre → `EmptyState` unifié (titre, explication,
  CTA « Nouvelle campagne »), JAMAIS un tableau vide muet.

### Détail à vérifier
- L'URL est la source de vérité : recharger une URL `?q=été&status=sent&page=2`
  restitue exactement le même écran.

---

## CMP-F02 / CMP-F08 — Création : route `/new` + warning unicité du nom

### Pour l'opérateur
- Deux entrées équivalentes : le formulaire inline en entête de liste **et** la
  route `/admin/emails/campaigns/new` (CAMP-08 — cohérence avec les autres
  sections ; accessible via palette ⌘K et lien « Nouvelle campagne »).
- Le champ « Nom interne » exige 3–120 caractères. En dessous de 3 : message
  inline `role="alert"`, pas de création.
- **Unicité (CAMP-12)** : pendant la frappe (debounce 500 ms), un appel async
  vérifie si le nom existe déjà. Si oui → bandeau **warning NON bloquant** :
  « Une campagne nommée "X" existe déjà — c'est autorisé, vérifie que ce n'est
  pas un doublon. » La création reste possible (le nom interne n'est pas une clé).
- Création réussie → redirect `/[id]/edit` (le wizard s'ouvre à l'étape 1).

### Pour le développeur
- `/new` est un **Server Component qui crée immédiatement le draft puis redirige**
  vers `/[id]/edit` (pas de double écran). En cas d'échec DB : page d'erreur
  neutre + lien retour liste (jamais de draft fantôme à demi créé — l'INSERT est
  atomique).
- Le check d'unicité est un GET `/api/admin/emails/campaigns/name-available?name=`
  (ou server action `checkCampaignNameAvailable`) — résultat purement indicatif,
  jamais une contrainte 422.

---

## CMP-F03..F08 + CMP-F05/F10 — Le wizard 6 étapes

> Le wizard **adopte le Wizard partagé `useWizard` (SOC-F05)** : stepper
> cliquable sur les étapes ≤ la plus haute validée (CAMP-05), focus management,
> Ctrl+flèches (CAMP-14), persistance de l'étape courante (`wizard_step`),
> autosave hook. F05 fournit le *contenu* des 6 étapes et leurs validations ;
> le socle fournit la *mécanique* de navigation.

### Navigation entre étapes
- Le stepper affiche 6 pastilles : ✓ (validée, cliquable), ● (courante), ○ (à
  venir, non cliquable). Cliquer une étape ✓ y revient SANS perdre les données.
- « Suivant » valide l'étape courante (cf. validations ci-dessous) ; un échec de
  validation affiche un `role="alert"` et **ne change pas d'étape**.
- « Précédent » ne valide pas (on peut toujours reculer).
- Ctrl+→ / Ctrl+← naviguent (équivalents Suivant/Précédent, validation incluse
  pour →).

### Validations par étape (oracle = message exact ou passage autorisé)
| Étape | Champ | Règle | Message si invalide |
|---|---|---|---|
| 1 Nom | name | `trim().length ≥ 3` (et ≤ 120) | « Le nom doit faire au moins 3 caractères. » |
| 2 Audience | audienceId XOR audienceLinkIds | au moins une liste OU une audience | « Sélectionne au moins une liste OU une audience. » |
| 3 Contenu | bodyHtml | `trim().length ≥ 10` | « Le corps du mail est trop court. » |
| 4 Sujet | subject | `trim().length ≥ 3` (et ≤ 140) | « Le sujet doit faire au moins 3 caractères. » |
| 5 Planif | scheduledFor | si `scheduled` : non vide ET dans le futur (TZ) | « Choisis une date. » / « La date doit être dans le futur. » |
| 6 Vérif | ack + estimateKnown | case cochée ET estimation connue (ou fallback) | « Coche la case… » / « Attends l'estimation… » |

### Étape 2 — Audience (CMP-F04 : CAMP-09 / CAMP-11 / LMK-04)
- Radio « audience FemiGlow » (mutuellement exclusif) **OU** checkboxes « listes
  Listmonk ». Sélectionner une audience vide les listes et vice-versa.
- **Chips des listes sélectionnées (CAMP-11)** : sous les checkboxes, une rangée
  de chips « ✕ Liste A · ✕ Liste B » donne un récap clair de ce qui partira ;
  cliquer ✕ désélectionne.
- Estimation FemiGlow async (cf. §Fallback) ; libellé « Envois estimés : N ».
  Multi-listes → annotation « borne haute (doublons inter-listes non déduits) ».
- **Listmonk down (CAMP-09 / LMK-04 / LMK-F05)** : si la liste des listes/templates
  ne charge pas, bandeau **honnête** « Listmonk indisponible — impossible de
  charger les listes. Réessaie ou choisis une audience FemiGlow. », JAMAIS un
  faux hint vide ni une liste fantôme.

### Étape 3 — Contenu (CMP-F05)
- Template Listmonk **optionnel** (combobox recherchable) + corps HTML inline.
- Bouton « Aucun (corps libre) » revient au corps libre.
- Aperçu iframe `sandbox=""` (`data-testid="template-preview"`) du template
  sélectionné, mis à jour avec le corps courant.

### Étape 4 — Sujet & preheader (CMP-F06)
- Compteurs `N/140` (sujet) et `N/200` (preheader), mock inbox (expéditeur,
  sujet, preheader) reflétant la frappe.

### Étape 5 — Planification (CMP-F07 : CAMP-07 + schedule_timezone)
- Radios « Envoyer maintenant » / « Planifier ».
- En mode planifié : `datetime-local` **annoté de la timezone explicite**
  « heure de Casablanca (UTC+1) » + phrase « vos destinataires recevront l'email
  à HH:MM heure locale Maroc ».
- La TZ retenue est **`Africa/Casablanca`** (persistée dans `schedule_timezone`).
  L'instant choisi par l'opérateur est interprété DANS cette TZ puis converti en
  UTC pour Listmonk (cf. 02-spec-technique §conversion TZ).
- **Date passée refusée** : l'instant converti doit être > `now()` ; sinon
  « La date doit être dans le futur. » et l'étape ne passe pas.
- Note DST : `Africa/Casablanca` peut suspendre l'heure d'été (ramadan). La
  conversion s'appuie sur `Intl`/`date-fns-tz` (offset au moment T), jamais sur
  un offset codé en dur (cf. risques 05-plan §DST).

### Étape 6 — Vérification (CMP-F08 : CAMP-01) + test send (CMP-F09 : CAMP-04)
- Récap (Nom, Audience+volume, Template, Sujet, Preheader, Planification),
  aperçu corps iframe, bloc « Envoyer un test », garde estimation, case d'ack
  chiffrée, bouton « Envoyer maintenant » / « Planifier ».
- La case d'ack porte le **nombre chiffré** (« ~1 234 destinataires ») et n'est
  jamais cochable tant que l'estimation est inconnue (sauf fallback assumé).

---

## CMP-F10 — Autosave debounced 2 s + indicateur + reprise

### Pour l'opérateur
- Toute modification dans le wizard (frappe d'un champ, sélection, changement de
  mode planif) déclenche un **autosave silencieux 2 s après la dernière frappe**.
- Indicateur près du stepper : « Enregistrement… » pendant l'écriture →
  « ✓ Brouillon enregistré il y a Xs » (âge relatif rafraîchi, TZ via Freshness
  SOC-F04). Sur échec : « ⚠ Échec de l'enregistrement — réessayer » (action).
- **Reprise (CAMP-03)** : après F5, retour navigateur, ou ouverture depuis un
  autre poste, le wizard ré-ouvre **à l'étape persistée (`wizard_step`)** avec
  toutes les données (nom, audience, contenu, sujet, planif) rechargées.
- L'étape courante est elle-même autosauvée : quitter à l'étape 4 → revenir à
  l'étape 4.

### Détail du payload partiel (quoi / quand / contenu)
- **Quand** : debounce 2 s côté client après mutation ; ET au passage d'étape
  (flush immédiat, pas d'attente) ; ET au blur de la fenêtre (best-effort).
- **Quoi** : `saveWizardProgress({ id, wizardStep, patch })` où `patch` ne porte
  QUE les champs touchés (merge non destructif serveur — cf. `loadPayload`).
  Champs possibles : `name, subject, preheader, listmonkTemplateId,
  audienceLinkIds, audienceId, scheduledFor, scheduleTimezone, payloadJson.body`.
- **Contenu de l'indicateur** : pose `savedAt` au retour OK ; l'indicateur lit
  `savedAt` et affiche l'âge. Un autosave en vol n'efface PAS la dernière valeur
  « enregistré il y a Xs » (transition « Enregistrement… » par-dessus).

### Invariants
- **Frappe rapide = 1 seul POST** : pendant une rafale de frappe < 2 s,
  l'autosave est rearmé à chaque frappe ; un seul appel part 2 s après la
  DERNIÈRE frappe (anti-rafale).
- L'autosave n'écrit JAMAIS le statut ni `listmonk_campaign_id` (uniquement des
  champs de brouillon) — il ne peut pas déclencher d'envoi ni régresser un état.
- Un autosave échoué laisse les données saisies intactes à l'écran (l'opérateur
  ne perd rien ; il peut continuer et réessayer).

---

## CMP-F08 — Fallback « envoyer sans estimation » (CAMP-01)

> Sans ce fallback, une API d'estimation morte produit un **deadlock** : la case
> d'ack et le bouton d'envoi restent bloqués indéfiniment. Le fallback est une
> sortie **assumée et tracée**, pas un contournement silencieux.

### Machine à états des tentatives (étape 6, audience FemiGlow uniquement)
```
        ┌──────────────┐  succès   ┌─────────────────────┐
        │ estimation    │─────────▶│ NOMBRE CONNU         │
   ┌───▶│ en cours       │          │ → ack chiffrée + envoi│
   │    │ (spinner)      │          │   normal possible    │
   │    └──────┬─────────┘          └─────────────────────┘
   │ Réessayer │ échec (HTTP/parse/abort hors-user)
   │           ▼
   │    ┌──────────────┐  échec    ┌──────────────┐  échec  ┌────────────────────┐
   └────│ tentative 1   │─────────▶│ tentative 2   │───────▶│ tentative 3 ÉPUISÉE │
        │ « Réessayer » │          │ « Réessayer » │        │ → bouton dégradé    │
        └──────────────┘          └──────────────┘        │ « Envoyer sans     │
                                                           │  estimation… »      │
                                                           └─────────┬──────────┘
                                                                     │ clic
                                                                     ▼
                                              ┌──────────────────────────────────┐
                                              │ ConfirmDialog (danger) :          │
                                              │ « Vous allez envoyer SANS         │
                                              │  connaître le volume. L'audience  │
                                              │  sera évaluée au moment du send.  │
                                              │  Taper ENVOYER : ___ »            │
                                              │ bouton actif SSI saisie = ENVOYER │
                                              └──────────────────────────────────┘
```

### Règles
- Le compteur de tentatives s'incrémente **uniquement sur un échec réel** (HTTP
  non-2xx, JSON invalide, network error). Un abort utilisateur (changement
  d'audience) ne compte pas.
- Avant la 3ᵉ tentative épuisée : SEUL « Réessayer » est offert (pas de fallback).
- À la 3ᵉ tentative épuisée : le bouton **dégradé** « Envoyer sans estimation… »
  apparaît À CÔTÉ de « Réessayer » (le chemin normal reste tentable).
- Le ConfirmDialog (variante danger, socle SOC-F01) exige la saisie EXACTE
  `ENVOYER` (insensible à la casse/espaces de bord) ; le bouton de confirmation
  reste désactivé sinon.
- **Succès tardif** : si une estimation finit par réussir (ex. l'opérateur
  reclique « Réessayer » après l'apparition du fallback), l'UI **réactive le
  chemin normal** : le nombre s'affiche, la case d'ack chiffrée reprend, le
  bouton dégradé disparaît. On ne reste pas bloqué en mode dégradé.
- Côté serveur, `finalize` reçoit un drapeau `skipEstimate: true` ; l'audience
  est évaluée au snapshot/push réel au moment du send (aucune estimation
  préalable requise). Le drapeau est tracé dans l'audit-log.

---

## CMP-F09 — Test send (épreuve)

> Deux chemins selon la présence d'un template Listmonk. Aucun ne mute la
> campagne ni son statut. Tous deux livrent une vraie épreuve dans la boîte de
> l'admin.

### Avec template (chemin Listmonk existant — `sendCampaignTest`)
- Le destinataire est upserté comme abonné Listmonk puis l'épreuve part par
  l'API **transactionnelle Listmonk** (`template_id` + `data:{subject, body,
  preheader, is_test}`).
- Feedback succès `role="status"` « Épreuve envoyée à X. » ; échec `role="alert"`
  avec le message Listmonk honnête.

### Sans template (corps libre — nouveau : `sendCampaignTestViaOutbox`, CAMP-04)
- L'épreuve part par le **pipeline transactionnel interne (outbox)** : on crée
  UNE ligne d'outbox (sujet + corps libre rendus) destinée à l'adresse de test,
  drainée par le worker existant. Le corps libre n'a plus besoin de template.
- Le bloc affiche « Sans template : l'épreuve part par le pipeline transactionnel
  interne. »
- Feedback succès « Épreuve mise en file (outbox) pour X. » ; échec honnête.

### Idempotence anti double-envoi
- Le bouton est verrouillé pendant l'envoi (`testSending` posé AVANT l'await,
  `aria-busy`, libellé « Envoi du test… ») : un double-clic n'émet qu'UNE requête.
- Côté outbox : une **clé d'idempotence** `test:{draftId}:{email}:{minute}` (ou un
  hash sujet+corps+destinataire) empêche deux lignes d'outbox identiques sur un
  double POST concurrent → une seule épreuve livrée.

---

## CMP-F11 — Détail : actions par statut (CAMP-06 / TRV-01)

### Actions disponibles selon le statut (vue opérateur)
| Statut | Pause | Reprendre | Annuler l'envoi | Supprimer le brouillon | Dupliquer | Rafraîchir |
|---|---|---|---|---|---|---|
| draft | — | — | — | ✓ (confirm) | ✓ | — |
| scheduled | — | — | ✓ (confirm) | — | ✓ | ✓ |
| sending | ✓ | — | ✓ (confirm) | — | ✓ | ✓ |
| paused | — | ✓ | ✓ (confirm) | — | ✓ | ✓ |
| sent / cancelled / failed | — | — | — | — | ✓ | ✓ |

- Toute action destructive (Annuler, Supprimer) passe par **ConfirmDialog**
  (SOC-F01, plus de `window.confirm`) rappelant le nom de la campagne, et émet un
  **toast** (SOC-F02) de résultat. Échec réseau → dialog reste, `role="alert"`,
  pas de faux succès.
- Les boutons illégaux sont MASQUÉS (l'UI calcule `caps` depuis le statut) ET le
  serveur refuse toute transition illégale (`isLegalTransition` → erreur).

### Duplication (CAMP-06)
- « Dupliquer » crée un draft « X (copie) » avec contenu/audience repris,
  **planification réinitialisée** (`scheduledFor=null`, `listmonkCampaignId=null`).
- Toast post-duplication : « Campagne dupliquée — **planification réinitialisée**.
  [La conserver] » ; l'action « La conserver » recopie la planif source dans le
  nouveau draft.

---

## CMP-F12 — Métriques + refresh (CAMP-02 / CAMP-10)

### Pour l'opérateur
- Bloc métriques : Envoyés, Ouvertures, Clics, Bounces (réels via poll) ; **Livrés
  et Désabos = `n/d`** avec **tooltip honnête (CAMP-02)** « Non couvert par le poll
  Listmonk. Suivi possible via webhook bounce (chantier R-013). » — jamais un `…`
  muet ni un faux 0.
- « ↻ Rafraîchir les métriques » : **spinner** pendant le poll, puis toast
  « Métriques à jour ». Échec de poll → toast d'erreur honnête (pas de silence,
  CAMP-10) ; les métriques restent celles du dernier poll réussi.
- « Dernière synchro : … » indique l'âge (Freshness) ; quand le sync retombe sur
  `updatedAt` (pas de vrai sync), c'est signalé (LMK-02, porté par F10).

---

## CMP-F13 — Détection campagne orpheline (CAMP-15)

### Critère (binaire)
Une campagne est **orpheline** ssi :
`status = 'sending'` ET `listmonk_campaign_id IS NULL` ET
`started_at < now() - interval '10 minutes'`.
(Crash entre la création Listmonk et la persistance de l'id ; pause/annulation
impossibles car aucun id à pousser.)

### Pour l'opérateur
- Bannière danger sur le détail : « ⚠ Cette campagne est en "envoi" sans
  référence Listmonk (création interrompue). » avec **deux sorties** :
  1. **[Marquer en échec]** → ConfirmDialog → `status='failed'`, `finishedAt`
     posé, toast « Campagne marquée en échec. ». (Sortie sûre par défaut.)
  2. **[Ré-associer (id Listmonk : ___)]** → champ de saisie d'un id Listmonk.
     - id **valide** (existe côté Listmonk) → on écrit `listmonk_campaign_id`,
       le sync reprend, la bannière disparaît, toast « Ré-associée à #N. ».
     - id **invalide / introuvable** → `role="alert"` « id Listmonk introuvable »,
       AUCUNE écriture, la bannière reste.
- La bannière n'apparaît PAS si l'un des trois critères manque (ex.
  `started_at` < 10 min → on attend ; `listmonk_campaign_id` présent → normal).

---

## CMP-F14 — Machine d'états (non-régression)

7 statuts : `draft, scheduled, sending, paused, sent, cancelled, failed`.
Transitions LÉGALES (source de vérité `isLegalTransition`, à NE PAS régresser) :

```
draft     → scheduled | sending | cancelled | failed
scheduled → sending | cancelled | failed
sending   → sent | cancelled | failed | paused
paused    → sending | cancelled | failed
sent / cancelled / failed → (terminaux, aucune sortie)
```

Invariants : un poll/rejeu ne régresse JAMAIS un terminal (`sent→sending`,
`cancelled→sending` rejetés) ; le serveur rejette toute transition illégale même
si l'UI l'a (par bug) proposée — l'arrêt d'urgence ne fait jamais confiance au
client.
