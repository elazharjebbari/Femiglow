# Page Contact — `/contact`

> **Univers Transverse · B2C + B2B · Page-fonctionnelle relationnelle** — Document de spécification détaillée
> *Volume XI · Mai 2026 · Complémentaire à la charte graphique et au document d'architecture.*
> *Page accessible depuis le footer de tout le site — moment où la cliente cherche un humain derrière la maison.*

---

## Sommaire

1. [Identité de la page](#1--identité-de-la-page)
2. [Contexte stratégique](#2--contexte-stratégique)
3. [Architecture verticale globale](#3--architecture-verticale-globale)
4. [Header — élément persistant](#4--header--élément-persistant)
5. [Section 01 — Hero d'accueil](#5--section-01--hero-daccueil)
6. [Section 02 — Coordonnées directes](#6--section-02--coordonnées-directes)
7. [Section 03 — Formulaire de contact](#7--section-03--formulaire-de-contact)
8. [Section 04 — FAQ courte](#8--section-04--faq-courte)
9. [Section 05 — Cross-links contextuels](#9--section-05--cross-links-contextuels)
10. [Section 06 — État succès & erreur](#10--section-06--état-succès--erreur)
11. [Footer — élément persistant](#11--footer--élément-persistant)
12. [Comportements transverses](#12--comportements-transverses)
13. [Adaptation responsive](#13--adaptation-responsive)
14. [Performance technique](#14--performance-technique)
15. [SEO & métadonnées](#15--seo--métadonnées)
16. [Accessibilité (a11y)](#16--accessibilité-a11y)
17. [Microcopy & états](#17--microcopy--états)
18. [Sécurité, anti-spam & traitement RGPD](#18--sécurité-anti-spam--traitement-rgpd)
19. [Synthèse — checklist de validation](#19--synthèse--checklist-de-validation)

---

## 1 — Identité de la page

| Attribut             | Valeur                                                                  |
| :------------------- | :---------------------------------------------------------------------- |
| **URL**              | `femiglow.ma/contact`                                                   |
| **Type**             | Page transverse · pont conversationnel                                   |
| **Audience**         | **3 publics** : B2C avant achat (questions produit), B2C après achat (suivi commande), B2B prospect (programme partenaires) |
| **Profil cognitif**  | Variable — curiosité, urgence légère, ou intention professionnelle      |
| **Funnel**           | **Cross-cutting** — accessible depuis le footer de toutes les pages      |
| **Position parcours**| Lien dans le footer global · trust signal `contact@femiglow.ma` cross-page · 404 redirection |
| **Durée d'attention**| 30 secondes à 3 minutes — variable selon intention                       |
| **Device split**     | Mobile 55% · Desktop 40% · Tablet 5%                                      |
| **Update frequency** | Statique — copy en CMS, formulaire connecté à l'inbox `contact@femiglow.ma` |
| **Indexation SEO**   | **Indexable** — `index, follow` (page institutionnelle utile en SERP)   |

### Ce que la page **doit** faire

1. **Identifier rapidement l'intention** de la cliente (avant achat / après achat / pro) via un sélecteur clair.
2. **Adapter le formulaire** à l'intention sélectionnée (champs pertinents seulement, pas de surcharge).
3. **Afficher les coordonnées directes** (email cliquable, mention adresse atelier) pour les clientes qui préfèrent court-circuiter le formulaire.
4. **Répondre aux questions les plus fréquentes** sans formulaire (FAQ rapide intégrée — auto-résolution).
5. **Confirmer l'envoi** de manière claire et chaleureuse (état de succès soigné, pas un toast).
6. **Préserver la voix éditoriale** — pas un Google Form générique, pas Zendesk, pas Intercom.

### Ce que la page **ne doit pas** faire

1. **Imposer un formulaire long et rigide** avec 12 champs obligatoires. La friction tue la conversion conversationnelle.
2. **Cacher l'email direct** derrière le formulaire. Certaines clientes préfèrent ouvrir leur client mail.
3. **Promettre des délais irréalistes** (« Réponse en 5 minutes ! »). La maison promet « Sous 24h ouvrées » et tient parole.
4. **Bombarder de bandeaux promo** (« Newsletter ! », « -10% si vous nous écrivez ! »). Cassure du registre.
5. **Demander le numéro de commande systématiquement.** Une cliente avant achat ne l'a pas.
6. **Forcer la création de compte** avant d'envoyer un message. Tous les envois sont en mode guest.
7. **Captcha agressif** (reCAPTCHA v2 visuel difficile). Préférer reCAPTCHA v3 invisible.
8. **Pop-up de chat live commercial agressif** (« Une question ? Un agent est dispo ! »). Hors registre maison.

### Spécificités techniques de la page

| Spécificité                  | Implication                                                          |
| :--------------------------- | :------------------------------------------------------------------ |
| **Page indexable SEO**       | Title, meta description, Open Graph optimisés                          |
| **Formulaire adaptatif**     | 3 variantes selon intention sélectionnée (champs conditionnels)      |
| **Anti-spam multi-couches**  | reCAPTCHA v3 invisible + honeypot + rate-limiting + validation serveur + délai minimal |
| **Confirmation visuelle**    | État de succès dédié (pas juste un toast)                              |
| **Email transactionnel**     | Auto-réponse à la cliente + alerte interne à l'équipe support          |
| **Pas de chat live V1**      | Email reste le canal principal (V2 : WhatsApp Business à considérer)   |

---

## 2 — Contexte stratégique

### Position dans l'écosystème

```
[ARRIVÉE]                          [PAGE CONTACT /contact]              [SUITE]
    │                                       │                              │
Footer (toutes pages) ────────────►   1. Hero d'accueil              ──►  Email envoyé → /contact?sent=1
Trust signal contact@femiglow.ma ─►   2. Coordonnées directes         ──►  Auto-réponse reçue
Page /commander étape 1 ────────►     3. Formulaire adaptatif         ──►  Réponse support sous 24h
404 page redirection ──────────►      4. FAQ courte                    ──►  Lien direct vers /accueil ou /journal
B2B prospect ──────────────────►      5. Cross-links contextuels       ──►  Conversation continue par email
                                      6. État succès / erreur
                                       │
                                       ↓
                                  Décision (~30s à 3min)
                                       ↓
                                  Envoi formulaire OU mailto:contact@femiglow.ma
                                       ↓
                                  État succès affiché
                                       ↓
                                  Auto-réponse reçue immédiatement
                                       ↓
                                  Réponse personnalisée sous 24h ouvrées
```

### La règle de la conversation ouverte

> Le contact est **le lieu de la conversation ouverte**. Pas un sas administratif, pas un trou noir où les messages disparaissent. La maison prend la parole **comme on prend le téléphone** — avec disponibilité.

C'est pourquoi la page mérite un soin particulier — c'est souvent le **premier vrai contact humain** qu'aura la cliente avec la maison. Si l'expérience contact est froide ou bureaucratique, l'image de la marque est durablement abîmée.

### Tension stratégique fondamentale

`/contact` vit dans une triple tension :

#### Tension 1 — Trois publics, une page

> Une cliente B2C avant achat (questions sur le produit), une cliente B2C après achat (suivi commande), et un professionnel B2B (programme partenaires) ont **des besoins très différents**. Mais une page Contact unique doit servir les trois sans devenir un labyrinthe.

**Résolution** : un **sélecteur de Type de demande** au début du formulaire (3 options dropdown) qui adapte les champs ci-dessous. La page reste **structurée** pour chaque public, sans création de pages séparées.

#### Tension 2 — Friction du formulaire vs qualité du support

> Plus le formulaire est court, plus la cliente envoie. Mais moins elle en dit, plus le support doit faire d'allers-retours. Inversement, un formulaire long décourage l'envoi mais permet une première réponse complète.

**Résolution** : un formulaire **adapté à chaque intention** — minimal pour B2C avant achat (3 champs principaux), plus complet pour suivi commande (4 champs avec numéro), plus structuré pour B2B (5-6 champs avec contexte business). Toujours dans la limite du raisonnable.

#### Tension 3 — Voix éditoriale vs efficacité fonctionnelle

> Un formulaire de contact doit **fonctionner** (validation, envoi, retour). Mais la page entière doit garder la voix de la maison — sobre, soignée, jamais corporate.

**Résolution** : composants fonctionnels **typographiés à la signature FemiGlow** — Cormorant pour les titres, Inter pour les champs, palette signature partout. Pas de placeholders type « Saisissez votre nom ici » mais des labels propres. Pas de bouton « Submit » mais « Envoyer mon message ».

### Architecture émotionnelle

| Étape                          | Émotion d'entrée    | Émotion de sortie       | Mouvement intérieur                  |
| :----------------------------- | :------------------ | :---------------------- | :----------------------------------- |
| Arrivée sur `/contact`          | Hésitation, question  | Reconnaissance           | « Ils acceptent qu'on leur écrive »  |
| Lecture du hero                 | Curiosité           | Apaisement                | « C'est une vraie maison, pas un bot » |
| Vue des coordonnées             | Vérification        | Crédibilité                | « Ils donnent leur email en clair »  |
| Choix du type de demande        | Réflexion           | Clarification             | « Voilà ma situation »                |
| Remplissage du formulaire       | Concentration       | Investissement            | « Je formule mon besoin »             |
| Envoi                           | Vigilance            | Soulagement                | « C'est parti »                       |
| Confirmation                    | Attente               | Confiance                 | « Ils ont reçu, ils vont répondre »   |

### KPIs cibles

| Métrique                                          | Cible                            | Source                       |
| :------------------------------------------------ | :------------------------------- | :--------------------------- |
| **Taux de complétion du formulaire**               | **> 65%** (très bon)             | GA4 funnel                   |
| Taux d'abandon en cours de remplissage             | < 20%                             | GA4 events                   |
| Taux de clic sur l'email direct (au lieu du formulaire) | 25-35% (sain — choix offert)| GA4 events                   |
| Temps moyen sur la page                           | 60s à 2min (médiane ~90s)         | GA4                          |
| Taux d'ouverture auto-réponse                     | > 85% (très haut transactionnel)  | Email automation analytics   |
| **Délai moyen de réponse support**                  | **< 24h ouvrées** (engagement maison) | Helpdesk ou inbox metrics |
| Taux de spam reçu                                  | < 5% (anti-spam efficace)         | Logs serveur                  |
| Taux de satisfaction réponse (NPS V2)              | > 8/10                            | Email follow-up V2            |
| LCP                                               | < 1.8s                           | Web Vitals                   |
| CLS                                               | < 0.05                           | Web Vitals                   |
| INP                                               | < 200ms (formulaire input fields) | Web Vitals                   |

> **Pourquoi un taux de complétion > 65% est la cible ?** Parce que les utilisateurs qui arrivent sur `/contact` ont déjà une **intention forte** (ils cherchaient le contact). Tout taux d'abandon > 35% est un signal de **friction** dans le formulaire.

### Le profil unique de chaque public

#### Public 1 — B2C avant achat

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **Intention**                     | Curiosité, hésitation, besoin de clarification                    |
| **Connaissance produit**          | Partielle — vient peut-être juste de découvrir le site             |
| **Patience**                      | Variable — souvent moment exploratoire                              |
| **Données disponibles**           | Email, prénom, question — **pas de numéro de commande**            |
| **Type de questions**             | Ingrédients, allergies, mode d'usage, livraison, prix, paiement     |
| **Délai attente acceptable**      | 24-48h ouvrées                                                      |

#### Public 2 — B2C après achat (suivi commande)

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **Intention**                     | Besoin de suivi, modification, problème livraison                  |
| **Connaissance produit**          | Forte — a acheté ou est dans l'attente                             |
| **Patience**                      | Faible si problème (livraison en retard, casse)                     |
| **Données disponibles**           | Email, prénom, **numéro de commande FG-2026-XXXXX**                 |
| **Type de questions**             | Statut livraison, modification adresse, retour, casse, garantie     |
| **Délai attente acceptable**      | < 24h ouvrées (urgence relative)                                    |

#### Public 3 — B2B prospect (programme partenaires)

| Caractéristique                   | Valeur                                                           |
| :-------------------------------- | :--------------------------------------------------------------- |
| **Intention**                     | Information sur le programme partenaires, conditions, échantillon  |
| **Connaissance produit**          | Variable — souvent professionnel beauté curieux                     |
| **Patience**                      | Forte — décision business, pas urgence                              |
| **Données disponibles**           | Email pro, nom, **nom du salon/entreprise**, **rôle**, **téléphone obligatoire** |
| **Type de questions**             | Tarification dégressive, minimum commande, échantillon, formation    |
| **Délai attente acceptable**      | 48-72h ouvrées (process B2B)                                         |

> **Trois profils, trois besoins** : la page doit reconnaître cette diversité sans créer trois pages distinctes. Le sélecteur de Type de demande résout cette tension.

### Spécificités du contact dans le e-commerce marocain

| Spécificité                  | Implication                                                          |
| :--------------------------- | :------------------------------------------------------------------ |
| **WhatsApp culturel**        | Beaucoup de clientes attendent un canal WhatsApp (V2 à considérer — Business API) |
| **Email moins systématique** | Certaines clientes n'utilisent l'email que rarement — d'où importance de la clarté |
| **Confiance par contact direct** | Voir un email humain (`contact@femiglow.ma`, pas `noreply@`) **construit la confiance** |
| **Téléphone (V2)**           | Cas spécifique — pas en V1 (équipe trop petite). En V2, ligne dédiée  |
| **Adresse physique**         | Mention adresse atelier — signal de réalité physique                  |
| **Horaires ouvrés**          | Mention « Réponse sous 24h ouvrées » + indication implicite des jours fériés |

### Les six fonctions de `/contact`

#### Fonction 1 — Identification rapide (sélecteur Type de demande)

Permettre à la cliente de **se reconnaître** dans une des trois catégories en 5 secondes maximum.

#### Fonction 2 — Formulaire adapté (capture qualifiée)

Présenter le **bon formulaire** pour son intention, ni trop court (manque d'info pour répondre) ni trop long (friction).

#### Fonction 3 — Coordonnées directes (court-circuit)

Pour les clientes qui préfèrent ouvrir leur client mail, l'email **est visible et cliquable**. Pas de monopole du formulaire.

#### Fonction 4 — FAQ rapide (auto-résolution)

Pour les questions les plus fréquentes, une **réponse immédiate** sans formulaire. Réduit le volume support et satisfait la cliente.

#### Fonction 5 — Confirmation rassurante (post-envoi)

Après envoi, une **page de succès** qui confirme la prise en charge et donne les prochaines étapes.

#### Fonction 6 — Préservation de la voix éditoriale

Toute la page reste **dans le ton FemiGlow** — pas un Google Form générique, pas Zendesk visible, pas Intercom widget. La maison gère son contact à sa façon.

### Différence avec une page contact e-commerce standard

| Élément standard e-commerce        | FemiGlow `/contact` choix                              |
| :--------------------------------- | :----------------------------------------------------- |
| Formulaire unique 8 champs           | Formulaire adaptatif 3-6 champs selon intention          |
| Captcha visuel reCAPTCHA v2          | reCAPTCHA v3 invisible + honeypot                       |
| Bouton « Send » ou « Submit »        | « Envoyer mon message »                                  |
| Message de succès « Message sent! »  | Page de succès soignée avec voix éditoriale              |
| Pas de coordonnées visibles          | Email cliquable + adresse atelier visibles               |
| Chat live widget intrusif (Intercom) | Pas de chat V1 — email est le canal                     |
| Pop-up newsletter au load            | Pas de pop-up — newsletter dans footer comme partout     |
| FAQ longue inline                     | FAQ rapide 4 questions max — pas plus                    |
| Champ « Sujet » à choisir dans liste  | Pas de sujet — l'intention est captée par le sélecteur Type |
| Numéros de commande mal validés       | Validation regex `FG-XXXX-XXXXX` côté client + serveur   |
| Réponse par email standard           | Auto-réponse soignée + réponse personnalisée signée       |
| « Notre équipe vous répondra »        | « Salma ou notre équipe vous répondra... »                |
| Logos de support (Zendesk, Intercom)  | Aucun — la maison parle en son nom                       |

> **La sobriété structurelle est stratégique** : moins de formulaires, plus de qualité dans la conversation. La cliente sent qu'elle écrit à **une maison**, pas à un système de tickets.

---

## 3 — Architecture verticale globale

### 3.1 — Vue d'ensemble (desktop ≥ 1024px)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║   HEADER — Wordmark · Menu · Compteur panier (≥ 0)                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   01 — HERO D'ACCUEIL                                                         ║
║   Fond crème uni · Titre Cormorant 40pt · Sous-titre italic · Email cité     ║
║                                                                              ║
║                                                                              ║
║   02 — COORDONNÉES DIRECTES                                                   ║
║   Fond crème · Email cliquable mailto: · Adresse atelier · Délai 24h         ║
║                                                                              ║
║                                                                              ║
║   03 — FORMULAIRE DE CONTACT (avec sélecteur Type de demande)                 ║
║   Fond sauge pâle · Sélecteur 3 options · Champs adaptés · Bouton envoyer     ║
║                                                                              ║
║                                                                              ║
║   04 — FAQ COURTE                                                             ║
║   Fond crème · 4 questions accordéon · Phrase de clôture italic              ║
║                                                                              ║
║                                                                              ║
║   05 — CROSS-LINKS CONTEXTUELS                                                ║
║   Fond crème · "En attendant notre réponse." · Journal + Maison              ║
║                                                                              ║
║                                                                              ║
║   06 — ÉTAT SUCCÈS / ERREUR (post-envoi, remplace formulaire)                 ║
║   Fond crème · Fleuron champagne · "Votre message est parti." · CTA accueil  ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║   FOOTER — Item Contact actif · Newsletter · Mentions · Réseaux               ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 3.2 — Hauteurs verticales par section (desktop)

| Section                                | Hauteur (desktop)     | Justification                          |
| :------------------------------------- | :-------------------- | :------------------------------------- |
| Header                                 | 80px                  | Standard global du site                  |
| 01 — Hero d'accueil                     | 320px                 | Hero typographique sobre                  |
| 02 — Coordonnées directes               | ~ 280px               | Section informationnelle compacte         |
| 03 — Formulaire de contact              | ~ 720-900px (variable selon type) | Formulaire adaptatif         |
| 04 — FAQ courte                          | ~ 480-600px (variable selon items ouverts) | FAQ accordéon         |
| 05 — Cross-links contextuels             | 360px                 | 2 cards en ligne                          |
| 06 — État succès / erreur (post-envoi)    | 600px (min)           | Page de confirmation soignée               |
| Footer                                 | ~ 280px               | Standard global                            |
| **Total page (avant succès)**           | **~ 2540-2820px**     | Scroll fluide, pas excessivement long     |
| **Total page (état succès)**            | **~ 1660px**          | Page recentrée sur la confirmation         |

### 3.3 — Hauteurs verticales par section (mobile)

| Section                                | Hauteur (mobile)      |
| :------------------------------------- | :-------------------- |
| Header                                 | 64px                  |
| 01 — Hero d'accueil                     | 240px                 |
| 02 — Coordonnées directes               | 320px                 |
| 03 — Formulaire de contact              | ~ 880-1080px          |
| 04 — FAQ courte                          | 540-700px             |
| 05 — Cross-links contextuels             | ~ 720px (cards empilées) |
| Footer                                 | ~ 480px               |
| **Total page (avant succès)**           | **~ 3260-3520px**     |

### 3.4 — Backgrounds par section

| Section                                | Background                          |
| :------------------------------------- | :---------------------------------- |
| Header                                 | `#FBF8F1` (Crème) avec border-bottom subtle |
| 01 — Hero d'accueil                     | `#FBF8F1` (Crème) uni                |
| 02 — Coordonnées directes               | `#FBF8F1` (Crème) uni                |
| 03 — Formulaire de contact              | `#E8EFE7` (Sauge pâle) — moment d'engagement |
| 04 — FAQ courte                          | `#FBF8F1` (Crème) uni                 |
| 05 — Cross-links contextuels             | `#FBF8F1` (Crème) uni                  |
| 06 — État succès / erreur                 | `#FBF8F1` (Crème) uni                  |
| Footer                                 | `#FBF8F1` (Crème) avec border-top subtle |

> **Règle confirmée des moments d'engagement** : le formulaire (section 03) est sur fond sauge pâle — cohérent avec toutes les sections d'engagement du site (étapes du rituel, formulaires de checkout, suivi de commande).

### 3.5 — Filets de séparation

Aucun filet horizontal entre sections — les changements de background suffisent visuellement. Les seules zones avec filets sont :
- Header : `border-bottom: 1px solid #E8E0D2` (Ligne)
- Footer : `border-top: 1px solid #E8E0D2`
- Filets internes : à l'intérieur des cards (FAQ items, formulaire dividers)

### 3.6 — Largeur max contenu

| Section                                | Max-width             |
| :------------------------------------- | :-------------------- |
| Hero, Coordonnées, FAQ                 | 800px                 |
| Formulaire                              | 720px                 |
| Cross-links                             | 1200px                |
| État succès                             | 720px                 |

> **Largeur formulaire 720px** : cohérent avec `/commander` (formulaires de checkout) — confort de lecture et de saisie.

### 3.7 — Densité visuelle

> **Page éditoriale fonctionnelle** : densité moyenne. Plus chargée que `/accueil` (purement éditoriale), moins dense que `/commander` (utilitaire). Équilibre entre **respiration** et **efficacité**.

---

## 4 — Header — élément persistant

### 4.1 — Structure héritée

Le header de `/contact` est **identique** à celui de toutes les pages B2C standard (`/accueil`, `/rituel`, `/kit`, `/journal`, `/maison`).

> **Pas de version simplifiée** comme sur `/commander` (où le menu est masqué pour focus checkout). `/contact` est une page transverse — la cliente peut vouloir naviguer ailleurs si elle change d'avis.

### 4.2 — Spécificités sur `/contact`

| Différence                | Spécification                                                       |
| :------------------------ | :------------------------------------------------------------------ |
| **Item « Contact »**      | **PAS dans le menu principal** du header (réservé au footer)          |
| **Compteur panier**       | Affiché normalement (peut être > 0 si la cliente vient avec un panier en cours) |
| **Mini-panier dropdown**   | Actif si compteur > 0                                                  |
| **Mention « sécurisé »**  | Aucune (réservée à `/commander`)                                       |
| **Wordmark**              | Lien retour `/accueil` (cohérent toutes pages)                          |

### 4.3 — Pourquoi pas de Contact dans le menu principal ?

> **Décision design** : le menu principal contient les pages **discoveries** (Maison · Rituel · Kit · Journal). Le footer contient les pages **utilities** (Contact · CGV · Mentions · Confidentialité).

Cette distinction préserve la **lisibilité du menu principal** (4 items max, ratio Miller 1956) tout en gardant `/contact` **toujours accessible** depuis le footer global.

### 4.4 — Comportement du compteur panier

Si la cliente arrive sur `/contact` avec un panier en cours (compteur > 0) :
- Le compteur reste affiché normalement
- Le mini-panier dropdown est actif au hover
- Aucune incitation à compléter la commande (pas de bandeau « Vous avez 1 article en panier ! »)

> **Respect du moment** : la cliente vient pour écrire, pas pour acheter. Le panier est **disponible** mais pas **mis en avant**.

### 4.5 — Tactiques héritées

Toutes les tactiques héritées du header global (`PERMANENCE EXCLUSIVE`, `FRICTION ZÉRO`, `CONFIANCE PERMANENTE`, `RETOUR ACCUEIL`) restent en place.

### 4.6 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Header simplifié (comme `/commander`)               | `/contact` est transverse, pas en tunnel checkout                    |
| Item « Contact » dans le menu principal              | Cassure de la distinction discoveries/utilities                       |
| Compteur panier masqué                                | Friction si la cliente veut revenir au panier                          |
| Mention « 24h ouvrées » dans le header                | Hors registre — réservée au hero et au formulaire                     |
| Bandeau « Besoin d'aide ? Contact ! »                  | Redondant — la cliente est déjà sur Contact                            |

---

## 5 — Section 01 — Hero d'accueil

### 5.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                                                                            │
│                                Contact.                                    │
│                                                                            │
│         Une question, un suivi, une demande professionnelle ?             │
│                                                                            │
│         Vous pouvez nous écrire directement à contact@femiglow.ma         │
│                            ou utiliser le formulaire ci-dessous.           │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              (fond crème uni)
```

### 5.2 — Pourquoi un hero typographique sobre (sans fleuron, sans photo) ?

> Le hero `/contact` est **fonctionnel** — la cliente vient pour écrire un message. Un fleuron champagne (réservé aux moments éditoriaux nobles : `/merci`, état panier vide, état succès `/contact`) ne serait pas justifié ici.

> Une photo lifestyle (« femme souriante au téléphone ») serait **vulgaire** — banal du e-commerce. La maison fait confiance à la **typographie pure** pour exprimer l'invitation.

### 5.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 320px (desktop) · 280px (tablet) · 240px (mobile)                |
| Padding vertical       | 96px / 64px (haut/bas desktop)                                    |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Largeur max contenu    | 800px                                                             |
| Alignement             | Centré horizontalement                                            |

### 5.4 — Titre

```
Contact.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light                                     |
| Taille          | 40pt (desktop) · 34pt (tablet) · 28pt (mobile)                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Letter-spacing  | -0.5px (réduction subtile pour Cormorant)                      |
| Alignement      | Centré                                                        |
| Espacement bas  | 32px                                                           |

> **« Contact. »** — un mot, point final. La maison **n'embellit pas** ce qui est purement fonctionnel. Le titre dit ce qu'il est : la page Contact. Cohérence avec « Récapitulatif » ou « Les prochaines étapes. » de `/merci` — la sobriété **est** le style.

### 5.5 — Sous-titre questionnant

```
Une question, un suivi, une demande professionnelle ?
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 18pt (desktop) · 17pt (tablet) · 16pt (mobile)                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Alignement      | Centré                                                        |
| Largeur max     | 640px                                                         |
| Line-height     | 1.5                                                          |
| Espacement bas  | 24px                                                           |

> **Sous-titre interrogatif** : trois publics évoqués en une phrase, sous forme de **question ouverte**. La cliente **se reconnaît** dans une des trois catégories. Pas de hiérarchisation — les trois sont mis sur le même plan.

> **Italic** : signal éditorial — c'est la maison qui parle, pas un titre fonctionnel sec.

### 5.6 — Phrase d'invitation (avec email cité)

```
Vous pouvez nous écrire directement à contact@femiglow.ma
ou utiliser le formulaire ci-dessous.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre) pour le texte, `#A8C4A6` (Sauge dark) pour le lien email |
| Lien email      | `mailto:contact@femiglow.ma` underline 1px sauge dark, offset 4px |
| Alignement      | Centré                                                        |
| Largeur max     | 720px                                                         |
| Line-height     | 1.6                                                          |

> **Email cité dès le hero** : pas d'obfuscation, pas de « Voir notre email ». L'adresse est en clair, cliquable. Choix philosophique fort : la maison **ne cache rien**.

> **« ou utiliser le formulaire ci-dessous »** : indique l'alternative pratique. Pas de monopole du formulaire — la cliente choisit son canal.

### 5.7 — Tokens design

```css
/* ─── Hero d'accueil — tokens ─── */
--hero-bg: #FBF8F1;
--hero-height-desktop: 320px;
--hero-height-mobile: 240px;
--hero-padding-top-desktop: 96px;
--hero-padding-bottom-desktop: 64px;
--hero-content-max-width: 800px;

--hero-title-font: 'Cormorant Garamond', serif;
--hero-title-weight: 300;
--hero-title-size-desktop: 40pt;
--hero-title-size-mobile: 28pt;
--hero-title-color: #2C2A28;
--hero-title-letter-spacing: -0.5px;
--hero-title-margin-bottom: 32px;

--hero-subtitle-font: 'Cormorant Garamond', serif;
--hero-subtitle-style: italic;
--hero-subtitle-weight: 300;
--hero-subtitle-size-desktop: 18pt;
--hero-subtitle-size-mobile: 16pt;
--hero-subtitle-color: #4A4844;
--hero-subtitle-line-height: 1.5;
--hero-subtitle-max-width: 640px;
--hero-subtitle-margin-bottom: 24px;

--hero-invitation-font: 'Cormorant Garamond', serif;
--hero-invitation-size-desktop: 16pt;
--hero-invitation-size-mobile: 15pt;
--hero-invitation-color: #2C2A28;
--hero-invitation-line-height: 1.6;
--hero-invitation-max-width: 720px;
--hero-invitation-link-color: #A8C4A6;
--hero-invitation-link-underline-offset: 4px;
```

### 5.8 — Comportements UX

#### Animation au chargement

```
[t=0ms]      → HTML loaded
[t=200ms]    → Titre fade-in (500ms)
[t=500ms]    → Sous-titre fade-in (500ms)
[t=800ms]    → Phrase d'invitation fade-in (500ms)
[t=1300ms]   → Animation hero terminée
```

> **Animation 1.3s totale** : plus rapide que les heros éditoriaux (`/merci`, `/journal`) car page fonctionnelle. Mais reste fluide pour ne pas paraître sec.

#### Hover sur le lien email

```css
.hero-email-link {
  color: #A8C4A6;
  text-decoration: underline;
  text-decoration-color: #A8C4A6;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
  transition: color 200ms;
}

.hero-email-link:hover {
  color: #2C2A28;
  text-decoration-color: #2C2A28;
}
```

#### Click sur le lien email

Ouvre le client mail par défaut avec l'adresse pré-remplie (`mailto:contact@femiglow.ma`). Pas de sujet pré-rempli en V1 (laisser la cliente formuler librement).

> **V2** : possible pré-remplissage du sujet selon la page d'origine — `?subject=Question%20depuis%20%2Fkit` etc. À tester.

### 5.9 — Comportement avec query string `?type=order`

Si la cliente arrive avec `/contact?type=order` (depuis un email transactionnel par exemple) :
- Le hero reste **identique** (pas de personnalisation)
- Le sélecteur Type de demande dans la section 03 est **pré-sélectionné** sur « Suivi de commande »
- Les champs conditionnels (numéro de commande) apparaissent automatiquement

> Subtilité : la cliente **comprend** sans surcharge informationnelle. Le hero reste sobre.

### 5.10 — Tracking GA4

| Événement                            | Trigger                                              |
| :----------------------------------- | :--------------------------------------------------- |
| `contact_page_viewed`                 | Page load                                              |
| `contact_email_direct_clicked`        | Click sur le lien email du hero                         |
| `contact_hero_visible`                 | IntersectionObserver à 50%                            |

### 5.11 — Psychologie

#### 1. Sobriété structurelle = signal de confiance

> **Cialdini 1984 (Influence)** : *« Visibility of channels of recourse builds trust. »*
> 
> Un hero sobre avec **email visible en clair** signale que la maison **n'a rien à cacher**. Cela construit une confiance forte avant même que la cliente n'ait écrit son message.

#### 2. Question ouverte = inclusion

> **« Une question, un suivi, une demande professionnelle ? »** — la cliente est **incluse** quel que soit son profil. Pas de tri excluant en amont.

#### 3. Email cité dans le hero

> Décision philosophique : la maison **donne son email** dans la première ligne visible. C'est un **acte de réciprocité** (Cialdini) — la maison se rend joignable, la cliente sera plus encline à partager ses coordonnées.

#### 4. « Ou utiliser le formulaire ci-dessous » = liberté de choix

> **Iyengar 2000** : *« Choice between 2-3 well-defined options yields higher engagement than a single forced path. »*
> 
> En proposant **deux canaux**, la maison respecte les préférences de la cliente. Certaines préfèrent l'email direct, d'autres le formulaire structuré.

### 5.12 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du titre | Reconnaissance fonctionnelle — « OK, c'est la page Contact »      |
| Vue du sous-titre | Inclusion — « Je me reconnais dans une de ces situations »   |
| Vue de la phrase d'invitation | Surprise positive — « Ils donnent leur email en clair » |
| Click sur email OU scroll vers formulaire | Liberté de choix                              |

### 5.13 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Titre « Nous contacter » ou « Contactez-nous »       | Verbe d'action — préférer le nom (Contact)                            |
| Titre « Comment pouvons-nous vous aider ? »          | Vulgaire e-commerce                                                   |
| Photo de support souriant                              | Cassure de palette + cliché                                          |
| Fleuron champagne dans le hero                          | Pas justifié — réservé aux moments nobles (état succès)               |
| Email obfusqué (`contact[at]femiglow[dot]ma`)         | Cassure de la philosophie — la maison ne cache rien                    |
| Sous-titre commercial (« Notre équipe à votre service ! ») | Banal                                                              |
| Mention « Réponse en 5 minutes ! »                    | Promesse intenable — préférer 24h ouvrées tenu                       |
| Bouton CTA dans le hero (« Écrivez-nous ! »)           | Redondant avec le formulaire ci-dessous                                |
| Chat live widget bottom-right                            | Hors registre maison                                                    |
| Animation parallax                                       | Coûteuse pour rien                                                       |
| Texte aligné à gauche                                    | Le hero typographique est centré                                          |

---

## 6 — Section 02 — Coordonnées directes

### 6.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│                            Pour nous écrire.                               │
│                                                                            │
│                                                                            │
│                                                                            │
│                          contact@femiglow.ma                                │
│                                                                            │
│                                                                            │
│                       Réponse sous 24 heures ouvrées.                      │
│                                                                            │
│                                                                            │
│                          ─────────────────────                              │
│                                                                            │
│                                                                            │
│                          Atelier — Casablanca                               │
│                                                                            │
│                       12 Rue de l'Atelier, Apt 4B                          │
│                          Quartier Maârif                                    │
│                       Casablanca 20100, Maroc                              │
│                                                                            │
│                                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                              (fond crème uni)
```

### 6.2 — Pourquoi afficher les coordonnées directes en plus du formulaire ?

> **Trois raisons stratégiques** :
> 
> 1. **Liberté de canal** — certaines clientes préfèrent ouvrir leur client mail (Gmail, Apple Mail, Outlook) plutôt que de remplir un formulaire web. Elles savent où sont leurs emails archivés, peuvent répondre, conserver l'historique.
> 
> 2. **Confiance par transparence** — une maison qui donne son email **en clair** (pas obfusqué, pas caché derrière un formulaire) signale qu'elle est joignable. C'est un **acte de réciprocité** (Cialdini 1984).
> 
> 3. **Adresse physique = signal de réalité** — l'adresse de l'atelier (même si pas un magasin de retail) prouve qu'il y a un **lieu physique** derrière la marque. Anti-arnaque, anti-dropshipping anonyme.

### 6.3 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni, continuité avec hero                    |
| Hauteur                | ~ 280px (desktop) · 320px (mobile, plus haut car empilement)      |
| Padding vertical       | 96px (haut) · 96px (bas — espacement avant section formulaire)   |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 800px                                                             |
| Alignement             | Centré horizontalement                                            |

### 6.4 — Titre de la section

```
Pour nous écrire.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 28pt (desktop) · 24pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 48px                                                 |

> **« Pour nous écrire. »** — formulation directe, point final. Pas « Comment nous joindre ? » (interrogation inutile) ni « Nos coordonnées » (administratif). Verbe à l'infinitif comme **action ouverte**.

### 6.5 — Email cliquable

```
contact@femiglow.ma
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Inter Regular                                                 |
| Taille          | 24pt (desktop) · 20pt (mobile)                                |
| Couleur         | `#2C2A28` (Encre)                                            |
| Alignement      | Centré                                                        |
| Lien            | `mailto:contact@femiglow.ma`                                  |
| Underline       | 1.5px sauge dark, offset 6px                                  |
| Espacement bas  | 24px                                                           |

> **Inter (sans-serif) plutôt que Cormorant** : volontairement, l'email est en **typographie technique** — pas un texte éditorial mais une **donnée utile**. Cohérent avec les numéros de commande.

> **Underline persistant** (pas seulement au hover) : signal fort de cliquabilité. La cliente sait immédiatement que c'est un lien.

### 6.6 — Mention délai

```
Réponse sous 24 heures ouvrées.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Light Italic                              |
| Taille          | 15pt (desktop) · 14pt (mobile)                                |
| Couleur         | `#6B6863` (Brume)                                            |
| Alignement      | Centré                                                        |
| Espacement bas  | 64px                                                           |

> **Engagement public** : la maison **promet** un délai et **s'engage** à le tenir. C'est un signal de fiabilité.

> **« Ouvrées »** : précision importante (lundi-vendredi, hors fériés). Évite les malentendus si la cliente écrit un samedi.

### 6.7 — Filet de séparation

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Forme           | Filet horizontal pointillé                                     |
| Largeur         | 32px                                                           |
| Couleur         | `#A8C4A6` (Sauge dark)                                        |
| Épaisseur       | 1px                                                            |
| Espacement      | 32px haut + 32px bas                                            |
| Alignement      | Centré                                                          |

> **Filet sauge dark** : sépare visuellement le bloc « Email » du bloc « Adresse atelier ». Cohérent avec les filets utilisés sur `/merci`.

### 6.8 — Adresse atelier

#### Surtitre

```
Atelier — Casablanca
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold                                       |
| Taille         | 8pt                                                  |
| Letter-spacing | 2.5px                                                |
| Transformation | Uppercase                                            |
| Couleur        | `#6B6863` (Brume)                                    |
| Alignement     | Centré                                                |
| Espacement bas | 16px                                                   |

#### Adresse complète

```
12 Rue de l'Atelier, Apt 4B
Quartier Maârif
Casablanca 20100, Maroc
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular                                   |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Line-height     | 1.6                                                          |
| Alignement      | Centré                                                        |

> **Adresse fictive en V1** : à remplacer par la vraie adresse de l'atelier au lancement. Format adresse marocaine standard.

> **Pas de carte Google Maps en V1** : alourdit la page, dégrade les performances, pose des questions RGPD (cookies tiers Google). V2 si demande utilisateur. La cliente peut copier l'adresse pour la chercher elle-même.

### 6.9 — Pas de téléphone V1

> **Décision V1** : pas de numéro de téléphone affiché. La maison est encore petite — promettre un téléphone joignable serait intenable.

> **V2** : ligne dédiée `+212 5 XX XX XX XX` (fixe Casablanca) avec horaires « Lundi-Vendredi 9h-18h ». À ajouter quand l'équipe support sera dimensionnée.

### 6.10 — Pas de WhatsApp V1

> **V2 envisageable** : WhatsApp Business avec lien `wa.me/212XXXXXXXXX`. Très utilisé au Maroc. Mais nécessite une équipe dédiée à la réactivité — pas en V1.

### 6.11 — Tokens design

```css
/* ─── Coordonnées directes — tokens ─── */
--coords-bg: #FBF8F1;
--coords-padding-vertical: 96px;
--coords-content-max-width: 800px;

--coords-title-font: 'Cormorant Garamond', serif;
--coords-title-weight: 300;
--coords-title-size-desktop: 28pt;
--coords-title-size-mobile: 24pt;
--coords-title-color: #2C2A28;
--coords-title-margin-bottom: 48px;

--coords-email-font: 'Inter', sans-serif;
--coords-email-size-desktop: 24pt;
--coords-email-size-mobile: 20pt;
--coords-email-color: #2C2A28;
--coords-email-underline-color: #A8C4A6;
--coords-email-underline-thickness: 1.5px;
--coords-email-underline-offset: 6px;
--coords-email-margin-bottom: 24px;

--coords-delay-font: 'Cormorant Garamond', serif;
--coords-delay-style: italic;
--coords-delay-weight: 300;
--coords-delay-size-desktop: 15pt;
--coords-delay-color: #6B6863;
--coords-delay-margin-bottom: 64px;

--coords-divider-color: #A8C4A6;
--coords-divider-width: 32px;
--coords-divider-thickness: 1px;
--coords-divider-margin-vertical: 32px;

--coords-atelier-kicker-font: 'Inter', sans-serif;
--coords-atelier-kicker-weight: 600;
--coords-atelier-kicker-size: 8pt;
--coords-atelier-kicker-letter-spacing: 2.5px;
--coords-atelier-kicker-transform: uppercase;
--coords-atelier-kicker-color: #6B6863;
--coords-atelier-kicker-margin-bottom: 16px;

--coords-address-font: 'Cormorant Garamond', serif;
--coords-address-size-desktop: 16pt;
--coords-address-color: #4A4844;
--coords-address-line-height: 1.6;
```

### 6.12 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → titre fade-in (500ms)
[atteint 70%]             → email fade-in + translate-up 8px (700ms)
[atteint 60%]             → mention délai fade-in (500ms)
[atteint 50%]             → filet animation draw (400ms)
[atteint 40%]             → bloc atelier fade-in (700ms)
```

#### Hover sur l'email

```css
.coords-email-link {
  color: #2C2A28;
  text-decoration: underline;
  text-decoration-color: #A8C4A6;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 6px;
  transition: text-decoration-color 200ms;
}

.coords-email-link:hover {
  text-decoration-color: #2C2A28;
}
```

#### Click sur l'email

Ouvre le client mail par défaut avec `mailto:contact@femiglow.ma`. Tracking GA4 `contact_email_direct_clicked` event.

### 6.13 — Tracking GA4

| Événement                            | Trigger                                              |
| :----------------------------------- | :--------------------------------------------------- |
| `contact_coords_section_viewed`       | IntersectionObserver à 50%                           |
| `contact_email_direct_clicked`        | Click sur l'email cliquable                            |

### 6.14 — Psychologie

#### 1. Email visible = transparence absolue

> Une maison qui **cache son email** signale qu'elle ne veut pas être contactée facilement. La maison FemiGlow fait l'inverse : elle expose son email **en grand**, en haut de la section. Acte de **disponibilité**.

#### 2. Délai annoncé = engagement public

> **« 24 heures ouvrées »** est un **engagement public**. La maison se met en risque (si elle ne tient pas, la cliente sera déçue). Cette mise en risque construit la **crédibilité** (Cialdini 1984 — engagement and consistency).

#### 3. Adresse atelier = preuve de réalité

> Beaucoup de pure-players e-commerce n'ont **aucune adresse physique** visible. Afficher l'adresse de l'atelier est un **anti-signal de fraude** — la maison est ancrée dans un lieu réel.

#### 4. Filet de séparation = respiration

> Le filet sauge dark **structure visuellement** la section en deux blocs distincts : « comment nous écrire » et « où nous sommes ». Aide à la lecture séquentielle.

### 6.15 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du titre | Curiosité — « voyons leurs coordonnées »                          |
| Vue de l'email | Surprise positive — « il est donné en clair »                    |
| Vue du délai | Confiance — « ils s'engagent »                                    |
| Vue de l'adresse | Crédibilité — « c'est une vraie maison »                          |

### 6.16 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Email obfusqué JS (« contact[at]femiglow[dot]ma »)   | Cassure de la philosophie — la maison ne cache rien                  |
| Email comme image (PNG)                              | Inaccessible (lecteurs d'écran) + non cliquable                       |
| Pas de mention délai                                 | Anxiogène — la cliente ne sait pas quand attendre                     |
| Délai irréaliste (« sous 5 minutes »)                | Promesse intenable                                                    |
| Carte Google Maps embarquée V1                       | Cookies tiers, performance, complexité                                |
| Adresse imprécise (« Casablanca, Maroc »)            | Pas crédible — préférer adresse complète                               |
| Numéro de téléphone visible sans capacité à répondre  | Engagement non tenu                                                     |
| Logos réseaux sociaux dans cette zone                  | Hors registre — réservés au footer                                       |
| Bouton « Voir notre FAQ » avant de voir l'email       | Friction — la FAQ vient en section 04, pas avant                       |

---

## 7 — Section 03 — Formulaire de contact

### 7.1 — Wireframe complet

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║                                                                            ║
║                            Ou via ce formulaire.                           ║
║                                                                            ║
║                                                                            ║
║                                                                            ║
║   Type de demande *                                                         ║
║   [ Sélectionnez                                                       ▾ ] ║
║   Choisissez le type pour adapter le formulaire ci-dessous.                ║
║                                                                            ║
║                                                                            ║
║   Nom *                                                                     ║
║   [______________________________________________________]                  ║
║                                                                            ║
║                                                                            ║
║   Email *                                                                    ║
║   [______________________________________________________]                  ║
║                                                                            ║
║                                                                            ║
║   Téléphone (optionnel)                                                      ║
║   [______________________________________________________]                  ║
║   Optionnel — utile pour les demandes urgentes.                              ║
║                                                                            ║
║                                                                            ║
║   ──── Champs conditionnels selon Type de demande ────                       ║
║                                                                            ║
║   [si type === 'order']                                                       ║
║   Numéro de commande *                                                        ║
║   [______________________________________________________]                  ║
║   ⓘ Le numéro figure dans l'email de confirmation.                           ║
║                                                                            ║
║   [si type === 'professional']                                                 ║
║   Société *                                                                   ║
║   [______________________________________________________]                  ║
║                                                                            ║
║   Rôle / fonction *                                                           ║
║   [______________________________________________________]                  ║
║                                                                            ║
║                                                                            ║
║   Message *                                                                   ║
║   ┌────────────────────────────────────────────────────────┐                ║
║   │                                                        │                ║
║   │  [Placeholder adapté selon Type de demande]             │                ║
║   │                                                        │                ║
║   │                                                        │                ║
║   │                                                        │                ║
║   └────────────────────────────────────────────────────────┘                ║
║                                                                            ║
║                                                                            ║
║   [ ] J'accepte le traitement de mes données pour répondre à ma demande.    ║
║       En savoir plus                                                        ║
║                                                                            ║
║   [ ] Je souhaite recevoir le journal de la maison une fois par mois.        ║
║       (optionnel)                                                            ║
║                                                                            ║
║                                                                            ║
║                  ┌──────────────────────────────────────┐                  ║
║                  │  Envoyer mon message →                │                  ║
║                  └──────────────────────────────────────┘                  ║
║                                                                            ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
                              (fond sauge pâle)
```

### 7.2 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#E8EFE7` (Sauge pâle) — moment d'engagement                     |
| Hauteur                | ~ 720-900px (variable selon type sélectionné et erreurs)          |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 720px                                                             |
| Alignement             | Centré horizontalement                                            |

> **Fond sauge pâle** : confirmation de la règle des **moments d'engagement** sur fond sauge — checkout `/commander`, suivi `/merci`, formulaire `/contact`. Cohérence visuelle absolue.

### 7.3 — Titre de la section

```
Ou via ce formulaire.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 28pt (desktop) · 24pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 64px                                                 |

> **« Ou via ce formulaire. »** — fait écho à la phrase d'invitation du hero (« ou utiliser le formulaire ci-dessous »). Continuité narrative. Le « **Ou** » signale qu'il s'agit d'**alternative**, pas d'obligation.

### 7.4 — Sélecteur Type de demande (en haut du formulaire)

#### Spécifications

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Élément HTML            | `<select>` natif (pas de custom dropdown JS pour a11y)            |
| Hauteur                | 52px                                                              |
| Padding interne         | 14px 20px                                                          |
| Border                 | 1px solid `#E8E0D2` (Ligne)                                       |
| Border-radius          | 4px                                                                |
| Font                   | Inter Regular 16pt                                                  |
| Couleur                | `#2C2A28` (Encre)                                                  |
| Background             | `#FFFFFF` (Crème pure)                                              |
| Focus border            | `#A8C4A6` (Sauge dark) 1.5px                                        |
| Largeur                | 100% du formulaire                                                   |

#### Options du dropdown

```html
<select id="contact-type" name="type" required aria-required="true">
  <option value="" disabled selected>Sélectionnez</option>
  <option value="general">Question générale</option>
  <option value="order">Suivi de commande</option>
  <option value="professional">Demande professionnelle</option>
</select>
```

| Valeur          | Label affiché              | Public ciblé                         |
| :-------------- | :------------------------- | :----------------------------------- |
| (vide)          | Sélectionnez               | (placeholder)                         |
| `general`       | Question générale          | B2C avant achat                       |
| `order`         | Suivi de commande          | B2C après achat                       |
| `professional`  | Demande professionnelle    | B2B prospect                          |

> **Sobriété volumétrique** : 3 options seulement. Pas de « Autre », « Réclamation », « Partenariat presse », etc. Si la cliente ne se reconnaît pas, elle choisit « Question générale » et précise dans son message.

#### Microcopy d'aide sous le sélecteur

```
Choisissez le type pour adapter le formulaire ci-dessous.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 13pt                                                              |
| Couleur         | `#6B6863` (Brume)                                            |
| Espacement haut | 8px sous le sélecteur                                         |

### 7.5 — Champs standards (toujours visibles)

#### Nom (obligatoire)

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `text`                                                         |
| Hauteur         | 52px                                                            |
| Validation      | Min 2, Max 100 caractères                                      |
| Autocomplete    | `name`                                                         |

#### Email (obligatoire)

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `email`                                                        |
| Hauteur         | 52px                                                            |
| Validation      | Format email valide (regex serveur + HTML5 client)              |
| Autocomplete    | `email`                                                         |
| Placeholder     | « Ex : salma@email.com »                                        |

#### Téléphone (optionnel par défaut, obligatoire si type='professional')

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `tel`                                                          |
| Hauteur         | 52px                                                            |
| Validation      | Format `+212 X XX XX XX XX` ou `0X XX XX XX XX` si rempli       |
| Autocomplete    | `tel`                                                           |
| Placeholder     | « Ex : +212 6 12 34 56 78 »                                       |

#### Microcopy téléphone selon contexte

| Type de demande     | Microcopy sous le champ                                  |
| :------------------ | :------------------------------------------------------ |
| `general` ou `order` | « Optionnel — utile pour les demandes urgentes. »         |
| `professional`      | « Le téléphone est nécessaire pour les demandes pro. »    |

### 7.6 — Champs conditionnels selon Type

#### Si type === 'order' — Numéro de commande (obligatoire)

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `text`                                                         |
| Hauteur         | 52px                                                            |
| Validation      | Regex `^FG-\d{4}-\d{5}$` (ex: FG-2026-00037)                    |
| Placeholder     | « Ex : FG-2026-00037 »                                          |
| Tooltip ⓘ        | « Le numéro figure dans l'email de confirmation. »                |

#### Si type === 'professional' — Société (obligatoire)

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `text`                                                         |
| Hauteur         | 52px                                                            |
| Validation      | Min 2, Max 200 caractères                                      |
| Autocomplete    | `organization`                                                  |
| Placeholder     | « Ex : Institut Maârif »                                        |

#### Si type === 'professional' — Rôle / fonction (obligatoire)

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Type            | `text`                                                         |
| Hauteur         | 52px                                                            |
| Validation      | Min 2, Max 100 caractères                                      |
| Autocomplete    | `organization-title`                                            |
| Placeholder     | « Ex : Gérante / Esthéticienne »                                |

#### Phrase d'accroche conditionnelle B2B

Visible uniquement quand `type === 'professional'`, **avant** les champs Société et Rôle :

```
┌──────────────────────────────────────────────────────────────────┐
│ Notre équipe partenaires vous recontacte sous 48h ouvrées        │
│ avec les conditions complètes du programme :                      │
│ tarification dégressive, échantillon gratuit, formation.          │
└──────────────────────────────────────────────────────────────────┘
```

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Position           | Au-dessus de Société, après le sélecteur Type                   |
| Fond               | `#FBF8F1` (Crème — léger contraste avec sauge pâle)               |
| Border-left        | 3px solid `#A8C4A6` (Sauge dark)                                  |
| Padding            | 16px 20px                                                          |
| Police             | Cormorant Garamond Regular 14pt                                    |
| Couleur            | `#4A4844` (Encre claire)                                           |
| Animation          | Fade-in + translate-down 8px (300ms) à l'apparition                  |

> **Information préalable** : la cliente B2B sait à quoi s'attendre **avant** de remplir. Construit la confiance et qualifie la conversation.

### 7.7 — Textarea Message (obligatoire)

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Hauteur                | 200px (desktop) · 160px (mobile)                                  |
| Min hauteur (resize)    | 160px                                                              |
| Max hauteur (resize)    | 400px                                                              |
| Validation              | Min 10 caractères, Max 5000 caractères                              |
| Resize                 | `vertical` (pas horizontal)                                          |
| Font                   | Inter Regular 16pt                                                  |

#### Placeholders adaptatifs selon Type

| Type            | Placeholder                                                              |
| :-------------- | :----------------------------------------------------------------------- |
| `general`       | « Quelle est votre question ? Décrivez en quelques mots votre demande, nous prenons le temps de répondre. » |
| `order`         | « Décrivez votre demande concernant cette commande : modification d'adresse, suivi de livraison, problème reçu, ou autre. » |
| `professional`  | « Décrivez votre projet : type d'établissement, nombre d'employé·es, volume estimé, attentes principales. Notre équipe partenaires vous recontacte sous 48h ouvrées. » |

> **Placeholders comme guides** : la cliente comprend **quoi écrire**. Désamorce le syndrome de la page blanche. Mais le **label « Message * »** reste **toujours visible** (pas de placeholder seul comme label).

### 7.8 — Compteur de caractères (V2)

> **V1** : pas de compteur visible. La validation au blur dit « trop court » ou « trop long » suffit.
> 
> **V2** : afficher discrètement « 487 / 5000 » sous le textarea, sans alerte agressive.

### 7.9 — Checkboxes RGPD

#### Checkbox principale (obligatoire)

```
[ ] J'accepte le traitement de mes données pour répondre à ma demande.
    En savoir plus
```

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Position               | Après le textarea Message                                          |
| État par défaut         | **Décochée** (jamais pré-cochée)                                  |
| Police                 | Inter Regular 13pt                                                |
| Couleur                | `#4A4844` (Encre claire)                                          |
| Lien « En savoir plus »  | Underline subtle sauge dark, target `_blank` vers `/confidentialite` |
| Validation              | Obligatoire — message « Veuillez accepter le traitement de vos données. » |

> **Jamais pré-cochée** : violation RGPD. La cliente doit cocher **explicitement**.

#### Checkbox newsletter (optionnelle)

```
[ ] Je souhaite recevoir le journal de la maison une fois par mois.
    (optionnel)
```

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Position               | Après la checkbox RGPD principale                                  |
| État par défaut         | **Décochée** (jamais pré-cochée)                                  |
| Police                 | Inter Regular 13pt                                                |
| Couleur                | `#4A4844` (Encre claire)                                          |
| Mention « (optionnel) » | Italic, plus pâle                                                  |

> **Newsletter opt-in jamais pré-coché** : conformité ePrivacy. La cliente fait un choix actif.

### 7.10 — Bouton submit

```
┌──────────────────────────────────────┐
│  Envoyer mon message →                │
└──────────────────────────────────────┘
```

| Propriété          | Valeur                                                                |
| :----------------- | :-------------------------------------------------------------------- |
| Police             | Inter Medium 15pt                                                     |
| Texte              | `#FBF8F1` (Crème pure)                                                |
| Fond               | `#2C2A28` (Encre)                                                     |
| Padding            | 16px 32px                                                             |
| Hauteur            | 56px                                                                  |
| Border-radius      | 4px                                                                   |
| Largeur            | Auto (selon contenu) ou 100% mobile                                    |
| Hover              | Fond `#4A4844`, flèche translate-x 4px                                 |
| Active             | Scale 0.98                                                             |
| Disabled (loading) | `pointer-events: none`, opacity 0.7                                     |

#### États du bouton

| État                     | Apparence                                          |
| :----------------------- | :------------------------------------------------- |
| Repos                    | « Envoyer mon message » + flèche                    |
| Hover                    | Fond `#4A4844`, flèche translate-x 4px               |
| Active (clic)            | Scale 0.98                                          |
| Loading (envoi)          | « Envoi en cours... » + spinner mini à droite       |
| Disabled (loading)       | Opacity 0.7                                          |

> **Pas de bouton désactivé tant que les champs sont vides** : pattern UX moderne. La cliente peut toujours cliquer ; les erreurs de validation s'affichent au clic. Plus accessible (ARIA), plus prévisible.

### 7.11 — Tokens design

```css
/* ─── Formulaire de contact — tokens ─── */
--form-bg: #E8EFE7;
--form-padding-vertical: 96px;
--form-content-max-width: 720px;

--form-title-font: 'Cormorant Garamond', serif;
--form-title-weight: 300;
--form-title-size-desktop: 28pt;
--form-title-color: #2C2A28;
--form-title-margin-bottom: 64px;

/* Champs */
--form-field-bg: #FFFFFF;
--form-field-border: 1px solid #E8E0D2;
--form-field-border-focus: 1.5px solid #A8C4A6;
--form-field-border-radius: 4px;
--form-field-height: 52px;
--form-field-padding: 14px 20px;
--form-field-font: 'Inter', sans-serif;
--form-field-font-size: 16pt;
--form-field-color: #2C2A28;

--form-label-font: 'Inter', sans-serif;
--form-label-weight: 500;
--form-label-size: 13pt;
--form-label-color: #2C2A28;
--form-label-margin-bottom: 8px;

/* Microcopy d'aide */
--form-help-font: 'Cormorant Garamond', serif;
--form-help-style: italic;
--form-help-size: 13pt;
--form-help-color: #6B6863;
--form-help-margin-top: 8px;

/* Phrase d'accroche B2B */
--form-b2b-accroche-bg: #FBF8F1;
--form-b2b-accroche-border-left: 3px solid #A8C4A6;
--form-b2b-accroche-padding: 16px 20px;
--form-b2b-accroche-font: 'Cormorant Garamond', serif;
--form-b2b-accroche-size: 14pt;
--form-b2b-accroche-color: #4A4844;

/* Textarea */
--form-textarea-min-height: 160px;
--form-textarea-default-height: 200px;
--form-textarea-max-height: 400px;
--form-textarea-resize: vertical;

/* Checkboxes */
--form-checkbox-size: 18px;
--form-checkbox-border: 1px solid #C2BBA8;
--form-checkbox-checked-bg: #2C2A28;
--form-checkbox-label-font: 'Inter', sans-serif;
--form-checkbox-label-size: 13pt;
--form-checkbox-label-color: #4A4844;

/* Bouton submit */
--form-submit-font: 'Inter', sans-serif;
--form-submit-weight: 500;
--form-submit-size: 15pt;
--form-submit-bg: #2C2A28;
--form-submit-color: #FBF8F1;
--form-submit-padding: 16px 32px;
--form-submit-height: 56px;
--form-submit-border-radius: 4px;
--form-submit-bg-hover: #4A4844;
--form-submit-arrow-translate: 4px;

/* Erreurs */
--form-error-color: #9C5B5B;
--form-error-bg: #FBE5E5;
--form-error-border-left: 3px solid #9C5B5B;
--form-error-message-font: 'Inter', sans-serif;
--form-error-message-size: 12pt;
--form-error-margin-top: 6px;
```

### 7.12 — Comportements UX

#### Animation au scroll (apparition de la section)

```
[atteint 80% viewport]   → titre fade-in (500ms)
[atteint 70%]             → cascade des champs (300ms entre chaque, 500ms chacun)
[atteint 50%]             → checkboxes fade-in (500ms)
[atteint 40%]             → bouton submit fade-in (500ms)
```

#### Animation à la sélection du Type de demande

```
[t=0ms]      → Cliente change le sélecteur
[t=0-100ms]  → Champs conditionnels actuels fade-out (200ms si présents)
[t=100ms]    → Suppression du DOM des champs précédents
[t=100ms]    → Insertion DOM des nouveaux champs conditionnels
[t=100-400ms]→ Champs nouveaux fade-in + translate-down 8px (300ms)
[t=400ms]    → Animation terminée
```

> **Animation 400ms totale** : assez rapide pour ne pas frustrer, assez visible pour que la cliente comprenne **qu'un changement a eu lieu**.

#### Validation au blur (pas keystroke)

```javascript
function onFieldBlur(fieldName, value) {
  const error = validateField(fieldName, value);
  setFieldError(fieldName, error);
}
```

> **Validation au moment où la cliente quitte le champ** (event `blur`), pas à chaque touche. Évite le bruit pendant la saisie.

#### Validation textarea — debounced 800ms

```javascript
const debouncedValidateMessage = debounce((value) => {
  const error = validateMessage(value);
  setFieldError('message', error);
}, 800);
```

> **Debouncing 800ms pour le textarea** — permet une validation pendant la saisie sans bruit.

#### Animation shake sur erreur

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.field.is-invalid {
  animation: shake 200ms ease-out;
}
```

### 7.13 — Tracking GA4

| Événement                            | Trigger                                              |
| :----------------------------------- | :--------------------------------------------------- |
| `contact_form_visible`                | IntersectionObserver à 50%                            |
| `contact_type_selected`               | Sélection du Type de demande                          |
| `contact_field_focused`               | Premier focus sur n'importe quel champ                  |
| `contact_form_started`                | Modification du premier champ                          |
| `contact_form_field_error`            | Erreur de validation (par champ)                       |
| `contact_form_submitted`              | Click sur "Envoyer mon message"                         |

### 7.14 — Psychologie

#### 1. Sélecteur en haut = clarification immédiate

> **Iyengar 2000** : *« Choice between 2-3 well-defined options yields higher engagement than a single forced path. »*
> 
> En proposant **3 options** dès le début, la cliente **se reconnaît** dans une catégorie et le formulaire **se simplifie** (champs adaptés). Pas de surcharge de champs inutiles.

#### 2. Champs conditionnels = friction minimisée

> Une cliente B2C avant achat ne voit **jamais** les champs « Société » et « Rôle » — qui sont irrelevants pour elle. Friction cognitive réduite.

#### 3. Labels toujours visibles = accessibilité

> **WCAG 2.2** : les labels doivent rester visibles en permanence, pas disparaître au focus. Les placeholders sont des **exemples** ou des **guides**, pas des labels.

#### 4. Phrase d'accroche B2B = qualification mutuelle

> **« Notre équipe partenaires vous recontacte sous 48h ouvrées avec les conditions complètes... »** — la maison **expose ses cartes** avant que la cliente B2B ne remplisse. Acte de réciprocité (Cialdini).

#### 5. RGPD jamais pré-coché = respect

> **Thaler & Sunstein (Nudge)** : *« Default options drive 70% of choices. »*
> 
> Pré-cocher la newsletter serait une manipulation par défaut. La maison fait un **choix éthique** : la cliente coche activement.

### 7.15 — Émotion à provoquer

| Étape       | Émotion                                                          |
| :---------- | :--------------------------------------------------------------- |
| Vue du titre | Continuité narrative (« ah, le formulaire »)                       |
| Vue du sélecteur | Reconnaissance — « je choisis ma situation »                    |
| Vue des champs simplifiés | Soulagement — « pas trop de champs »                       |
| Saisie du message | Investissement                                                 |
| Click sur Envoyer | Soulagement — « c'est parti »                                  |

### 7.16 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 6 champs visibles                            | Friction excessive                                                    |
| Captcha bloquant (« Cliquez sur les feux ») V1       | Frustration — reCAPTCHA v3 invisible suffit                           |
| Champ « Société » obligatoire pour tous              | Discrimine les particuliers                                            |
| Champ « Sujet » en plus du « Type de demande »        | Redondant                                                              |
| Bouton désactivé tant que champs vides                | Frustrant et accessible faiblement                                      |
| Validation à chaque keystroke                         | Bruyant — préférer validation au blur                                  |
| Messages d'erreur en MAJUSCULES                        | Vulgaire                                                                |
| Messages d'erreur techniques (« HTTP 422 »)            | Incompréhensible                                                         |
| Pas d'auto-confirmation email                          | Anxiogène — la cliente doute                                            |
| Email auto-confirmation avec « DO NOT REPLY »          | Vulgaire — la maison répond toujours                                    |
| Newsletter signup pré-cochée                            | Manipulation par défaut (Thaler & Sunstein)                              |
| RGPD checkbox pré-cochée                                | Violation RGPD                                                            |
| Spinner sans texte (juste une roue tournante)          | Anxiogène — préférer « Envoi en cours... »                              |
| Reset des champs après échec                            | Frustrant                                                                  |
| Compteur de caractères agressif (« 4998 / 5000 »)      | Stress inutile — V1 sans compteur                                          |
| Placeholder qui sert de label                          | Disparaît au focus, accessibilité catastrophique                          |
| Style flat sur boutons (pas de feedback hover)         | Manque de signal d'interaction                                            |

---

## 8 — Section 04 — FAQ courte

### 8.1 — Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                          Quelques réponses rapides.                        │
│                                                                            │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ▸  Combien de temps pour recevoir ma commande ?                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ▾  Est-ce que je peux modifier mon adresse de livraison ?            │  │
│  │                                                                      │  │
│  │     Oui, tant que la commande n'est pas expédiée. Écrivez-nous       │  │
│  │     dès que possible avec votre numéro de commande, nous            │  │
│  │     intervenons dans la journée si elle n'est pas partie.           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ▸  Quels sont les délais de réponse aux messages ?                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ▸  Je suis professionnel·le, comment commander en gros ?             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│                                                                            │
│                  Vous ne trouvez pas votre réponse ?                       │
│                  Écrivez-nous, nous prenons le temps.                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 — Pourquoi une FAQ rapide sur la page contact ?

> **Paradoxe du contact** : la cliente arrive sur `/contact` parce qu'elle a une question. Mais souvent, la question est **commune** — déjà traitée des dizaines de fois. Une FAQ courte **résout immédiatement** ces cas, sans formulaire.

Trois bénéfices :
1. **La cliente est satisfaite plus vite** (réponse instantanée)
2. **Le support reçoit moins de doublons** (charge réduite)
3. **La page reste utile** même pour les visiteuses qui ne veulent pas écrire

### 8.3 — Pourquoi 4 questions seulement ?

> Une vraie FAQ extensive vivrait sur une page dédiée `/faq` (V2 si volume justifie). Ici, **4 questions max** — celles qui captent le plus gros volume.

**Iyengar 2000 — choice paradox** : trop de questions visibles = la cliente passe à autre chose. 4 questions courtes = scan rapide en 10 secondes.

**Miller 1956 — 7±2** : la limite cognitive justifie de rester en dessous de 5 items pour faciliter la lecture.

### 8.4 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | Auto (selon ouverture/fermeture des questions)                    |
| Padding vertical       | 96px                                                              |
| Padding latéral        | 96px (desktop) · 64px (tablet) · 24px (mobile)                  |
| Largeur max contenu    | 800px                                                             |
| Alignement             | Centré horizontalement                                            |

### 8.5 — Titre de la section

```
Quelques réponses rapides.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light                            |
| Taille         | 28pt (desktop) · 24pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 64px                                                 |

> **« Quelques réponses rapides. »** — ton modeste qui annonce que ce n'est **pas** une FAQ exhaustive. La cliente comprend qu'il s'agit d'un **échantillon** des questions les plus communes. Si elle ne trouve pas, le formulaire est juste au-dessus.

### 8.6 — Item d'accordéon

#### Container fermé

```
┌──────────────────────────────────────────────────────────────────────┐
│  ▸  Combien de temps pour recevoir ma commande ?                      │
└──────────────────────────────────────────────────────────────────────┘
```

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | `#FFFFFF` (Crème pure)                                           |
| Border            | 1px solid `#E8E0D2` (Ligne)                                     |
| Border-radius     | 0                                                                |
| Padding           | 20px 24px (desktop) · 16px 20px (mobile)                          |
| Hauteur           | Auto                                                              |
| Espacement entre items | 12px                                                          |
| Cursor            | `pointer` sur toute la zone                                       |

#### Header de l'item (toujours visible)

| Élément              | Spécifications                                                |
| :------------------- | :------------------------------------------------------------ |
| Icône chevron         | `▸` quand fermé, `▾` quand ouvert (caractères typographiques)   |
| Couleur chevron       | `#A8C4A6` (Sauge dark)                                         |
| Taille chevron        | 14pt                                                            |
| Espacement chevron    | 12px à droite (avant la question)                                |
| Question texte        | Cormorant Garamond Regular 17pt (desktop) · 16pt (mobile)       |
| Couleur question      | `#2C2A28` (Encre)                                                |
| Layout                | Flex avec chevron à gauche, question à droite, alignés baseline  |

#### Container ouvert

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Filet séparateur  | 1px sauge dark à 30% d'opacité, 16px haut + 16px bas              |
| Réponse texte      | Cormorant Garamond Regular 15pt (desktop) · 14pt (mobile)        |
| Couleur réponse    | `#4A4844` (Encre claire)                                          |
| Line-height        | 1.6                                                                |
| Largeur max        | 100% (héritée du container)                                        |

### 8.7 — Les 4 questions et réponses — copy intégral

#### Question 1 — Délai de livraison (B2C avant achat + après achat)

```
▸  Combien de temps pour recevoir ma commande ?

   En livraison Standard, comptez entre 3 et 5 jours ouvrables
   pour Casablanca, Rabat, Salé et Mohammedia, et 5 à 7 jours
   pour les autres villes du Maroc. La livraison Express, quand
   elle est disponible, ramène ce délai à 1 ou 2 jours.

   Vous recevrez un email avec le numéro de suivi dès l'expédition.
```

#### Question 2 — Modification d'adresse (B2C après achat)

```
▸  Est-ce que je peux modifier mon adresse de livraison ?

   Oui, tant que la commande n'est pas expédiée. Écrivez-nous
   dès que possible avec votre numéro de commande
   (FG-2026-XXXXX), nous intervenons dans la journée si elle
   n'est pas partie.

   Une fois la commande remise au transporteur, la modification
   passe par lui — nous vous indiquerons la marche à suivre.
```

#### Question 3 — Délai de réponse (transversal)

```
▸  Quels sont les délais de réponse aux messages ?

   Nous répondons sous 24 heures ouvrées (du lundi au vendredi).
   Les messages reçus le week-end ou un jour férié sont traités
   le premier jour ouvré suivant.

   Pour une demande urgente concernant une livraison en cours,
   précisez-le en début de message.
```

#### Question 4 — B2B (prospect partenaires)

```
▸  Je suis professionnel·le, comment commander en gros ?

   Notre programme partenaires est ouvert aux instituts, salons
   et professionnel·les de la beauté. Nous proposons une
   tarification dégressive et un échantillon gratuit avant
   première commande.

   Sélectionnez « Demande professionnelle » dans le formulaire
   ci-dessus, et notre équipe partenaires vous recontacte sous
   48h ouvrées avec les conditions complètes.
```

> **Notez** : la question 4 contient un **lien implicite** vers le formulaire (« Sélectionnez "Demande professionnelle" dans le formulaire ci-dessus »). Cohérence narrative — la FAQ **renvoie** vers le formulaire au bon moment.

### 8.8 — Phrase de clôture

```
Vous ne trouvez pas votre réponse ?
Écrivez-nous, nous prenons le temps.
```

| Propriété       | Valeur                                                       |
| :-------------- | :----------------------------------------------------------- |
| Police          | Cormorant Garamond Regular Italic                            |
| Taille          | 16pt (desktop) · 15pt (mobile)                                |
| Couleur         | `#4A4844` (Encre claire)                                     |
| Alignement      | Centré                                                        |
| Espacement haut | 64px sous le dernier item                                      |
| Largeur max     | 480px                                                         |
| Line-height     | 1.5                                                          |

> **« Écrivez-nous, nous prenons le temps. »** — phrase signature de la maison. Reprend la grammaire « rendues à soi » / « pas de précipitation » / « avec attention ». Le **temps** est la valeur centrale de la marque, même dans le support.

### 8.9 — Comportements UX

#### Animation au scroll

```
[atteint 80% viewport]   → titre fade-in (500ms)
[atteint 70%]             → 4 items en cascade fade-in (200ms entre chaque, 500ms chacun)
[atteint 40%]             → phrase de clôture fade-in (600ms)
```

#### Animation d'ouverture/fermeture

```css
.faq-item-content {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 320ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 240ms ease-out 80ms;
}

.faq-item.is-open .faq-item-content {
  max-height: 400px;
  opacity: 1;
}

.faq-item.is-open .chevron {
  transform: rotate(90deg);
}
```

#### Comportement multi-ouverture

> **V1** : un seul item ouvert à la fois (accordéon classique). Si la cliente clique sur un nouveau, le précédent se ferme automatiquement.

#### Comportement clavier

| Touche                | Comportement                                          |
| :-------------------- | :---------------------------------------------------- |
| Tab                   | Focus séquentiel sur chaque item                       |
| Enter / Space          | Ouvre / ferme l'item ciblé                             |
| Escape (item ouvert)  | Ferme l'item ouvert                                     |
| Arrow Up / Arrow Down  | Navigation entre items (V2 — pattern WAI-ARIA accordéon) |

### 8.10 — Hash URL gérés

> Permettre `/contact#faq-modification-adresse` pour un lien direct ouvrant un item. Utile dans les emails support pour pointer vers une réponse spécifique.

### 8.11 — Tracking GA4

| Événement                            | Trigger                                              |
| :----------------------------------- | :--------------------------------------------------- |
| `faq_section_viewed`                  | IntersectionObserver à 50%                            |
| `faq_item_opened`                     | À chaque ouverture d'un item                          |
| `faq_item_closed`                     | À chaque fermeture                                    |

### 8.12 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Plus de 5-6 questions                                | Surcharge — l'objectif est de ne pas remplacer une vraie FAQ        |
| Réponses très longues (> 100 mots)                    | Cassure de la promesse « rapides »                                   |
| Réponses qui finissent par « Pour plus d'info, contactez-nous » | Inutile — c'est implicite                                  |
| Items fermés par défaut TOUS sauf un                  | Pas de raison de privilégier un item                                  |
| Items ouverts TOUS au chargement                       | Page visuellement chaotique                                            |
| Pas de phrase de clôture                                | Manque le pont vers le formulaire                                      |
| Phrase de clôture commerciale (« Inscrivez-vous à la newsletter ! ») | Cassure du registre                                  |
| Hash URL non géré                                       | Liens emails support cassent                                            |

---

## 9 — Section 05 — Cross-links contextuels

### 9.1 — Wireframe

```
┌════════════════════════════════════════════════════════════════════════════┐
║                                                                            ║
║                          En attendant notre réponse.                        ║
║                                                                            ║
║                                                                            ║
║  ┌──────────────────────────────┐    ┌──────────────────────────────┐     ║
║  │  [PHOTO LIFESTYLE LECTURE]   │    │  [PHOTO ATELIER]              │     ║
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
║  └──────────────────────────────┘    └──────────────────────────────┘     ║
║                                                                            ║
└════════════════════════════════════════════════════════════════════════════┘
                              (fond crème uni)
```

### 9.2 — Pourquoi des cross-links sur la page contact ?

> La cliente vient d'envoyer un message (ou s'apprête à le faire). Elle attend maintenant **une réponse sous 24h ouvrées**. Que fait-elle pendant ce temps ?

Trois scénarios :
1. **Elle quitte le site** (→ chance perdue de prolonger l'engagement)
2. **Elle revient sur ses pages favorites** (`/kit`, `/rituel` — bonne navigation libre)
3. **Elle découvre des contenus complémentaires** (Journal, Maison — l'engagement éditorial)

Les cross-links sur `/contact` jouent sur le scénario 3 — **transformer l'attente en exploration**.

### 9.3 — Cohérence avec `/merci` et `/panier`

Les cross-links `/contact` reprennent **exactement** la même structure que sur `/panier` (Journal seul) et `/merci` (Journal + Maison).

> Sur `/contact` : Journal + Maison (comme `/merci`). **Cohérence narrative absolue à travers le site.**

### 9.4 — Composition générale

| Propriété              | Valeur                                                          |
| :--------------------- | :-------------------------------------------------------------- |
| Fond                   | `#FBF8F1` (Crème) — uni                                          |
| Hauteur                | 360px (desktop) · auto (mobile)                                  |
| Padding vertical       | 96px (haut) · 64px (bas)                                          |
| Padding latéral        | 96px (desktop) · 24px (mobile)                                  |
| Largeur max contenu    | 1200px                                                            |

### 9.5 — Titre de la section

```
En attendant notre réponse.
```

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Cormorant Garamond Light Italic                     |
| Taille         | 24pt (desktop) · 22pt (mobile)                       |
| Couleur        | `#2C2A28` (Encre)                                   |
| Alignement     | Centré                                               |
| Espacement bas | 64px                                                 |

> **« En attendant notre réponse. »** — variante du « En attendant. » de `/merci`. Plus contextuel ici (« notre réponse » = la réponse que la maison va apporter au message envoyé).

### 9.6 — Disposition de la grille

| Breakpoint | Layout                                    |
| :--------- | :---------------------------------------- |
| Desktop    | 2 colonnes égales, gap 32px                |
| Tablet     | 2 colonnes égales, gap 24px                |
| Mobile     | 1 colonne (empilées), gap 32px             |

### 9.7 — Spécifications de chaque card cross-link

#### Container

| Propriété         | Valeur                                                          |
| :---------------- | :-------------------------------------------------------------- |
| Fond              | Transparent (le crème de la section transparait)                  |
| Border            | Aucun                                                              |
| Padding           | 0                                                                  |
| Largeur           | 100% de la colonne                                                |
| Cliquable         | Toute la card est cliquable                                         |

#### Photo

| Propriété         | Valeur                                                                |
| :---------------- | :-------------------------------------------------------------------- |
| Format            | 4:3 (paysage)                                                          |
| Hauteur           | 200px (desktop) · 240px (mobile)                                        |
| Object-fit        | `cover`                                                                |
| Hover (sur card)  | Image scale 1.03 (transition 600ms)                                    |

> **Photos identiques à `/merci`** : tasse de thé tiède + livre ouvert pour Journal, atelier avec outils pour Maison. **Cohérence narrative absolue**.

#### Surtitre

| Propriété      | Valeur                                              |
| :------------- | :-------------------------------------------------- |
| Police         | Inter SemiBold 7.5pt                                |
| Letter-spacing | 2.5px                                               |
| Couleur        | `#6B6863` (Brume)                                   |
| Position       | Aligné à gauche, sous la photo                      |
| Espacement haut| 24px                                                  |
| Espacement bas | 12px                                                  |

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

#### CTA (text-link)

| Propriété          | Valeur                                                          |
| :----------------- | :-------------------------------------------------------------- |
| Police             | Inter Medium 13pt                                                 |
| Couleur            | `#2C2A28` (Encre)                                                |
| Underline          | 1.5px sauge dark, offset 4px                                       |
| Hover              | Couleur sauge dark, flèche translate-x 4px                          |

> **Text-link, pas bouton** — cohérent avec `/merci` (cliente détendue, pas en friction commerciale comme sur `/panier`).

### 9.8 — Copy intégral des deux cards

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

> **Copy strictement identique** à `/merci` section 06. Cohérence narrative.

### 9.9 — Pas de cross-link vers `/kit`, `/rituel`, `/panier`, `/merci`

> Volontairement, **pas de cross-link commercial** sur cette page :
> - Pas vers `/kit` (cassure du registre — la cliente n'est pas en mode achat)
> - Pas vers `/rituel` (idem)
> - Pas vers `/panier` ou `/merci` (pages transactionnelles, sans rapport)
> 
> Le contact est un **moment relationnel**, pas commercial.

### 9.10 — Tracking GA4

| Événement                            | Trigger                                              |
| :----------------------------------- | :--------------------------------------------------- |
| `crosslinks_section_viewed`           | IntersectionObserver à 50%                            |
| `contact_crosslink_journal_clicked`   | Click sur card Journal                                 |
| `contact_crosslink_maison_clicked`    | Click sur card Maison                                  |

### 9.11 — Erreurs à éviter

| Erreur                                              | Pourquoi c'est faux                                                |
| :-------------------------------------------------- | :----------------------------------------------------------------- |
| Trois cards ou plus                                  | Surcharge                                                            |
| Card vers `/kit` ou `/rituel`                        | Cross-sell déguisé — moment inopportun                                |
| Boutons pleins (au lieu de text-links)               | Trop fort — la cliente n'est pas en friction                          |
| Photos product-shot                                   | Mauvais registre — préférer lifestyle                                  |
| Description trop longue (> 30 mots)                  | Casse la sobriété                                                     |
| Newsletter signup en bas                              | Hors registre du moment                                                |

<!-- INSERT_NEXT_HERE -->
