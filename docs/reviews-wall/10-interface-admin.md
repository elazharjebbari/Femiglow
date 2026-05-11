# 10 — Interface admin : modération, curation, audit

Cette spécification décrit l'interface back-office de gestion du composant « Rituels partagés » accessible aux modératrices de la maison à l'adresse `/admin/rituals`. Elle s'intègre à l'admin existant (`apps/web/src/app/admin/`) sans modifier sa structure.

## 1. Navigation

Ajout dans la sidebar admin existante, sous la rubrique **Communauté** (à créer si elle n'existe pas) :

```
─ Tableau de bord
─ Analytics
─ Components
─ Products
─ Media
─ Communauté
   ├── Leads
   └── Rituels partagés        ← nouveau
─ SEO
─ Settings
─ Tracking
─ Webhooks
```

L'entrée pointe vers `/admin/rituals/queue` (vue par défaut).

## 2. Vue d'ensemble (5 onglets)

| Onglet | URL | Rôle |
| --- | --- | --- |
| **Queue** | `/admin/rituals/queue` | Témoignages `PENDING` à modérer |
| **Publiés** | `/admin/rituals/published` | Tous les `APPROVED` |
| **Masqués / Rejetés** | `/admin/rituals/archived` | `HIDDEN` et `REJECTED` |
| **Insights** | `/admin/rituals/insights` | Agrégation marketing |
| **Politique** | `/admin/rituals/politique` | Éditeur du texte vérification |

Chaque onglet est un sous-route `page.tsx` partageant un layout commun `app/admin/rituals/layout.tsx`.

## 3. Onglet Queue (vue principale)

### 3.1 Structure

```
┌────────────────────────────────────────────────────────────┐
│  Queue de modération                          [Filtres ▾]  │
├────────────────────────────────────────────────────────────┤
│  Tri : Plus ancien │ Plus récent │ Priorité auto-flag      │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ▲ PRIORITÉ                                            │  │
│  │ 🛈 Visage détecté · 🛈 Emoji détecté                  │  │
│  │                                                       │  │
│  │ « Trois mois et l'ongle a retrouvé sa nervure... »   │  │
│  │ — Amal, Rabat · Initiée février 2026                  │  │
│  │ Signal : Oui · Tags : ongles plus lisses, plus de... │  │
│  │ Photos : 2 (1 manual review)                          │  │
│  │ Source : email_j45 · Vérifiée : Oui                   │  │
│  │ Soumis il y a 3 h                                     │  │
│  │                                                       │  │
│  │ [Voir détail]                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ « Cinq minutes le soir... »                          │  │
│  │ ...                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [12 témoignages en attente]                               │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Filtres

Bouton `[Filtres ▾]` ouvre un panel :

| Filtre | Options |
| --- | --- |
| Auto-flags | Toutes / Visages détectés / Emojis détectés / Lien externe / Mot interdit / Trop court / Trop long |
| Vérifié | Toutes / Initiée vérifiée / Non vérifiée |
| Source | Toutes / Web / E-mail J+45 / Manuel |
| Langue | Toutes / FR / AR |
| Photos | Toutes / Avec photos / Sans photos / Photos en revue manuelle |
| Date | Aujourd'hui / 7 jours / 30 jours / Tous |

Filtres combinables. URL params persistés.

### 3.3 Tri

- Plus ancien d'abord (défaut, pour respecter SLA 24-48 h).
- Plus récent d'abord.
- Priorité auto-flag (rejets potentiels en haut, à traiter en premier).

### 3.4 Carte queue (résumé)

| Élément | Contenu |
| --- | --- |
| Badge priorité | Si auto-flag présent, badge orange `PRIORITÉ` en haut |
| Indicateurs auto-flags | Icônes 16 px : 🛈 (visage), 🛈 (emoji), etc. — uniquement si présents |
| Citation | Aperçu 2 lignes Cormorant Italic 16 pt, ellipsis |
| Signature | Inter 12 pt brume |
| Métadonnées | Signal, Tags (max 3 affichés), Photos (compte + statut), Source, Vérifié, Soumis il y a... |
| Bouton | `Voir détail` → ouvre la vue détaillée |

### 3.5 Bulk actions

Sélection multiple via checkbox sur chaque carte. Actions disponibles :

- **Approuver en masse** (uniquement si toutes les cartes sélectionnées sont sans flags critiques).
- **Rejeter en masse** (modale demande raison commune).

Bulk approve sans flag critique = workflow rapide pour traitement express.

## 4. Vue détaillée d'un témoignage

URL : `/admin/rituals/queue/[id]` (ou `/admin/rituals/[id]` selon contexte).

### 4.1 Layout 2 colonnes

```
┌─────────────────────────────────┬───────────────────────────┐
│  Preview (comme sur le wall)    │  Actions & Métadonnées     │
│                                 │                            │
│  RITUEL PARTAGÉ                 │  [Approuver]               │
│  Les voix de la maison          │  [Rejeter]                 │
│  ──                             │  [Masquer]                 │
│                                 │  [Mettre en avant]         │
│  ┌─────────┐                    │                            │
│  │ photo 1 │  « Trois mois et   │  Auto-flags                │
│  └─────────┘    l'ongle... »    │  ─ Visage détecté (photo 1)│
│                                 │  ─ Emoji détecté (texte)   │
│  — Amal, Rabat                  │                            │
│  Initiée février 2026           │  Texte original (avant     │
│                                 │  sanitization)             │
│  ongles plus lisses · plus de   │  [Afficher / masquer]      │
│  casse                          │                            │
│                                 │  Source : email_j45         │
│  [Reviendrait]                  │  Initiée vérifiée : Oui     │
│                                 │  Order : #FG-2026-00037    │
│                                 │  Soumis : 11 mai 16:32     │
│                                 │  Customer hash : 3a4b...   │
│                                 │                            │
│                                 │  ─────────                 │
│                                 │                            │
│                                 │  Audit                     │
│                                 │  ─ Système · created       │
│                                 │    11 mai 16:32            │
│                                 │  ─ Système · auto-flag     │
│                                 │    face_detected           │
│                                 │    11 mai 16:33            │
└─────────────────────────────────┴───────────────────────────┘
```

### 4.2 Bloc Preview

Reproduction fidèle de la carte telle qu'elle apparaîtra sur le wall, avec photos cliquables qui ouvrent une lightbox **avec marquage des visages détectés** (rectangles rouges, comptés).

### 4.3 Bloc Actions

| Bouton | Comportement |
| --- | --- |
| **Approuver** | Modale de confirmation, met `status = APPROVED`, `published_at = now()`. Si auto-flag faces présent, demande confirmation supplémentaire. |
| **Rejeter** | Modale obligatoire : `Raison interne` (texte libre) + `Message à l'auteure` (template pré-rempli, éditable). E-mail envoyé si `customer_hash` rattachable. |
| **Masquer** | Modale : `Raison`. Met `status = HIDDEN`. Le témoignage disparaît du wall mais n'est pas supprimé. |
| **Mettre en avant** | Bascule `featured = true`. Limité à 3 simultanés ; si déjà 3, propose de retirer le moins récent. |
| **Restaurer** | Visible si `status != APPROVED` : remet en `APPROVED`. |
| **Corriger une coquille** | Ouvre un éditeur de texte limité (max 5 caractères changés sans re-modération). Au-delà : action `corrected_substantially`, demande nouvelle modération. |

### 4.4 Bloc Métadonnées

Toutes les colonnes non éditables de la table `ritual_testimonials` affichées en lecture seule, regroupées par sections (Auteur, Vérification, Système).

### 4.5 Bloc Audit

Log immuable issu de `ritual_audit_log`, du plus récent au plus ancien. Chaque entrée : `Acteur · action · note · timestamp`. Système ou modératrice nommée.

## 5. Vue photos détaillée

Quand une photo est `MANUAL_REVIEW`, la modératrice peut :

1. Visualiser la photo plein écran avec les rectangles ML autour des visages.
2. Voir le `faces_count`.
3. Choisir :
   - **Approuver la photo** (override le flag) — utile pour menton/hijab/sourire.
   - **Rejeter la photo** seule (pas le témoignage entier).
   - **Demander à l'auteure une autre photo** (e-mail template).
4. Re-run vision ML (`/api/admin/rituals/[id]/photos/[photoId]/recheck`) si la modératrice doute du résultat.

## 6. Onglet Publiés

### 6.1 Liste

Identique à Queue mais avec status `APPROVED`. Filtres adaptés :

- Featured / Non featured.
- Photos / Sans photos.
- Signal de retour.
- Tags choisis.
- Période de publication.

### 6.2 Actions par carte

- **Voir détail** (lecture seule + audit).
- **Mettre en avant** / **Retirer la mise en avant**.
- **Masquer** (si problème découvert a posteriori).

## 7. Onglet Masqués / Rejetés

Liste des `HIDDEN` et `REJECTED`. Permet :

- **Restaurer** (passage en `PENDING` puis re-modération, ou directement en `APPROVED` selon contexte).
- **Suppression définitive** (RGPD — demande utilisateur). Modale double confirmation.

## 8. Onglet Insights

### 8.1 KPI globaux

```
┌──────────────────────────────────────────────────┐
│  Témoignages publiés       26                    │
│  En attente                 3                    │
│  Rejetés                    1                    │
│  Masqués                    0                    │
├──────────────────────────────────────────────────┤
│  Reviendraient              92,3 %  (24 sur 26)  │
│  Hésitent                    3,8 %  (1 sur 26)   │
│  Pas pour elles              3,8 %  (1 sur 26)   │
├──────────────────────────────────────────────────┤
│  Avec photos                69,2 %  (18 sur 26)  │
│  Initiée vérifiée           80,8 %  (21 sur 26)  │
└──────────────────────────────────────────────────┘
```

### 8.2 Tags les plus mentionnés

Histogramme horizontal :

```
ongles plus lisses    ████████████████  17
plaque souple         █████████████     14
cuticules apaisées    ██████████        11
plus de casse         █████████         9
éclat naturel         ███████           7
rituel devenu habitude ██████           6
halal                  ████             4
mains détendues        ███              3
fini brillant          ██               2
```

### 8.3 Soumissions dans le temps

Graphique linéaire 90 derniers jours, courbes superposées : soumissions / approuvées / rejetées.

### 8.4 Sources

```
E-mail J+45    ████████████  78 %
Web direct     ████          18 %
Manuel         █              4 %
```

### 8.5 Taux d'approbation et SLA

- Taux d'approbation : 96 % (25 / 26).
- Temps médian de modération : 14 h (cible < 48 h).
- Témoignages dépassant 48 h en queue : 0.

Une alerte rouge si > 0 témoignages dépassent 48 h.

## 9. Onglet Politique

Éditeur Markdown du texte « Comment ces rituels partagés sont vérifiés ».

- Champ Markdown avec preview.
- Stocké dans table `app_config` section `rituals_policy`.
- Versionné dans `app_config_snapshots`.
- Bouton `Publier` (met à jour la version courante exposée à `/api/rituals/policy`).
- Bouton `Restaurer une version` (liste les versions précédentes datées).

## 10. Notifications / Slack hook (optionnel)

Webhook configurable dans `/admin/settings/webhooks` :

- Événement `ritual_submitted` : nouvelle soumission, lien direct vers la vue détaillée.
- Événement `ritual_face_detected` : photo avec visage à examiner.
- Événement `ritual_sla_warning` : témoignage en queue depuis > 36 h.

Format : payload JSON HMAC-signé selon le système webhooks existant.

## 11. Permissions RBAC

Trois rôles utilisés :

| Rôle | Queue | Approuver | Rejeter | Masquer | Featured | Politique | Insights |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **admin** | Oui | Oui | Oui | Oui | Oui | Oui | Oui |
| **moderator** | Oui | Oui | Oui | Oui | Non | Non | Lecture |
| **viewer** | Lecture | Non | Non | Non | Non | Non | Lecture |

Rôles stockés dans `admin_users.role`.

## 12. Performance admin

- Pagination 25 par page (queue et publiés).
- Recherche full-text sur `body` et `author_first_name` (index trigram Postgres).
- Photos chargées en thumbnails 240×240, full-res à la demande.
- Tableau virtualisé `react-virtual` si > 100 entrées affichées simultanément.

## 13. Tests

- E2E Playwright `apps/web/e2e/admin-rituals.spec.ts` :
  - Login admin → queue → ouvrir détail → approuver → vérifier `APPROVED` côté API.
  - Soumettre une review test depuis le wizard → vérifier qu'elle apparaît dans la queue.
  - Tester la détection de visages : uploader une photo de visage → vérifier `MANUAL_REVIEW`.
- Unit Vitest : permissions RBAC, validations Zod, helpers de calcul d'agrégation.

## 14. Templates d'e-mails (modération)

Stockés dans `apps/web/content/email-templates/`.

### 14.1 `rituals-rejected-face.md`

```
Objet : À propos de votre photo

Bonjour [Prénom],

Merci d'avoir partagé votre rituel avec la maison.

Pour préserver l'intimité de notre communauté, nous publions
des photos de mains, de gestes, de tables de soin — jamais de
visage de face. La photo que vous nous avez envoyée contient
un visage que nous avons identifié.

Souhaiteriez-vous nous envoyer une autre photo, centrée sur
vos mains ou un détail de votre rituel ? Vous pouvez répondre
à ce mail avec la nouvelle image.

Votre témoignage écrit, lui, est en attente de publication.

Avec soin,
La maison FemiGlow
```

### 14.2 `rituals-rejected-other.md`

```
Objet : Votre rituel partagé

Bonjour [Prénom],

Merci d'avoir pris le temps d'écrire ce témoignage.

Après lecture, nous ne pourrons pas le publier en l'état.
La raison : [raison personnalisée par la modératrice].

N'hésitez pas à nous écrire à info@femiglow-maroc.com si vous
souhaitez en discuter — la maison reste à l'écoute.

Avec soin,
La maison FemiGlow
```

### 14.3 `rituals-approved.md`

```
Objet : Votre rituel est publié

Bonjour [Prénom],

Votre rituel a été lu et publié sur notre site. D'autres
initiées le découvriront en ce moment même.

Merci d'avoir prêté votre voix à la maison.

[ Lire le wall des rituels ]

Avec soin,
La maison FemiGlow
```

Les variables (`[Prénom]`, `[raison]`) sont remplacées au send.

## 15. Synthèse — workflow type d'une modération

1. Souheila ouvre `/admin/rituals/queue` le matin.
2. Tri par « Plus ancien d'abord ».
3. 3 témoignages PENDING. 1 avec auto-flag `face_detected`.
4. Elle clique le témoignage avec flag.
5. Vue détaillée : photo avec rectangle rouge sur un visage frontal.
6. Action : **Rejeter** → modal avec template pré-rempli `rituals-rejected-face.md`. E-mail envoyé.
7. Les 2 autres : lecture rapide, aucun flag → **Approuver** (bulk approve si elle veut). 
8. `published_at = now()`, `ritual_aggregate` rafraîchi sous 5 min.
9. Les 2 témoignages apparaissent sur le wall public.
10. Tracking `ritual_admin_action` push dans `audit_events`.

Temps moyen par témoignage : 2 à 3 min. Pour un volume cible 10 / mois, charge < 30 min par mois. Très soutenable.
