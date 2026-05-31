# 01 — Recherche : bonnes pratiques d'un wall de témoignages à fort taux de conversion

Cette synthèse compile les 25 heuristiques qui font la performance d'un wall de témoignages e-commerce, telles qu'établies par la recherche académique (Baymard Institute, Nielsen Norman Group, Sevilla & Townsend 2016, Lu 2023) et les guides Kolenda (`docs/kolenda/Ecommerce.pdf`, `Pricing.pdf`, `UX.pdf`, `Attention.pdf`). Elle a été distillée à partir du blueprint Baiti (`draft/baiti_reviews_wall_blueprint/01_research/`) et étendue.

Le filtre FemiGlow est appliqué dans `02-contraintes-femiglow.md`. Le présent document liste l'**état de l'art universel** sans préjuger des décisions maison.

## 1. Psychologie de la crédibilité

### 1.1 La distribution prévaut sur la moyenne

Une moyenne sans distribution est suspecte. Afficher l'histogramme par niveau (5 → 1) renforce la confiance même lorsque le volume est faible. L'œil cherche d'abord la **forme de la distribution**, ensuite la moyenne. (Baymard 2019, étude #2347.)

### 1.2 La perfection nuit à la crédibilité

Une moyenne 5,0 / 5 réduit la confiance perçue de 8 à 12 points vs une moyenne 4,7 / 5. Le wall doit **accepter** les retours négatifs et les afficher (Park & Lee 2008, *Journal of Marketing Research*).

### 1.3 Le volume affiché conditionne la conversion

`4,8 (12 avis)` convertit mieux que `4,8` seul. Le volume est un signal d'usage social ; sans lui, la note est anecdotique. À volume égal, un compteur affiché en valeur absolue (« 24 ») bat un pourcentage (« 98 % de satisfaction »).

### 1.4 Récence = pertinence perçue

Un avis daté de cette semaine pèse 2 à 3 fois plus qu'un avis de l'an passé. Surfacer la date, et trier par défaut sur « Recommandés » mais offrir « Plus récents » comme bascule rapide.

### 1.5 Identité partielle = crédibilité maximale

Anonymat total → suspicion. Nom complet → friction côté témoin. **Prénom + ville + date d'initiation** est le sweet spot académique (Cheung & Thadani 2012).

## 2. Architecture de l'information

### 2.1 La hiérarchie canonique en 4 zones

1. **Résumé** (note, volume, distribution, insights) — 40 % de l'attention.
2. **Contrôles** (filtres + tri).
3. **Liste** (cartes paginées).
4. **Action** (CTA primaire « partager mon expérience » + retour produit).

Cette hiérarchie est universelle (Baymard). La violer dégrade la scannabilité.

### 2.2 Les filtres qui convertissent

Trois familles maximum (K-UX-01, loi de Hick) :

- **Filtre crédibilité** : « Avec photos », « Achat vérifié ».
- **Filtre note** : étoiles (ou équivalent maison).
- **Filtre contexte** : tags d'usage (« mains sèches », « ongles fragiles »).

Plus de 7 filtres simultanés dégrade la conversion (Cottam 2021).

### 2.3 Le tri par défaut

« Recommandés » > « Plus récents ». Un algorithme `recommended` combine : score qualité + récence (decay sur 90 jours) + nombre de photos + utilité (vote helpful) + spread de notes pour montrer la diversité.

### 2.4 La pagination explicite l'emporte sur l'infinite scroll

Bouton « Afficher plus » avec compteur (`12 / 47 affichés`). L'infinite scroll dégrade la conversion mobile de 8 à 14 points (Cottam 2021, Baymard 2022). L'utilisateur perd le repère et abandonne.

## 3. Format du témoignage

### 3.1 La longueur sweet spot

50 à 250 mots. En dessous : peu de valeur informative. Au-dessus : décrochage. Encourager la longueur médiane par un placeholder de formulaire (« Décrivez en quelques lignes votre expérience — 50 mots suffisent »).

### 3.2 La structure du témoignage qui convertit

1. **Contexte** : « avant le rituel, mes ongles étaient… »
2. **Action** : « depuis trois mois, j'utilise… »
3. **Résultat** : « aujourd'hui, je remarque… »

Ce schéma BAR (Before-Action-Result) est la trame implicite des témoignages performants (cf. Park & Lee 2008).

### 3.3 Le titre court augmente le CTR

Si un champ titre existe : < 8 mots, formulé comme une promesse (« Mes ongles ont changé en trois mois »). Le titre est le second élément lu après la note.

### 3.4 La photo augmente l'engagement de 2 à 3×

Un avis avec photo reçoit 2 à 3 fois plus d'attention. Encourager activement (« Une photo aide les autres à se projeter »). Pas obligatoire — la friction tue la soumission.

## 4. Formulaire de dépôt

### 4.1 Progressive disclosure

Étape 1 — minimale : note + texte. Soumettre est possible ici.
Étape 2 — optionnelle : titre + tags + photos.
Étape 3 — optionnelle : nom + ville + anonymat.

La friction d'un seul formulaire long divise le taux de complétion par 2 à 4.

### 4.2 Validation inline non agressive

Pas de message d'erreur tant que le champ n'a pas perdu le focus. Les messages doivent **guider**, pas reprocher (« Encore quelques mots pour aider les autres » plutôt que « Trop court »).

### 4.3 Indication de modération

« Publication après lecture de la maison sous 24 à 48 heures. » Honnête. Crée la confiance et limite les attentes.

### 4.4 Photos — affordances

Drag & drop + click. Max 3 par avis. Taille max 5 Mo / photo. Format JPEG / PNG / HEIC. Compression côté client.

## 5. Accessibilité (WCAG 2.2 AA, obligatoire)

### 5.1 Dialog accessible

Si drawer : `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Focus trap (Tab/Shift+Tab boucle dans le drawer, arrière-plan `inert`). ESC ferme. Retour focus sur l'élément déclencheur (W3C WAI APG).

### 5.2 Tailles tactiles

Touch targets ≥ 44 × 44 px (chips, boutons, cards cliquables).

### 5.3 Contrastes

Texte / fond : ≥ 4,5:1. Éléments UI : ≥ 3:1.

### 5.4 Mouvement réduit

`prefers-reduced-motion: reduce` : supprimer translations, garder fade ≤ 120 ms, désactiver shimmer.

### 5.5 Lecteurs d'écran

Chaque carte d'avis doit pouvoir se lire en continu : « Témoignage de [Prénom], [Ville], publié le [date]. [Tags]. [Texte]. » Pas de mention « photo » sans alt explicite (« Photo des ongles de [Prénom], six semaines après le début du rituel »).

## 6. Performance

### 6.1 Budget Web Vitals dédié

LCP < 2,5 s — même quand le wall est ouvert. Ajouter ≤ 30 ko CSS et ≤ 50 ko JS gzip.

### 6.2 Pagination cursor-based

Plus stable et plus rapide que `offset / limit` sur de gros volumes. Cursor opaque (`base64(created_at + id)`).

### 6.3 Images

Thumbnails 240 × 240, AVIF / WebP, `loading="lazy"`. Full-res en lightbox uniquement, fetch on demand.

### 6.4 Cache serveur

Le résumé (note, volume, distribution) est en cache (TTL 5 min, invalidé sur publication). La liste paginée n'est pas cacheable par utilisateur (filtres divergents).

### 6.5 Plafond DOM

Max 60 cartes chargées simultanément. Au-delà, demander « Voir les plus anciennes » qui réinitialise la liste.

## 7. Conformité légale et confiance

### 7.1 Directive UE Omnibus 2019/2161

Tout site qui affiche des avis doit publier **comment ils sont vérifiés**. Un lien visible « Comment ces témoignages sont vérifiés » est obligatoire. Texte sobre, qui répond : qui peut témoigner, comment on modère, ce qu'on accepte et refuse, ce qu'on ne fait pas (jamais éditer un témoignage sans accord du témoin).

### 7.2 RGPD

Nom et ville sont des données personnelles. Toujours optionnels. Consentement explicite. Possibilité de demander la suppression d'un témoignage par l'auteur (DSAR).

### 7.3 Achat vérifié

Si possible, un badge « Achat vérifié » : un témoignage rattaché à une commande gagne 30 à 50 % de poids perçu. Sans achat, ne pas afficher le badge (pas de mensonge).

### 7.4 Pas d'incentive financier

Offrir une remise pour un témoignage biaise la moyenne et viole la directive Omnibus. Si compensation : remise applicable à tous, indépendamment du contenu du témoignage.

## 8. Modération

### 8.1 SLA publié et tenu

24 à 48 heures. Si dépassement, alerter par e-mail. La transparence du délai est un atout.

### 8.2 Auto-flags non bloquants

Détection automatique élève la priorité dans la queue, ne rejette **jamais** :

- Lien externe ou contact email.
- Très court (< 20 mots) ou très long (> 800 mots).
- Trop d'emojis ou caractères répétitifs.
- Mots interdits (insulte, marque concurrente, médical non prouvé).
- Photo contenant un visage (détection ML).

### 8.3 Workflow standard

`PENDING` → revue manuelle → `APPROVED` ou `REJECTED` ou `HIDDEN`. `HIDDEN` est utile pour archiver sans supprimer.

### 8.4 Notes de modération auditables

Toute action conservée : qui, quand, pourquoi. Permet l'audit interne et la résolution de litiges.

## 9. Tracking et boucle de mesure

### 9.1 Événements clés

| Étape | Événement |
| --- | --- |
| Découverte | `ritual_wall_view`, `ritual_wall_open` |
| Exploration | `ritual_wall_filter_change`, `ritual_wall_sort_change`, `ritual_wall_card_impression` |
| Sollicitation | `ritual_wall_load_more`, `ritual_wall_open_photo` |
| Action | `ritual_wall_cta_buy_click` (vers `/kit`) |
| Contribution | `ritual_submit_start`, `ritual_submit_step_complete`, `ritual_submit_success`, `ritual_submit_error` |

### 9.2 KPI primaire

Taux de conversion **add-to-cart** sur visiteurs qui ont ouvert le wall vs ceux qui ne l'ont pas ouvert (cohort A/B observationnelle, à confirmer en A/B test contrôlé).

### 9.3 KPI secondaires

- Temps moyen passé dans le wall.
- Nombre médian de cartes vues.
- Taux de soumission (visiteurs qui démarrent / qui finissent).
- Taux d'approbation post-modération.

## 10. Mobile

### 10.1 Bottom-sheet > drawer latéral

Sur mobile, un bottom-sheet (90 % de la hauteur) est plus naturel qu'un drawer latéral. Drag-to-close depuis le haut. Snap points (compact à 50 %, étendu à 90 %).

### 10.2 Filtres en scroll horizontal

Chips en scroll horizontal sur une seule ligne, avec ombre de droite suggérant qu'on peut scroller. Pas de menu déroulant lourd.

### 10.3 CTA sticky bas d'écran

Bouton « Recevoir le pack » sticky en bas, fond encre, accessible au pouce.

## Synthèse — 25 heuristiques sur une carte

| # | Heuristique | Domaine |
| --- | --- | --- |
| 1 | Afficher la distribution, pas que la moyenne | Crédibilité |
| 2 | Moyenne 5,0 = suspecte, viser 4,5–4,9 | Crédibilité |
| 3 | Compter le volume explicitement | Crédibilité |
| 4 | Récence prime sur ancienneté | Crédibilité |
| 5 | Identité partielle (prénom + ville) | Crédibilité |
| 6 | Hiérarchie en 4 zones (résumé → contrôles → liste → action) | IA |
| 7 | 3 familles de filtres maximum | IA |
| 8 | Tri par défaut = Recommandés | IA |
| 9 | Pagination explicite (load more) | IA |
| 10 | Longueur cible 50 à 250 mots | Format |
| 11 | Structure BAR (Before-Action-Result) | Format |
| 12 | Titre court (< 8 mots) | Format |
| 13 | Photo encouragée, jamais obligatoire | Format |
| 14 | Wizard progressif (3 étapes) | Form |
| 15 | Validation inline non agressive | Form |
| 16 | SLA modération affiché | Form |
| 17 | Dialog accessible (focus trap, ESC) | A11y |
| 18 | Touch targets ≥ 44 px | A11y |
| 19 | Contrastes WCAG AA | A11y |
| 20 | Respect `prefers-reduced-motion` | A11y |
| 21 | Cursor-based pagination | Perf |
| 22 | Lazy load images + thumbnails | Perf |
| 23 | Cache serveur du résumé | Perf |
| 24 | Auto-flags non bloquants | Modération |
| 25 | Lien « Comment vérifiés » obligatoire | Légal |

Ce socle est la base universelle. Le filtre FemiGlow (refus des étoiles, refus des emoji, refus des visages, voix « maison ») est traité dans le document suivant.
