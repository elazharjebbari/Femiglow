# 02 — Contraintes FemiGlow : ce qui n'est pas transposable depuis Baiti

Ce document explicite ce que la voix « maison / rituel / initiée » et la charte graphique FemiGlow imposent de **réécrire** par rapport au gabarit d'un wall de témoignages e-commerce classique. Il sert de filtre obligatoire avant la phase prototype.

## 1. Le périmètre des interdits

### 1.1 Pas de notation 1 à 5 étoiles

**Constat de charte** (`docs/audit/07-singularites-dette.md` § 4.1) :

> Pas de système d'avis ratings 5-stars. Les avis sont éditoriaux (textes curés, photos de mains).
> Décision intentionnelle : les étoiles seraient bruit, et incompatibles avec la voix de la maison.

**Conséquence pour le wall** :

- Aucune mécanique 5★. Ni dans l'UI publique, ni dans le formulaire de dépôt, ni dans l'admin.
- Le concept de « note moyenne » disparaît au profit d'un **signal narratif** binaire ou ternaire.
- La distribution agrégée s'exprime non en histogramme 5→1 mais en **insights tagués** (« 89 % reprendraient le rituel », « 23 initiées sur 26 mentionnent une plaque plus lisse »).

**Mécanique de substitution proposée (à valider en prototype)** :

| Mécanique | Description | Précédent connu |
| --- | --- | --- |
| **Signal de retour** | À la fin du témoignage, l'initiée répond à une seule question : « Recommanderiez-vous ce rituel à une amie ? » — `Oui` / `Hésite` / `Pas pour moi`. Mécanique inspirée du Net Promoter Score simplifié (Reichheld 2003). | NPS / Reichheld |
| **Tags qualitatifs** | 3 à 6 tags maison cochés par l'initiée parmi une liste fermée (« ongles plus lisses », « plaque souple », « cuticules apaisées », « rituel devenu habitude », « plus de casse », « éclat naturel »). | Sephora, Glossier |
| **Durée d'initiation** | « Initiée depuis [mois année] ». Donne un proxy de crédibilité (ancienneté) sans note. | The Ordinary |

### 1.2 Pas d'emoji

**Constat de charte** : aucune exception.

**Conséquence pour le wall** :

- **Sanitization automatique** côté serveur sur tout texte soumis (strip de la plage Unicode `U+1F300–U+1FAFF`).
- **Feedback au témoin** lors de la soumission : message éditorial doux — « La maison reçoit vos mots. Les émoticônes ont été retirées — elles ne sont pas dans notre grammaire. »
- **Admin** : le flag emoji est un signal informatif, pas un rejet. La modératrice peut, si nécessaire, demander une réécriture par e-mail.

### 1.3 Pas de visages

**Constat de charte** : « mains, jamais visages » (K-LUX-04). RGPD : les données biométriques d'identification (visage frontal) sont des données sensibles.

**Conséquence pour le wall** :

- **Détection automatique** des visages sur les photos uploadées (vision ML, modèle léger côté serveur — MediaPipe Face Detection ou équivalent).
- **Politique** : photos contenant un visage frontal → **rejet automatique** avec message éditorial : « Pour préserver l'intimité de notre maison, nous publions des mains, des gestes, des détails de table — jamais de visage de face. Merci de nous envoyer une photo de vos mains. »
- **Exceptions tolérées** : visage partiellement visible (menton, sourire, lèvres, hijab) mais pas regard frontal — cas frontière à passer en revue manuelle. Cf. les images de référence `docs/images/values/reviews/reviews1.jpg` et `reviews9.jpg` qui montrent un sourire ou des lèvres sans regard direct.

### 1.4 Pas d'urgence, pas de promotion dans le wall

Aucun bandeau « -49 % », aucun countdown, aucun « il reste X packs ». L'anchoring prix 199 / 390 dh reste exclusivement sur la fiche produit (`/kit`).

Dans le wall, le seul CTA commercial est sobre : `Recevoir le pack — 199 dh · Livraison offerte au Maroc`. Pas de répétition agressive.

### 1.5 Pas de « cliente »

Lexique strict (`docs/preparation/annexes/glossaire-editorial.md`) :

| Interdit | Préféré |
| --- | --- |
| Cliente | Initiée |
| Avis | Témoignage / Rituel partagé |
| Note | (rien — la note n'existe pas) |
| Acheter | Recevoir |
| Achat vérifié | Initiée vérifiée |
| Produit | Pack / Rituel |

## 2. Le périmètre des transposables

À l'inverse, **les principes universels** énoncés dans `01-recherche-bonnes-pratiques.md` restent valables sans exception :

| Domaine | Transposé tel quel ? |
| --- | --- |
| Hiérarchie en 4 zones (résumé → contrôles → liste → action) | Oui |
| Filtres limités à 3 familles (K-UX-01) | Oui |
| Wizard progressif en 3 étapes | Oui |
| Pagination explicite (load more) | Oui |
| Cursor-based pagination | Oui |
| Lazy load images, AVIF/WebP | Oui |
| Dialog accessible, focus trap, ESC | Oui |
| Touch targets ≥ 44 px | Oui |
| Contrastes WCAG AA | Oui — à valider sur sauge / crème |
| Respect `prefers-reduced-motion` | Oui |
| Cache serveur 5 min sur résumé | Oui |
| Auto-flags non bloquants | Oui — étendus à emoji et visages |
| SLA modération affiché | Oui |
| Lien « Comment vérifiés » | Oui |
| Tracking événementiel | Oui — noms adaptés |
| Bottom-sheet mobile | Oui |
| Photo encouragée jamais obligatoire | Oui |

## 3. Décisions structurantes spécifiques à FemiGlow

### 3.1 Le nom

| Surface | Nom |
| --- | --- |
| UI publique | **Rituels partagés** |
| Code TypeScript | `RitualsWall` |
| Tables Drizzle | `ritual_testimonials`, `ritual_testimonial_photos`, `ritual_testimonial_tags`, `ritual_testimonial_aggregate` |
| Routes API | `/api/rituals/summary`, `/api/rituals/list`, `/api/rituals/submit`, `/api/rituals/policy` |
| dataLayer events | `ritual_wall_*` |
| Admin nav | « Rituels partagés » dans `/admin/rituals` |

### 3.2 La signature d'un témoignage

Chaque carte du wall affiche, en bas, sur deux lignes :

```
Yasmine, Rabat
Initiée depuis mars 2024
```

Pas de nom complet. Pas d'arobase. Pas d'icône utilisateur. La typographie est Inter 12 pt, brume `#6B6863`.

### 3.3 La photo d'un témoignage

- Format conseillé : carré ou 4:5 portrait.
- Sujet **obligatoire** : mains, ongles, geste, table de soin, pots. Pas de visage de face.
- Pré-modération vision ML.
- Affichée en thumbnail 240 × 240 dans la carte, lightbox plein écran sur clic.

### 3.4 La répartition palette dans le wall

Le wall doit respecter la règle 60-30-10 (K-COL-01) :

| Surface | Couleur | Part visée |
| --- | --- | --- |
| Fond drawer / page | Crème `#FBF8F1` | 60 % |
| Cartes témoignage | Crème pure `#FFFFFF` + bordure ligne `#E8E0D2` 1 px | 25 % |
| Tags actifs, chips actives, focus | Sauge `#C5DBC4` | 8 % |
| Texte courant | Encre `#2C2A28` | 5 % |
| Accent rare (signature, séparateurs) | Champagne `#C8A876` | ≤ 2 % |

Aucune autre couleur. Pas de bleu, pas de vert vif, pas de rouge.

### 3.5 La typographie

| Élément | Police | Style |
| --- | --- | --- |
| Titre du wall « Rituels partagés » | Cormorant Garamond Light | 32 pt |
| Sous-titre / kicker | Inter SemiBold | 9 pt, tracking 2 px, uppercase |
| Citation du témoignage | Cormorant Garamond Regular | 17 pt italic |
| Métadonnées (signature, date) | Inter Regular | 12 pt, brume |
| Tags / chips | Inter Medium | 13 pt |
| CTA | Inter Medium | 13 pt sur bouton encre |

Pas de Pinyon (réservé wordmark). Pas de Cormorant Bold.

### 3.6 Les motifs graphiques

Le fleuron champagne (variante B — point central) peut séparer les insights agrégés. La vague asymétrique n'est pas utilisée dans le wall (réservée aux hero des pages éditoriales).

### 3.7 La mécanique de retour pour soumission

Le formulaire de dépôt n'est **pas** accessible depuis n'importe où. Il est proposé :

1. Dans le wall, via un CTA secondaire `Partager mon rituel`.
2. Dans l'e-mail post-achat **J+45** envoyé automatiquement à l'initiée — moment où la transformation des ongles est mesurable. Le lien dans l'e-mail ouvre directement le wizard avec `productKey` et `customerHash` pré-remplis.

L'e-mail J+45 est le canal principal — la majorité des témoignages viendra de là, pas du wall lui-même. Le wall sert avant tout à **consulter**.

### 3.8 L'admin

L'admin FemiGlow `/admin/rituals` contient :

- **Queue** (témoignages en attente, priorité par auto-flag).
- **Détail** (preview, photos avec marquage faces si détectées, actions Approve / Reject / Hide).
- **Liste publiée** (filtrer, mettre en avant, archiver).
- **Insights** (agrégation : tags les plus fréquents, signal de retour, photos avec / sans).
- **Politique** (texte « Comment ces témoignages sont vérifiés », éditable).

Pas d'éditeur libre du texte du témoignage — l'admin peut corriger une coquille typographique (apostrophe droite → courbe, espace insécable) mais pas réécrire. Tout changement est tracé.

## 4. Synthèse — la grille de réécriture Baiti → FemiGlow

| Baiti | FemiGlow |
| --- | --- |
| Étoiles 1–5 | **Signal de retour ternaire** + tags qualitatifs |
| Note moyenne 4,8 | **24 initiées sur 26 reprendraient le rituel** |
| Histogramme 5★→1★ | **Insights tagués** (tags les plus mentionnés) |
| Avis | **Témoignage / rituel partagé** |
| Client / cliente | **Initiée** |
| « Laisser un avis » | **« Partager mon rituel »** |
| Achat vérifié | **Initiée vérifiée** |
| Emoji acceptés (flag si excès) | **Sanitization systématique** |
| Photos avec visages OK | **Détection ML, rejet auto si face frontale** |
| Drawer titre « Avis & expériences » | **« Rituels partagés »** |
| Palette neutre | **Sauge / crème / encre stricte** |
| CTA « Voir le produit » | **« Recevoir le pack — 199 dh · Livraison offerte »** |
| Voix neutre / rassurante | **Voix maison : sensorielle, complice, lente** |

Ces règles cadrent les trois prototypes qui suivent.
