# Identité, design system, architecture du site

Ce document condense la charte graphique (`docs/pages/FemiGlow_Charte_Graphique.md`), l'architecture (`docs/pages/FemiGlow_Architecture_Site.md`) et les annexes (`docs/preparation/annexes/tokens.css.md`, `glossaire-editorial.md`). Il sert de référence rapide pour toute itération qui touche au branding, à la navigation ou aux composants UI primitifs.

## 1. Identité et promesse

### 1.1 Wordmark et signature

- Police exclusive : **Pinyon Script** (calligraphie cursive, issue du carton packaging du kit).
- Variantes : wordmark complet avec tagline « Maison d'Éclat » (≥ 160 px desktop) — monogramme circulaire « Fg » (≥ 60 px) — monogramme seul (favicon 32 px).
- Espace de protection : hauteur de la majuscule « F ».
- Couleurs autorisées : encre `#2C2A28` sur fond clair, crème `#FBF8F1` sur fond sombre. Aucun effet (ombre, glow, relief), aucune déformation.

### 1.2 Proposition de valeur — trois niveaux

| Registre | Énoncé |
| --- | --- |
| Sensoriel | « Le rituel d'éclat. Une lumière qui retrouve. » |
| Méthodique | « Quatre gestes pensés. Sans vernis, sans abrasion. » |
| Éthique | « Pas une marque. Une maison. » |

La promesse fonctionne par suggestion indirecte ; on infère les bénéfices, on ne les énonce pas en gain frontal.

### 1.3 Audience

- **Persona B2C — Salma**, 34 ans, Casablanca, CSP B+, directrice de communication, urbaine, fatiguée des semi-permanents.
- **Modes de découverte** : story Instagram d'une amie, recherche Google.
- **Peurs** : marketing vide, abîmer ses ongles, payer cher pour rien.
- **Déclencheurs d'achat** : récit fondateur authentique, ingrédients tracés, témoignages d'initiées (jamais d'influenceuses).

### 1.4 Voix — B2C vs B2B

| Dimension | B2C | B2B |
| --- | --- | --- |
| Registre | Sensoriel, complice, narratif | Factuel, précis, partenarial |
| Priorité d'information | Sens avant fait | Fait avant sens |
| Posture | Invitation, jamais injonction | Information structurée |
| Phrase | Courte, posée | Dense, hiérarchisée |

### 1.5 Lexique

| Préférer | Éviter absolument |
| --- | --- |
| Rituel, geste, maison, initiée, éclat, patience, complice, partenaire, découvrir, révéler, naturel, précision | Acheter, produit, client, vernis, promotion, solde, urgent, offre flash, exceptionnel, wow, magique, must-have, game-changer |

Signatures :

- Emails : « Avec soin, Salma · FemiGlow ».
- Confirmations : « Votre rituel est en route. »
- CTA panier : « Recevoir le rituel », « Composer mon rituel », « Ajouter au rituel ».
- Bouton de fiche : « Recevoir le kit », jamais « Acheter ».

### 1.6 Typographie française stricte

- Apostrophes courbes `'` (U+2019).
- Guillemets français « » avec espace fine insécable (U+202F).
- Tirets cadratins `—` (U+2014) littéraux.
- Points de suspension `…` (U+2026), jamais `...`.
- Aucun point d'exclamation. Aucun emoji.

## 2. Design system

### 2.1 Palette signature

| Couleur | Hex | Usage B2C | Usage B2B |
| --- | --- | --- | --- |
| **Sauge** | `#C5DBC4` | 60 % — dominante | 30 % — accent |
| **Crème** | `#FBF8F1` | 25 % — fond | 60 % — dominante |
| **Encre** | `#2C2A28` | 10 % — texte | 8 % — texte |
| **Pétale** | `#F2CECC` | 3–12 % — accent féminin (B2C uniquement) | — |
| **Ciel** | `#C5DBE5` | 2–3 % — touche (icône étape 4) | — |
| **Champagne** | `#C8A876` | ≤ 5 % — ornement (filets, fleurons, numéros) | ≤ 5 % |

Utilitaires :

| Couleur | Hex | Rôle |
| --- | --- | --- |
| Brume | `#6B6863` | Texte secondaire, mentions |
| Ligne | `#E8E0D2` | Bordures, séparateurs |
| Encre-claire | `#4A4844` | Texte adouci |
| Sauge-dark | `#A8C4A6` | Focus rings, hover |
| Sauge-pale | `#E8EFE7` | Fonds doux |
| Crème-pure | `#FFFFFF` | Champs formulaire |
| Rouge-feutre | `#9C5B5B` | Erreurs sans alarmisme |
| Rouge-feutre-pale | `#FBE5E5` | Bandeaux erreur |

Règle 60-30-10 contrôlée à chaque revue UI. Pas de gradient, pas d'ombres colorées, sauf `rgba(44, 42, 40, 0.08)` discret.

Contrastes WCAG validés : Encre/Crème 14.2:1 (AAA), Brume/Crème 5.6:1 (AA). Champagne et Sauge-dark jamais en corps de texte courant (≥ 18 pt uniquement, ou ornements).

### 2.2 Typographies — trois polices, trois rôles

| Police | Source | Rôle | Styles |
| --- | --- | --- | --- |
| **Pinyon Script** | Google Fonts (OFL) | Wordmark uniquement | Regular |
| **Cormorant Garamond** | Google Fonts (OFL) | Titres éditoriaux, sous-titres, citations | Light 300, Regular 400, Light Italic, Regular Italic (jamais Bold) |
| **Inter** | rsms.me | UI, corps courant, labels, kickers | Light 300, Regular 400, Medium 500, SemiBold 600 |

Hiérarchie :

| Niveau | Famille | Taille | Style |
| --- | --- | --- | --- |
| Display XL | Cormorant | 80 pt | Light |
| Display L | Cormorant | 64 pt | Light |
| Display M | Cormorant | 48 pt | Light |
| H1 | Cormorant | 32 pt | Regular |
| H2 | Cormorant | 24 pt | Regular |
| H3 | Cormorant | 18 pt | Regular |
| H4 | Inter | 16 pt | SemiBold |
| Lead / Chapô | Cormorant | 18 pt | Italic |
| Body éditorial | Cormorant | 17 pt | Regular |
| Body UI | Inter | 15 pt | Regular |
| Body texte | Inter | 14 pt | Regular |
| Label / CTA | Inter | 13 pt | Medium |
| Caption | Inter | 12 pt | Regular |
| Kicker | Inter | 9 pt | SemiBold tracking 2 px |

Hauteurs de ligne : 1.1 tight (hero), 1.2 headline (H1/H2), 1.3 subhead (H3/H4), 1.7 body éditorial, 1.5 body standard, 1.4 tight UI.

Inter Light interdit en dessous de 13 pt (trop fin).

### 2.3 Espacements

Tokens (multiples de 4 px) :

| Token | Valeur |
| --- | --- |
| 2xs | 4 px |
| xs | 8 px |
| sm | 12 px |
| md | 16 px |
| lg | 24 px |
| xl | 32 px |
| 2xl | 48 px |
| 3xl | 64 px |
| 4xl | 96 px |
| 5xl | 128 px |

Max-widths : 480 px (formulaires), 640 px (lecture), 720 px (contenu), 1200 px (container), 1440 px (bleed limit).

### 2.4 Grille responsive

| Breakpoint | Colonnes | Gouttière | Padding section |
| --- | --- | --- | --- |
| Mobile < 768 px | 4 | 16 px | 40 px |
| Tablet 768–1279 px | 8 | 20 px | 64–80 px |
| Desktop ≥ 1280 px | 12 | 24 px | 96–128 px |

Mobile-first justifié : 78 % des sessions e-commerce marocaines via mobile (HCP 2024).

### 2.5 Rayons, ombres, transitions

- **Rayons** : 0 (angles vifs = signature maison). Exceptions : 2 px (badges), 50 % (étiquettes circulaires, monogramme).
- **Ombres** : bordures préférées. Si nécessaire : `0 1px 2px rgba(44,42,40,0.06)` (hover card), `0 2px 8px rgba(44,42,40,0.08)` (modal), `0 8px 24px rgba(44,42,40,0.12)` (overlay focal rare).
- **Transitions** : 100 ms instant, 200 ms quick (hover), 300 ms default, 500 ms slow (apparition section), 800 ms deliberate (luxe), 1200 ms cinematic (hero).
- **Easings** : default `cubic-bezier(0.4, 0, 0.2, 1)`, out `cubic-bezier(0.16, 1, 0.3, 1)`, in `cubic-bezier(0.4, 0, 1, 1)`.
- `prefers-reduced-motion: reduce` respecté partout, sans exception.

### 2.6 Focus et touch targets

- Focus ring : 2 px solid sauge-dark, offset 4 px.
- Touch target minimum : 44 × 44 px.

### 2.7 Motifs graphiques

| Motif | Description | Usage |
| --- | --- | --- |
| **La Vague** | SVG asymétrique, jamais centré, sauge + pétale, opacité 0.6–0.85 | Coins d'écran, haut de page, parallaxe légère (translateY × 0.15 à 0.20) |
| **Le Fleuron** | Trois variantes : A losange ◆ champagne entre filets (80–96 px, filet 1 px, espace 24 px) — B point central • — C double filet | Signature, séparateur, em-dashes éditoriaux |
| **L'Étiquette circulaire** | Disque 80–120 px + chiffre Cormorant 24 pt + mot italique 14 pt + wordmark Pinyon 12 pt | Une étiquette = une étape du rituel ; 1 paste sauge, 2 powder pétale, 3 shine crème, 4 polish ciel |

Aucune invention hors les 4 étapes. Aucun pictogramme externe.

### 2.8 Tokens CSS

Exposés dans `apps/web/src/styles/tokens.css` puis pontés vers `tailwind.config.ts` (cf. document 01). Extrait :

```css
:root {
  --color-sauge: #C5DBC4;
  --color-creme: #FBF8F1;
  --color-encre: #2C2A28;
  --color-petale: #F2CECC;
  --color-ciel: #C5DBE5;
  --color-champagne: #C8A876;

  --font-pinyon: 'Pinyon Script', cursive;
  --font-cormorant: 'Cormorant Garamond', serif;
  --font-inter: 'Inter', sans-serif;

  --space-md: 16px;
  --transition-default: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --easing-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### 2.9 Composants UI canoniques

| Composant | Comportement |
| --- | --- |
| **Bouton primaire** | Fond encre `#2C2A28`, texte crème, padding 12 px 32 px, hauteur 48 px (56 px CTA panier), radius 0, hover encre-claire, active scale(0.98), transition 300 ms |
| **Champ formulaire** | Fond crème-pure, bordure 1 px ligne, hauteur 48 px, padding 16 px, focus bordure sauge-dark 1.5 px, erreur bordure rouge-feutre, police Inter, radius 0 |
| **Card éditorial** | Fond crème-pure, bordure 1 px ligne, padding 24 px, hover translateY(-4 px) + shadow-subtle |

## 3. Architecture de l'information

### 3.1 Sitemap B2C

```
femiglow.ma/
├── /                       Accueil — TOFU
├── /rituel                 Narration — MOFU
├── /kit                    Fiche produit pivot — BOFU
├── /journal                Hub éditorial + newsletter
│   └── /journal/[slug]     Article détail
├── /maison                 Récit fondateur — MOFU / trust
├── /panier                 Pre-checkout
├── /commander              Tunnel 3 étapes — checkout
├── /merci                  Post-achat — bascule transaction → relation
└── /contact                Pont conversationnel
```

Routes B2B et légales réservées Phase 2 (`/partenaires`, `/programme`, `/echantillon`, `/espace-pro`, `/faq`, `/legal/*`).

### 3.2 Funnel canonique

```
[DÉCOUVERTE]    →   [CONSIDÉRATION]    →   [DÉCISION]   →   [VALIDATION]   →   [ACTIVATION]
    TOFU                MOFU                  BOFU              Pre-checkout       Post-achat
     /              /rituel, /maison,         /kit            /panier,            /merci
                       /journal                                /commander
```

KPIs par étape :

| Étape | Pages | KPI cible |
| --- | --- | --- |
| Découverte | `/` | Bounce < 55 %, scroll > 60 % |
| Considération | `/rituel`, `/maison`, `/journal` | Pages/session ≥ 3, durée > 2:30 |
| Décision | `/kit` | Add-to-cart > 8 % |
| Validation | `/panier`, `/commander` | Conversion checkout > 65 % |
| Activation | `/merci` | NPS > 50 |

### 3.3 Header B2C

- 80 px desktop / 64 px mobile, fond crème, blur au scroll > 80 px.
- Composition : `[Wordmark Pinyon 36 pt]  RITUEL  JOURNAL  KIT  MAISON  [Panier · n]`.
- 4 entrées (max cognitif, Gallivan 2011). Aucun mega menu, aucun sous-niveau déroulant.
- Compteur panier si articles présents, sticky top-right.

### 3.4 Header checkout simplifié

Sur `/commander`, navigation supprimée pour zéro fuite. Wordmark cliquable → modal de confirmation « Quitter le checkout ? ». Cadenas et mention « Commande sécurisée », plus lien retour panier.

### 3.5 Footer commun

Fond encre, texte crème. Quatre colonnes :

| Colonne | Liens |
| --- | --- |
| Le Rituel | Le rituel · Le kit · Journal · Maison |
| Partenaires (Phase 2) | Le programme · Marges salon · Échantillon · Espace Pro |
| Assistance | Contact · FAQ · Livraison · Retours |
| Légal | Mentions · CGV · Cookies · Confidentialité |

Pas de newsletter en footer global — elle est valorisée exclusivement dans `/journal`.

### 3.6 Cross-links inter-pages

Maximum 3 à 5 liens contextuels par page :

| Source | Cibles |
| --- | --- |
| `/` | `/rituel`, `/journal`, `/kit` |
| `/rituel` | `/kit`, `/journal` (3 articles cross) |
| `/kit` | `/rituel`, `/journal` |
| `/journal` | `/journal/[slug]`, `/maison`, `/rituel` |
| `/maison` | `/rituel`, `/journal`, `/kit` |
| `/panier` | `/kit`, `/journal` |
| `/commander` | `/panier`, wordmark → modal |
| `/merci` | `/journal`, `/maison` |
| `/contact` | `/journal`, `/maison`, `/rituel` |

### 3.7 Pages pivots (soin maximal)

Trois pages concentrent la valeur : `/kit` (BOFU), `/commander` (conversion), `/merci` (relation). Modification : validation Product Owner + revue UX dédiée obligatoire.

### 3.8 Stratégie d'URL

- Slugs lisibles, en français (`/rituel`, `/kit`, `/journal/hiver-ongles-patience`).
- Pas de `/products/` ni `/blog/` (redirects en place).
- Sans trailing slash. Casse lowercase.
- Accents évités dans les slugs (`/maison`, pas `/maïson`).
- Identifiants commande : `FG-YYYY-XXXXX`, exposés via `/merci?order=FG-2026-00037` derrière session.

## 4. Performance et accessibilité

Cibles Web Vitals (cf. `docs/preparation/10-performance-web-vitals.md`) :

| Métrique | Cible |
| --- | --- |
| LCP | < 2.5 s |
| CLS | < 0.1 |
| INP | < 200 ms |

Accessibilité WCAG 2.2 AA minimum :

- `axe-core` en CI.
- Focus management critique sur le tunnel checkout.
- `prefers-reduced-motion` respecté partout.
- Labels explicites sur tous les formulaires.
- Touch targets ≥ 44 × 44 px.

## 5. Synthèse — règles d'or pour toute itération

1. **Palette** — ne jamais introduire une couleur tierce. Toute variante passe par les six couleurs et leurs déclinaisons.
2. **Typographie** — Pinyon réservé au wordmark, Cormorant pour les titres, Inter pour le reste. Pas de bold sur Cormorant.
3. **Motifs** — vague + fleuron + étiquette. Aucun pictogramme externe, aucun emoji.
4. **Photographie** — mains, gestes, détails. Jamais de visage de face. Vidéos en slow motion sans musique.
5. **Voix** — rituel, maison, initiée. Pas de produit, pas de cliente, pas d'urgence.
6. **Animations** — 300 à 800 ms selon le poids du moment. Respect strict de `prefers-reduced-motion`.
7. **Navigation** — quatre entrées max, pas de mega menu, cross-links contextuels et numériquement bornés.
8. **Tokens** — toujours via CSS variables, jamais en littéral dans les composants.
9. **Contraste** — vérifié AAA pour les corps de texte courants, AA partout sinon.
10. **Performance** — LCP < 2.5 s, CLS < 0.1, INP < 200 ms. Toute nouvelle section qui dégrade ces seuils est refusée.
