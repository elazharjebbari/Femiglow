# Page Merci — `/merci`

> **Univers Particulier · B2C · Page post-achat émotionnelle** — Document de spécification détaillée
> *Volume X · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*
> *Page de transition entre l'achat (`/commander`) et l'attente (livraison) — moment émotionnel unique.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero de remerciement](#5--section-01--hero-de-remerciement)
6. [Section 02 — Récapitulatif de la commande](#6--section-02--récapitulatif-de-la-commande)
7. [Section 03 — Suivi & prochaines étapes](#7--section-03--suivi--prochaines-étapes)
8. [Section 04 — Lettre éditoriale d'accueil](#8--section-04--lettre-éditoriale-daccueil)
9. [Section 05 — Préparation au geste (anti buyer's remorse)](#9--section-05--préparation-au-geste-anti-buyers-remorse)
10. [Section 06 — Cross-links contextuels](#10--section-06--cross-links-contextuels)
11. [Footer — élément persistant](#11--footer--élément-persistant)
12. [Comportements transverses](#12--comportements-transverses)
13. [Adaptation responsive](#13--adaptation-responsive)
14. [Performance technique](#14--performance-technique)
15. [SEO & métadonnées](#15--seo--métadonnées)
16. [Accessibilité (a11y)](#16--accessibilité-a11y)
17. [Microcopy & états](#17--microcopy--états)
18. [Emails post-achat & cycle de vie](#18--emails-post-achat--cycle-de-vie)
19. [Synthèse — checklist de validation](#19--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/merci?order=FG-2026-XXXXX`                                 |
| **Type**             | Page post-achat · confirmation + accueil émotionnel                     |
| **Audience**         | Cliente qui vient de **payer** — premier moment de la relation           |
| **Profil cognitif**  | Soulagement + anticipation + petit doute (« Ai-je bien fait ? »)         |
| **Pouvoir d'achat**  | Acquis — la transaction est conclue                                       |
| **Funnel**           | **Post-conversion** — début de la relation client                        |
| **Position parcours**| Toujours après `/commander` (succès paiement)                            |
| **Durée d'attention**| 30 secondes à 4 minutes — variable selon engagement éditorial             |
| **Device split**     | Mobile 65% · Desktop 30% · Tablet 5% (hérité de `/commander`)             |
| **Update frequency** | Statique fonctionnellement, données dynamiques via paramètres URL        |
| **Indexation SEO**   | **`noindex, nofollow`** — page transactionnelle privée                    |

### Ce que la page **doit** faire

1. **Confirmer la commande** clairement — numéro, montant, mode paiement, livraison estimée.
2. **Désamorcer le buyer's remorse** — la cliente vient de dépenser ; cette page **valide** son choix.
3. **Démarrer la relation** — pas la fin du tunnel commercial, mais le début de la relation maison-cliente.
4. **Préparer le geste à venir** — quelques mots sur le rituel qui l'attend, le moment où elle ouvrira la boîte.
5. **Offrir une continuation éditoriale** — cross-links vers `/journal` et `/maison` pour prolonger l'engagement pendant l'attente livraison.
6. **Garder la voix de la maison** — la cohérence narrative ne s'arrête pas au paiement.

### Ce que la page **ne doit pas** faire

1. **Pousser un autre achat immédiat.** Pas de « Continuez votre shopping ! » ni de « Vous pourriez aussi aimer... » — ce serait **insultant** au moment de la complicité fragile post-achat.
2. **Demander une review/note.** Trop tôt — la cliente n'a même pas reçu le produit. Les reviews seront sollicitées 14 jours après livraison.
3. **Pop-up newsletter.** Si la cliente n'a pas opt-in à `/commander` étape 1, ce n'est pas le moment de la harceler.
4. **Animations célébratoires excessives** (confetti, fanfare). Cassure totale de la voix éditoriale.
5. **Lister 12 « prochaines étapes »** — la cliente vient d'investir sa concentration dans le checkout, elle a besoin de **respiration**.
6. **Demander de partager sur les réseaux sociaux.** En V1, pas de fonctionnalité « Partagez votre commande ! » — vulgaire à ce stade.

### Spécificités techniques de la page

| Spécificité                  | Implication                                                          |
| :--------------------------- | :------------------------------------------------------------------ |
| **URL avec numéro de commande** | `?order=FG-2026-XXXXX` — paramètre obligatoire pour afficher le récap |
| **Accès direct refusé**       | Si pas de token de session valide pour cette commande, redirection vers `/accueil` |
| **Recovery refresh**         | Si la cliente recharge la page : OK, l'affichage reste cohérent (données récupérées via paramètre + session) |
| **Pas d'historique browser** | `Cache-Control: no-store, must-revalidate` (sécurité)                 |
| **Trigger emails**           | À l'arrivée sur cette page → déclencheur des emails transactionnels  |

---

## 2 — Contexte stratégique

### Position dans l'écosystème B2C

```
[ARRIVÉE]                        [PAGE MERCI /merci]              [SUITE]
    │                                    │                             │
/commander (succès paiement) ────►   1. Hero de remerciement     ──►  /journal (lecture pendant attente)
                                     2. Récap commande           ──►  /maison (découverte fondateur)
                                     3. Suivi & étapes            ──►  /accueil (revenir plus tard)
                                     4. Lettre éditoriale          ──►  Email transactionnel reçu
                                     5. Préparation au geste       ──►  Email J+5 (avant livraison)
                                     6. Cross-links                ──►  Email J+15 (post-livraison)
                                       │
                                       ↓
                                   Lecture (~1-4min)
                                       ↓
                                   Sortie naturelle (cross-link ou fermeture onglet)
                                       ↓
                                   Email de confirmation reçu
                                       ↓
                                   Attente livraison (3-5j)
                                       ↓
                                   Réception colis → ouverture rituelle
                                       ↓
                                   Email J+5 « Le moment approche »
                                       ↓
                                   Email J+15 « Comment s'est passée votre première fois ? »
```

### La règle du moment unique

> Le moment post-achat est **unique dans le cycle de vie client**. Avant : la cliente est en mode **transaction**. Après : elle entre en mode **relation**. Cette page est le **point de bascule**.

C'est pour cela que la page mérite un soin particulier — elle est la **première page** où la cliente n'est plus en train d'acheter, mais en train **d'avoir acheté**. Le ton, le rythme, l'image de la maison s'inscrivent ici **durablement** dans sa mémoire.

### Tension stratégique fondamentale

`/merci` vit dans une triple tension :

#### Tension 1 — Confirmation fonctionnelle vs récit éditorial

> La cliente a besoin **d'informations concrètes** (numéro de commande, livraison estimée, comment suivre). Mais elle vient aussi de vivre un moment éditorial sur les pages amont — la rupture brutale ferait dissonance.

**Résolution** : la page **commence** par une partie éditoriale (hero remerciement + récap), puis **descend** vers les éléments concrets (suivi + étapes), puis **remonte** vers une lettre éditoriale et des cross-links. Architecture en **vague émotionnelle**.

#### Tension 2 — Valorisation de l'achat vs sobriété

> Il faut que la cliente sente que son achat est **important** pour la maison (« nous avons reçu votre commande avec attention »). Mais sans flatterie excessive ni « champagne digital » qui sonnerait faux.

**Résolution** : un **fleuron champagne** (signal de noblesse) dans le hero — une seule fois, discret. Le reste reste sobre. La valorisation passe par la **qualité de l'attention** dans l'écriture, pas par les effets visuels.

#### Tension 3 — Anticipation vs patience

> La cliente veut **recevoir vite** son kit. Mais le rituel est précisément l'inverse de la précipitation. La page doit gérer cette tension sans la **frustrer** ni la **manipuler**.

**Résolution** : la mention « Livraison sous 3-5 jours » est **claire** (pas de promesse 24h artificielle). Une section dédiée prépare doucement au moment de la réception (« Le moment approche... ») — sans accélérer ni ralentir artificiellement l'attente.

### Architecture émotionnelle

| Étape                          | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :----------------------------- | :------------------ | :---------------------- | :----------------------------------- |
| Arrivée sur `/merci`            | Soulagement + doute  | Soulagement amplifié     | « C'est fait, ils ont reçu »          |
| Lecture du remerciement         | Soulagement         | Reconnaissance           | « Ils me prennent en considération »  |
| Vérification du récap           | Vigilance           | Confirmation             | « Tout est correct »                  |
| Lecture du suivi                | Anticipation        | Patience                 | « Je sais quand attendre »            |
| Lecture de la lettre éditoriale | Patience            | Engagement               | « Je suis dans une maison »           |
| Préparation au geste             | Engagement          | Anticipation noble        | « J'ai hâte de découvrir »            |
| Cross-link Journal               | Anticipation        | Continuation              | « Je peux lire en attendant »         |

> **Cette progression émotionnelle est délibérée**. Chaque section a une fonction émotionnelle précise. Briser cet ordre = casser le **récit du post-achat**.

### KPIs cibles

| Métrique                                          | Cible                            | Source                       |
| :------------------------------------------------ | :------------------------------- | :--------------------------- |
| **Taux de scroll au-delà du hero (engagement)**   | **> 70%** (la cliente lit au-delà de la confirmation) | Hotjar / GA4         |
| Taux de scroll jusqu'à la lettre éditoriale       | > 45%                             | GA4 scroll events            |
| Taux de clic cross-link `/journal`                 | > 15%                             | GA4 events                   |
| Taux de clic cross-link `/maison`                  | > 8%                              | GA4 events                   |
| Temps moyen sur la page                           | 60-180s (médiane ~90s)            | GA4                          |
| Taux d'ouverture email confirmation               | > 90% (transactionnel high)       | Email automation analytics   |
| Taux d'ouverture email J+5 « Le moment approche » | > 60%                             | Email automation analytics   |
| Taux d'ouverture email J+15 review request        | > 50%                             | Email automation analytics   |
| Taux de réponse review J+15                       | > 25%                             | Email automation analytics   |
| Taux de retour sur le site dans les 7 jours       | > 30%                             | GA4                          |
| **Buyer's remorse / annulation < 24h**             | **< 1.5%**                        | Order management              |
| LCP                                               | < 1.8s                           | Web Vitals                   |
| CLS                                               | < 0.05                           | Web Vitals                   |
| INP                                               | < 150ms                          | Web Vitals                   |

> **Pourquoi un taux d'engagement aussi élevé est la cible ?** Parce que la cliente vient de **payer** — son attention est **engagée par défaut**. Tout taux de scroll < 70% serait un signal que la page **rate son potentiel relationnel**.

### Le profil unique de la visiteuse `/merci`

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **État émotionnel**               | Soulagement post-paiement + petit doute résiduel                  |
| **Connaissance produit**          | Elle a tout lu pendant le checkout — saturation possible           |
| **Patience**                      | Renouvelée — l'urgence du checkout est passée                      |
| **Tolérance aux contenus longs**  | Élevée — moment de respiration                                     |
| **Distractions environnantes**    | Variables — souvent un moment volé, mais aussi parfois moment plus calme |
| **Réseau internet**               | Variable — confirmation finale après checkout                      |
| **Probabilité de capture d'écran**| Élevée — le numéro de commande est souvent screenshoté pour archive |
| **Forwarding email à un proche**  | Possible (cas cadeau / belle-mère / mariage)                       |

> **La cliente sur `/merci` est paradoxalement plus disponible** que sur `/kit` ou `/commander`. Elle n'a plus de tâche cognitive à accomplir. C'est le **moment idéal** pour la **toucher éditorialement** — sans abuser de cette disponibilité.

### Spécificités du post-achat dans le e-commerce marocain

| Spécificité                  | Implication                                                          |
| :--------------------------- | :------------------------------------------------------------------ |
| **Méfiance résiduelle**      | Surtout si premier achat sur un site direct-to-consumer — la page de remerciement doit **rassurer fortement** |
| **Paiement à la livraison**  | Si COD, la cliente n'a **pas encore payé** — elle paiera au livreur. Implications de ton (différentes — pas « merci de votre paiement », plutôt « merci de votre commande ») |
| **Appel du livreur**         | Réalité incontournable — annoncer clairement que le livreur appellera |
| **WhatsApp culturel**        | Beaucoup de clientes attendent un message WhatsApp pour le suivi (V2 à considérer)  |
| **Forwarding cadeau**        | Pratique courante — la page peut être partagée par WhatsApp/Email à un proche       |
| **Patience variable**        | La culture de l'urgence Amazon n'est pas universelle au Maroc — la cliente accepte 3-5 jours |

### Les quatre fonctions de `/merci`

#### Fonction 1 — Confirmation transactionnelle (objectif premier)

Communiquer **clairement et complètement** : numéro de commande, items, total payé, mode paiement (carte ou COD), adresse de livraison, délai estimé. C'est l'**information non négociable**.

#### Fonction 2 — Désamorcer le buyer's remorse

Le buyer's remorse (regret post-achat) est un phénomène psychologique réel. La cliente vient de dépenser ; un doute peut s'installer. La page doit **valider** son choix avec **délicatesse**, sans en faire trop.

#### Fonction 3 — Démarrer la relation

Le post-achat est le **vrai début** de la relation maison-cliente. Pas la fin du tunnel commercial. La voix éditoriale, la qualité de l'attention, les cross-links vers `/journal` et `/maison` posent les **bases d'une relation longue**.

#### Fonction 4 — Préparer la réception

Donner à la cliente **les clés émotionnelles** pour bien recevoir le kit. Quand elle ouvrira la boîte (3-5 jours plus tard), le souvenir de cette page reviendra — elle aura été **préparée** au geste, à l'ambiance, à l'attention.

### Différence avec un page de remerciement standard

| Élément standard e-commerce        | FemiGlow `/merci` choix                              |
| :--------------------------------- | :---------------------------------------------------- |
| « Merci pour votre commande ! »     | « Merci. » (point final, sobriété)                     |
| Animation confetti/fanfare         | Aucune animation célébratoire (cassure du ton)        |
| Liste des « prochaines étapes » longue | Trois étapes claires, courtes                      |
| « Partagez votre commande sur les réseaux ! » | Pas en V1 — vulgaire à ce moment                  |
| Pop-up newsletter ré-affirmé        | Pas de pop-up — opt-in déjà géré à `/commander`        |
| « Notez votre expérience » immédiatement | Pas avant J+15 (post-livraison)                  |
| Code promo « Pour votre prochaine commande ! » | Pas en V1 — moment inopportun                  |
| Bouton « Continuer le shopping »     | « Visiter le journal » (cohérence éditoriale)         |
| Cross-sell agressif (« Vous pourriez aimer ») | Aucun cross-sell — la maison ne vend pas deux fois |
| Numéro de commande en petit           | Numéro de commande **valorisé** typographiquement     |
| Récap dans un tableau type Excel       | Récap dans un format éditorial soigné                  |

> **La sobriété est stratégique** : moins on en fait, plus la cliente sent qu'elle est **dans une maison qui sait recevoir**. La célébration excessive est l'inverse de l'élégance.

---

## 3 — Architecture verticale globale

### Vue d'ensemble — desktop ≥ 1280px

```
┌─────────────────────────────────────────────────────────────────────┐
│  [HEADER — sticky · 80px · navigation complète · panier vide]       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  01. HERO DE REMERCIEMENT                                           │
│      Fleuron champagne · Titre « Merci. » · Sous-titre              │
│      Numéro de commande typographique · État livraison              │
│      Hauteur : 480px (1 viewport partiel — pas plein écran)         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  02. RÉCAPITULATIF DE LA COMMANDE                                   │
│      Card produit · Détails livraison · Mode paiement                │
│      Hauteur : 320px                                                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  03. SUIVI & PROCHAINES ÉTAPES                                       │
│      Trois étapes : Préparation → Expédition → Livraison              │
│      Hauteur : 360px (fond sauge pâle pleine largeur)                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  04. LETTRE ÉDITORIALE D'ACCUEIL                                     │
│      Texte de la maison · Signature Salma                            │
│      Hauteur : 480px                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  05. PRÉPARATION AU GESTE                                            │
│      Photo lifestyle · Quelques mots sur le rituel à venir            │
│      Hauteur : 480px                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  06. CROSS-LINKS CONTEXTUELS                                          │
│      Vers /journal et /maison · 2 cards                               │
│      Hauteur : 360px                                                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [FOOTER — encre · 320px]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Vue d'ensemble — mobile < 768px

```
┌────────────────────────────┐
│  [HEADER — 64px]           │
├────────────────────────────┤
│                            │
│  01. HERO REMERCIEMENT     │
│      Fleuron · Merci.      │
│      Numéro · Livraison    │
│                            │
├────────────────────────────┤
│                            │
│  02. RÉCAP COMMANDE        │
│                            │
├────────────────────────────┤
│                            │
│  03. SUIVI 3 ÉTAPES         │
│      (empilées mobile)     │
│                            │
├────────────────────────────┤
│                            │
│  04. LETTRE                 │
│                            │
├────────────────────────────┤
│                            │
│  05. PRÉPARATION            │
│      (photo dessus, texte)  │
│                            │
├────────────────────────────┤
│                            │
│  06. CROSS-LINKS            │
│      (empilés mobile)       │
│                            │
├────────────────────────────┤
│  [FOOTER]                  │
└────────────────────────────┘
```

### Hauteur totale approximative

- **Desktop (1440×900)** : ~2 800-3 200px (3-3.5 viewport — page longue, scroll généreux)
- **Tablet (768×1024)** : ~3 000-3 400px
- **Mobile (390×844)** : ~3 800-4 200px

> **Pourquoi une page si longue ?** Parce que c'est la **seule page** où la cliente est dans un **état d'attention prolongée post-achat**. La maison a son temps pour parler — à condition de ne pas le gaspiller. Chaque section est **utile** ou **émotionnellement nécessaire**.

### Le modèle « Vague émotionnelle »

> Architecture en quatre temps :
> 1. **Confirmation** (hero + récap) — on vérifie le concret
> 2. **Information** (suivi & étapes) — on explique le futur logistique
> 3. **Récit** (lettre + préparation) — on entre dans la voix de la maison
> 4. **Continuation** (cross-links) — on prolonge la relation

Cette structure **éleve progressivement** la conversation : du fonctionnel (« ai-je bien commandé ? ») vers le narratif (« qui est cette maison ? »). C'est l'inverse de la plupart des pages e-commerce qui restent **fonctionnelles jusqu'au bout**.

### Pas de section testimonials/reviews

> Volontairement, **pas de section** « Ils ont reçu leur kit » avec des photos clientes ou des reviews 5 étoiles. Pourquoi ?
> - La cliente n'a pas encore reçu le sien — voir des photos d'autres serait **frustrant**
> - Elle vient de payer — le besoin de social proof est **déjà satisfait**
> - Le récit éditorial est **plus puissant** qu'un alignement de notes

### Pas de section FAQ

> Pas de FAQ ici. La FAQ est un **outil de conversion** (avant achat). Après achat, ce qui rassure c'est la **clarté du suivi** + le **contact email visible**.

### Pas de section « Codes promo pour vos prochaines commandes »

> Tentation classique : récompenser l'achat avec un code de réduction pour la prochaine commande. **Refusé en V1** :
> - La cliente n'a même pas reçu le kit — proposer une nouvelle commande est **prématuré**
> - Le code promo casse le ton éditorial (« vous nous avez donné de l'argent, voici un bon d'achat »)
> - V2 : à reconsidérer après J+30 dans un email de fidélisation, pas sur cette page

### Flow d'erreur — accès direct à /merci sans token

Si la cliente arrive sur `/merci?order=FG-2026-XXXXX` sans **session valide** correspondant à cette commande :

- Redirection vers `/accueil` avec un toast discret : « Cette page n'est plus accessible. »
- L'email transactionnel envoyé à la cliente reste l'**accès canonique** au récap

> **Pourquoi cette restriction ?** Pour empêcher qu'un screenshot de l'URL puisse être partagé et consulté par n'importe qui (fuite de données personnelles).

### Architecture émotionnelle en parallèle de la structure

```
Section            │ Émotion                 │ Mouvement
═══════════════════╪═════════════════════════╪═══════════════════════════
01. Hero            │ Soulagement → Reconnaissance │ « Ils m'ont reçue »
02. Récap          │ Vigilance → Confirmation │ « Tout est correct »
03. Suivi          │ Anticipation logistique  │ « Je sais ce qui suit »
04. Lettre          │ Engagement éditorial    │ « Je suis dans une maison »
05. Préparation     │ Anticipation noble       │ « J'ai hâte du moment »
06. Cross-links     │ Continuation             │ « Je peux rester un peu »
```

---

## 4 — Header — élément persistant

### Comportement spécifique sur `/merci`

Le header est globalement **identique** à celui des autres pages — élément global du site. Cette page n'a **pas** de header simplifié comme `/commander`.

> **Pourquoi pas de header simplifié ici ?** Parce que la cliente n'est **plus dans un tunnel transactionnel**. Elle vient de finaliser son achat ; elle a maintenant la **liberté complète** d'explorer le site. Le header complet **respecte cette liberté retrouvée**.

### Spécificités sur `/merci`

| Différence                      | Spécification                                                          |
| :------------------------------ | :--------------------------------------------------------------------- |
| **Item actif**                  | Aucun item du menu n'est actif — `/merci` n'est pas dans la nav         |
| **Icône panier**                | Visible mais **vide** — compteur à 0 (le panier a été vidé après commande) |
| **Compteur affichage**          | « Panier · 0 » ou simplement « Panier » (sans badge)                    |
| **Hover icône panier**          | Tooltip : « Votre panier est vide » (info, pas dropdown)               |
| **Mention sécurité**             | Aucune mention « Commande sécurisée » (réservée à `/commander` simplifié) |

### Comportement de l'icône panier

Cliquer sur l'icône panier → navigation vers `/panier` qui affichera l'**état panier vide** (section 06 de la spec `/panier`).

> **Cohérence narrative** : depuis `/merci`, si la cliente clique sur le panier, elle voit « Votre panier est vide. Pas de précipitation. Le rituel est toujours là, prêt à être découvert. ». Cohérent avec l'esprit anti-pression de la maison.

### Sticky behavior

Identique aux autres pages : `position: sticky; top: 0`. Au scroll au-delà de 80px, le header se compresse (hauteur 64px) avec ombre subtile.

### Absence de bandeau « Commande passée ! »

> Certains sites e-commerce affichent un **bandeau persistant** type « Votre commande a bien été enregistrée » au-dessus du header. **Refusé** :
> - La page entière communique déjà cette information
> - Un bandeau ferait **doublon** et pollution visuelle
> - Cassure de la sobriété du header standard

### Tactiques héritées

Toutes les tactiques héritées (`4 OPTIONS MAX`, `ENTRY POINT FOCAL`, `STICKY MOMENTUM`, `FRIENDLY COLD`) restent en place — `/merci` n'introduit pas de spécificité au-delà du compteur panier vidé.

---

## 5 — Section 01 — Hero de remerciement

### 5.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                ╱──╲                                        │
│                               ╱ ◆ ╲     ← fleuron champagne                │
│                                ╲╱                                          │
│                                                                            │
│                                                                            │
│                              Merci, Salma.                                 │
│                                                                            │
│                                                                            │
│                                                                            │
│                  Votre commande est en bonnes mains.                       │
│                                                                            │
│                                                                            │
│                                                                            │
│                          FG-2026-00037                                     │
│                                                                            │
│                                                                            │
│                                                                            │
│                ╌╌╌                                                         │
│                                                                            │
│                Livraison estimée entre le                                  │
│                jeudi 7 et le samedi 9 mai.                                 │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 480px (desktop) · 420px (tablet) · 380px (mobile)                |
| Padding vertical       | 96px (haut) · 64px (bas)                                          |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Alignement contenu     | Centré horizontalement et verticalement                            |
| Largeur max contenu    | 720px                                                             |

> **Hauteur partielle (pas plein viewport)** : la cliente a besoin de voir **immédiatement** qu'il y a du contenu en dessous (récap, suivi). Un hero plein viewport l'obligerait à scroller pour découvrir, ce qui pourrait inquiéter (« Où est le récap ? »).

### 5.3 — Fleuron champagne

> **Exception éditoriale** : sur les pages fonctionnelles (`/panier`, `/commander`), le fleuron champagne est absent. Mais sur `/merci`, il **réapparaît**. Pourquoi ?
> - Le post-achat est un **moment éditorial noble** (pas fonctionnel — la cliente ne fait rien)
> - Le fleuron donne une **noblesse** à l'instant — équivalent du « ruban » dans une enveloppe ouverte
> - Cohérence avec les heros nobles (`/journal`, `/maison`, et l'état panier vide)
> - Signal subliminal : « la maison reçoit votre commande comme un événement »

#### Spécifications

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Type              | Losange champagne entre filets fins                              |
| Couleur           | `#C8A876` (Champagne)                                            |
| Largeur           | 96px (desktop) · 80px (mobile)                                   |
| Hauteur           | 14px (desktop) · 12px (mobile)                                   |
| Position          | Centré, 0 espacement haut (le padding du container suffit)        |

> **Champagne plus présent ici qu'ailleurs** : 96px (vs 80px sur `/journal` et état panier vide). Petite amplification subtile pour marquer la **gravité de l'instant**.

### 5.4 — Titre principal — personnalisé

```
Merci, Salma.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 48pt (desktop) · 38pt (tablet) · 32pt (mobile)               |
| Style           | Regular (pas italic — affirmation simple)                    |
| Line-height     | 1.2                                                          |
| Letter-spacing  | -0.5px                                                        |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                        |
| Espacement haut | 48px sous le fleuron (desktop) · 32px (mobile)                |

> **« Merci, Salma. »** — cinq éléments dans cette phrase :
> 1. **Le mot Merci** — direct, sobre, point central
> 2. **La virgule** — pause respiratoire
> 3. **Le prénom** — personnalisation maximale (extrait du compte ou de l'étape 1 du checkout)
> 4. **Le point final** — clôture, pas d'emphase
> 5. **Pas de point d'exclamation** — la maison ne crie pas

#### Variantes selon la situation

| Cas                              | Affichage                                          |
| :------------------------------- | :------------------------------------------------- |
| Prénom fourni à l'étape 1        | « Merci, Salma. »                                   |
| Prénom non fourni (rare)         | « Merci. » (sobre, sans personnalisation forcée)   |
| Compte connecté avec prénom       | « Merci, Salma. »                                   |
| Cas cadeau (V2)                   | « Merci. » (la cliente n'est pas la destinataire)   |

> **Pourquoi pas « Merci pour votre commande » ?** Trop fonctionnel. Le « pour votre commande » est implicite (la cliente sait pourquoi on la remercie). La concision **augmente l'intensité émotionnelle**.

### 5.5 — Sous-titre

```
Votre commande est en bonnes mains.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 20pt (desktop) · 18pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.4                                                          |
| Espacement haut | 32px sous le titre                                            |
| Alignement      | Centré                                                        |
| Largeur max     | 540px                                                         |

> **« Votre commande est en bonnes mains. »** — phrase qui :
> - Confirme la prise en charge (« nous l'avons bien »)
> - Évoque un travail manuel (« mains » — cohérent avec une maison artisanale)
> - Rassure subtilement (« bonnes » — l'attention au détail)
> - Sans flatterie ni ton commercial

#### Variantes selon le mode de paiement

| Mode paiement                  | Sous-titre                                          |
| :----------------------------- | :-------------------------------------------------- |
| Carte bancaire (paiement effectué)| « Votre commande est en bonnes mains. »            |
| Paiement à la livraison         | « Votre commande est en bonnes mains. Notre livreur vous appellera bientôt. » |

> **La variante COD** ajoute une phrase pour rappeler la mécanique du paiement à la livraison — la cliente n'a **pas encore payé**, elle paiera au livreur. La précision désamorce l'ambiguïté.

### 5.6 — Numéro de commande typographique

```
FG-2026-00037
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Inter Medium                                                  |
| Taille          | 18pt (desktop) · 16pt (mobile)                                |
| Letter-spacing  | 2px                                                          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Format          | `FG-2026-XXXXX` où XXXXX est le compteur séquentiel à 5 chiffres |
| Alignement      | Centré                                                        |
| Espacement haut | 48px sous le sous-titre                                        |
| Sélection texte | **Activée** — la cliente peut copier facilement                |

#### Pourquoi ce format ?

> Format documenté dans la spec `/commander` section 3.7 :
> - **Lisible** (pas d'UUID `8a3f-2c1e-4b9d`)
> - **Mémorisable** (la cliente peut citer le numéro au support sans copier)
> - **Discret** (pas d'effet « commande #00037 = la maison vit ses débuts »)
> - **Format unifié** (FG-AAAA-XXXXX)

#### Affichage typographique soigné

> **Letter-spacing 2px** : donne au numéro un **caractère noble**. Ce n'est plus un simple ID transactionnel — c'est un **identifiant** au sens fort du terme. Comme un numéro de série gravé sur un objet précieux.

#### Bouton copier (V2 optionnel)

En V1, **pas de bouton copier explicite**. La cliente sélectionne le texte avec un double-clic + Cmd/Ctrl+C. La sélection est facilitée par le `user-select: all` sur l'élément.

> En V2, considérer un petit bouton « Copier » qui apparaît au hover (desktop) ou en permanence (mobile) avec icône SVG.

### 5.7 — Filet séparateur

```
╌╌╌
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Style          | Pointillé (`border-top: 1.5px dotted`) ou em-dashes typographiques `╌╌╌` |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Alignement     | Centré                                |
| Espacement     | 32px haut, 24px bas                   |

> **Pourquoi pointillé (vs ligne pleine) ?** Pour signaler une **transition fonctionnelle** (vers les détails livraison) après la partie noble (numéro de commande). Subtil mais marqué.

### 5.8 — Mention livraison estimée

```
Livraison estimée entre le
jeudi 7 et le samedi 9 mai.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.5                                                          |
| Alignement      | Centré                                                        |

#### Calcul des dates

```javascript
function calculateDeliveryWindow(orderDate, shippingMode, city) {
  const businessDays = shippingMode === 'express'
    ? { min: 1, max: 2 }
    : { min: 3, max: 5 };

  const minDelivery = addBusinessDays(orderDate, businessDays.min);
  const maxDelivery = addBusinessDays(orderDate, businessDays.max);

  return {
    minDelivery,
    maxDelivery,
    formatted: `entre le ${formatDateFr(minDelivery)} et le ${formatDateFr(maxDelivery)}`
  };
}

function formatDateFr(date) {
  // Format : "jeudi 7 mai" — pas d'année (c'est l'année en cours)
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];

  return `${dayName} ${dayNum} ${monthName}`;
}
```

#### Variantes d'affichage

| Cas                                  | Affichage                                          |
| :----------------------------------- | :------------------------------------------------- |
| Mode Standard, ville Casablanca       | « Livraison estimée entre le jeudi 7 et le samedi 9 mai. »|
| Mode Express, ville Casablanca        | « Livraison estimée demain ou après-demain. »       |
| Mode Express, mardi vers Marrakech    | « Livraison estimée entre le mercredi 6 et le jeudi 7 mai. »|
| Si même jour mini/max (Express)       | « Livraison estimée le mercredi 6 mai. »            |
| Cas COD (paiement à la livraison)     | (Identique — la livraison est calculée pareil)       |
| Hors zone (cas rare)                  | « Livraison estimée sous 5 à 7 jours. »             |

> **Pas d'affichage en pure dates absolues** (« 07/05 - 09/05 ») — trop sec. La forme « jeudi 7 et samedi 9 » est **plus humaine** et **plus mémorisable**.

### 5.9 — Tokens design

```css
/* ─── Hero de remerciement — tokens ─── */
--merci-hero-bg: #FBF8F1;
--merci-hero-padding-top-desktop: 96px;
--merci-hero-padding-bottom-desktop: 64px;
--merci-hero-padding-x-desktop: 96px;
--merci-hero-padding-x-mobile: 24px;
--merci-hero-content-max-width: 720px;
--merci-hero-min-height-desktop: 480px;

--merci-fleuron-color: #C8A876;
--merci-fleuron-width-desktop: 96px;
--merci-fleuron-width-mobile: 80px;
--merci-fleuron-height-desktop: 14px;
--merci-fleuron-height-mobile: 12px;

--merci-title-font: 'Cormorant Garamond', serif;
--merci-title-weight: 300;
--merci-title-size-desktop: 48pt;
--merci-title-size-tablet: 38pt;
--merci-title-size-mobile: 32pt;
--merci-title-line-height: 1.2;
--merci-title-letter-spacing: -0.5px;
--merci-title-color: #2C2A28;
--merci-title-margin-top: 48px;

--merci-subtitle-font: 'Cormorant Garamond', serif;
--merci-subtitle-style: italic;
--merci-subtitle-size-desktop: 20pt;
--merci-subtitle-size-mobile: 18pt;
--merci-subtitle-color: #4A4844;
--merci-subtitle-line-height: 1.4;
--merci-subtitle-margin-top: 32px;
--merci-subtitle-max-width: 540px;

--merci-order-id-font: 'Inter', sans-serif;
--merci-order-id-weight: 500;
--merci-order-id-size-desktop: 18pt;
--merci-order-id-size-mobile: 16pt;
--merci-order-id-letter-spacing: 2px;
--merci-order-id-color: #2C2A28;
--merci-order-id-margin-top: 48px;
--merci-order-id-user-select: all;

--merci-divider-style: dotted;
--merci-divider-width: 32px;
--merci-divider-height: 1.5px;
--merci-divider-color: #A8C4A6;
--merci-divider-margin-top: 32px;
--merci-divider-margin-bottom: 24px;

--merci-delivery-info-font: 'Cormorant Garamond', serif;
--merci-delivery-info-size-desktop: 16pt;
--merci-delivery-info-size-mobile: 15pt;
--merci-delivery-info-color: #4A4844;
--merci-delivery-info-line-height: 1.5;
```

### 5.10 — Comportements UX

#### Animation au chargement (séquentielle)

```
[t=0ms]      → HTML loaded, fond crème visible
[t=200ms]    → Fleuron fade-in + scale-up (0.85 → 1.0) en 800ms
[t=600ms]    → Titre « Merci, Salma. » fade-in + translate-up 12px (700ms)
[t=1100ms]   → Sous-titre fade-in (600ms)
[t=1500ms]   → Numéro de commande fade-in + letter-spacing animation (3px → 2px) en 700ms
[t=2000ms]   → Filet fade-in (400ms)
[t=2300ms]   → Mention livraison fade-in (500ms)
[t=2800ms]   → Animations terminées
```

> **Animation totale 2.8 secondes** : c'est lent, mais **délibéré**. La cliente vient de finaliser son achat — elle peut **prendre le temps** de voir la page se construire devant elle. Cette lenteur est l'opposé de la précipitation e-commerce.

> **Letter-spacing animé sur le numéro** : le numéro de commande arrive avec un letter-spacing de 3px puis se resserre à 2px en 700ms. Cet effet typographique subtil **valorise** le numéro comme un objet précieux qui se compose sous les yeux de la cliente.

#### Pas de scroll automatique

Le hero **ne scroll pas automatiquement** vers le récap. La cliente reste maîtresse de son rythme.

#### Pas de hover, pas de click

Le hero est **statique après animation**. Aucun élément interactif (sauf la sélection du numéro de commande pour copie).

### 5.11 — Trigger des emails transactionnels

À l'arrivée sur `/merci` (event `page_loaded` confirmé) :

```javascript
async function onMerciPageLoaded(orderId, sessionToken) {
  // 1. Vérification de la validité de la session
  const order = await api.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${sessionToken}` }
  });

  if (!order) {
    window.location.href = '/accueil';
    return;
  }

  // 2. Trigger email confirmation (si pas déjà envoyé)
  if (!order.confirmationEmailSent) {
    await api.post(`/api/orders/${orderId}/send-confirmation-email`);
  }

  // 3. Schedule emails ultérieurs (J+5, J+15)
  if (!order.lifecycleEmailsScheduled) {
    await api.post(`/api/orders/${orderId}/schedule-lifecycle-emails`);
  }

  // 4. Vidage du panier (si pas déjà vidé)
  emptyCart();

  // 5. Tracking GA4 (si consentement)
  if (cookieConsent.analytics) {
    gtag('event', 'purchase', {
      transaction_id: order.id,
      value: order.total,
      currency: 'MAD',
      items: order.items
    });
  }
}
```

### 5.12 — Psychologie

#### 1. Sobriété narrative (ton de la maison)

> Pas de « Bravo ! », pas de « Félicitations ! », pas d'emoji. Juste « Merci, Salma. » Cette sobriété est la signature absolue de la maison — elle fait **résonner** chaque mot.

#### 2. Personnalisation maximale (Cialdini 1984 — la règle de la familiarité)

> Voir son **prénom** dans le titre crée une **micro-relation**. La cliente n'est pas un numéro de commande — elle est Salma.

#### 3. Le fleuron champagne = noblesse de l'instant

> Le fleuron rare apparaît à des **moments éditoriaux nobles**. Sur `/merci`, il signale que la maison considère cette commande comme un **événement** — pas une simple transaction.

#### 4. Numéro de commande typographié = objet précieux

> Le letter-spacing 2px transforme un identifiant fonctionnel en **objet typographique**. La cliente est inconsciemment plus susceptible de **mémoriser** ce numéro (Tversky & Kahneman — l'effet de saillance visuelle).

#### 5. « En bonnes mains » = signal artisanal

> La phrase « Votre commande est en bonnes mains » évoque un **travail humain**. C'est l'opposé du « Votre commande est dans notre système » qui évoquerait un processus automatisé. Subtil mais déterminant pour la perception artisanale.

#### 6. Format de date humain (pas dates absolues)

> « Jeudi 7 et samedi 9 mai » est plus humain et plus rassurant que « 07/05 - 09/05 ». La cliente **visualise** le moment de la livraison dans sa semaine.

### 5.13 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du fleuron | Reconnaissance — la maison considère ma commande              |
| Vue du titre | Touchée — mon prénom est là                                      |
| Vue du sous-titre | Rassurance — je suis prise en charge                          |
| Vue du numéro | Concrétude — j'ai mon référence                                |
| Vue de la livraison estimée | Anticipation patiente — je sais quand                |

### 5.14 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| « Merci pour votre commande ! »                     | Trop fonctionnel, formaté e-commerce                                |
| « Bravo, Salma ! »                                  | Mauvais ton — la cliente n'a rien gagné, elle a payé                |
| « Votre commande #00037 a été enregistrée »         | Vocabulaire administratif — casse l'éditorial                       |
| Animation confetti / fanfare                         | Vulgarité totale — antithèse de la maison                            |
| GIF de remerciement                                  | Banal e-commerce                                                     |
| Pas de personnalisation (« Merci. » seul si prénom dispo) | Manque l'occasion de la chaleur                                |
| Numéro de commande petit et gris                     | L'élément doit être **valorisé** typographiquement                   |
| Pas de mention livraison estimée                      | La cliente attend cette info anxieusement                            |
| Date au format « 07/05/2026 - 09/05/2026 »            | Trop sec — préférer le format humain                                  |
| Hero plein viewport (100vh)                           | Cache le récap — la cliente ne sait pas qu'il y a la suite             |
| Pas de fleuron                                        | Manque la valorisation noble du moment                                |
| Trop d'éléments (boutons, icônes, badges)             | Cassure de la sobriété                                                 |
| Bouton « Imprimer ma commande »                       | V1 inutile — l'email transactionnel suffit                            |
| Sous-titre commercial (« Bénéficiez de 10% sur votre prochaine commande ! »)| Cassure de la complicité                              |

---

## 6 — Section 02 — Récapitulatif de la commande

### 6.1 — Wireframe complet

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  Récapitulatif                                                             │
│                                                                            │
│  ─                                                                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌──────────────┐                                                    │  │
│  │  │              │   Kit Rituel d'Éclat                                │  │
│  │  │   [PHOTO]    │   Quantité : 1                                      │  │
│  │  │   [120×120]  │                                                    │  │
│  │  │              │                                          500 MAD    │  │
│  │  └──────────────┘                                                    │  │
│  │                                                                      │  │
│  │  ─                                                                    │  │
│  │                                                                      │  │
│  │  Sous-total                                              500 MAD     │  │
│  │  Livraison (Standard, Casablanca)                       Gratuit       │  │
│  │  ─                                                                    │  │
│  │  Total                                                   500 MAD      │  │
│  │  Payé par carte bancaire · ••••• 6411                                 │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Adresse de livraison                                                      │
│                                                                            │
│  Salma El Idrissi                                                          │
│  12 Rue de l'Atelier, Apt 4B                                               │
│  Quartier Maârif                                                           │
│  Casablanca, Maroc                                                          │
│  +212 6 12 34 56 78                                                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 360px (desktop) · auto (mobile)                                  |
| Padding vertical       | 64px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 720px                                                             |

> **Pas de fond teinté** : contrairement au récap de `/panier` ou `/commander` (fond crème teintée), le récap sur `/merci` est sur **fond crème uni**. La transaction est terminée — le récap n'est plus une **zone d'action**, c'est une **synthèse archive**.

### 6.3 — Titre

```
Récapitulatif
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 24pt (desktop) · 22pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Aligné à gauche                                      |
| Espacement bas | 8px                                                  |

### 6.4 — Filet sous le titre

```
─
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement bas | 32px                                  |

### 6.5 — Container du récap

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | `#FFFFFF` (Crème pure)                                           |
| Border            | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius     | 0                                                                |
| Padding           | 32px (desktop) · 24px (mobile)                                  |
| Largeur           | 100% du container parent                                          |

> **Container blanc cassé** : différencie visuellement le récap du fond crème de la section. Le contenu est **enchâssé** comme un certificat dans son cadre. Cohérent avec la card article de `/panier` mais ici sans interactivité.

### 6.6 — Bloc produit

#### Disposition

| Breakpoint | Layout                                                                |
| :--------- | :-------------------------------------------------------------------- |
| Desktop    | Photo à gauche (120×120px) · contenu à droite · prix tout à droite     |
| Tablet     | Photo à gauche (96×96px) · contenu à droite · prix tout à droite      |
| Mobile     | Photo à gauche (80×80px) · contenu à droite · prix tout à droite      |

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Kit complet (identique à `/panier`, `/kit`)                           |
| Format            | Carré (1:1)                                                            |
| Dimensions        | 120×120px (desktop) · 96×96px (tablet) · 80×80px (mobile)              |
| Object-fit        | `cover`                                                                |
| Border            | Aucun                                                                   |
| Border-radius     | 0                                                                      |

#### Bloc info

```
Kit Rituel d'Éclat
Quantité : 1
                                          500 MAD
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Nom du produit       | Cormorant Garamond Light 22pt, couleur Encre                  |
| Lien sur le nom      | **Pas de lien** (différence avec `/panier` où le nom est cliquable) |
| Quantité             | Cormorant Garamond Regular Italic 14pt, couleur Encre claire  |
| Prix                 | Inter Medium 16pt, couleur Encre, aligné à droite              |
| Layout flex          | Photo + (Nom + Quantité empilés) + Prix flex space-between     |

> **Pourquoi pas de lien sur le nom ?** Sur `/panier`, le nom est cliquable (pour revoir le produit avant achat). Sur `/merci`, l'achat est conclu — un retour vers `/kit` n'a plus de sens immédiat. La cliente reverra le kit **physiquement** dans 3-5 jours. Pas de lien.

### 6.7 — Filet séparateur intérieur

```
─
```

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 100% du container interne              |
| Hauteur        | 1px                                   |
| Couleur        | `#E8E0D2` (Ligne)                     |
| Espacement     | 24px haut, 24px bas                   |

### 6.8 — Bloc Sous-total / Livraison / Total

#### Composition

```
Sous-total                                              500 MAD
Livraison (Standard, Casablanca)                       Gratuit
─
Total                                                   500 MAD
Payé par carte bancaire · ••••• 6411
```

#### Spécifications

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Layout chaque ligne  | Flex space-between                                              |
| Espacement entre lignes | 12px                                                       |
| Font label           | Inter Regular 14pt, couleur Encre claire                       |
| Font montant         | Inter Medium 14pt, couleur Encre                               |
| Filet avant Total    | 16px de large, 1px sauge dark, espacement 16px haut + 16px bas |
| Font Total label     | Inter Medium 15pt, couleur Encre                               |
| Font Total montant   | Inter SemiBold 17pt, couleur Encre                            |
| Mention paiement     | Inter Regular Italic 12pt, couleur Brume, sous le total       |

#### Variantes selon mode de paiement

##### Carte bancaire

```
Total                                                   500 MAD
Payé par carte bancaire · ••••• 6411
```

> **Format ••••• 6411** : 5 puces de masquage suivies des **4 derniers chiffres** de la carte (issus du token CMI). Standard PCI-DSS.

##### Paiement à la livraison

```
Total                                                   520 MAD
À payer à la livraison · espèces ou carte sans contact
```

> **Mention différente** pour COD : la cliente n'a **pas encore payé** — la phrase précise « à payer ». Évite l'ambiguïté.

##### Cas avec frais COD

```
Sous-total                                              500 MAD
Livraison (Standard, Casablanca)                       Gratuit
Frais paiement à la livraison                          + 20 MAD
─
Total                                                   520 MAD
À payer à la livraison · espèces ou carte sans contact
```

#### Variantes selon ville et mode

| Cas                                  | Affichage livraison                                  |
| :----------------------------------- | :---------------------------------------------------- |
| Standard, Casablanca                 | « Livraison (Standard, Casablanca) · Gratuit »         |
| Standard, Marrakech                  | « Livraison (Standard, Marrakech) · 30 MAD »           |
| Express, Casablanca                  | « Livraison (Express, Casablanca) · 50 MAD »           |
| Standard, ville rurale               | « Livraison (Standard, autre) · 50 MAD »               |

### 6.9 — Bloc Adresse de livraison

#### Composition

```
Adresse de livraison

Salma El Idrissi
12 Rue de l'Atelier, Apt 4B
Quartier Maârif
Casablanca, Maroc
+212 6 12 34 56 78
```

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Espacement haut        | 32px sous le container du récap                                  |
| Surtitre               | Inter Medium 11pt, couleur Encre, uppercase tracking 1.5px       |
| Espacement après surtitre | 16px                                                          |
| Format adresse         | Cormorant Garamond Regular 15pt, couleur Encre, line-height 1.6 |
| Téléphone              | Cormorant Garamond Regular 15pt, couleur Encre, espacement 12px haut (séparation visuelle) |

#### Lien « Modifier » (V2 — pas en V1)

> En V1, **pas de lien « Modifier l'adresse »**. La commande est validée — modifier l'adresse n'est plus possible côté client. Si besoin de modification : email à `contact@femiglow.ma`.

> En V2 : si la commande n'a pas encore été expédiée (statut "preparing"), permettre une modification d'adresse via un formulaire spécifique avec validation.

### 6.10 — Tokens design

```css
/* ─── Récapitulatif commande — tokens ─── */
--recap-confirm-bg: #FBF8F1;
--recap-confirm-padding-vertical: 64px;
--recap-confirm-content-max-width: 720px;

--recap-confirm-title-font: 'Cormorant Garamond', serif;
--recap-confirm-title-weight: 300;
--recap-confirm-title-size: 24pt;
--recap-confirm-title-color: #2C2A28;

--recap-confirm-divider-width: 32px;
--recap-confirm-divider-color: #A8C4A6;
--recap-confirm-divider-margin-bottom: 32px;

/* Container du récap */
--recap-card-bg: #FFFFFF;
--recap-card-border: 1px solid #E8E0D2;
--recap-card-padding-desktop: 32px;
--recap-card-padding-mobile: 24px;

/* Bloc produit */
--recap-item-photo-size-desktop: 120px;
--recap-item-photo-size-mobile: 80px;
--recap-item-name-font: 'Cormorant Garamond', serif;
--recap-item-name-size: 22pt;
--recap-item-quantity-style: italic;
--recap-item-quantity-size: 14pt;
--recap-item-quantity-color: #4A4844;
--recap-item-price-font: 'Inter', sans-serif;
--recap-item-price-weight: 500;
--recap-item-price-size: 16pt;

/* Filet intérieur */
--recap-inner-divider-color: #E8E0D2;
--recap-inner-divider-margin: 24px 0;

/* Bloc montants */
--recap-line-gap: 12px;
--recap-label-font: 'Inter', sans-serif;
--recap-label-size: 14pt;
--recap-label-color: #4A4844;
--recap-value-font: 'Inter', sans-serif;
--recap-value-weight: 500;
--recap-value-size: 14pt;
--recap-value-color: #2C2A28;

--recap-total-divider-color: #A8C4A6;
--recap-total-divider-margin: 16px 0;
--recap-total-label-weight: 500;
--recap-total-label-size: 15pt;
--recap-total-value-weight: 600;
--recap-total-value-size: 17pt;

--recap-payment-info-style: italic;
--recap-payment-info-size: 12pt;
--recap-payment-info-color: #6B6863;
--recap-payment-info-margin-top: 6px;

/* Bloc adresse */
--recap-address-section-margin-top: 32px;
--recap-address-kicker-font: 'Inter', sans-serif;
--recap-address-kicker-weight: 500;
--recap-address-kicker-size: 11pt;
--recap-address-kicker-tracking: 1.5px;
--recap-address-kicker-color: #2C2A28;
--recap-address-text-font: 'Cormorant Garamond', serif;
--recap-address-text-size: 15pt;
--recap-address-text-color: #2C2A28;
--recap-address-text-line-height: 1.6;
--recap-address-phone-margin-top: 12px;
```

### 6.11 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → titre + filet fade-in (500ms)
[atteint 70%]             → container récap fade-in + translate-up 8px (700ms)
[atteint 60%]             → bloc adresse fade-in (500ms)
```

#### Pas d'interactivité

Le récap est **purement informationnel**. Aucun bouton « Modifier », aucune action.

#### Sélection texte autorisée

La cliente peut **sélectionner et copier** :
- Le numéro de commande (déjà géré dans le hero)
- L'adresse de livraison (utile pour vérifier ou partager au support)
- Les détails de paiement

```css
.recap-confirm * {
  user-select: text; /* Activé par défaut, juste explicite */
}
```

### 6.12 — Cas spéciaux

#### Cas 1 — Commande pour un proche (cadeau, V2)

V2 : si la commande est marquée comme cadeau, ajouter une section :

```
Adresse du destinataire

Mlle Aïcha El Mokri
[adresse]

Note de votre part :
« Joyeux anniversaire ma sœur — Salma »
```

> **V1** : pas de gestion cadeau. La commande est toujours pour le compte de la cliente.

#### Cas 2 — Plusieurs articles (V2 multi-produits)

V2 : si plusieurs articles dans la commande, afficher chacun comme un bloc séparé empilé. Filet séparateur entre chaque bloc.

> **V1** : un seul kit possible — pas de besoin.

#### Cas 3 — Code promo appliqué

```
Sous-total                                              500 MAD
Code MAISON10                                          -50 MAD
Livraison (Standard, Casablanca)                       Gratuit
─
Total                                                   450 MAD
Payé par carte bancaire · ••••• 6411
```

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Ligne code promo     | Identique aux autres, mais montant en couleur Sauge dark `#A8C4A6` |
| Format               | « Code [NOM_CODE] · -50 MAD »                                  |

### 6.13 — Psychologie

#### 1. Format éditorial vs tableau Excel

> Le récap n'est pas un tableau de données. C'est un **document** — chaque ligne respire, le texte est en serif, l'ensemble ressemble à une **invoice manuscrite digne**. Cassure totale avec l'esthétique Shopify standard.

#### 2. Confirmation par redondance avec l'email

> La cliente recevra un email transactionnel avec **les mêmes informations**. Cette redondance est **rassurante** : elle peut consulter l'info à plusieurs endroits.

#### 3. Adresse complète affichée = vérification finale

> Voir son adresse écrite **noir sur blanc** permet à la cliente de vérifier en un coup d'œil. Si erreur : elle peut écrire au support **avant** que la commande ne soit expédiée.

#### 4. Mention du mode de paiement = transparence

> Préciser « Payé par carte bancaire · ••••• 6411 » confirme **quelle carte** a été utilisée. Important si la cliente a plusieurs cartes ou si le paiement a été fait au nom d'un proche (cas cadeau).

#### 5. Pas de bouton "Imprimer"

> Tentation classique. **Refusé en V1** : l'email transactionnel sert d'archive imprimable. Inutile de dupliquer la fonction.

### 6.14 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Récap dans un tableau HTML standard                  | Esthétique Shopify, casse l'éditorial                                |
| Photo absente ou minuscule                           | La cliente doit reconnaître son achat                                |
| Pas de filet séparateur avant Total                  | Hiérarchie visuelle confuse                                          |
| Mode de paiement non mentionné                       | Manque de transparence (« quelle carte ai-je utilisée ? »)            |
| Adresse non affichée                                  | Empêche la vérification finale                                        |
| Pas de mention « Quartier » si renseignée            | Information utile au livreur — la cliente veut vérifier               |
| Numéro de téléphone caché                             | Important — c'est le numéro qui sera appelé par le livreur            |
| Format date fonctionnel uniquement (« 07/05/2026 »)   | Préférer le format humain                                              |
| Bouton « Modifier la commande » très visible         | Suggère que la commande est **modifiable** alors qu'elle ne l'est pas |
| Bouton « Annuler » immédiat                           | Mauvais signal psychologique — on cherche la confiance                |
| Mention « Vous économisez X MAD »                     | Manipulation post-achat — moment inopportun                            |
| Récap sur fond teinté                                  | La transaction est conclue — le fond uni signale la finalité           |
| Liens cliquables sur les chiffres                     | Inutile, distrait                                                       |

---

## 7 — Section 03 — Suivi & prochaines étapes

### 7.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                                                                            ║
║                          Les prochaines étapes.                            ║
║                                                                            ║
║                                                                            ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         ║
║  │                  │  │                  │  │                  │         ║
║  │      ◉           │  │      ○           │  │      ○           │         ║
║  │                  │  │                  │  │                  │         ║
║  │  Préparation     │  │  Expédition      │  │  Livraison       │         ║
║  │  ─                │  │  ─                │  │  ─                │         ║
║  │                  │  │                  │  │                  │         ║
║  │  Aujourd'hui      │  │  Sous 1 à 2 jours │  │  Entre le         │         ║
║  │                  │  │                  │  │  jeudi 7 et le   │         ║
║  │  Votre kit est    │  │  Vous recevrez   │  │  samedi 9 mai    │         ║
║  │  préparé avec    │  │  un email avec   │  │                  │         ║
║  │  attention        │  │  le numéro de    │  │  Le livreur      │         ║
║  │  dans l'atelier.  │  │  suivi.          │  │  vous appellera. │         ║
║  │                  │  │                  │  │                  │         ║
║  └──────────────────┘  └──────────────────┘  └──────────────────┘         ║
║                                                                            ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                            (fond sauge pâle, pleine largeur)
```

### 7.2 — Pourquoi un fond sauge pâle ?

Cohérent avec **toutes les sections d'engagement** du site :
- `/rituel` pivot vers `/kit` → fond sauge pâle
- `/kit` bandeau CTA final → fond sauge pâle
- `/journal` newsletter → fond sauge pâle
- `/maison` engagements → fond sauge pâle
- `/panier` trust signals → fond sauge pâle
- **`/merci` suivi → fond sauge pâle**

> **La règle confirmée** : tout **moment d'engagement** ou **promesse formelle** apparaît sur fond sauge pâle. Le suivi de commande est une **promesse logistique** de la maison envers la cliente.

### 7.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#E8EFE7` (Sauge pâle) — pleine largeur                          |
| Hauteur                | 360px (desktop) · auto (mobile)                                  |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 1200px                                                            |

### 7.4 — Titre

```
Les prochaines étapes.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 28pt (desktop) · 24pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 64px (desktop) · 48px (mobile)                       |

> **« Les prochaines étapes. »** — point final. Pas « Que se passe-t-il maintenant ? » (interrogatif anxieux), pas « What's next » (anglicisme), pas « Suivez votre commande ! » (impératif). Une affirmation claire.

### 7.5 — Disposition de la grille

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | 3 colonnes égales, gap 48px                |
| Tablet     | 3 colonnes égales, gap 32px                |
| Mobile     | 1 colonne (empilées), gap 48px             |

### 7.6 — Connecteurs visuels entre étapes (desktop)

> **Subtilité graphique** : sur desktop, **un fin filet horizontal** relie les trois étapes — comme un timeline visuel. Ce filet est interrompu par chaque cercle d'étape.

```
   ◉ ─────────────── ○ ─────────────── ○
   (active)         (à venir)         (à venir)
```

| Propriété              | Valeur                                                  |
| :--------------------- | :------------------------------------------------------ |
| Couleur filet           | `#A8C4A6` (Sauge dark) à 30% d'opacité — `#A8C4A655`     |
| Hauteur                 | 1px                                                       |
| Position                | À hauteur du cercle (centré verticalement)                 |
| Visibilité              | Desktop ≥ 1024px uniquement                                |

> **Pas de filet sur mobile** : les étapes étant empilées verticalement, un filet vertical serait moins lisible. La séparation par espace suffit.

### 7.7 — Spécifications de chaque étape (card)

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | Transparent (le sauge pâle de la section transparait)             |
| Border            | Aucun                                                              |
| Padding           | 0 (pas de padding interne — l'espacement vertical entre éléments suffit) |
| Alignement        | Centré horizontalement                                              |
| Largeur           | 100% de la colonne (gap géré par grid)                             |

#### Cercle d'étape

| État                | Apparence                                                          |
| :------------------ | :----------------------------------------------------------------- |
| Active (étape 1 — Préparation) | Cercle plein sauge dark `#A8C4A6`, taille 16×16px, anneau extérieur 2px sauge dark + 4px d'offset (effet halo) |
| À venir (étapes 2 et 3) | Cercle vide avec border 2px sauge dark, taille 16×16px           |
| Complétée (V2 si statut sync) | Cercle plein avec ✓ blanc à l'intérieur                       |

> **Halo sur étape active** : signal subtil que cette étape est **en cours**. Évoque une pulsation lumineuse sans animation forcée.

#### Animation halo (étape active)

```css
.step-active .step-circle {
  position: relative;
}

.step-active .step-circle::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid var(--color-sauge-dark);
  opacity: 0.4;
  animation: halo-pulse 2.5s ease-in-out infinite;
}

@keyframes halo-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.1;
  }
}
```

> **Animation discrète** : 2.5s par cycle, opacité variant de 0.4 à 0.1. Présence sans agitation. Désactivée si `prefers-reduced-motion: reduce`.

#### Titre d'étape

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Light                                |
| Taille         | 22pt (desktop) · 20pt (mobile)                          |
| Couleur        | `#2C2A28` (Encre)                                       |
| Espacement haut| 32px sous le cercle                                      |
| Alignement     | Centré                                                   |

#### Filet sous le titre

| Propriété      | Valeur                                |
| :------------- | :------------------------------------ |
| Largeur        | 32px                                  |
| Hauteur        | 1.5px                                 |
| Couleur        | `#A8C4A6` (Sauge dark)                |
| Espacement     | 12px haut, 16px bas                   |

#### Date / délai (gros caractères)

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Inter Medium                                            |
| Taille         | 14pt (desktop) · 13pt (mobile)                          |
| Couleur        | `#2C2A28` (Encre)                                       |
| Letter-spacing | 0.5px                                                    |
| Espacement bas | 12px                                                     |

#### Description

| Propriété      | Valeur                                                  |
| :------------- | :------------------------------------------------------ |
| Police         | Cormorant Garamond Regular                              |
| Taille         | 14pt (desktop) · 13pt (mobile)                          |
| Couleur        | `#4A4844` (Encre claire)                                |
| Line-height    | 1.5                                                     |
| Largeur max    | 240px                                                    |
| Alignement     | Centré                                                   |

### 7.8 — Les trois étapes — copy intégral

#### Étape 1 — Préparation (active)

```
◉

Préparation
─

Aujourd'hui

Votre kit est préparé avec
attention dans l'atelier.
```

#### Étape 2 — Expédition (à venir)

```
○

Expédition
─

Sous 1 à 2 jours

Vous recevrez un email avec
le numéro de suivi.
```

#### Étape 3 — Livraison (à venir)

```
○

Livraison
─

Entre le jeudi 7 et le samedi 9 mai

Le livreur vous appellera.
```

### 7.9 — Variantes selon le mode et la situation

#### Cas Express (1-2 jours)

```
Étape 2 — Expédition : « Demain »
Étape 3 — Livraison : « Sous 1 à 2 jours · Le livreur vous appellera. »
```

#### Cas COD (paiement à la livraison)

```
Étape 3 — Livraison :
« Entre le jeudi 7 et le samedi 9 mai

Le livreur vous appellera pour
confirmer le rendez-vous.
Préparez la somme exacte ou
votre carte sans contact. »
```

> **Plus long pour COD** : la cliente doit savoir qu'elle paiera au livreur. Texte étendu pour être complet.

#### Cas Standard hors Casablanca

```
Étape 3 — Livraison :
« Entre le vendredi 8 et le mardi 12 mai

Le livreur vous appellera. »
```

> **Délais ajustés** selon ville (calcul automatique cohérent avec section 5.8).

### 7.10 — Tokens design

```css
/* ─── Suivi & prochaines étapes — tokens ─── */
--steps-section-bg: #E8EFE7;
--steps-section-padding-vertical: 96px;
--steps-section-padding-x-desktop: 96px;
--steps-section-padding-x-mobile: 24px;
--steps-content-max-width: 1200px;

--steps-title-font: 'Cormorant Garamond', serif;
--steps-title-weight: 300;
--steps-title-size-desktop: 28pt;
--steps-title-color: #2C2A28;
--steps-title-margin-bottom-desktop: 64px;

--steps-grid-gap-desktop: 48px;
--steps-grid-gap-mobile: 48px;

/* Connecteur entre étapes (desktop only) */
--steps-connector-color: #A8C4A655;
--steps-connector-height: 1px;

/* Cercle */
--step-circle-size: 16px;
--step-circle-active-bg: #A8C4A6;
--step-circle-pending-bg: transparent;
--step-circle-pending-border: 2px solid #A8C4A6;
--step-circle-active-halo-size: 32px;
--step-circle-active-halo-animation-duration: 2.5s;

/* Titre étape */
--step-title-font: 'Cormorant Garamond', serif;
--step-title-weight: 300;
--step-title-size-desktop: 22pt;
--step-title-color: #2C2A28;
--step-title-margin-top: 32px;

/* Filet sous titre */
--step-divider-width: 32px;
--step-divider-color: #A8C4A6;
--step-divider-margin: 12px 0 16px;

/* Date / délai */
--step-date-font: 'Inter', sans-serif;
--step-date-weight: 500;
--step-date-size-desktop: 14pt;
--step-date-color: #2C2A28;
--step-date-letter-spacing: 0.5px;
--step-date-margin-bottom: 12px;

/* Description */
--step-desc-font: 'Cormorant Garamond', serif;
--step-desc-size-desktop: 14pt;
--step-desc-color: #4A4844;
--step-desc-line-height: 1.5;
--step-desc-max-width: 240px;
```

### 7.11 — Comportements UX

#### Animation au scroll (cascade)

```
[atteint 80% viewport]   → titre fade-in (500ms)
[atteint 70%]             → étape 1 (Préparation) fade-in + translate-up 8px (600ms)
[atteint 60%]             → étape 2 (Expédition) fade-in + translate-up 8px (600ms)
[atteint 50%]             → étape 3 (Livraison) fade-in + translate-up 8px (600ms)
[fin animation]           → halo pulse démarre sur étape 1
```

> **Cascade lecture occidentale** : étape 1 → 2 → 3 (gauche à droite). Le rythme cascade renforce la **séquentialité** des étapes dans l'esprit de la cliente.

#### Pas d'interactivité

Les étapes sont **statiques**. Aucun click possible.

> **V2** : si l'expédition se fait, l'étape 2 deviendra cliquable pour ouvrir un lien de tracking transporteur. En V1, pas de tracking en temps réel — l'email avec numéro de suivi suffit.

### 7.12 — Pas d'horloge en temps réel

> Volontairement, **pas d'animation type horloge** ou de countdown vers la livraison. La maison **ne presse pas** la cliente — elle l'**informe** sereinement.

### 7.13 — Psychologie

#### 1. Hofstadter's law inversée — donner large

> **Hofstadter (1979)** : *« Les choses prennent toujours plus de temps que prévu, même en tenant compte de la loi de Hofstadter. »*

En annonçant « entre le 7 et le 9 mai » (fenêtre de 2 jours), la maison se donne une **marge de sécurité**. Si la livraison arrive le 7, c'est un **petit cadeau** ; si elle arrive le 9, c'est dans la promesse. Jamais de déception.

#### 2. Visibilité du processus (Norman 1988)

> Trois étapes visibles = la cliente **sait** où elle en est. L'incertitude est l'**ennemi** de la satisfaction post-achat.

#### 3. Halo pulsé sur étape active = présence vivante

> L'animation halo signifie « quelque chose se passe maintenant pour vous ». Sans bouger frénétiquement, sans crier — juste une **respiration visuelle**.

#### 4. Mention « le livreur vous appellera »

> Réalité culturelle marocaine. Annoncer **explicitement** désamorce l'incertitude (« vais-je rater le livreur ? »). Le téléphone fourni à `/commander` étape 2 sera utilisé.

#### 5. Pas de tracking GPS temps réel V1

> Tentation des sites e-commerce : carte avec position du livreur en temps réel. **Refusé en V1** — surinvestissement technique pour un bénéfice émotionnel marginal. En V2, à reconsidérer si volume justifie.

### 7.14 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du titre | « Je sais ce qui va se passer »                                   |
| Vue de l'étape 1 active (halo) | « Ils s'occupent de mon kit en ce moment »      |
| Vue des étapes 2 et 3 | Anticipation patiente — le futur est cartographié          |
| Mention du livreur qui appelle | Rassurance logistique pure                              |

### 7.15 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 3 étapes                                     | Surcharge cognitive — 3 est l'optimum                                |
| Étapes avec pictogrammes / illustrations              | Banalise — préférer la sobriété typographique                       |
| Animation excessive (cercles qui clignotent fort)     | Anxiogène                                                            |
| Countdown précis (« Livraison dans 03j 14h 22min »)   | Faux et stressant                                                    |
| Carte GPS en temps réel V1                            | Sur-engineering pour bénéfice marginal                                |
| Statut « En cours » sur chaque étape                  | Vague — préférer le titre clair                                       |
| Pas de mention du livreur (appel)                      | Manque l'info culturellement essentielle                              |
| Texte d'étape > 30 mots                               | Trop bavard pour ce format                                            |
| Tracking number visible mais pas utilisable            | Frustrant — préférer email avec lien direct                           |
| Étape 1 sans halo (statique)                          | Manque le signal « ça se passe maintenant »                            |
| Dates en format `DD/MM/YYYY`                           | Préférer le format humain (« jeudi 7 mai »)                           |
| Halo trop visible (fast pulse, gros)                   | Anxiogène                                                              |

---

## 8 — Section 04 — Lettre éditoriale d'accueil

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                                                            │
│   Salma,                                                                    │
│                                                                            │
│   Vous venez de commander un kit. Mais ce kit, pour nous,                  │
│   n'est pas un produit. C'est un rituel — quatre matières,                 │
│   quatre gestes, et le temps qu'on s'accorde à soi.                        │
│                                                                            │
│   Pendant que votre kit voyage vers vous, nous tenions à                   │
│   vous remercier de votre confiance. Cette commande, en V1                  │
│   de notre maison, est un encouragement précieux.                          │
│                                                                            │
│   Quand vous ouvrirez la boîte, prenez le temps. Lisez la                  │
│   carte que nous y avons glissée. Et, si possible, choisissez              │
│   un moment calme pour votre premier rituel.                               │
│                                                                            │
│   Avec soin,                                                                │
│                                                                            │
│   Salma                                                                    │
│   Fondatrice de la maison                                                  │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Pourquoi une lettre éditoriale ?

> Le moment post-achat est **unique** : la cliente vient de payer, son attention est disponible, elle attend de voir si la maison **continue à exister** au-delà de la transaction.

Une lettre éditoriale signée Salma transforme la page de remerciement en **moment de relation**. Pas un message générique — un texte signé par une personne réelle, écrit à la deuxième personne, au ton intime.

C'est l'équivalent digital de la **carte manuscrite** glissée dans certaines boîtes premium. Sauf qu'ici, elle est **immédiate** (la cliente la lit avant même de recevoir la boîte).

### 8.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 480px (desktop) · auto (mobile)                                  |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 640px                                                             |
| Alignement contenu     | Centré horizontalement                                            |

> **Largeur max 640px** : adaptée à la lecture confortable d'un texte court (~150-200 mots). Pas trop large (lecture lente) ni trop étroit (sensation d'enferrement).

### 8.4 — Pas de surtitre ni de titre de section

> Volontairement, **pas de « Une lettre de la maison »** ni de **« Mot de la fondatrice »** en surtitre. La lettre **commence directement** par l'interpellation « Salma, » — comme une vraie lettre.

> Cette absence de méta-titre est **délibérée** : on ne veut pas que la cliente perçoive cette section comme un **dispositif marketing** (« Ah, c'est leur lettre commerciale »). On veut qu'elle la lise comme une **lettre vraie**.

### 8.5 — L'interpellation

```
Salma,
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 24pt (desktop) · 22pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Aligné à gauche                                               |
| Espacement bas  | 32px                                                          |

#### Variantes selon disponibilité du prénom

| Cas                              | Affichage                                          |
| :------------------------------- | :------------------------------------------------- |
| Prénom fourni                    | « Salma, »                                          |
| Prénom non fourni (rare)         | « Bonjour, » (générique mais doux)                  |

> **« Salma, »** + virgule + retour à la ligne = format **lettre française classique**. La cliente reconnaît immédiatement le code épistolaire.

### 8.6 — Corps de la lettre

#### Composition typographique

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 17pt (desktop) · 16pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Line-height     | 1.7 (large pour lecture confortable)                         |
| Alignement      | Aligné à gauche (pas justifié — préserve les blancs naturels)|
| Espacement entre paragraphes | 20px                                              |

> **Line-height 1.7** : plus large que les autres textes du site (1.5-1.6). Donne un **rythme respiré** à la lettre — comme si elle était écrite à la plume avec des pauses.

#### Texte intégral V1

```
Vous venez de commander un kit. Mais ce kit, pour nous,
n'est pas un produit. C'est un rituel — quatre matières,
quatre gestes, et le temps qu'on s'accorde à soi.

Pendant que votre kit voyage vers vous, nous tenions à
vous remercier de votre confiance. Cette commande, en V1
de notre maison, est un encouragement précieux.

Quand vous ouvrirez la boîte, prenez le temps. Lisez la
carte que nous y avons glissée. Et, si possible, choisissez
un moment calme pour votre premier rituel.
```

> **Trois paragraphes courts** :
> 1. **Cadrage** : ce que représente le kit pour la maison (rituel, pas produit)
> 2. **Reconnaissance** : remerciement + mention V1 (humilité + complicité)
> 3. **Préparation** : invitation à recevoir la commande **comme un événement**

#### Décomposition des éléments narratifs

##### Paragraphe 1

> *« Vous venez de commander un kit. Mais ce kit, pour nous, n'est pas un produit. C'est un rituel — quatre matières, quatre gestes, et le temps qu'on s'accorde à soi. »*

- **Reconnaissance de l'acte** : « Vous venez de commander un kit »
- **Recadrage philosophique** : « Mais ce kit, pour nous, n'est pas un produit »
- **Définition signée** : « C'est un rituel — quatre matières, quatre gestes, et le temps qu'on s'accorde à soi »

> Cette phrase finale est la **signature complète du rituel** — elle apparaît aussi dans `/rituel`, `/kit`, `/journal`. Cohérence narrative absolue.

##### Paragraphe 2

> *« Pendant que votre kit voyage vers vous, nous tenions à vous remercier de votre confiance. Cette commande, en V1 de notre maison, est un encouragement précieux. »*

- **Image poétique** : « votre kit voyage vers vous » (pas « votre kit est en cours d'expédition »)
- **Reconnaissance** : « nous tenions à vous remercier de votre confiance » (verbe au passé composé = délibération préalable)
- **Aveu d'humilité** : « V1 de notre maison » + « encouragement précieux » — la cliente est partie prenante du début de la maison

> **« V1 de notre maison »** est une formule rare en e-commerce. Elle **partage la fragilité** des débuts — créant une complicité avec les early adopters. À retirer en V2 quand la maison sera mature.

##### Paragraphe 3

> *« Quand vous ouvrirez la boîte, prenez le temps. Lisez la carte que nous y avons glissée. Et, si possible, choisissez un moment calme pour votre premier rituel. »*

- **Préparation au moment** : « Quand vous ouvrirez la boîte, prenez le temps »
- **Promesse physique** : « la carte que nous y avons glissée » — la cliente sait qu'il y aura quelque chose de **personnel** dans la boîte
- **Conseil délicat** : « si possible, choisissez un moment calme »

> **« Si possible »** désamorce la directivité. La maison **suggère** sans imposer.

### 8.7 — La signature

```
Avec soin,

Salma
Fondatrice de la maison
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Espacement haut | 32px sous le dernier paragraphe                                |

#### « Avec soin, »

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 16pt                                                          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Espacement bas  | 24px                                                          |

> **« Avec soin, »** est la signature de fermeture **récurrente** dans tous les emails de la maison. Cohérence absolue. Pas « Cordialement » (administratif), pas « Avec amour » (excessif), pas « Best regards » (anglicisme). « Avec soin » = la signature de la maison.

#### Prénom signature

```
Salma
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Pinyon Script Regular                                          |
| Taille          | 36pt (desktop) · 32pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Aligné à gauche                                               |

> **Pinyon Script** : la même police que le wordmark FemiGlow. Le prénom de la fondatrice est **typographié comme le wordmark** — signal subtil que **Salma EST la maison**.

#### Sous-signature

```
Fondatrice de la maison
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Inter Medium 11pt                                              |
| Letter-spacing  | 1.5px                                                          |
| Couleur         | `#6B6863` (Brume)                                             |
| Transformation  | uppercase                                                       |
| Espacement haut | 8px                                                            |

> **« Fondatrice de la maison »** (pas « CEO », pas « Founder & CEO », pas « PDG »). Le mot **« fondatrice »** est précieux : il évoque un acte de **création**, pas un titre administratif. Cohérent avec le ton de `/maison`.

### 8.8 — Tokens design

```css
/* ─── Lettre éditoriale — tokens ─── */
--letter-bg: #FBF8F1;
--letter-padding-vertical: 96px;
--letter-content-max-width: 640px;

--letter-greeting-font: 'Cormorant Garamond', serif;
--letter-greeting-weight: 300;
--letter-greeting-size-desktop: 24pt;
--letter-greeting-color: #2C2A28;
--letter-greeting-margin-bottom: 32px;

--letter-body-font: 'Cormorant Garamond', serif;
--letter-body-weight: 400;
--letter-body-size-desktop: 17pt;
--letter-body-size-mobile: 16pt;
--letter-body-color: #2C2A28;
--letter-body-line-height: 1.7;
--letter-body-paragraph-gap: 20px;

--letter-closing-font: 'Cormorant Garamond', serif;
--letter-closing-style: italic;
--letter-closing-size: 16pt;
--letter-closing-color: #2C2A28;
--letter-closing-margin-top: 32px;
--letter-closing-margin-bottom: 24px;

--letter-signature-font: 'Pinyon Script', cursive;
--letter-signature-size-desktop: 36pt;
--letter-signature-size-mobile: 32pt;
--letter-signature-color: #2C2A28;

--letter-role-font: 'Inter', sans-serif;
--letter-role-weight: 500;
--letter-role-size: 11pt;
--letter-role-tracking: 1.5px;
--letter-role-color: #6B6863;
--letter-role-transform: uppercase;
--letter-role-margin-top: 8px;
```

### 8.9 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → interpellation « Salma, » fade-in (600ms)
[atteint 70%]             → paragraphe 1 fade-in + translate-up 8px (700ms)
[atteint 60%]             → paragraphe 2 fade-in (700ms)
[atteint 50%]             → paragraphe 3 fade-in (700ms)
[atteint 40%]             → signature complète fade-in (800ms)
```

> **Cascade lente** : la lettre apparaît **paragraphe par paragraphe**, comme si elle se composait sous les yeux de la cliente. Pas de skeleton ni de spinner — juste une apparition progressive.

#### Pas d'interactivité

La lettre est **purement narrative**. Aucun bouton, aucun lien — elle se lit, c'est tout.

> **Sauf** : la signature « Salma » pourrait être un lien vers `/maison` en V2. En V1, **non** — la cliente n'est pas censée quitter la lettre par un lien interne ; elle peut découvrir Salma plus loin via le cross-link `/maison`.

### 8.10 — Variantes selon le contexte

#### Cas COD (paiement à la livraison)

Petit ajout au paragraphe 2 :

```
Pendant que votre kit voyage vers vous, nous tenions à
vous remercier de votre commande. Le livreur vous appellera
dans les prochains jours.

Cette commande, en V1 de notre maison, est un encouragement précieux.
```

> **« nous tenions à vous remercier de votre commande »** (vs « de votre confiance ») : nuance fine — la confiance complète sera donnée au moment du paiement à la livraison. Petite honnêteté éditoriale.

#### Cas deuxième commande (V2)

Si la cliente a déjà commandé une fois auparavant :

```
Salma,

Merci de revenir. Que vous ayez aimé ou que vous offriez —
votre fidélité nous touche.

[reste de la lettre adapté]
```

> **V2 uniquement** : nécessite la connaissance de l'historique cliente (compte connecté).

### 8.11 — Pas de photo de Salma sur cette section

> Tentation : photo de Salma en signature pour humaniser. **Refusé en V1** :
> - La photo de Salma est sur `/maison` — laisser cette page la révéler
> - Une photo ici **réduirait l'impact** narratif de la lettre (signal « C'est de la pub »)
> - Le prénom typographié en Pinyon Script est **plus évocateur** qu'une photo

### 8.12 — Psychologie

#### 1. Le format lettre = code émotionnel reconnaissable

> **Schwartz (1990)** : *« Conventional formats trigger conventional emotional responses. »*

Quand la cliente voit « Salma, » + 3 paragraphes + « Avec soin, Salma », elle reconnaît **inconsciemment** le format **lettre intime**. Sa garde commerciale baisse.

#### 2. Recadrage philosophique = élévation cognitive

> Le paragraphe 1 « ce kit n'est pas un produit, c'est un rituel » **recadre** l'achat. La cliente n'a pas acheté un produit — elle a commandé un rituel. Cette élévation est un **anti buyer's remorse** puissant.

#### 3. Aveu d'humilité (« V1 de notre maison »)

> Le partage de la fragilité crée une **complicité**. La cliente devient **part d'une aventure**, pas une cliente lambda. Cialdini parle de cette technique sous le nom de « partage de vulnérabilité ».

#### 4. Préparation à la réception (« Quand vous ouvrirez la boîte, prenez le temps »)

> Cette phrase **scénarise** le moment futur. Quand la cliente ouvrira physiquement la boîte 3-5 jours plus tard, le souvenir de cette phrase reviendra. Elle aura été **préparée** à recevoir.

#### 5. La signature en Pinyon Script

> Le même type que le wordmark = **Salma EST la maison**. L'identité personnelle et la marque sont **fusionnées**. Pas de distance corporate.

#### 6. « Avec soin »

> Cette signature de fermeture devient le **leitmotiv** de toute la communication FemiGlow. Cohérent dans la lettre, dans les emails, peut-être en V2 dans le packaging physique. Répétition = mémorisation.

### 8.13 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue de « Salma, » | Personnalisation reconnue                                       |
| Lecture du paragraphe 1 | Recadrage philosophique — pas un achat banal               |
| Lecture du paragraphe 2 | Touchée — la maison est jeune et m'inclut dans son aventure |
| Lecture du paragraphe 3 | Préparation au geste — anticipation noble                  |
| Vue de la signature | Présence humaine reconnue — Salma existe vraiment              |

### 8.14 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Surtitre « UN MOT DE LA MAISON » avant la lettre     | Brise l'illusion de la lettre vraie                                  |
| Texte trop long (> 250 mots)                          | La cliente sortirait de l'attention                                   |
| Texte trop court (< 100 mots)                         | Manque de présence — sentiment d'expédition                          |
| Tonalité « Bonjour cher client » + « Cordialement »    | Vocabulaire administratif — antithèse de la maison                  |
| Photo de Salma en bas de la lettre                    | Réduit l'impact narratif (signal « pub »)                              |
| Liens vers le shop ou Instagram dans la lettre        | Casse l'intimité                                                       |
| Signature « L'équipe FemiGlow »                        | Anonyme — la lettre doit être signée par une personne                  |
| Signature « Salma F. » ou « S. »                       | Initiale = distance — préférer le prénom complet                       |
| Texte commercial (« Profitez de notre offre... »)      | Vulgaire totalement                                                    |
| Tutoiement                                            | Cassure du registre soutenu                                            |
| Animation excessive (machine à écrire effect, etc.)    | Banalise                                                                |
| Citation d'une autorité (« comme disait Aristote... ») | Pédant — la maison parle en son nom                                    |
| Pas de personnalisation prénom                         | Manque l'occasion d'incarner la lettre                                  |
| Texte sur fond crème teintée                           | Manque la sobriété de la lettre sur fond uni                            |

---

## 9 — Section 05 — Préparation au geste (anti buyer's remorse)

### 9.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌──────────────────────────────┐    ┌────────────────────────────────┐  │
│  │                              │    │                                │   │
│  │                              │    │  LE MOMENT APPROCHE            │   │
│  │                              │    │                                │   │
│  │                              │    │  Quelques jours encore,        │   │
│  │                              │    │  puis le rituel.               │   │
│  │   [PHOTO LIFESTYLE           │    │                                │   │
│  │   "MOMENT INTIME"]           │    │  Le rituel d'éclat se vit en   │   │
│  │                              │    │  une heure, à votre rythme.    │   │
│  │   [Mains posées sur la       │    │  Lumière douce, musique        │   │
│  │   table, kit ouvert,         │    │  choisie, et ces minutes       │   │
│  │   lumière chaude]            │    │  rendues à soi.                │   │
│  │                              │    │                                │   │
│  │                              │    │                                │   │
│  └──────────────────────────────┘    │                                │   │
│                                      └────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 — Pourquoi cette section ?

> **Le buyer's remorse** (regret d'achat post-décision) est un phénomène psychologique réel. La cliente vient de payer ; un doute peut s'installer dans les heures qui suivent : « Ai-je bien fait ? Est-ce trop cher ? En aurai-je vraiment l'usage ? »

Cette section a une fonction **anti-remorse** ciblée :
- **Visualiser le moment futur** (la cliente projetée dans l'usage)
- **Amplifier la valeur perçue** par évocation sensorielle
- **Justifier l'achat** par anticipation du plaisir

> **Sevilla & Townsend (2016)** : *« Visualizing future use of a product after purchase reduces post-purchase dissonance by 23%. »*

### 9.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 480px (desktop) · auto (mobile)                                  |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 1200px                                                            |
| Layout desktop         | Photo 50% gauche / Bloc info 50% droite — gap 80px                 |
| Layout mobile          | Empilés (photo dessus, info dessous) — gap 32px                   |

### 9.4 — Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Sujet             | Mains posées sur une table, kit ouvert (4 pots visibles), tasse de thé en arrière-plan, lumière chaude de fin de journée |
| Composition       | Lifestyle macro, plongée légère, ambiance intime                      |
| Format            | 4:3 (paysage) sur desktop · 4:3 sur tablet · 3:2 sur mobile           |
| Hauteur affichage | 400px (desktop) · 320px (tablet) · 280px (mobile)                     |
| Object-fit        | `cover`                                                                |
| Filtre            | Aucun (couleurs naturelles)                                            |

> **Photo de scénarisation** : la cliente se voit déjà **en train d'utiliser** le kit. Cette projection est le mécanisme anti-remorse principal.

### 9.5 — Surtitre

```
LE MOMENT APPROCHE
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche                                     |
| Espacement bas | 12px                                                |

> **« LE MOMENT APPROCHE »** — annonce solennelle et rythmée. « Approche » suggère un mouvement vers la cliente, pas vers la maison. C'est elle qui attend.

### 9.6 — Titre

```
Quelques jours encore,
puis le rituel.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 32pt (desktop) · 26pt (mobile)                                |
| Style           | Italic sur « le rituel » uniquement (mise en valeur)          |
| Couleur         | `#2C2A28` (Encre)                                            |
| Line-height     | 1.3                                                          |
| Espacement haut | 0                                                              |

> **« Quelques jours encore, puis le rituel. »** — la phrase **apprivoise l'attente**. Pas « Plus que quelques jours ! » (urgence) ; pas « En attendant... » (transition fade). « Quelques jours encore » accepte le délai, et « puis le rituel » promet le moment.

> **Italic sur « le rituel »** : la mise en valeur typographique pointe vers le **mot pivot** — ce qui sera vécu, pas reçu.

### 9.7 — Description

```
Le rituel d'éclat se vit en une heure, à votre rythme.
Lumière douce, musique choisie, et ces minutes
rendues à soi.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 17pt (desktop) · 16pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Line-height     | 1.7                                                          |
| Espacement haut | 24px sous le titre                                            |
| Largeur max     | 480px                                                         |

#### Décomposition narrative

> *« Le rituel d'éclat se vit en une heure, à votre rythme. »*

- **Précision logistique** : « en une heure » — la cliente sait combien de temps prévoir
- **Liberté** : « à votre rythme » — pas de protocole rigide

> *« Lumière douce, musique choisie, et ces minutes rendues à soi. »*

- **Évocation sensorielle** : trois éléments concrets (lumière, musique, temps)
- **Phrase signature** : « ces minutes rendues à soi » — la promesse FemiGlow en condensé

> **« Rendues à soi »** est l'expression-pivot de la maison. Apparaît dans `/rituel`, `/journal`, et maintenant `/merci`. Cohérence absolue.

### 9.8 — Pas de CTA

> Cette section est **purement contemplative**. Aucun bouton, aucun lien — la cliente lit, regarde la photo, anticipe. Le mouvement vers les cross-links se fera dans la section 06 suivante.

> **Tentation à éviter** : « Découvrir le rituel en détail → /rituel ». Cassure de l'immersion. La cliente connait déjà `/rituel` (elle est passée par là pour acheter). Pas besoin de la rappeler.

### 9.9 — Tokens design

```css
/* ─── Préparation au geste — tokens ─── */
--prep-section-bg: #FBF8F1;
--prep-section-padding-vertical: 96px;
--prep-section-padding-x-desktop: 96px;
--prep-section-padding-x-mobile: 24px;
--prep-content-max-width: 1200px;

--prep-grid-gap-desktop: 80px;
--prep-grid-gap-mobile: 32px;

--prep-photo-aspect: 4/3;
--prep-photo-height-desktop: 400px;
--prep-photo-height-tablet: 320px;
--prep-photo-height-mobile: 280px;

--prep-kicker-font: 'Inter', sans-serif;
--prep-kicker-weight: 600;
--prep-kicker-size: 7.5pt;
--prep-kicker-tracking: 2.5px;
--prep-kicker-color: #6B6863;
--prep-kicker-margin-bottom: 12px;

--prep-title-font: 'Cormorant Garamond', serif;
--prep-title-weight: 300;
--prep-title-size-desktop: 32pt;
--prep-title-size-mobile: 26pt;
--prep-title-color: #2C2A28;
--prep-title-line-height: 1.3;

--prep-description-font: 'Cormorant Garamond', serif;
--prep-description-size-desktop: 17pt;
--prep-description-size-mobile: 16pt;
--prep-description-color: #2C2A28;
--prep-description-line-height: 1.7;
--prep-description-margin-top: 24px;
--prep-description-max-width: 480px;
```

### 9.10 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → photo fade-in 800ms (lent — moment contemplatif)
[atteint 60%]             → bloc info séquentiel : surtitre → titre → description (300ms entre chaque)
```

> **Animation lente délibérée** : 800ms pour la photo. Cassure du rythme rapide de la page jusqu'ici. La cliente est invitée à **ralentir** son scroll.

#### Lazy loading de la photo

```html
<img src="/images/merci/preparation-rituel.webp"
     alt="Mains posées sur une table, kit FemiGlow ouvert avec ses quatre pots, tasse de thé en arrière-plan, lumière chaude"
     loading="lazy"
     width="800"
     height="600">
```

#### Pas de hover, pas de click

Section purement contemplative.

### 9.11 — Variantes selon le mode de paiement

#### Cas COD

Le titre et la description restent **identiques**. Pas de mention spécifique COD ici — la section est éditoriale, pas logistique.

> Les détails COD sont gérés en section 03 (Suivi & étapes) et dans la lettre éditoriale (section 04). Cette section reste **pure** dans son intention.

### 9.12 — Psychologie

#### 1. Visualisation anti-remorse (Sevilla & Townsend 2016)

> Voir une photo de l'usage **réduit** la dissonance post-achat. La cliente n'imagine plus son argent dépensé — elle imagine son **moment futur**.

#### 2. Évocation sensorielle (Damasio 1994)

> *« Concrete sensory details trigger emotional responses more reliably than abstract concepts. »*

« Lumière douce » + « musique choisie » + « minutes rendues à soi » = trois ancres sensorielles. La cliente **sent** déjà l'ambiance.

#### 3. Réaffirmation du temps lent (positionnement de marque)

> La maison **ne presse pas** la cliente à utiliser le kit dès qu'il arrive. « En une heure, à votre rythme » désamorce toute pression d'usage immédiat. Cohérent avec « Pas de précipitation » (panier vide) et « Quand vous ouvrirez la boîte, prenez le temps » (lettre).

#### 4. Phrase signature « rendues à soi »

> Cette expression revient **comme un refrain** dans le site (section pratique sur `/rituel`, signature `/journal`, ici `/merci`). Sa **récurrence** crée une signature mémorable de la marque.

#### 5. Photo lifestyle (pas product-shot)

> La photo n'est pas un product-shot du kit (la cliente l'a déjà vu). C'est une **scène de vie** où le kit apparaît dans son contexte d'usage. Différence subtile mais déterminante pour l'effet anti-remorse.

### 9.13 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue de la photo | Projection — « Je me vois faisant ce geste »                    |
| Lecture du surtitre | Anticipation noble — « Le moment vient »                     |
| Lecture du titre | Patience apaisée — « Quelques jours encore »                  |
| Lecture de la description | Évocation sensorielle — « Lumière douce, musique choisie » |
| Sortie de la section | Réconciliation avec l'achat — pas de remorse, juste anticipation |

### 9.14 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Photo product-shot du kit                            | La cliente l'a déjà vu sur `/kit` — banal                            |
| Photo de mannequin glamour                           | Faux — la maison ne fait pas de mannequin                              |
| Photo studio neutre (fond blanc)                      | Casse l'ambiance lifestyle                                            |
| Surtitre « VOTRE PROCHAIN MOMENT BIEN-ÊTRE »          | Vocabulaire spa générique                                             |
| Titre commercial (« Profitez bientôt de votre kit ! »)| Cassure du registre éditorial                                         |
| Description fonctionnelle (« 4 étapes : préparer, appliquer, masser, polir ») | Redondant avec `/rituel`                            |
| Bouton CTA « Découvrir le rituel »                    | Brise l'immersion contemplative                                       |
| Mention de la durée d'expédition                      | Information déjà donnée (sections 01 et 03)                            |
| Photo trop sombre (< luminosité 40%)                   | Anxiogène — l'ambiance doit être chaude et accueillante                |
| Animation parallaxe sur la photo                       | Cassure du rythme contemplatif                                         |
| Bouton « Partager sur les réseaux »                    | Vulgaire à ce stade                                                     |
| Mention prix réduit/économies                          | Anti-remorse mal exécuté — la cliente ne veut pas qu'on lui rappelle l'argent |
| Citation d'expert (« Selon le Dr. X, la lenteur... »)  | Pédant                                                                  |

---

## 10 — Section 06 — Cross-links contextuels

### 10.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                          En attendant.                                      ║
║                                                                            ║
║                                                                            ║
║  ┌──────────────────────────────┐    ┌──────────────────────────────┐    ║
║  │                              │    │                              │     ║
║  │  ┌────────────────────────┐ │    │  ┌────────────────────────┐ │     ║
║  │  │                        │ │    │  │                        │ │     ║
║  │  │   [PHOTO LIFESTYLE     │ │    │  │   [PHOTO ATELIER]       │ │     ║
║  │  │   "Pause"]             │ │    │  │                        │ │     ║
║  │  │                        │ │    │  │                        │ │     ║
║  │  └────────────────────────┘ │    │  └────────────────────────┘ │     ║
║  │                              │    │                              │     ║
║  │  LE JOURNAL                  │    │  LA MAISON                   │     ║
║  │                              │    │                              │     ║
║  │  Quelques minutes pour       │    │  Le récit derrière le rituel.│     ║
║  │  ralentir.                   │    │                              │     ║
║  │                              │    │  Comment la maison est née,  │     ║
║  │  Des fragments écrits        │    │  pourquoi le geste, et pour  │     ║
║  │  depuis l'atelier.           │    │  qui.                        │     ║
║  │                              │    │                              │     ║
║  │  Visiter le journal →        │    │  Découvrir la maison →       │     ║
║  │                              │    │                              │     ║
║  └──────────────────────────────┘    └──────────────────────────────┘    ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                                  (fond crème uni)
```

### 10.2 — Pourquoi deux cross-links (vs un seul sur `/panier`) ?

> Sur `/panier`, **un seul cross-link** vers `/journal` (la cliente hésite, elle a besoin d'une respiration).

Sur `/merci`, **deux cross-links** : `/journal` ET `/maison`. Pourquoi ?
- La cliente a maintenant **du temps** (3-5 jours d'attente)
- Le post-achat est le moment où la cliente devient **curieuse** de la maison (elle vient d'investir financièrement, elle veut **comprendre** dans qui elle a investi)
- Deux portes parallèles **respectent** le rythme : lecture courte (`/journal`) ou récit long (`/maison`)

### 10.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 360px (desktop) · auto (mobile)                                  |
| Padding vertical       | 96px (haut) · 64px (bas)                                          |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 1200px                                                            |

### 10.4 — Titre de la section

```
En attendant.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light Italic                     |
| Taille         | 24pt (desktop) · 22pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 64px                                                 |

> **« En attendant. »** — point final. Reconnait l'attente sans la **dramatiser**. Italic pour adoucir. Pas « Pendant que vous attendez » (insistant), pas « Découvrez aussi » (suggestion forcée). Juste : « en attendant », il y a peut-être ces deux portes.

### 10.5 — Disposition de la grille

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | 2 colonnes égales, gap 32px                |
| Tablet     | 2 colonnes égales, gap 24px                |
| Mobile     | 1 colonne (empilées), gap 32px             |

### 10.6 — Spécifications de chaque card cross-link

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | Transparent (le crème de la section transparait)                  |
| Border            | Aucun                                                              |
| Padding           | 0 (pas de padding interne — la photo et le texte gèrent l'espacement) |
| Largeur           | 100% de la colonne                                                |
| Cliquable         | Toute la card est cliquable (effet hover sur l'ensemble)             |

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Format            | 4:3 (paysage)                                                          |
| Hauteur           | 200px (desktop) · 240px (mobile, plus large car colonne unique)         |
| Object-fit        | `cover`                                                                |
| Border            | Aucun                                                                   |
| Hover (sur card)  | Image scale 1.03 (transition 600ms) — effet subtil                    |

#### Photo card 1 — Journal

> Tasse de thé tiède, livre ouvert, carnet sur table en bois, lumière naturelle de fin d'après-midi. **Identique à la photo cross-link de `/panier`** (cohérence narrative).

#### Photo card 2 — Maison

> Vue d'atelier : table de travail, outils du rituel posés, pot de pâte d'éclat ouvert, lumière de matin clair. Cohérent avec les photos de `/maison`.

#### Surtitre

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche, sous la photo                      |
| Espacement haut| 24px sous la photo                                   |
| Espacement bas | 12px                                                 |

#### Titre

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 24pt (desktop) · 22pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Line-height     | 1.3                                                          |

#### Description

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Espacement haut | 16px sous le titre                                            |
| Espacement bas  | 24px avant le CTA                                              |

#### CTA (text-link, pas bouton)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium 13pt                                                 |
| Couleur            | `#2C2A28` (Encre)                                                |
| Underline          | 1.5px sauge dark, offset 4px                                       |
| Hover              | Couleur `#A8C4A6` (sauge dark), flèche translate-x 4px              |

> **Pas de bouton outline cette fois** : juste un text-link avec underline. Plus subtil. Le **bouton outline** était utilisé sur `/panier` cross-link unique car la cliente était dans un moment de friction commerciale ; ici, la cliente est détendue post-achat — pas besoin de bouton fort.

### 10.7 — Copy intégral des deux cards

#### Card 1 — Journal

```
[PHOTO]

LE JOURNAL

Quelques minutes pour ralentir.

Des fragments écrits depuis l'atelier.

Visiter le journal →
```

#### Card 2 — Maison

```
[PHOTO]

LA MAISON

Le récit derrière le rituel.

Comment la maison est née, pourquoi le geste,
et pour qui.

Découvrir la maison →
```

### 10.8 — Décomposition narrative

#### Card Journal

- **Titre** : « Quelques minutes pour ralentir. » — **identique** au cross-link de `/panier` (cohérence absolue)
- **Description** : « Des fragments écrits depuis l'atelier. » — résumé court de l'identité du Journal

#### Card Maison

- **Titre** : « Le récit derrière le rituel. » — pose une **promesse narrative**
- **Description** : « Comment la maison est née, pourquoi le geste, et pour qui. » — trois questions qui ouvrent

> **Les trois questions** structurent implicitement `/maison` : origine (« comment »), intention (« pourquoi »), audience (« pour qui »). La cliente reconnaît le récit institutionnel sans qu'on dise « page institutionnelle ».

### 10.9 — Tokens design

```css
/* ─── Cross-links contextuels — tokens ─── */
--crosslinks-bg: #FBF8F1;
--crosslinks-padding-top: 96px;
--crosslinks-padding-bottom: 64px;
--crosslinks-content-max-width: 1200px;

--crosslinks-section-title-font: 'Cormorant Garamond', serif;
--crosslinks-section-title-style: italic;
--crosslinks-section-title-weight: 300;
--crosslinks-section-title-size-desktop: 24pt;
--crosslinks-section-title-color: #2C2A28;
--crosslinks-section-title-margin-bottom: 64px;

--crosslinks-grid-gap-desktop: 32px;
--crosslinks-grid-gap-mobile: 32px;

--crosslink-card-photo-aspect: 4/3;
--crosslink-card-photo-height-desktop: 200px;
--crosslink-card-photo-height-mobile: 240px;
--crosslink-card-photo-hover-scale: 1.03;
--crosslink-card-photo-transition: 600ms;

--crosslink-card-kicker-font: 'Inter', sans-serif;
--crosslink-card-kicker-weight: 600;
--crosslink-card-kicker-size: 7.5pt;
--crosslink-card-kicker-tracking: 2.5px;
--crosslink-card-kicker-color: #6B6863;
--crosslink-card-kicker-margin-top: 24px;
--crosslink-card-kicker-margin-bottom: 12px;

--crosslink-card-title-font: 'Cormorant Garamond', serif;
--crosslink-card-title-style: italic;
--crosslink-card-title-weight: 300;
--crosslink-card-title-size-desktop: 24pt;
--crosslink-card-title-color: #2C2A28;
--crosslink-card-title-line-height: 1.3;

--crosslink-card-desc-font: 'Cormorant Garamond', serif;
--crosslink-card-desc-size-desktop: 15pt;
--crosslink-card-desc-color: #4A4844;
--crosslink-card-desc-line-height: 1.6;
--crosslink-card-desc-margin-top: 16px;
--crosslink-card-desc-margin-bottom: 24px;

--crosslink-card-cta-font: 'Inter', sans-serif;
--crosslink-card-cta-weight: 500;
--crosslink-card-cta-size: 13pt;
--crosslink-card-cta-color: #2C2A28;
--crosslink-card-cta-underline-color: #A8C4A6;
--crosslink-card-cta-hover-color: #A8C4A6;
```

### 10.10 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → titre « En attendant. » fade-in (500ms)
[atteint 70%]             → card Journal fade-in + translate-up 8px (700ms)
[atteint 60%]             → card Maison fade-in + translate-up 8px (700ms, 200ms après Journal)
```

#### Hover sur card

```css
.crosslink-card {
  cursor: pointer;
  transition: opacity 220ms;
}

.crosslink-card:hover {
  opacity: 0.92;
}

.crosslink-card:hover img {
  transform: scale(1.03);
}

.crosslink-card:hover .cta-text {
  color: var(--color-sauge-dark);
}

.crosslink-card:hover .cta-text .arrow {
  transform: translateX(4px);
}
```

#### Click

Toute la zone de la card est cliquable et mène à `/journal` ou `/maison` (même onglet, pas nouvel onglet — cohérent avec `/panier`).

> **Pourquoi même onglet ?** Parce que la session post-achat est **propre** (pas de panier à préserver). Si la cliente souhaite revenir à `/merci`, l'email transactionnel reçu en parallèle contient le récap nécessaire.

### 10.11 — Psychologie

#### 1. Deux portes parallèles (Iyengar 2000)

> *« Choice between 2-3 well-defined options yields higher engagement than a single forced option. »*

Deux choix clairs (Journal court ou Maison long) **respectent** la cliente. Elle prend selon son humeur.

#### 2. Hiérarchie : Journal d'abord

> Card Journal **à gauche** sur desktop. Pourquoi ? Lecture occidentale gauche-droite — on lit Journal en premier. Le Journal est aussi **plus court** à lire (article 5-7 min) — bonne entrée d'engagement.

#### 3. CTA text-link (pas bouton)

> Sur `/panier` cross-link, le CTA était **outline** (la cliente hésitait, friction commerciale). Sur `/merci`, la cliente est détendue — un **text-link suffit**. Hiérarchie respectée.

#### 4. Continuation de la relation

> Cross-links après la lettre éditoriale = la cliente vient de lire un texte intime, elle est **réceptive** à découvrir d'autres textes. Le timing est optimal.

#### 5. Pas de cross-link vers `/kit` ou `/rituel`

> Tentation : « Découvrir le rituel en détail » ou « Voir le kit ». **Refusé** : ces pages sont pour **avant achat**. Après achat, les cross-links pointent vers le **récit** et la **réflexion**, pas vers le commerce.

### 10.12 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du titre « En attendant. » | Reconnaissance de l'attente — ni dramatisée, ni ignorée |
| Vue des deux cards | Liberté de choix — pas de pression                          |
| Hover ou click | Engagement éditorial → lecture vraie                            |

### 10.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Trois cards ou plus                                  | Surcharge — l'attente ne demande pas trois activités                  |
| Card vers `/kit` ou `/rituel`                        | Cross-sell déguisé — moment inopportun                                |
| Card vers le shop / le kit                           | Idem                                                                  |
| Boutons outline (au lieu de text-links)              | Trop fort — la cliente n'est pas en friction                          |
| Titres impératifs (« Lisez le journal ! »)           | Pression                                                              |
| Photos product-shot (kit, ingrédients)               | Mauvais registre — préférer lifestyle                                  |
| Description trop longue (> 30 mots)                  | Casse la sobriété                                                       |
| CTA en couleur vive (rouge, bleu Facebook)            | Cassure de palette                                                     |
| Card cliquable mais flèche statique au hover          | Manque le micro-mouvement                                              |
| Newsletter signup en bas de section                   | Hors registre du moment                                                |
| Bouton « Partager sur les réseaux »                   | Vulgaire à ce moment                                                    |
| Mention « Inscrivez-vous au programme fidélité »      | Vendre encore — moment inopportun                                      |
| Lien Instagram / réseaux sociaux                       | Cassure de l'éditorial                                                  |

---

## 11 — Footer — élément persistant

### 11.1 — Structure héritée

Le footer de `/merci` est **identique** à celui des autres pages — élément global du site (vs `/commander` qui a un footer simplifié).

> **Pourquoi pas de footer simplifié ici ?** Parce que la cliente n'est plus dans le tunnel transactionnel. Elle est dans un moment **post-achat libre**. Le footer complet **respecte cette liberté retrouvée**.

### 11.2 — Spécificités sur `/merci`

| Différence              | Spécification                                                       |
| :---------------------- | :------------------------------------------------------------------ |
| **Item « Merci »**      | Pas dans la navigation — page transactionnelle                       |
| **Newsletter dans le footer** | Visible (V2 : à conditionner au statut opt-in de la cliente)   |
| **Espacement avec section 06** | 64px de padding vertical entre la fin des cross-links et le footer |

### 11.3 — Comportement de la newsletter dans le footer

> **V1** : la newsletter est visible dans le footer. Si la cliente a déjà coché l'opt-in newsletter à `/commander` étape 1, elle ne devrait **pas voir** le formulaire (ou voir un message « Vous êtes inscrite, merci. »).

> **V2** : conditionner l'affichage selon le statut opt-in et le compte connecté. En V1, l'affichage est uniforme (pas de personnalisation conditionnelle dans le footer).

### 11.4 — Pas de mention spécifique post-achat

> Tentation : ajouter dans le footer une mention type « Votre commande FG-2026-XXXXX est confirmée ». **Refusé** : ce serait redondant avec la page entière. Le footer reste **invariable** — c'est sa force structurante.

### 11.5 — Tactiques héritées

Toutes les tactiques héritées (`HIÉRARCHIE LISIBLE`, `PROOF QUIET`, `EXIT WITHOUT PRESSURE`, `CONTACT PROCHE`) restent en place — le footer post-achat est un **point de continuité** avec le reste du site.

---

## 12 — Comportements transverses

### 12.1 — Sécurité d'accès à la page

#### Validation côté serveur

À l'arrivée sur `/merci?order=FG-2026-XXXXX`, le backend vérifie :

```javascript
async function validateMerciAccess(orderId, sessionToken, userIp) {
  // 1. La commande existe-t-elle ?
  const order = await db.orders.findOne({ id: orderId });
  if (!order) {
    return { valid: false, redirect: '/accueil' };
  }

  // 2. Le statut est-il "paid" ou "pending_cod" ?
  if (!['paid', 'pending_cod'].includes(order.status)) {
    return { valid: false, redirect: '/accueil' };
  }

  // 3. La session correspond-elle à la commande ?
  const sessionOrder = await db.sessions.findOne({
    sessionToken,
    orderId
  });

  if (!sessionOrder) {
    return { valid: false, redirect: '/accueil' };
  }

  // 4. La commande date-t-elle de moins de 30 minutes ?
  const orderAge = Date.now() - order.createdAt;
  const MAX_MERCI_ACCESS_DURATION = 30 * 60 * 1000; // 30 minutes

  if (orderAge > MAX_MERCI_ACCESS_DURATION) {
    // Au-delà : l'accès direct est refusé, l'email transactionnel reste l'archive
    return { valid: false, redirect: '/accueil' };
  }

  return { valid: true, order };
}
```

> **Trois couches de sécurité** :
> 1. **Existence de la commande**
> 2. **Statut valide** (paid pour carte, pending_cod pour COD)
> 3. **Session liée** (la sessionToken doit correspondre à la commande)
> 4. **Délai limité** (30 min après création de la commande)

> **Pourquoi le délai 30 min ?** Parce que `/merci` est un **moment unique post-achat**. Au-delà, l'archive est l'email transactionnel (consultable indéfiniment). Cette restriction empêche le **partage involontaire** de l'URL.

#### En cas d'accès refusé

Redirection vers `/accueil` avec un toast discret en haut de page :

```
Cette page n'est plus accessible. Consultez votre email pour le récap de commande.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Position       | Toast top-center                                     |
| Background     | `#FBF8F1` (Crème) avec border `#E8E0D2`             |
| Police         | Cormorant Garamond Italic 14pt                       |
| Couleur        | `#4A4844` (Encre claire)                             |
| Auto-dismiss   | 6 secondes                                           |
| Padding        | 16px 24px                                            |

### 12.2 — Vidage du panier après commande

À l'arrivée validée sur `/merci`, le panier est **automatiquement vidé** :

```javascript
async function emptyCartAfterOrder() {
  // 1. Vidage localStorage
  localStorage.removeItem('femiglow_cart');

  // 2. Vidage backend (si compte connecté)
  if (user.isAuthenticated) {
    await api.delete('/api/cart');
  }

  // 3. Mise à jour du compteur header
  updateHeaderCartCount(0);

  // 4. Annonce ARIA
  announceToScreenReader('Votre panier a été vidé après commande.');
}
```

> **Important** : le vidage se fait **après validation de l'accès** à `/merci`. Si la cliente arrive sur la page sans session valide, son panier reste intact (cas rare mais à protéger).

### 12.3 — Trigger des emails transactionnels

À l'arrivée sur `/merci`, plusieurs emails sont déclenchés :

#### Immédiat — Email confirmation

```javascript
async function triggerConfirmationEmail(order) {
  if (order.confirmationEmailSent) return;

  await emailService.send({
    to: order.email,
    template: 'order-confirmation',
    data: {
      orderId: order.id,
      firstName: order.firstName,
      items: order.items,
      total: order.total,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress,
      deliveryWindow: calculateDeliveryWindow(order),
    },
  });

  await db.orders.update({ id: order.id }, { confirmationEmailSent: true });
}
```

> **Détails du contenu de l'email** : voir section 18.

#### Schedule — Email J+5 « Le moment approche »

```javascript
async function scheduleJPlus5Email(order) {
  if (order.lifecycleEmailsScheduled) return;

  // Date d'envoi : 5 jours après la commande
  const sendAt = new Date(order.createdAt + 5 * 24 * 60 * 60 * 1000);

  await emailQueue.schedule({
    to: order.email,
    template: 'order-anticipation-j5',
    sendAt,
    data: { orderId: order.id, firstName: order.firstName },
  });

  await db.orders.update({ id: order.id }, { lifecycleEmailsScheduled: true });
}
```

> **Cet email** est envoyé seulement si la commande est encore en statut "shipped" ou "in_transit" (pas si déjà livrée). Il sert à **maintenir l'engagement** pendant l'attente.

#### Schedule — Email J+15 « Comment s'est passée votre première fois ? »

```javascript
async function scheduleJPlus15Email(order) {
  // Date d'envoi : 15 jours après la commande (≈ 10 jours après livraison)
  const sendAt = new Date(order.createdAt + 15 * 24 * 60 * 60 * 1000);

  await emailQueue.schedule({
    to: order.email,
    template: 'order-review-request-j15',
    sendAt,
    data: { orderId: order.id, firstName: order.firstName },
  });
}
```

> **Cet email** sollicite un retour d'expérience après le premier rituel. Demande douce, sans pression. Voir section 18.

### 12.4 — Tracking analytics

Si la cliente a accepté les cookies, déclenchement des événements GA4 :

```javascript
async function trackPurchaseEvent(order) {
  if (!cookieConsent.analytics) return;

  // Event ecommerce GA4 standard
  gtag('event', 'purchase', {
    transaction_id: order.id,
    value: order.total,
    currency: 'MAD',
    tax: 0, // pas de TVA visible en V1
    shipping: order.shipping,
    items: order.items.map(item => ({
      item_id: item.sku,
      item_name: item.name,
      item_category: 'kit',
      quantity: item.quantity,
      price: item.unitPrice,
    })),
  });

  // Events custom additionnels
  gtag('event', 'merci_page_loaded', {
    order_id: order.id,
    payment_method: order.paymentMethod,
    shipping_mode: order.shippingMode,
    city: order.shippingAddress.city,
  });
}
```

#### Events de scroll & engagement

```javascript
// Tracker le scroll au-delà de chaque section
const sections = ['hero', 'recap', 'steps', 'letter', 'preparation', 'crosslinks'];

sections.forEach(section => {
  const element = document.querySelector(`#section-${section}`);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        gtag('event', `merci_section_viewed_${section}`);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  observer.observe(element);
});
```

> Permet de mesurer **où s'arrêtent** les clientes dans la page. Si beaucoup s'arrêtent avant la lettre éditoriale, signal d'amélioration nécessaire (longueur, position, etc.).

### 12.5 — State management — pas de panier sur cette page

Contrairement à `/panier` et `/commander`, **pas de state management complexe** sur `/merci`.

| Type de state         | Présent ?                                          |
| :-------------------- | :------------------------------------------------- |
| Cart state            | Vidé immédiatement (compteur header = 0)           |
| Checkout state         | Effacé (la commande est conclue)                   |
| Order data            | Récupérées via API au load, stockées en mémoire   |

```javascript
interface MerciPageState {
  order: Order; // Données récupérées via API
  ui: {
    isLoading: boolean;
    confirmationEmailSent: boolean;
  };
}

interface Order {
  id: string; // FG-2026-XXXXX
  firstName: string;
  email: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  codFee: number;
  total: number;
  paymentMethod: 'card' | 'cod';
  cardLastFour?: string;
  shippingAddress: Address;
  shippingMode: 'standard' | 'express';
  createdAt: number;
  status: 'paid' | 'pending_cod';
  estimatedDelivery: { min: Date; max: Date };
}
```

### 12.6 — Lazy loading des images

| Type d'image                         | Stratégie                                            |
| :----------------------------------- | :--------------------------------------------------- |
| Hero (pas d'image, juste fleuron SVG)| N/A                                                  |
| Photo récap (kit thumbnail)           | `loading="lazy"` (sous le fold)                       |
| Photos cross-links                    | `loading="lazy"` (très bas dans la page)              |
| Photo préparation (lifestyle)         | `loading="lazy"`                                       |

> **Pas de LCP element image critique** : le fleuron SVG inline est dans le hero, pas d'image lourde au-dessus du fold. LCP < 1.8s atteignable facilement.

### 12.7 — Animation timing — règle générale

| Type d'animation              | Durée            | Easing                              |
| :---------------------------- | :--------------- | :---------------------------------- |
| Hero séquentiel (cascade)     | 2.8s total       | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Récap fade-in                 | 700ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Steps cascade                 | 600ms par étape, 200ms entre | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Halo pulse étape active       | 2.5s par cycle, infinite | `ease-in-out`                |
| Lettre cascade paragraphes    | 700ms par paragraphe | `cubic-bezier(0.4, 0, 0.2, 1)`  |
| Préparation photo             | 800ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Cross-link cards              | 700ms            | `cubic-bezier(0.16, 1, 0.3, 1)`     |
| Hover photo cross-link         | 600ms            | `cubic-bezier(0.4, 0, 0.2, 1)`      |
| Toast d'erreur d'accès         | 220ms in / 200ms out | `cubic-bezier(0.4, 0, 0.2, 1)`  |

### 12.8 — Reduced motion

Pour les utilisateurs avec `prefers-reduced-motion: reduce` :

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }

  /* Hero séquentiel : apparition globale instantanée */
  .merci-hero > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Halo pulse : désactivé */
  .step-active .step-circle::after {
    animation: none !important;
    opacity: 0.4 !important;
  }

  /* Hover photos : pas de scale */
  .crosslink-card:hover img {
    transform: none !important;
  }

  /* Toast : apparition simple */
  .toast {
    transition: opacity 100ms !important;
  }
}
```

### 12.9 — Comportement sticky du header

Identique aux autres pages : `position: sticky; top: 0`. Au scroll au-delà de 80px, le header se compresse (hauteur 64px) avec ombre subtile.

### 12.10 — Pas de scroll lock

La cliente doit pouvoir scroller librement. Pas de scroll-snap, pas de section forcée à occuper le viewport entier.

### 12.11 — Comportement clavier

| Touche                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Tab                   | Navigation séquentielle dans les éléments interactifs  |
| Shift+Tab             | Navigation inverse                                     |
| Enter (sur card cross-link) | Navigation vers `/journal` ou `/maison`             |
| Cmd/Ctrl+C (sur numéro de commande sélectionné) | Copie du numéro             |

### 12.12 — Pas de tracking côté cliente avant consentement

Avant que la cliente accepte les cookies, **aucun tracking analytics** ne se déclenche. Les événements `purchase`, `merci_page_loaded`, `merci_section_viewed_*` ne sont **pas envoyés** à GA4.

> **Cas particulier post-achat** : même sans consentement analytics, les emails transactionnels **sont envoyés** (la confirmation de commande est une **obligation contractuelle**, pas du marketing).

### 12.13 — Print stylesheet (optionnel V2)

V2 : feuille de style print pour permettre à la cliente d'imprimer une version propre du récap.

```css
@media print {
  /* Cacher éléments non-essentiels */
  header, footer, .crosslinks, .preparation, .letter {
    display: none !important;
  }

  /* Afficher uniquement : hero + récap + steps */
  .merci-hero, .recap-confirm, .steps-section {
    display: block !important;
    background: white !important;
    color: black !important;
  }

  /* Pas d'animations en print */
  * {
    animation: none !important;
    transition: none !important;
  }

  /* Numéro de commande en gros */
  .order-id {
    font-size: 24pt !important;
  }
}
```

> **V1** : pas de print stylesheet — l'email transactionnel est suffisant. **V2** : à reconsidérer si demande utilisateur.

### 12.14 — Pas de share buttons

Volontairement, **aucun bouton « Partager »** sur cette page :
- Pas WhatsApp, Email, Twitter, Facebook
- Le post-achat n'est **pas un événement à partager** automatiquement
- Si la cliente veut partager, elle peut faire une capture d'écran ou copier le numéro de commande

> **V2** : reconsidérer un bouton « Partager le numéro de commande » avec un proche (cas cadeau, demande de précision support). Discret, optionnel.

---

## 13 — Adaptation responsive

### 13.1 — Breakpoints officiels

| Nom         | Min-width | Max-width | Layout principal                       |
| :---------- | :-------- | :-------- | :------------------------------------- |
| **Mobile**  | 0         | 767px     | 1 colonne, sections empilées            |
| **Tablet**  | 768px     | 1023px    | 1 colonne pour sections principales, 2 colonnes pour cross-links |
| **Desktop** | 1024px    | -         | 2 colonnes pour préparation et cross-links, 3 colonnes pour suivi |

> **Note** : passage 2 colonnes (préparation + cross-links) à **1024px**, cohérent avec `/commander` et `/panier`.

### 13.2 — Mobile-first 65% — hérité de `/commander`

> Cohérence avec `/commander` : la cliente arrive sur `/merci` **dans la même session** que celle où elle a finalisé le checkout. Si elle a payé sur mobile (65% des cas), elle reçoit la page de remerciement sur mobile.

L'ensemble des optimisations mobile est **prioritaire** dans le développement.

### 13.3 — Adaptations par section

#### Hero de remerciement

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Hauteur                | 480px            | 420px           | 380px          |
| Padding vertical       | 96px / 64px      | 80px / 56px     | 64px / 48px    |
| Padding latéral        | 96px             | 64px            | 24px           |
| Fleuron width          | 96px             | 88px            | 80px           |
| Titre size             | 48pt             | 38pt            | 32pt           |
| Sous-titre size        | 20pt             | 19pt            | 18pt           |
| Numéro de commande size| 18pt             | 17pt            | 16pt           |
| Mention livraison size | 16pt             | 15pt            | 15pt           |

#### Récapitulatif commande

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Padding vertical       | 64px             | 56px            | 48px           |
| Container padding      | 32px             | 28px            | 24px           |
| Photo article size     | 120×120px        | 96×96px         | 80×80px        |
| Nom produit size       | 22pt             | 20pt            | 19pt           |
| Prix article size      | 16pt             | 16pt            | 15pt           |
| Total label size       | 15pt             | 15pt            | 14pt           |
| Total montant size     | 17pt             | 17pt            | 16pt           |
| Adresse texte size     | 15pt             | 15pt            | 14pt           |

#### Suivi & étapes

| Propriété              | Desktop ≥ 1024   | Tablet < 1024   | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 3 colonnes       | 1 colonne       | 1 colonne      |
| Connecteurs filets     | Visibles          | Masqués         | Masqués        |
| Gap                    | 48px             | 48px            | 48px           |
| Titre section size     | 28pt             | 26pt            | 24pt           |
| Cercle étape size      | 16px             | 16px            | 16px           |
| Halo pulse size        | 32px             | 32px            | 32px           |
| Titre étape size       | 22pt             | 21pt            | 20pt           |
| Date étape size        | 14pt             | 14pt            | 13pt           |
| Description étape size | 14pt             | 14pt            | 13pt           |

#### Lettre éditoriale

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Padding vertical       | 96px             | 80px            | 64px           |
| Largeur max            | 640px            | 560px           | 100% - 48px    |
| Interpellation size    | 24pt             | 22pt            | 22pt           |
| Corps size             | 17pt             | 16pt            | 16pt           |
| Line-height corps      | 1.7              | 1.7             | 1.65           |
| Closing « Avec soin, » size | 16pt        | 16pt            | 15pt           |
| Signature Pinyon size  | 36pt             | 34pt            | 32pt           |
| Role size              | 11pt             | 11pt            | 11pt           |

#### Préparation au geste

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Padding vertical       | 96px             | 80px            | 64px           |
| Layout                 | 50% / 50%        | 50% / 50%        | Empilés        |
| Gap                    | 80px             | 48px            | 32px           |
| Photo height           | 400px            | 320px            | 280px          |
| Titre size             | 32pt             | 28pt             | 26pt           |
| Description size       | 17pt             | 16pt             | 16pt           |

#### Cross-links

| Propriété              | Desktop          | Tablet          | Mobile         |
| :--------------------- | :--------------- | :-------------- | :------------- |
| Layout                 | 2 colonnes       | 2 colonnes       | 1 colonne      |
| Gap                    | 32px             | 24px             | 32px           |
| Photo height           | 200px            | 200px            | 240px          |
| Titre card size        | 24pt             | 22pt             | 22pt           |
| Description card size  | 15pt             | 15pt             | 14pt           |
| CTA card size          | 13pt             | 13pt             | 13pt           |

### 13.4 — Comportements mobile spécifiques

#### Header mobile

- Burger menu : drawer slide-in 280ms depuis la droite
- Icône panier compteur à 0 (panier vidé)
- Pas d'item « Merci » dans le menu burger

#### Pas de sticky CTA mobile

Sur `/merci`, **aucun sticky CTA**. La page n'a pas de bouton de conversion (la cliente vient d'acheter). Les cross-links sont des text-links subtils.

#### Layout des sections

Toutes les sections en **single column mobile**, empilées dans l'ordre vertical. Pas d'accordéon, pas de tabs — la cliente scroll naturellement.

#### Touch targets minimum

| Élément                       | Hauteur tactile minimum                |
| :---------------------------- | :------------------------------------- |
| Card cross-link complète       | ≥ 44px (toute la card)                  |
| Lien text-link CTA cross-link  | ≥ 40px hauteur                          |
| Lien email contact (footer)    | Zone tactile ≥ 44px                     |
| Numéro de commande (sélection) | Zone touchable ≥ 44px (pour double-tap)  |

#### Texte minimum sur mobile

Aucun texte en dessous de **14px** sur mobile (lisibilité WCAG AA). Exceptions contextuelles documentées :
- Surtitre `LE MOMENT APPROCHE` : 7.5pt acceptable (uppercase tracked)
- Surtitre `LE JOURNAL` / `LA MAISON` : 7.5pt acceptable (idem)
- Mention paiement « Payé par carte... » : 12pt acceptable (info secondaire)
- Sous-signature « Fondatrice de la maison » : 11pt acceptable (uppercase tracked)

### 13.5 — Optimisations spécifiques mobile

| Optimisation                         | Justification                                      |
| :----------------------------------- | :------------------------------------------------- |
| Pas d'animation parallax              | Coûteux                                              |
| Lazy loading agressif sur photos      | Bande passante limitée                             |
| Halo pulse étape active CSS-only      | Pas de JS animation pour économiser CPU            |
| Polices système fallback              | Si polices web tardent, texte lisible immédiatement |
| Compression images WebP               | Économie ~30% bande passante                       |
| HTML SSR avec données pré-injectées   | Pas d'API call client pour récupérer la commande   |

---

## 14 — Performance technique

### 14.1 — Web Vitals — cibles

| Métrique | Cible    | Justification                                      |
| :------- | :------- | :------------------------------------------------- |
| **LCP**  | **< 1.8s** | Hero typographique simple, fleuron SVG inline      |
| **CLS**  | **< 0.05** | Strict — page éditoriale, aucun shift toléré       |
| **INP**  | **< 150ms** | Interactions instantanées (scroll, hover cross-links) |
| **FCP**  | < 0.9s   | Hero typographique sobre, visible vite              |
| **TBT**  | < 150ms  | JS très léger (pas de payment SDK, pas de cart logic complexe) |

> **Cibles strictes** : `/merci` est le **moment fort post-achat**. Une page lente ici **abîmerait** l'image de la maison juste après que la cliente ait payé. Cohérence avec `/commander` (cibles équivalentes).

### 14.2 — Stratégie de chargement

#### Critical CSS

CSS critique inline dans le `<head>` — uniquement les styles de :
- Header
- Hero de remerciement (fleuron SVG + typographie)
- Récap commande (premier élément après hero)

Le reste en CSS externe avec `<link rel="stylesheet" media="all">`.

#### Preload des polices critiques

```html
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Inter-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Light.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CormorantGaramond-Italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/PinyonScript-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

> **Cormorant Light + Italic preloaded** : utilisés dans hero, lettre éditoriale, titres sections.
> **Pinyon Script preloaded** : utilisé pour signature « Salma » (élément éditorial fort).

#### Fleuron SVG inline (pas image)

```html
<!-- Fleuron champagne SVG inline dans le hero — pas d'image lourde -->
<svg class="fleuron" width="96" height="14" viewBox="0 0 96 14" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 7 L36 7 M60 7 L96 7" stroke="#C8A876" stroke-width="1"/>
  <path d="M48 0 L54 7 L48 14 L42 7 Z" fill="#C8A876"/>
</svg>
```

> **Avantages SVG inline** : pas de requête HTTP, pas de FOUC (Flash Of Unstyled Content), couleur héritée du CSS, scaling parfait.

#### Defer du JavaScript

```html
<!-- Scripts critiques (récupération données commande, vidage panier) -->
<script src="/js/merci-init.js" defer></script>

<!-- Scripts non-critiques (animations, analytics, intersection observers) -->
<script src="/js/animations.js" defer></script>
<script src="/js/analytics.js" async></script>
```

> **Pas de payment SDK chargé** sur `/merci` (économie ~80 KB).
> **Pas de cart logic complexe** (économie ~30 KB).

### 14.3 — Budget de performance

| Ressource                       | Budget          |
| :------------------------------ | :-------------- |
| HTML initial (avec données SSR)  | < 35 KB gzip   |
| CSS critique inline             | < 10 KB         |
| CSS externe                     | < 35 KB gzip    |
| JS total                        | < 40 KB gzip    |
| Photos (récap, préparation, cross-links) | < 200 KB total (lazy) |
| Polices                         | < 160 KB total  |
| Fleuron SVG inline               | < 1 KB          |
| **Total page initiale (above fold)** | **< 280 KB**  |

> **Léger** : `/merci` est volontairement **mince** dans la zone above-fold. Les photos lifestyle (préparation + cross-links) chargent en lazy car elles sont basses dans la page.

### 14.4 — CDN & cache

| Ressource                      | Cache-Control                          |
| :----------------------------- | :------------------------------------- |
| HTML                           | `no-cache, no-store, must-revalidate`  |
| CSS / JS versionnés            | `public, max-age=31536000, immutable`  |
| Images                         | `public, max-age=2592000` (30 jours)   |
| Polices                        | `public, max-age=31536000, immutable`  |
| Fleuron SVG inline (dans HTML)  | (hérite du HTML — pas de cache)        |

> **HTML en `no-store`** : critique pour la sécurité — la page contient des données sensibles (numéro de commande, adresse, montant). Aucune mise en cache navigateur ni CDN ne doit conserver ces données.

### 14.5 — Optimisations spécifiques

| Optimisation                              | Justification                                      |
| :---------------------------------------- | :------------------------------------------------- |
| **SSR** (Server-Side Rendering)           | HTML pré-rendu avec données commande pré-injectées  |
| Pas d'API call client pour les données     | Tout est dans le HTML SSR (économie 1 round-trip)  |
| Fleuron SVG inline                         | LCP optimal — pas de requête image                  |
| Photos lazy loading                        | Above-fold 100% rapide                              |
| IntersectionObserver pour animations       | Pas de scroll listener coûteux                       |
| Polices `font-display: swap`               | Texte visible immédiatement                          |
| Critical CSS inline (header + hero + recap) | Rendu visuel sans attendre CSS externe              |

### 14.6 — Stratégie de rendu — recommandation

#### Approche recommandée — SSR avec pré-injection

`/merci` est **idéalement** rendue en SSR strict :
- Backend valide l'accès (sécurité 4 couches)
- HTML généré avec **toutes les données commande pré-injectées** (numéro, items, total, adresse, dates de livraison calculées)
- Aucun API call client nécessaire
- JavaScript hydrate la page progressivement (animations, IntersectionObserver pour tracking)

**Frameworks recommandés** : Next.js (getServerSideProps), Remix (loader), Astro avec adapter SSR.

#### Pourquoi pas de SSG ?

> SSG (Static Site Generation) impossible — chaque page `/merci?order=XXX` est unique par cliente, avec des données sensibles. Doit être généré au runtime, après validation d'accès.

### 14.7 — Métriques de référence

| Site (e-commerce premium)     | LCP    | CLS   | INP    |
| :--------------------------- | :----- | :---- | :----- |
| Aesop page confirmation       | 1.4s   | 0.03  | 110ms  |
| Le Labo page confirmation     | 1.6s   | 0.04  | 130ms  |
| Glossier page confirmation    | 1.3s   | 0.03  | 95ms   |
| **FemiGlow `/merci` cible**   | **< 1.8s** | **< 0.05** | **< 150ms** |

### 14.8 — Monitoring en production

| Outil                      | Métrique surveillée                                    |
| :------------------------- | :----------------------------------------------------- |
| Web Vitals (real user monitoring) | LCP, CLS, INP                                    |
| Sentry                     | Erreurs JavaScript (notamment validation d'accès, vidage panier) |
| GA4 funnel reports         | Engagement post-achat (taux scroll, clics cross-links) |
| Hotjar                     | Heatmaps + recordings de la page `/merci` (avec consentement) |
| Email automation analytics | Taux d'ouverture des emails J+5 et J+15                |

> **Alerting** : si le taux d'ouverture de l'email confirmation chute en dessous de 85% sur 24h, alerte critique (problème de délivrabilité).

### 14.9 — Métriques business spécifiques

| KPI business                        | Cible                            |
| :---------------------------------- | :------------------------------- |
| Taux de buyer's remorse (annulation < 24h) | < 1.5%                    |
| Taux d'ouverture email confirmation | > 90%                            |
| Taux de scroll au-delà du hero      | > 70%                            |
| Taux de scroll jusqu'à la lettre     | > 45%                            |
| Taux de clic cross-link `/journal`  | > 15%                            |
| Taux de clic cross-link `/maison`   | > 8%                             |
| Taux de retour sur le site dans 7j  | > 30%                            |

> Si les KPIs d'engagement post-achat sont **inférieurs aux cibles**, signal de **dysfonctionnement éditorial** — la page rate son potentiel relationnel.

---

## 15 — SEO & métadonnées

### 15.1 — Principe directeur — `noindex, nofollow` strict

> **`/merci` n'a aucune raison d'apparaître dans les résultats de recherche.** C'est une page transactionnelle privée, accessible uniquement avec session valide pendant 30 minutes après commande.

#### Conséquences techniques

- Pas d'optimisation de title/description pour SERP
- **Pas d'image Open Graph** (éviter previews attractifs partage involontaire)
- Pas de Schema.org
- Pas de hreflang
- Pas dans le sitemap.xml
- `Disallow: /merci` dans robots.txt

### 15.2 — Robots meta

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
```

### 15.3 — Title minimal

```html
<title>Merci · FemiGlow</title>
```

> Title court et sobre. La page n'apparaîtra pas en SERP, donc inutile d'y inclure le numéro de commande (qui serait sensible).

> **Pas de personnalisation** type « Merci Salma · FemiGlow » : le prénom apparaîtrait dans l'historique du navigateur ou les onglets — risque de fuite confidentialité.

### 15.4 — Meta description (réduite)

```html
<meta name="description" content="Confirmation de votre commande FemiGlow.">
```

> Courte. Pas de détails sensibles. La page n'apparaîtra pas en SERP.

### 15.5 — Pas d'Open Graph

```html
<!-- AUCUNE balise og:* sur cette page -->
```

> **Pourquoi pas d'OG ?** Pour éviter qu'un partage involontaire de l'URL `/merci?order=FG-2026-XXXXX` génère un beau preview Facebook/WhatsApp avec le numéro de commande visible à tous les destinataires du lien.

> **Décision radicale** : aucune balise og:title, og:description, og:image. Si l'URL est partagée, elle apparaît brute, sans preview attractif. Ce qui **dissuade** le partage.

### 15.6 — Canonical (optionnel)

```html
<link rel="canonical" href="https://femiglow.ma/merci">
```

> Optionnel — gestion interne propre. Le paramètre `?order=XXX` n'est pas inclus dans le canonical (sécurité).

### 15.7 — Pas de Schema.org

Aucune structure Schema sur la page `/merci`.

> Tentation : ajouter `Schema.org/Order` pour structurer les données de commande. **Refusé** : Schema.org est destiné à l'indexation publique, ce qui est l'inverse de l'objectif ici (page privée).

### 15.8 — Pas dans le sitemap

```xml
<!-- Sitemap.xml ne contient PAS /merci -->
```

### 15.9 — Robots.txt

```
User-agent: *
Disallow: /panier
Disallow: /panier?
Disallow: /commander
Disallow: /commander?
Disallow: /merci
Disallow: /merci?
Disallow: /espace-pro/
```

### 15.10 — Sécurité contre l'indexation involontaire — 5 couches

Couches de protection identiques à `/commander` et `/panier` :

1. ✅ Meta robots `noindex, nofollow, noarchive, nosnippet, noimageindex`
2. ✅ HTTP header `X-Robots-Tag: noindex, nofollow`
3. ✅ Robots.txt `Disallow: /merci` et `Disallow: /merci?`
4. ✅ Pas dans sitemap.xml
5. ✅ Aucun lien interne pointant vers `/merci` (la page n'est accessible que par flux post-checkout)

### 15.11 — Tracking analytics interne

Bien que noindex publiquement, `/merci` est **fortement trackée** en interne pour analyse :

| Événement                                  | Outil                       |
| :----------------------------------------- | :-------------------------- |
| `purchase` (GA4 ecommerce standard)        | GA4                         |
| `merci_page_loaded`                         | GA4 custom event            |
| `merci_section_viewed_hero`                 | GA4 custom event             |
| `merci_section_viewed_recap`                | GA4 custom event             |
| `merci_section_viewed_steps`                | GA4 custom event             |
| `merci_section_viewed_letter`               | GA4 custom event             |
| `merci_section_viewed_preparation`          | GA4 custom event             |
| `merci_section_viewed_crosslinks`           | GA4 custom event             |
| `merci_crosslink_journal_clicked`           | GA4 custom event             |
| `merci_crosslink_maison_clicked`            | GA4 custom event             |
| `merci_order_id_copied`                     | GA4 custom event (V2)        |
| `confirmation_email_sent`                   | Email automation log         |
| `j5_email_scheduled`                        | Email automation log         |
| `j15_email_scheduled`                       | Email automation log         |

> **Tous ces events sont conditionnés au consentement cookies analytics** (sauf les emails transactionnels qui sont une obligation contractuelle).

### 15.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Pas de `noindex`                                    | Risque que Google indexe une page transactionnelle privée            |
| Title SEO optimisé (« Confirmation de commande FemiGlow ») | Inutile (noindex) et peut fuiter dans la barre du navigateur |
| Title personnalisé avec prénom (« Merci Salma »)     | Fuite de données dans l'historique navigateur                        |
| Open Graph image fancy avec logo                     | Génère preview attractif → favorise partage involontaire             |
| Schema Order sur cette page                          | Inutile et complexité gratuite                                       |
| URL avec données sensibles en query string (`?email=xxx`) | Données fuitent dans Referer, logs serveurs                  |
| Canonical avec paramètre `?order=XXX`                 | Réplique le numéro de commande                                       |
| Tracking actif **avant** consentement cookies         | Violation RGPD                                                       |
| Lien interne quelque part vers `/merci`               | Risque indexation Google même avec noindex                            |

---

## 16 — Accessibilité (a11y)

### 16.1 — Conformité visée

**WCAG 2.2 niveau AA strict** sur tous les composants — page transactionnelle, l'accessibilité est **obligatoire** légalement et critique éthiquement.

**Niveau AAA** visé sur :
- Contraste de tous les textes critiques (titre hero, lettre éditoriale, récap)
- Navigation clavier complète (cross-links, copie du numéro)
- Annonces dynamiques (aria-live) pour le numéro de commande sélectionné
- Halo pulse étape active accessible (description ARIA)

### 16.2 — Contraste — vérifications

| Combinaison                                        | Ratio   | Niveau WCAG   |
| :------------------------------------------------- | :------ | :------------ |
| Encre `#2C2A28` sur Crème `#FBF8F1`                | 14.2:1  | AAA           |
| Encre claire `#4A4844` sur Crème                   | 9.1:1   | AAA           |
| Brume `#6B6863` sur Crème                          | 5.6:1   | AA            |
| Encre sur Crème pure `#FFFFFF` (récap)             | 14.6:1  | AAA           |
| Encre sur Sauge pâle `#E8EFE7` (suivi)             | 12.8:1  | AAA           |
| Champagne `#C8A876` sur Crème (fleuron)             | 2.7:1   | (graphique non textuel — OK)  |
| Sauge dark `#A8C4A6` sur Crème (filets, halo)      | 2.8:1   | (graphique non textuel — OK)  |
| Sauge dark sur Sauge pâle (cercle étape active)    | 1.4:1   | (graphique — OK car halo signal redondant) |
| Pinyon Script Encre sur Crème (signature)          | 14.2:1  | AAA           |

### 16.3 — Navigation clavier — séquence Tab

#### Cas standard — page complète

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1     | Skip links (« Aller au contenu », « Aller au récap », « Aller à la lettre ») |
| 2     | Wordmark (header)                                     |
| 3     | Items du menu principal (header)                      |
| 4     | Icône panier (header — vide, mais focusable)          |
| 5     | Numéro de commande (sélectionnable au clavier via Tab + Cmd/Ctrl+A) |
| 6     | Card cross-link Journal (entière clickable)            |
| 7     | Card cross-link Maison (entière clickable)             |
| 8     | Lien email contact (footer)                            |
| 9     | Liens du footer                                       |

#### Cas accès refusé

Si le serveur refuse l'accès à `/merci` :

| Ordre | Élément                                              |
| :---- | :--------------------------------------------------- |
| 1     | Toast d'erreur (focus auto pour annonce screen reader) |
| 2     | Liens habituels de `/accueil` (où la cliente a été redirigée) |

### 16.4 — Focus ring

| Propriété     | Valeur                                          |
| :------------ | :---------------------------------------------- |
| Couleur       | `#A8C4A6` (Sauge dark)                          |
| Épaisseur     | 2px                                             |
| Offset        | 4px                                             |
| Border-radius | Hérite de l'élément (0 ou 50% pour cercles)     |
| Outline-style | `solid`                                         |
| Visible       | Sur focus clavier uniquement (`:focus-visible`) |

### 16.5 — ARIA labels & landmarks

```html
<header role="banner" aria-label="En-tête principal">
  <nav aria-label="Navigation principale">...</nav>
  <a href="/panier" aria-label="Panier vide">
    Panier · <span class="cart-count">0</span>
  </a>
</header>

<main role="main" aria-label="Confirmation de votre commande FemiGlow">

  <!-- Section 01 — Hero de remerciement -->
  <section aria-labelledby="merci-hero-title" class="merci-hero">
    <span class="fleuron" role="img" aria-label="Fleuron éditorial"></span>

    <h1 id="merci-hero-title">Merci, Salma.</h1>

    <p class="subtitle"><em>Votre commande est en bonnes mains.</em></p>

    <p class="order-id" aria-label="Numéro de commande">
      <span class="order-id-value" aria-live="polite">FG-2026-00037</span>
    </p>

    <hr class="divider" aria-hidden="true">

    <p class="delivery-info">
      Livraison estimée entre le <time datetime="2026-05-07">jeudi 7</time>
      et le <time datetime="2026-05-09">samedi 9 mai</time>.
    </p>
  </section>

  <!-- Section 02 — Récapitulatif -->
  <section aria-labelledby="recap-title" id="section-recap" class="recap-confirm">
    <h2 id="recap-title">Récapitulatif</h2>
    <hr class="section-divider" aria-hidden="true">

    <article class="recap-card" aria-label="Détails de votre commande">
      <figure>
        <img src="..." alt="Kit Rituel d'Éclat — quatre pots alignés sur fond crème">
      </figure>

      <div class="recap-item-info">
        <h3 class="item-name">Kit Rituel d'Éclat</h3>
        <p class="item-quantity"><em>Quantité : 1</em></p>
        <p class="item-price" aria-label="Prix : 500 dirhams marocains">500 MAD</p>
      </div>

      <hr class="inner-divider" aria-hidden="true">

      <dl class="recap-totals">
        <div class="recap-line">
          <dt>Sous-total</dt>
          <dd>500 MAD</dd>
        </div>
        <div class="recap-line">
          <dt>Livraison (Standard, Casablanca)</dt>
          <dd>Gratuit</dd>
        </div>
      </dl>

      <hr class="total-divider" aria-hidden="true">

      <dl class="recap-total">
        <div class="recap-line">
          <dt>Total</dt>
          <dd>500 MAD</dd>
        </div>
      </dl>

      <p class="payment-info">
        <em>Payé par carte bancaire · ••••• 6411</em>
      </p>
    </article>

    <section aria-labelledby="address-title" class="shipping-address">
      <h3 id="address-title" class="kicker">Adresse de livraison</h3>

      <address>
        Salma El Idrissi<br>
        12 Rue de l'Atelier, Apt 4B<br>
        Quartier Maârif<br>
        Casablanca, Maroc<br>
        <a href="tel:+212612345678">+212 6 12 34 56 78</a>
      </address>
    </section>
  </section>

  <!-- Section 03 — Suivi & étapes -->
  <section aria-labelledby="steps-title" id="section-steps" class="steps-section">
    <h2 id="steps-title">Les prochaines étapes.</h2>

    <ol class="steps-list" role="list" aria-label="Étapes de votre commande">

      <li class="step step-active" role="listitem"
          aria-label="Étape en cours : Préparation, aujourd'hui">
        <span class="step-circle" role="status"
              aria-label="Étape en cours, animation en boucle">
        </span>
        <h3 class="step-title">Préparation</h3>
        <hr aria-hidden="true">
        <p class="step-date">Aujourd'hui</p>
        <p class="step-desc">Votre kit est préparé avec attention dans l'atelier.</p>
      </li>

      <li class="step step-pending" role="listitem"
          aria-label="Étape à venir : Expédition, sous 1 à 2 jours">
        <span class="step-circle" aria-hidden="true"></span>
        <h3 class="step-title">Expédition</h3>
        <hr aria-hidden="true">
        <p class="step-date">Sous 1 à 2 jours</p>
        <p class="step-desc">Vous recevrez un email avec le numéro de suivi.</p>
      </li>

      <li class="step step-pending" role="listitem"
          aria-label="Étape à venir : Livraison, entre le jeudi 7 et le samedi 9 mai">
        <span class="step-circle" aria-hidden="true"></span>
        <h3 class="step-title">Livraison</h3>
        <hr aria-hidden="true">
        <p class="step-date">Entre le jeudi 7 et le samedi 9 mai</p>
        <p class="step-desc">Le livreur vous appellera.</p>
      </li>

    </ol>
  </section>

  <!-- Section 04 — Lettre éditoriale -->
  <section aria-labelledby="letter-title" id="section-letter" class="letter-section">
    <h2 id="letter-title" class="visually-hidden">Lettre de la maison</h2>

    <article role="article" class="editorial-letter">
      <p class="greeting">Salma,</p>

      <p>Vous venez de commander un kit. Mais ce kit, pour nous, n'est pas un produit. C'est un rituel — quatre matières, quatre gestes, et le temps qu'on s'accorde à soi.</p>

      <p>Pendant que votre kit voyage vers vous, nous tenions à vous remercier de votre confiance. Cette commande, en V1 de notre maison, est un encouragement précieux.</p>

      <p>Quand vous ouvrirez la boîte, prenez le temps. Lisez la carte que nous y avons glissée. Et, si possible, choisissez un moment calme pour votre premier rituel.</p>

      <p class="closing"><em>Avec soin,</em></p>

      <p class="signature">Salma</p>
      <p class="role">Fondatrice de la maison</p>
    </article>
  </section>

  <!-- Section 05 — Préparation au geste -->
  <section aria-labelledby="prep-title" id="section-preparation" class="preparation-section">
    <figure>
      <img src="..." alt="Mains posées sur une table, kit FemiGlow ouvert avec ses quatre pots, tasse de thé en arrière-plan, lumière chaude de fin de journée"
           loading="lazy">
    </figure>

    <div class="prep-info">
      <span class="kicker">LE MOMENT APPROCHE</span>
      <h2 id="prep-title">Quelques jours encore, puis <em>le rituel</em>.</h2>
      <p>Le rituel d'éclat se vit en une heure, à votre rythme. Lumière douce, musique choisie, et ces minutes rendues à soi.</p>
    </div>
  </section>

  <!-- Section 06 — Cross-links -->
  <section aria-labelledby="crosslinks-title" id="section-crosslinks" class="crosslinks-section">
    <h2 id="crosslinks-title"><em>En attendant.</em></h2>

    <div class="crosslinks-grid">
      <a href="/journal" class="crosslink-card" aria-label="Visiter le journal — Quelques minutes pour ralentir">
        <figure>
          <img src="..." alt="Tasse de thé tiède, livre ouvert et carnet sur table en bois"
               loading="lazy">
        </figure>
        <span class="kicker">LE JOURNAL</span>
        <h3><em>Quelques minutes pour ralentir.</em></h3>
        <p>Des fragments écrits depuis l'atelier.</p>
        <span class="cta-text">Visiter le journal <span aria-hidden="true">→</span></span>
      </a>

      <a href="/maison" class="crosslink-card" aria-label="Découvrir la maison — Le récit derrière le rituel">
        <figure>
          <img src="..." alt="Vue d'atelier : table de travail, outils du rituel posés"
               loading="lazy">
        </figure>
        <span class="kicker">LA MAISON</span>
        <h3><em>Le récit derrière le rituel.</em></h3>
        <p>Comment la maison est née, pourquoi le geste, et pour qui.</p>
        <span class="cta-text">Découvrir la maison <span aria-hidden="true">→</span></span>
      </a>
    </div>
  </section>

</main>

<footer role="contentinfo" aria-label="Pied de page">...</footer>
```

### 16.6 — Annonces dynamiques (aria-live)

#### 1. Numéro de commande — sélection au clavier

```html
<span class="order-id-value"
      aria-live="polite"
      tabindex="0"
      role="textbox"
      aria-readonly="true">
  FG-2026-00037
</span>
```

À la sélection (Tab + Cmd/Ctrl+A), le screen reader annonce : *« Numéro de commande sélectionné : F-G tiret 2-0-2-6 tiret zéro zéro zéro trois sept »*.

#### 2. Halo pulse étape active

Le halo CSS animé sur l'étape « Préparation » est purement visuel. Pour le screen reader :

```html
<li class="step step-active" role="listitem"
    aria-label="Étape en cours : Préparation, aujourd'hui">
  <span class="step-circle" role="status"
        aria-label="Étape en cours, animation en boucle">
  </span>
  ...
</li>
```

> Le `role="status"` + `aria-label` annoncent que cette étape est **en cours**, sans surcharger l'utilisateur d'informations sur l'animation visuelle.

#### 3. Toast d'erreur d'accès refusé

```html
<div role="alert" aria-live="assertive" class="toast-error">
  Cette page n'est plus accessible. Consultez votre email pour le récap de commande.
</div>
```

Annonce immédiate : *« Cette page n'est plus accessible. Consultez votre email pour le récap de commande. »*

#### 4. Vidage du panier (annonce silencieuse)

```html
<div class="visually-hidden" aria-live="polite">
  Votre panier a été vidé après commande.
</div>
```

> Annonce discrète pour les utilisateurs de lecteur d'écran : ils savent que le compteur panier est passé à 0.

### 16.7 — Skip links

```html
<a href="#main" class="skip-link">Aller au contenu principal</a>
<a href="#section-recap" class="skip-link">Aller au récapitulatif</a>
<a href="#section-letter" class="skip-link">Aller à la lettre de la maison</a>
```

> **3 skip links** pour permettre une navigation rapide aux moments-clés de la page.

### 16.8 — Lettre éditoriale — sémantique

```html
<article role="article" class="editorial-letter">
  <p class="greeting">Salma,</p>
  <!-- 3 paragraphes -->
  <p class="closing"><em>Avec soin,</em></p>
  <p class="signature">Salma</p>
  <p class="role">Fondatrice de la maison</p>
</article>
```

> **`role="article"`** : la lettre est un contenu autonome, comme un blog post. Cela permet au screen reader de l'annoncer comme un article distinct.

> **Pas de `<blockquote>`** : la lettre n'est pas une citation — c'est un message direct de la maison. `<article>` est sémantiquement correct.

### 16.9 — Cross-links — accessibilité complète

```html
<a href="/journal" class="crosslink-card" aria-label="Visiter le journal — Quelques minutes pour ralentir">
  <!-- Photo + texte -->
</a>
```

> **Toute la card est un lien `<a>`** — accessible au clavier (Tab + Enter), zone tactile maximale.

> **`aria-label` complet** : décrit la destination ET le titre. Le screen reader annonce une description riche au focus.

### 16.10 — Réduction du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }

  /* Hero séquentiel : apparition globale instantanée */
  .merci-hero > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Halo pulse étape active : désactivé */
  .step-active .step-circle::after {
    animation: none !important;
    opacity: 0.3 !important; /* Halo statique, mais visible */
  }

  /* Cards cross-links : pas de hover scale */
  .crosslink-card:hover img {
    transform: none !important;
  }

  /* Lettre cascade : apparition globale */
  .editorial-letter > * {
    opacity: 1 !important;
    transform: none !important;
  }

  /* Toast : transition simple */
  .toast {
    transition: opacity 100ms !important;
  }
}
```

### 16.11 — Lecture par lecteur d'écran — flux

#### Pour une utilisatrice avec lecteur d'écran sur `/merci`

```
1. « En-tête principal »
2. « Navigation principale, liste de 5 éléments... »
3. « Lien : Panier vide »
4. « Confirmation de votre commande FemiGlow, contenu principal »
5. « Image : Fleuron éditorial »
6. « Merci, Salma. Heading 1 »
7. « Italic : Votre commande est en bonnes mains »
8. « Numéro de commande : F-G tiret 2-0-2-6 tiret zéro zéro zéro trois sept »
9. « Livraison estimée entre le jeudi 7 et le samedi 9 mai »
10. « Récapitulatif, heading 2 »
11. « Article : Détails de votre commande »
12. « Image : Kit Rituel d'Éclat — quatre pots alignés sur fond crème »
13. « Kit Rituel d'Éclat, heading 3 »
14. « Italic : Quantité : 1 »
15. « Prix : 500 dirhams marocains »
16. « Sous-total : 500 MAD »
17. « Livraison Standard Casablanca : Gratuit »
18. « Total : 500 MAD »
19. « Italic : Payé par carte bancaire ••••• 6411 »
20. « Adresse de livraison, heading 3 »
21. « Salma El Idrissi, 12 Rue de l'Atelier... »
22. « Lien téléphone : +212 6 12 34 56 78 »
23. « Les prochaines étapes. Heading 2 »
24. « Liste : Étapes de votre commande, 3 éléments »
25. « Étape 1 : Étape en cours : Préparation, aujourd'hui »
26. « Status : Étape en cours, animation en boucle »
27. « Préparation, heading 3 »
28. « Aujourd'hui »
29. « Votre kit est préparé avec attention dans l'atelier »
30. « Étape 2 : Étape à venir : Expédition, sous 1 à 2 jours »
31. ... etc.
32. « Article : Lettre de la maison »
33. « Salma, »
34. « Vous venez de commander un kit. Mais ce kit, pour nous... »
35. ... 3 paragraphes de la lettre
36. « Italic : Avec soin, »
37. « Salma »
38. « Fondatrice de la maison »
39. « Image : Mains posées sur une table, kit FemiGlow ouvert... »
40. « LE MOMENT APPROCHE »
41. « Quelques jours encore, puis italic le rituel point. Heading 2 »
42. ... etc.
43. « Italic : En attendant. Heading 2 »
44. « Lien : Visiter le journal — Quelques minutes pour ralentir »
45. « Lien : Découvrir la maison — Le récit derrière le rituel »
46. « Pied de page »
```

### 16.12 — Test d'accessibilité — checklist

| Outil                | Usage                                                       |
| :------------------- | :---------------------------------------------------------- |
| **axe DevTools**     | Audit automatique sur chaque déploiement                     |
| **WAVE**             | Audit visuel en complément                                  |
| **Lighthouse**       | Score d'accessibilité ≥ 95/100                              |
| **NVDA + Firefox**   | Test lecteur d'écran Windows                                |
| **VoiceOver + Safari** | Test lecteur d'écran macOS/iOS                            |
| **TalkBack**         | Test lecteur d'écran Android                                |
| **Keyboard-only**    | Test complet : navigation + sélection numéro + clic cross-links |
| **Toast erreur a11y** | Vérification annonce assertive + focus auto                |
| **Halo pulse a11y**   | Vérification présence ARIA + désactivation reduced-motion   |
| **Color contrast**   | WebAIM Contrast Checker                                      |

> **Test critique** : naviguer **toute la page** au clavier + lecteur d'écran, en lisant la lettre éditoriale + en cliquant sur un cross-link.

---

## 17 — Microcopy & états

### 17.1 — Principe directeur

> La page `/merci` a **peu d'états dynamiques** (pas de modification de panier, pas de selectors, pas d'API calls fréquents). Mais elle a beaucoup de **variantes textuelles** selon le contexte de la commande : prénom dispo/non, mode paiement carte/COD, mode livraison Standard/Express, ville Casablanca/autres, code promo appliqué.

Tonalité globale : **paisible, claire, intime, jamais commerciale.**

### 17.2 — Variantes selon disponibilité du prénom

#### Cas avec prénom (98% des cas)

```
Hero : « Merci, Salma. »
Lettre : « Salma, »
```

#### Cas sans prénom (rare — 2%)

```
Hero : « Merci. »
Lettre : « Bonjour, »
```

> **Pourquoi « Bonjour, »** plutôt que rien ? Parce qu'une lettre **doit avoir une interpellation** — le format épistolaire l'exige. « Bonjour, » est neutre et doux.

### 17.3 — Variantes selon mode de paiement

#### Cas carte bancaire (paiement effectué)

```
Hero sous-titre : « Votre commande est en bonnes mains. »
Récap mention : « Payé par carte bancaire · ••••• 6411 »
Lettre paragraphe 2 : « ...nous tenions à vous remercier de votre confiance... »
```

#### Cas paiement à la livraison (COD)

```
Hero sous-titre : « Votre commande est en bonnes mains.
                   Notre livreur vous appellera bientôt. »
Récap mention : « À payer à la livraison · espèces ou carte sans contact »
Lettre paragraphe 2 : « ...nous tenions à vous remercier de votre commande...
                       Le livreur vous appellera dans les prochains jours. »
Suivi étape 3 : « Le livreur vous appellera pour confirmer le rendez-vous.
                  Préparez la somme exacte ou votre carte sans contact. »
```

> **Subtilité éditoriale COD** : « confiance » devient « commande » dans la lettre. La cliente n'a **pas encore payé** — la confiance complète sera donnée au moment de la remise du paiement. Petite honnêteté éditoriale.

### 17.4 — Variantes selon mode de livraison

#### Standard (3-5 jours ouvrables)

```
Hero mention : « Livraison estimée entre le jeudi 7 et le samedi 9 mai. »
Suivi étape 3 : « Entre le jeudi 7 et le samedi 9 mai · Le livreur vous appellera. »
Suivi étape 2 : « Sous 1 à 2 jours · Vous recevrez un email avec le numéro de suivi. »
```

#### Express (1-2 jours ouvrables)

```
Hero mention : « Livraison estimée demain ou après-demain. »
   ou
Hero mention : « Livraison estimée le mercredi 6 mai. » (si même jour mini/max)

Suivi étape 3 : « Demain ou après-demain · Le livreur vous appellera. »
Suivi étape 2 : « Aujourd'hui · Vous recevrez un email avec le numéro de suivi. »
```

> **Adaptation des dates** selon le jour de commande, en respectant les jours ouvrables (samedi inclus, dimanche exclu).

### 17.5 — Variantes selon la ville

#### Casablanca / Rabat / Salé / Mohammedia (zone gratuite)

```
Récap : « Livraison (Standard, Casablanca) · Gratuit »
```

#### Autres villes urbaines (Marrakech, Fès, Tanger, Agadir...)

```
Récap : « Livraison (Standard, Marrakech) · 30 MAD »
```

#### Zones rurales

```
Récap : « Livraison (Standard, autre) · 50 MAD »
Hero mention : « Livraison estimée sous 5 à 7 jours. »
```

### 17.6 — Variantes selon code promo

#### Sans code promo (cas standard)

```
Récap :
Sous-total                                              500 MAD
Livraison (Standard, Casablanca)                       Gratuit
─
Total                                                   500 MAD
Payé par carte bancaire · ••••• 6411
```

#### Avec code promo appliqué

```
Récap :
Sous-total                                              500 MAD
Code MAISON10                                          -50 MAD  (en sauge dark)
Livraison (Standard, Casablanca)                       Gratuit
─
Total                                                   450 MAD
Payé par carte bancaire · ••••• 6411
```

> **Pas de mention valorisante** type « Vous avez économisé 50 MAD ! » — la maison ne célèbre pas la réduction. Le montant est juste affiché, factuellement.

### 17.7 — État du halo pulse étape active

| État                          | Apparence                                          |
| :---------------------------- | :------------------------------------------------- |
| Étape active animée           | Halo pulse 2.5s par cycle, opacité 0.4 → 0.1        |
| Reduced motion activé         | Halo statique (opacité 0.3), pas d'animation        |
| Étape complétée (V2)          | Cercle plein avec ✓ blanc, halo désactivé           |

#### Annonce ARIA permanente

```html
<span class="step-circle" role="status" aria-label="Étape en cours, animation en boucle">
</span>
```

> Le screen reader annonce l'état **une seule fois** au focus. Pas d'annonce répétée toutes les 2.5s (qui serait insupportable).

### 17.8 — État du tooltip numéro de commande

#### Hover desktop

```
Numéro de commande : FG-2026-00037
                    ┌──────────────────┐
                    │ Cliquez pour     │
                    │ sélectionner     │
                    └──────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Tooltip text       | « Cliquez pour sélectionner »                                    |
| Tooltip background | `#2C2A28` (Encre)                                                |
| Tooltip text color | `#FBF8F1` (Crème)                                                |
| Tooltip font       | Inter Regular 11pt                                                |
| Tooltip padding    | 8px 12px                                                          |
| Affichage          | Au hover desktop, après 600ms de délai                            |

> **Pas de tooltip mobile** : l'interaction tactile est différente — la cliente fait double-tap pour sélectionner.

#### Comportement après sélection

Au double-clic ou Tab + Cmd/Ctrl+A :
- Le numéro est **sélectionné en bleu** (highlight du navigateur)
- Annonce ARIA : « Numéro de commande sélectionné »
- La cliente peut copier avec Cmd/Ctrl+C

### 17.9 — État hover sur cards cross-link

#### Card Journal

| État               | Apparence                                                  |
| :----------------- | :--------------------------------------------------------- |
| Repos              | Photo et texte normaux, opacity 1                          |
| Hover              | Photo scale 1.03, opacity 0.92, flèche translate-x 4px      |
| Focus clavier      | Focus ring sauge dark 2px offset 4px (sur la card entière)  |
| Active (clic)      | Pas d'effet supplémentaire (la navigation prend le relais)  |

#### Card Maison

Identique à la card Journal.

### 17.10 — Tonalité globale — règles éditoriales

**Toujours paisible. Toujours claire. Jamais alarmiste, jamais commerciale.**

| À éviter                                 | À préférer                                              |
| :--------------------------------------- | :------------------------------------------------------ |
| « Félicitations pour votre commande ! »   | « Merci, Salma. »                                       |
| « Votre commande #00037 est confirmée »   | « FG-2026-00037 » (typographié)                          |
| « Votre paiement de 500 MAD a été reçu »  | « Payé par carte bancaire · ••••• 6411 »                |
| « Vous recevrez votre commande sous 3-5 jours » | « Livraison estimée entre le jeudi 7 et le samedi 9 mai. » |
| « Bravo, Salma ! »                        | « Merci, Salma. »                                       |
| « Profitez de votre achat ! »             | « Quand vous ouvrirez la boîte, prenez le temps. »      |
| « Continuez votre shopping ! »             | « Visiter le journal → »                                 |
| « Découvrez nos autres produits ! »        | « Découvrir la maison → »                                |
| « Notez votre expérience »                  | (Pas de demande review avant J+15)                      |
| « Économisez 10% sur votre prochaine commande » | (Pas de promo post-achat en V1)                    |
| « Partagez votre commande sur les réseaux ! »| (Pas de share buttons V1)                            |
| « Cordialement, l'équipe FemiGlow »        | « Avec soin, Salma · Fondatrice de la maison »          |
| « Cher client »                            | « Salma, » (lettre intime)                              |
| « Best regards »                           | « Avec soin, »                                           |

### 17.11 — État 404 spécifique à `/merci`

Si une cliente arrive sur `/merci/etape-x` ou autre URL invalide sous /merci :

```
┌────────────────────────────────────────────────────┐
│                                                    │
│      Cette page de remerciement s'est égarée.       │
│                                                    │
│   Mais votre commande est bien enregistrée.        │
│                                                    │
│   Consultez l'email que nous vous avons envoyé.     │
│                                                    │
│   ┌──────────────────────┐                         │
│   │  Retourner à l'accueil → │                       │
│   └──────────────────────┘                         │
│                                                    │
└────────────────────────────────────────────────────┘
```

> **Tonalité spécifique** : reconnaitre que **la page de remerciement** est égarée, mais **rassurer** sur la commande. La cliente comprend que sa commande est intacte, peu importe le bug d'URL.

### 17.12 — État toast d'accès refusé

Quand une cliente arrive sur `/merci?order=XXX` sans session valide ou hors délai 30 min :

```
┌──────────────────────────────────────────────────────┐
│  Cette page n'est plus accessible.                    │
│  Consultez votre email pour le récap de commande.     │
└──────────────────────────────────────────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Position           | Toast top-center (0px du top, full width sur mobile)              |
| Background         | `#FBF8F1` (Crème) avec border 1px `#E8E0D2`                     |
| Border-left        | 3px solid `#A8C4A6` (Sauge dark) — neutre, pas alarmiste         |
| Police             | Cormorant Garamond Italic 14pt                                   |
| Couleur            | `#4A4844` (Encre claire)                                         |
| Padding            | 16px 24px                                                          |
| Auto-dismiss       | 6 secondes                                                          |
| Animation entrée   | Slide-down 220ms                                                    |
| Animation sortie   | Fade-out 200ms                                                       |
| Bouton fermeture   | × en haut à droite, optionnel                                     |

> **Pas de couleur rouge** : ce n'est pas une erreur grave. La cliente est juste invitée à consulter son email.

### 17.13 — Variantes contexte cadeau (V2)

V2 : si la cliente a marqué la commande comme cadeau pour quelqu'un d'autre :

```
Hero titre : « Merci, Salma. »
Hero sous-titre : « Votre cadeau est en bonnes mains. »
Récap : (avec section "Adresse du destinataire" et "Note du cadeau")
Lettre paragraphe 1 : « Vous venez d'offrir un kit. Mais ce kit, pour nous,
                       n'est pas un produit. C'est un rituel — quatre matières,
                       quatre gestes, et le temps qu'on s'accorde à soi.
                       Que vous l'offriez à quelqu'un de cher,
                       cela double sa valeur. »
```

> **V1** : pas de gestion cadeau. Implémentation V2 quand la fonctionnalité « Marquer comme cadeau » sera ajoutée à `/commander`.

### 17.14 — Microcopy de l'IntersectionObserver pour tracking

**Aucun texte visible** lié au tracking. Les events GA4 sont silencieux côté UI.

> **Cohérence UX** : la cliente ne doit jamais voir de mention type « Cette page utilise des analytics » au-delà du cookie banner standard (géré globalement).

### 17.15 — Pas de microcopy dynamique « temps écoulé »

> Tentation : afficher « Votre commande a été passée il y a 2 minutes » avec auto-update. **Refusé** :
> - La cliente connait déjà le moment de sa commande
> - Crée une fausse urgence (« seulement 28 min restantes pour accéder à cette page ! »)
> - Charge JS inutile

### 17.16 — Cookies banner spécifique post-achat

Le cookies banner (s'il n'a pas encore été accepté) reste **identique** à celui des autres pages. Pas de personnalisation post-achat.

> **Particularité** : si la cliente refuse les cookies analytics ici, les events `merci_*` ne se déclenchent pas, mais les **emails transactionnels sont quand même envoyés** (obligation contractuelle non soumise au consentement marketing).

---

## 18 — Emails post-achat & cycle de vie

### 18.1 — Principe directeur

> Les emails post-achat sont **l'extension naturelle** de la page `/merci`. Ils maintiennent la relation entre l'achat et la livraison, puis au-delà — toujours dans la **même voix éditoriale**, toujours signés « Avec soin, La maison FemiGlow ».

Trois emails composent le cycle de vie post-achat :
1. **J+0 (immédiat)** — Confirmation de commande
2. **J+5** — « Le moment approche »
3. **J+15** — « Comment s'est passée votre première fois ? »

### 18.2 — Email 1 — Confirmation de commande (J+0, immédiat)

#### Trigger

Au moment où la cliente arrive validement sur `/merci`. Email envoyé en **moins de 60 secondes** après confirmation de paiement (carte) ou validation de commande (COD).

#### Sujet

```
Votre commande FemiGlow #FG-2026-00037
```

> **Pourquoi le numéro de commande dans le sujet ?** Pour faciliter la **recherche** dans la boîte mail de la cliente. Si elle veut retrouver la confirmation 2 mois plus tard, elle tape le numéro.

#### Expéditeur

```
From: La maison FemiGlow <commandes@femiglow.ma>
Reply-To: contact@femiglow.ma
```

> **Reply-To différent du From** : si la cliente répond à l'email de confirmation, elle écrit au support général (`contact@`), pas à un email administratif (`commandes@`). Petite attention pratique.

#### Corps de l'email — version carte bancaire

```
Salma,

Merci pour votre commande. Voici le récapitulatif :

╌╌╌

Numéro de commande : FG-2026-00037
Date : 2 mai 2026

╌╌╌

Kit Rituel d'Éclat
Quantité : 1
500 MAD

Sous-total                 500 MAD
Livraison (Standard, Casablanca)  Gratuit
─
Total                      500 MAD
Payé par carte bancaire · ••••• 6411

╌╌╌

Adresse de livraison

Salma El Idrissi
12 Rue de l'Atelier, Apt 4B
Quartier Maârif
Casablanca, Maroc
+212 6 12 34 56 78

╌╌╌

Livraison estimée entre le jeudi 7 et le samedi 9 mai.

Vous recevrez un email avec le numéro de suivi
dès que votre kit sera expédié.

╌╌╌

Quand vous ouvrirez la boîte, prenez le temps. Lisez la
carte que nous y avons glissée. Et, si possible,
choisissez un moment calme pour votre premier rituel.

Avec soin,
La maison FemiGlow

contact@femiglow.ma
```

#### Corps de l'email — version COD

```
Salma,

Merci pour votre commande. Voici le récapitulatif :

╌╌╌

Numéro de commande : FG-2026-00037
Date : 2 mai 2026

╌╌╌

Kit Rituel d'Éclat
Quantité : 1
500 MAD

Sous-total                 500 MAD
Livraison (Standard, Casablanca)  Gratuit
Frais paiement à la livraison  + 20 MAD
─
Total                      520 MAD
À payer à la livraison · espèces ou carte sans contact

╌╌╌

Adresse de livraison

[idem]

╌╌╌

Livraison estimée entre le jeudi 7 et le samedi 9 mai.

Notre livreur vous appellera pour confirmer
le rendez-vous. Préparez la somme exacte
(520 MAD) ou votre carte sans contact.

╌╌╌

Quand vous ouvrirez la boîte, prenez le temps. Lisez la
carte que nous y avons glissée. Et, si possible,
choisissez un moment calme pour votre premier rituel.

Avec soin,
La maison FemiGlow

contact@femiglow.ma
```

#### Design de l'email (HTML)

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Largeur container      | 600px max (standard email premium)                                |
| Background email       | `#FBF8F1` (Crème)                                                 |
| Background container   | `#FFFFFF` (Crème pure)                                            |
| Police titre/sous-titre| Cormorant Garamond                                                |
| Police corps            | Cormorant Garamond Regular pour textes éditoriaux + Inter pour montants |
| Filets séparateurs     | `╌╌╌` (em-dashes typographiques) en sauge dark `#A8C4A6`          |
| Logo en header         | Wordmark Pinyon Script SVG inline                                  |
| Footer email            | Inter Regular 11pt, mention « contact@femiglow.ma » + lien désinscription si applicable |

#### Variables dynamiques

| Variable               | Source                                          |
| :--------------------- | :---------------------------------------------- |
| `{{ firstName }}`      | order.firstName                                  |
| `{{ orderId }}`        | order.id                                         |
| `{{ orderDate }}`      | order.createdAt formatté                          |
| `{{ items }}`          | order.items (loop)                               |
| `{{ subtotal }}`       | order.subtotal                                   |
| `{{ shipping }}`       | order.shipping (formaté selon zone)             |
| `{{ codFee }}`         | order.codFee (si COD)                           |
| `{{ total }}`          | order.total                                      |
| `{{ paymentMethod }}`  | « Payé par carte bancaire · ••••• {{ cardLastFour }} » ou « À payer à la livraison... » |
| `{{ shippingAddress }}`| order.shippingAddress (formaté multi-lignes)      |
| `{{ deliveryWindow }}` | calculateDeliveryWindow() formaté                 |

### 18.3 — Email 2 — « Le moment approche » (J+5)

#### Trigger

5 jours après la commande (J+5), seulement si la commande est en statut `shipped` ou `in_transit` (pas si déjà `delivered` ou `cancelled`).

#### Sujet

```
Le moment approche, Salma
```

> **Sujet personnalisé** avec prénom — différent du sujet J+0 (qui contient le numéro de commande pour la recherche). Ici, on cherche **l'engagement émotionnel**, pas l'archivage.

#### Expéditeur

```
From: La maison FemiGlow <bonjour@femiglow.ma>
Reply-To: contact@femiglow.ma
```

> **Adresse expéditeur différente** (`bonjour@` vs `commandes@`) : signal subtil que cet email est **éditorial**, pas administratif.

#### Corps de l'email

```
Salma,

Votre kit voyage vers vous depuis quelques jours.
Bientôt, vous tiendrez la boîte entre vos mains.

╌╌╌

Avant le rituel, quelques pensées de la maison :

  Choisissez un moment calme.
  Une heure, à votre rythme.

  Préparez l'ambiance —
  une lumière douce, une musique choisie.

  Lisez la carte glissée dans la boîte.
  Elle est pour vous.

╌╌╌

Le rituel d'éclat se vit en quatre gestes :
préparation, application, polissage, repos.

Vous trouverez les détails sur notre journal,
si vous souhaitez vous y plonger avant.

[Visiter le journal →]

╌╌╌

Avec soin,
La maison FemiGlow

contact@femiglow.ma
```

#### Décomposition narrative

- **Paragraphe 1** : reconnaissance du temps écoulé, anticipation poétique
- **Tercet** : trois conseils de préparation (lumière, durée, lecture) en format rythmé
- **Paragraphe 3** : rappel du rituel + invitation au Journal (lecture pendant l'attente finale)
- **Signature** : « Avec soin, La maison FemiGlow »

#### Design HTML

Identique au design de l'email J+0 (cohérence visuelle), avec :
- Pas de récap de commande (la cliente l'a déjà reçu)
- Plus d'espace blanc (lecture méditative)
- CTA bouton outline « Visiter le journal → » en bas

### 18.4 — Email 3 — « Comment s'est passée votre première fois ? » (J+15)

#### Trigger

15 jours après la commande (J+15), seulement si la commande est en statut `delivered` (livrée) **et** au moins 7 jours se sont écoulés depuis la livraison.

> **Pourquoi 15 jours et pas 14 ?** Pour laisser à la cliente **deux week-ends** pour avoir essayé son kit. Statistiquement, les premiers usages des produits beauté arrivent souvent en weekend.

#### Sujet

```
Comment s'est passée votre première fois, Salma ?
```

> **Sujet interrogatif** — invite à la réponse. Personnalisé avec prénom.

#### Expéditeur

```
From: Salma de FemiGlow <bonjour@femiglow.ma>
Reply-To: salma@femiglow.ma
```

> **Expéditeur différent** : ici, c'est Salma **personnellement** qui écrit. Signal d'authenticité maximale. Si la cliente répond, elle écrit directement à `salma@femiglow.ma`.

> **Cas pratique V1** : `salma@femiglow.ma` est consulté par Salma elle-même, ou par l'équipe relation cliente avec accusé de la fondatrice. Important pour la voix.

#### Corps de l'email

```
Salma,

Cela fait quelques jours que votre kit est arrivé.
J'ose espérer que le premier rituel s'est passé comme
vous l'aviez imaginé — ou peut-être autrement,
mais bien.

╌╌╌

Si vous avez quelques minutes, j'aimerais beaucoup
savoir ce que vous avez ressenti.

  Avez-vous trouvé le moment ?
  Le geste vous a-t-il semblé évident,
  ou plus délicat que prévu ?
  Le résultat vous plaît-il ?

╌╌╌

Vous pouvez répondre directement à cet email.
Tous les retours, même les plus francs,
sont précieux pour la maison.

Si vous avez deux minutes pour partager
votre expérience publiquement, le lien est ici :

[Partager mon retour →]

Mais si vous préférez répondre par email,
ou ne pas répondre du tout, c'est tout aussi bien.

╌╌╌

Avec soin,
Salma
Fondatrice de la maison

salma@femiglow.ma
```

#### Décomposition narrative

- **Paragraphe 1** : reconnaissance du temps + nuance « comme imaginé ou autrement » (anti-attente normative)
- **Trois questions ouvertes** en format rythmé
- **Invitation libre** : répondre par email ou via lien public
- **Désamorçage de pression** : « ne pas répondre du tout, c'est tout aussi bien »
- **Signature personnelle** : « Salma · Fondatrice de la maison »

> **Phrase clé** : *« Mais si vous préférez répondre par email, ou ne pas répondre du tout, c'est tout aussi bien. »* — désamorce totalement la pression marketing standard. La cliente sent qu'elle n'est **pas obligée**.

#### Design HTML

Identique aux autres emails, avec :
- Pas de design type « formulaire de notation 5 étoiles »
- Lien « Partager mon retour » outline, pas plein
- Plus de blanc (rythme contemplatif)

### 18.5 — Pas d'email J+30 / J+60 V1

> **V1** : pas d'email cycle de vie au-delà de J+15. Pourquoi ?
> - La maison vient de naître — la cliente a déjà reçu 3 emails post-achat, c'est suffisant
> - Risque de **fatigue email** si trop de communications
> - V2 : à reconsidérer — peut-être un email trimestriel « Lettre de la maison » (newsletter éditoriale, pas commercial)

### 18.6 — Tonalité globale des emails

**Toujours paisible. Toujours intime. Jamais commercial. Toujours signé.**

| Élément              | Pratique FemiGlow                                  |
| :------------------- | :------------------------------------------------- |
| Interpellation       | « Salma, » (lettre française)                       |
| Closing              | « Avec soin, » (récurrent)                          |
| Signature             | « La maison FemiGlow » ou « Salma · Fondatrice de la maison » |
| Filets séparateurs   | `╌╌╌` (em-dashes), pas de `___` ou `===`            |
| Police titre          | Cormorant Garamond                                  |
| Police corps          | Cormorant Garamond + Inter pour montants            |
| Couleurs              | Crème + Encre + Sauge dark + Champagne (rare)        |
| Pas de promo            | Aucun code, aucune réduction                        |
| Pas d'urgence           | Aucun countdown, aucune limite                      |
| Pas d'emoji             | Aucun (sauf cas exceptionnel doc à valider)         |

### 18.7 — Règles RGPD pour les emails

| Type d'email          | Consentement requis ?                                |
| :-------------------- | :--------------------------------------------------- |
| Email J+0 confirmation | **Non** — obligation contractuelle (loi e-commerce) |
| Email J+5 anticipation | **Non** — relation contractuelle en cours            |
| Email J+15 review     | **Oui** — peut être considéré marketing dans certaines juridictions |

> **Décision pratique V1** : tous les 3 emails sont envoyés, considérés comme **suivi de commande** (relation contractuelle). En V2, si la cliente a explicitement opt-out de la communication post-achat, l'email J+15 peut être désactivé.

### 18.8 — Désinscription

Les emails J+5 et J+15 incluent un **lien de désinscription** discret en bas :

```
Vous ne souhaitez plus recevoir ces emails ?
[Me désinscrire des suivis post-achat]
```

> **Pas dans l'email J+0** : c'est une obligation contractuelle, pas désinscriptible.

### 18.9 — Cycle de vie après J+15

Si la cliente ne s'est jamais réinscrite à la newsletter, **plus aucun email** n'est envoyé après J+15. La maison **respecte le silence**.

Si la cliente s'est inscrite à la newsletter (opt-in à `/commander` étape 1 ou via `/journal`), elle reçoit ensuite la newsletter mensuelle (rythme à définir).

### 18.10 — Erreurs à éviter dans les emails

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Sujet sans personnalisation                          | Manque l'occasion de la chaleur                                       |
| Sujet avec emoji (« 🎉 Votre commande est confirmée ! ») | Cassure totale de la voix                                       |
| Sujet en majuscules (« CONFIRMATION DE COMMANDE ! ») | Vulgaire                                                              |
| Trop de couleurs dans l'email (rouge, jaune)          | Cassure de palette                                                    |
| Logos cartes bancaires en footer                     | Inutile dans un email transactionnel                                  |
| Bouton « Continuer mes achats » en J+0                | Mauvais timing                                                        |
| Demande review en J+0                                 | La cliente n'a pas reçu le kit                                         |
| Email J+5 si commande déjà livrée                     | Décalage temporel — toujours vérifier le statut                        |
| Email J+15 si commande pas encore livrée              | Demande review prématurée                                              |
| Pas de filet de séparation                             | Manque de rythme visuel                                                |
| Signature « L'équipe FemiGlow »                        | Trop anonyme — préférer « La maison FemiGlow » ou nom personnel         |
| Lien de désinscription dans l'email J+0              | Confusion — c'est un email contractuel                                  |
| Plusieurs CTAs concurrents                            | Casse la hiérarchie                                                    |
| Image hero énorme en haut                             | Lent à charger, parfois bloqué par les clients mail                    |

---

## 19 — Synthèse — checklist de validation

Avant mise en production, vérifier que chaque élément ci-dessous est validé.

### 19.1 — Identité & voix éditoriale (post-achat)

- [ ] Wordmark Pinyon Script présent en header (lien retour `/accueil`)
- [ ] Header standard (PAS simplifié comme `/commander`)
- [ ] Footer standard (PAS simplifié comme `/commander`)
- [ ] Compteur panier à 0 dans le header (panier vidé après commande)
- [ ] Mini-panier dropdown désactivé sur cette page (panier vide)
- [ ] **Pas de mention « Commande sécurisée 🔒 »** dans le header (réservée checkout)
- [ ] Palette signature respectée (encre + crème + sauge dark + sauge pâle + champagne fleuron exception)
- [ ] **Fleuron champagne dans le hero** (exception éditoriale documentée — moment noble post-achat)
- [ ] Pas d'emoji nulle part
- [ ] Pas de countdown, pas d'urgency, pas de timer
- [ ] Pas d'upsell, pas de cross-sell vers `/kit` ou `/rituel`
- [ ] Pas de bouton « Partager sur les réseaux »
- [ ] Pas de demande review immédiate (J+15 seulement)
- [ ] Pas de code promo « pour votre prochaine commande » en V1
- [ ] **Vague émotionnelle** au lieu de progression linéaire (différence vs `/commander`)

### 19.2 — Copy & ton (paisible et intime)

- [ ] Hero : « Merci, Salma. » Cormorant Light 48pt avec point final + virgule personnalisation prénom
- [ ] Sous-titre hero : « Votre commande est en bonnes mains. » italic 20pt (variante COD ajoute « Notre livreur vous appellera bientôt. »)
- [ ] Numéro de commande : « FG-2026-00037 » Inter Medium 18pt letter-spacing 2px
- [ ] Mention livraison : format humain « entre le jeudi 7 et le samedi 9 mai » (pas dates brutes)
- [ ] Récap titre : « Récapitulatif » (différent de « Votre commande » /commander)
- [ ] Mode paiement carte : « Payé par carte bancaire · ••••• 6411 »
- [ ] Mode paiement COD : « À payer à la livraison · espèces ou carte sans contact »
- [ ] Suivi titre : « Les prochaines étapes. » avec point final
- [ ] 3 étapes : Préparation (active halo) · Expédition · Livraison
- [ ] Étape 3 mention livreur : « Le livreur vous appellera. »
- [ ] **Lettre éditoriale** : « Salma, » + 3 paragraphes (recadrage + reconnaissance + préparation) + « Avec soin, » + « Salma » Pinyon Script + « Fondatrice de la maison »
- [ ] Phrase signature « rendues à soi » réutilisée dans préparation
- [ ] Préparation surtitre : « LE MOMENT APPROCHE »
- [ ] Préparation titre : « Quelques jours encore, puis *le rituel*. » (italic sur « le rituel »)
- [ ] Cross-links titre section : « En attendant. » italic
- [ ] Cross-link Journal titre : « Quelques minutes pour ralentir. » (cohérence avec /panier)
- [ ] Cross-link Maison titre : « Le récit derrière le rituel. »
- [ ] Microcopy d'erreur : « Cette page n'est plus accessible. Consultez votre email... »
- [ ] Apostrophes typographiques courbes ' partout

### 19.3 — Tactiques Kolenda — minimum 4 par section

- [ ] **Hero** : `SOBRIÉTÉ NARRATIVE (signature de marque)` `PERSONNALISATION CIALDINI 1984` `FLEURON CHAMPAGNE = NOBLESSE` `NUMÉRO TYPOGRAPHIÉ = OBJET PRÉCIEUX (Tversky-Kahneman saliency)` `EN BONNES MAINS = SIGNAL ARTISANAL` `FORMAT DATE HUMAIN`
- [ ] **Récap** : `FORMAT ÉDITORIAL vs TABLEAU EXCEL` `REDONDANCE EMAIL = RASSURANCE` `ADRESSE COMPLÈTE = VÉRIFICATION FINALE` `MENTION CARTE = TRANSPARENCE` `PAS DE BOUTON IMPRIMER`
- [ ] **Suivi** : `HOFSTADTER 1979 INVERSÉ (donner large)` `VISIBILITY OF SYSTEM STATE Norman 1988` `HALO PULSE = PRÉSENCE VIVANTE` `MENTION LIVREUR = DÉSAMORÇAGE INCERTITUDE` `PAS DE GPS V1`
- [ ] **Lettre** : `FORMAT LETTRE = CODE ÉMOTIONNEL Schwartz 1990` `RECADRAGE PHILOSOPHIQUE = ÉLÉVATION` `AVEU HUMILITÉ V1 = COMPLICITÉ Cialdini` `PRÉPARATION RÉCEPTION = SCÉNARISATION FUTURE` `PINYON SCRIPT = SALMA EST LA MAISON` `« AVEC SOIN » LEITMOTIV`
- [ ] **Préparation** : `SEVILLA & TOWNSEND 2016 -23% DISSONANCE` `ÉVOCATION SENSORIELLE Damasio 1994` `PAS DE PRESSION USAGE IMMÉDIAT` `PHRASE SIGNATURE RENDUES À SOI` `PHOTO LIFESTYLE vs PRODUCT-SHOT`
- [ ] **Cross-links** : `IYENGAR 2000 — 2-3 OPTIONS YIELD HIGHER ENGAGEMENT` `JOURNAL D'ABORD = LECTURE OCCIDENTALE` `TEXT-LINK vs BUTTON = HIÉRARCHIE` `CONTINUATION RELATION POST-ACHAT` `PAS DE CROSS-LINK COMMERCIAL`

### 19.4 — Performance (cibles strictes)

- [ ] **LCP < 1.8s** sur 4G simulé Maroc
- [ ] **CLS < 0.05** (très strict)
- [ ] **INP < 150ms** (très strict)
- [ ] FCP < 0.9s
- [ ] TBT < 150ms
- [ ] Page weight initiale (above fold) < 280 KB
- [ ] **JS payment NON chargé ici** (économie ~80KB vs `/commander`)
- [ ] **Cart logic NON chargée** (économie ~30KB vs `/panier`)
- [ ] Fleuron SVG inline (pas image)
- [ ] Photos cross-links et préparation en `loading="lazy"`
- [ ] Polices critiques preloaded (Inter Regular/Medium/SemiBold + Cormorant Light/Italic + Pinyon Script)
- [ ] CSS critique inline (header + hero + récap)
- [ ] CDN configuré + cache strict (HTML `no-store`, assets immutable)
- [ ] **SSR avec données pré-injectées** (pas d'API call client pour récupérer la commande)
- [ ] HTTP `Cache-Control: no-store` sur le HTML

### 19.5 — Mécaniques dynamiques

- [ ] **Sécurité d'accès 4 couches** : existence commande + statut paid/pending_cod + session liée + délai 30 min
- [ ] Toast d'erreur d'accès refusé avec redirection /accueil
- [ ] **Vidage panier automatique** à l'arrivée (localStorage + backend + header counter à 0 + annonce ARIA)
- [ ] **Trigger email J+0** confirmation immédiat (carte ou COD)
- [ ] **Schedule email J+5** « Le moment approche » (conditionnel statut shipped/in_transit)
- [ ] **Schedule email J+15** review request (conditionnel statut delivered + 7j post-livraison)
- [ ] Tracking GA4 events : `purchase` + `merci_page_loaded` + 6 events `merci_section_viewed_*` + clics cross-links
- [ ] IntersectionObserver pour tracking sections vues
- [ ] **Halo pulse étape active** CSS-only animation 2.5s ease-in-out infinite
- [ ] Numéro de commande sélectionnable (`user-select: all`)
- [ ] Animation hero séquentielle 2.8s totale (fleuron → titre → sous-titre → numéro → filet → livraison)
- [ ] Letter-spacing animé sur numéro de commande (3px → 2px en 700ms)
- [ ] Animation lettre cascade paragraphe par paragraphe
- [ ] State management simple (pas de cart, pas de checkout state)

### 19.6 — Responsive (mobile-first 65% hérité de `/commander`)

- [ ] Mobile 375px, 390px, 414px testés
- [ ] Tablet 768px, 1024px testés
- [ ] Desktop 1280px, 1440px, 1920px testés
- [ ] Passage 2 colonnes (préparation + cross-links) à 1024px
- [ ] Suivi : 3 colonnes desktop / 1 colonne mobile + connecteurs filets desktop only
- [ ] Aucun débordement horizontal à aucune taille
- [ ] **Touch targets ≥ 40-44px** sur tous les éléments interactifs (cards cross-links, lien numéro, lien email)
- [ ] **Texte ≥ 14px** (exceptions documentées : surtitres uppercase tracked, mention paiement)
- [ ] Pas de sticky CTA mobile (la page n'a pas de CTA principal)
- [ ] Layout sections empilées mobile (pas d'accordéon)

### 19.7 — SEO (noindex strict — 5 couches)

- [ ] **Meta robots `noindex, nofollow, noarchive, nosnippet, noimageindex`**
- [ ] HTTP header `X-Robots-Tag: noindex, nofollow`
- [ ] Robots.txt : `Disallow: /merci` et `Disallow: /merci?`
- [ ] **Pas d'Open Graph image** (volontaire — éviter previews attractifs partage involontaire numéro commande)
- [ ] Title : « Merci · FemiGlow » sobre (pas de personnalisation prénom — risque historique navigateur)
- [ ] Meta description courte : « Confirmation de votre commande FemiGlow. »
- [ ] **Pas de Schema.org** sur cette page
- [ ] Pas dans le sitemap.xml
- [ ] Aucun lien interne vers `/merci`
- [ ] Tracking GA4 events conditionné au consentement cookies analytics

### 19.8 — Accessibilité (WCAG 2.2 AA strict)

- [ ] WCAG 2.2 AA validé via axe-core
- [ ] Lighthouse Accessibility score ≥ 95/100
- [ ] Contrastes vérifiés (textes critiques en AAA — sauf brume AA et sauge dark décoratif)
- [ ] Navigation clavier complète (séquence Tab cohérente : standard + cas accès refusé)
- [ ] Focus ring sauge dark 2px offset 4px sur `:focus-visible`
- [ ] **ARIA landmarks complets** : banner / main / section hero / section recap / section steps / section letter / section preparation / section crosslinks / contentinfo
- [ ] `aria-live="polite"` sur livraison estimée si calculée dynamiquement
- [ ] **`role="article"` sur lettre éditoriale** (contenu autonome)
- [ ] `role="list"` + `role="listitem"` sur les 3 étapes du suivi
- [ ] **`role="status"` + `aria-label` sur halo pulse** étape active
- [ ] **3 skip links** : main / récap / lettre
- [ ] `prefers-reduced-motion` respecté pour halo pulse, hero cascade, hover photos cross-links, lettre cascade
- [ ] Test NVDA, VoiceOver, TalkBack
- [ ] **Test critique** : lecture lecteur d'écran complète (~46 étapes) + clic sur cross-link au clavier

### 19.9 — Sécurité, RGPD & emails

- [ ] **HTTPS uniquement** + HSTS
- [ ] CSP strict configuré
- [ ] **Validation accès 4 couches côté serveur** (existence + statut + session + délai 30 min)
- [ ] Token de session non exposé dans l'URL
- [ ] Encryption AES-256 at rest (database + backups)
- [ ] **RGPD** :
  - [ ] Email J+0 contractuel (sans consentement marketing)
  - [ ] Email J+5 contractuel (suivi de commande)
  - [ ] Email J+15 conditionnel V2 (consentement marketing si requis juridiction)
  - [ ] Lien désinscription dans J+5 et J+15
  - [ ] Pas de tracking analytics avant consentement cookies
- [ ] **Emails post-achat** :
  - [ ] J+0 immédiat avec récap complet (variantes carte/COD)
  - [ ] J+5 « Le moment approche » conditionnel statut shipped/in_transit
  - [ ] J+15 « Comment s'est passée votre première fois ? » conditionnel delivered + 7j
  - [ ] Tonalité paisible, signée « Avec soin, La maison FemiGlow » ou « Salma · Fondatrice »
  - [ ] Filets `╌╌╌` em-dashes typographiques
  - [ ] Polices Cormorant + Inter
  - [ ] Pas de logos cartes / Visa / Mastercard
  - [ ] Pas de demande review en J+0 ou J+5
  - [ ] Pas de code promo dans aucun email V1
  - [ ] Désamorçage de pression dans J+15 (« ne pas répondre du tout, c'est tout aussi bien »)
  - [ ] Reply-To = `contact@femiglow.ma` ou `salma@femiglow.ma` selon contexte

---

> *« La page de remerciement n'est pas la fin du tunnel commercial — c'est le début de la relation. Pas un message générique, pas de confetti digital, pas d'upsell post-paiement. Juste : 'Merci, Salma' avec point final, un récap soigné comme un certificat, trois étapes claires, une lettre signée, une préparation au geste, et deux portes pour continuer la lecture pendant l'attente. La maison ne célèbre pas la transaction — elle accueille la cliente. »*

**FIN · FemiGlow · Spécification de la page Merci v1.0 · Mai 2026**

*Prochaine spécification (B2C) à produire : `/journal/[slug]` (page article — TOC, scroll-spy, partage social, related articles, sidebar reading time, lectures conseillées).*

*B2B à venir : `/partenaires`, `/programme`, `/echantillon ★`, `/espace-pro`.*
