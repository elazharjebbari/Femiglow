# 03 — Architecture de l'information

> *Sitemap, parcours, navigation, hiérarchie*

---

## 1. Carte du site complète

```
femiglow.ma/
│
├─ /                       (Accueil — TOFU B2C)
├─ /rituel                 (Page narrative — MOFU)
├─ /kit                    (Fiche produit pivot — BOFU)
├─ /journal                (Hub éditorial)
│   └─ /journal/[slug]     (Article)
├─ /maison                 (Récit fondateur)
├─ /panier                 (Pre-checkout)
├─ /commander              (Tunnel checkout 3 étapes)
├─ /merci                  (Post-achat)
├─ /contact                (Contact transverse)
│
│  ── Phase 2 (B2B) ──
├─ /partenaires
├─ /programme
├─ /echantillon
├─ /espace-pro
│
│  ── Phase 2 (Légal) ──
├─ /faq
├─ /legal/mentions
├─ /legal/cgv
├─ /legal/confidentialite
└─ /legal/cookies
```

**Routes Phase 1** : 9 pages B2C + 1 sous-route dynamique (article journal).

## 2. Funnel B2C (parcours principal)

```
[DÉCOUVERTE]   →   [CONSIDÉRATION]   →   [DÉCISION]   →   [POST-ACHAT]
   TOFU              MOFU                  BOFU              ACTIVATION

   /                /rituel               /kit              /merci
   /journal*        /maison               /panier           
   (entrée)         /journal              /commander
                                          (3 étapes)
```

| Étape | Pages | Émotion cible | Action produit clef | KPI |
|---|---|---|---|---|
| **Découverte** | `/` | curiosité | hero éditorial + dual path | bounce < 55 %, scroll > 60 % |
| **Considération** | `/rituel`, `/maison`, `/journal` | intérêt | narratif long + preuve sociale | pages/session ≥ 3, durée > 2:30 |
| **Décision** | `/kit` | désir, hésitation | photo contextuelle + FAQ + 320 MAD | add-to-cart > 8 % |
| **Validation** | `/panier`, `/commander` | engagement | tunnel 3 étapes guest | conversion checkout > 65 % |
| **Activation** | `/merci` | anticipation, fierté | lettre éditoriale + emails J+5/J+15 | NPS > 50 |

## 3. Conventions de navigation

### 3.1 Header (commun B2C)

```
┌─────────────────────────────────────────────────────────────┐
│  FemiGlow      RITUEL  JOURNAL  KIT  MAISON       [Panier·1]│
└─────────────────────────────────────────────────────────────┘
```

**Spécifications** :

| Élément | Détail |
|---|---|
| **Wordmark** | Pinyon Script 36 pt desktop / 28 pt mobile, cliquable → `/` |
| **Menu principal** | 4 entrées B2C : Rituel · Journal · Kit · Maison (max cognitif Gallivan 2011) |
| **Panier** | Compteur visible si articles, sticky top-right |
| **Hauteur** | 80 px desktop / 64 px mobile |
| **Position** | Sticky `z-index: 100`, fond crème blur (backdrop-filter) au scroll > 80 px |
| **B2B** | En Phase 2, menu reçoit une 5ᵉ entrée « PARTENAIRES » légèrement sourde |

**Pas de mega menu**, pas de sous-niveaux déroulants. Wordmark = focal entry point.

### 3.2 Header simplifié (tunnel checkout)

```
┌─────────────────────────────────────────────────────────────┐
│  FemiGlow         🔒 Commande sécurisée    ← Retour panier  │
└─────────────────────────────────────────────────────────────┘
```

Tunnel sans fuite — navigation supprimée (+5 à +12 % conversion, Baymard 2022). Wordmark cliquable ouvre une modal de confirmation « Quitter le checkout ? ».

### 3.3 Footer (commun, dense)

| Colonne | Liens |
|---|---|
| **Le rituel** | Le rituel · Le kit · Journal · Maison |
| **Partenaires** *(Phase 2)* | Le programme · Marges salon · Demander un échantillon · Espace Pro |
| **Assistance** | Contact · FAQ · Livraison · Retours |
| **Légal** | Mentions · CGV · Cookies · Confidentialité |

Fond Encre `#2C2A28`, texte crème, contraste fort = signal de fin.

**Aucun module newsletter en footer global** — la newsletter est valorisée uniquement sur `/journal`.

## 4. Règles inter-pages

### 4.1 Cross-links autorisés

| Page source | Cross-links sortants |
|---|---|
| `/` | `/rituel`, `/journal` (3 articles), `/kit` (CTA implicite) |
| `/rituel` | `/kit` (CTA section pivot), `/journal` (3 articles cross) |
| `/kit` | `/rituel` (lien secondaire), `/journal` (cross fin) |
| `/journal` | `/journal/[slug]`, `/maison`, `/rituel` |
| `/maison` | `/rituel`, `/journal`, `/kit` (3 cross-links fin) |
| `/panier` | `/kit` (continuer mes achats), `/journal` (lecture pendant réflexion) |
| `/commander` | `/panier` (retour), wordmark → modal quitter |
| `/merci` | `/journal`, `/maison` |
| `/contact` | `/journal`, `/maison`, `/rituel` |

### 4.2 Pages pivots (soin particulier)

Trois pages concentrent la valeur de conversion et requièrent un soin maximal :

1. **`/kit`** — fiche produit unique, pivot BOFU
2. **`/commander`** — tunnel checkout
3. **`/merci`** — moment de bascule transaction → relation

Toute modification de ces pages requiert validation Product Owner + revue UX dédiée.

## 5. Stratégie d'URL

| Règle | Application |
|---|---|
| **Slugs lisibles** | `/rituel`, `/kit`, `/journal/hiver-ongles-patience` |
| **Pas de /products/** ni /blog/** | URLs pensées pour humain, pas crawler |
| **Trailing slash** | Sans (`/rituel`, pas `/rituel/`) |
| **Casse** | Lowercase exclusif |
| **Locales (Phase 2)** | `/fr/...`, `/ar/...` (avec `/fr/` redirigé canonical par défaut) |
| **Accents** | Évités dans les slugs (`/maison` plutôt que `/maïson`) |
| **Identifiants commande** | Format `FG-YYYY-XXXXX`, dans body de page `/merci?order=FG-2026-00037` (sécurisé par session) |

## 6. Hiérarchie de l'information par page

Chaque page suit une **structure narrative en 5 à 7 sections**, dans l'ordre :

1. **Hero** — propose la promesse en 5 secondes
2. **Manifeste / Pédagogie** — explique le pourquoi
3. **Méthode / Composition** — explique le comment
4. **Preuve sociale** — témoignages, sciences, sourcing
5. **CTA pivot** — moment décisif
6. **Cross-links** — repli si pas conversion
7. **Footer** — garantie, légal, support

Cette structure préserve la **respiration** et le **rythme musical** des pages : alternance dense / aérée.

## 7. Stratégie SEO architecture (cf. doc 11 pour détails)

| Niveau | Tactique |
|---|---|
| **Site** | Sitemap.xml généré automatiquement, robots.txt soigné, hreflang Phase 2 |
| **Page** | `<title>` 50-60 car, meta description 140-160 car, OG image custom |
| **Schéma** | `Organization` site-wide, `Product` sur `/kit`, `Article` sur `/journal/[slug]`, `BreadcrumbList`, `FAQ` |
| **Linking interne** | 3+ liens entrants par page importante, anchor text descriptive |
| **URLs** | Stables, jamais cassées (redirections 301 si refactor Phase 2) |

## 8. Stratégie multilingue (préparation Phase 2)

L'architecture i18n est posée dès Phase 1, sans contenu AR encore.

| Élément | Phase 1 | Phase 2 |
|---|---|---|
| Routing | Single locale `fr` | `/fr/...`, `/ar/...` avec next-intl |
| Direction | LTR | LTR + RTL switch |
| Polices | Cormorant + Inter | + IBM Plex Sans Arabic + Cormorant Arabic alternative |
| Tokens | `tokens.css` | `tokens.css` + `tokens-rtl.css` overrides |

> *Document suivant : [04 — Spécifications de pages](./04-specifications-pages.md)*
