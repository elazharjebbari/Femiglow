# Phase 1 — Analyse conceptuelle · Système de pages légales

> Objectif : concevoir un système de gestion des pages légales pour FemiGlow,
> avec admin éditable, intégration design cohérent, exclusion SEO automatique,
> vérification d'accessibilité, et **pages préconfigurées légalement nickels
> pour le contexte marocain** (e-commerce cosmétique).
>
> Niveau : conceptuel et prototypal. Pas de code détaillé, pas de schéma SQL.

---

## TL;DR — Matrice des décisions

| Chantier | Approche retenue | Pourquoi |
|---|---|---|
| 1. Stockage contenu | **DB-first + sync git** | Édition admin sans deploy + audit + recovery git |
| 2. Éditeur admin | **MD raw + preview live (split-pane)** | Simple, accessible, pas de dépendance WYSIWYG |
| 3. Placement (footer/etc) | **Zones configurables en DB** | Flexibilité métier + admin contrôle visibilité |
| 4. SEO exclusion | **Default `noindex` + opt-in admin** | Sécurité par défaut, jamais d'indexation accidentelle |
| 5. Vérification liens | **Cron build-time + dashboard health** | Régression détectée immédiatement |
| 6. Pré-remplissage | **9 pages seedées + workflow review** | Démarre nickel, l'admin ajuste |

**Effort total estimé : 28-40 h** (~ 1 semaine dev focus).

---

## Recherche préalable — Cadre légal marocain (e-commerce cosmétique)

Lois directement applicables :

| Loi | Sujet | Pages impactées |
|---|---|---|
| **Loi 31-08** | Protection du consommateur (rétractation 14j, garantie) | CGV, retours |
| **Loi 09-08** | Protection des données personnelles + CNDP | Confidentialité, cookies |
| **Loi 53-05** | Échange électronique de données juridiques | Mentions, CGV |
| **Loi 24-99** | Produits cosmétiques (DMP) | Avertissements produits |
| **Loi 03-03** | Cybersécurité (lutte contre la cybercriminalité) | Mentions, CGU |

Informations obligatoires côté éditeur :
- **Identification éditeur** : nom, forme juridique, capital social, RC (Registre de Commerce), **ICE** (Identifiant Commun de l'Entreprise — obligatoire 2016+), patente, TVA si assujetti
- **Adresse physique** + email + téléphone
- **Directeur de publication**
- **Hébergeur** (nom, adresse)
- **CNDP** : déclaration ou autorisation de traitement (selon catégorie de données)

Pages légales nécessaires identifiées (9 au total) :
1. Mentions légales
2. Conditions Générales de Vente (CGV)
3. Conditions Générales d'Utilisation (CGU)
4. Politique de confidentialité
5. Politique cookies
6. Politique de retours & remboursements
7. Politique de livraison
8. Avertissements sécurité produits cosmétiques
9. FAQ / service client

⚠️ **Disclaimer** : ce dossier propose des **templates fonctionnels** rédigés
sur la base de la pratique standard du e-commerce marocain. **Une validation
par un juriste qualifié est requise** avant publication. Les templates sont
des **points de départ** ajustables par l'admin.

---

# Chantier 1 — Stockage du contenu

## Problème

Où vivent les contenus ? Comment l'admin édite ? Comment on garde un audit
des modifications légales (important : preuve en cas de litige) ?

## Approche A — « Tout en fichiers MD versionnés git »

Le contenu vit dans `apps/web/content/legal/<slug>.md`. L'admin "édite" en
ouvrant un PR GitHub. Pas de DB. Build-time rendering.

### Forces
- ✅ Versioning git natif (audit parfait, blame, rollback)
- ✅ Pas de DB à gérer
- ✅ CDN-friendly (build statique)
- ✅ Diff lisible

### Faiblesses
- ❌ Nécessite git/CI pour publier (l'admin doit faire un PR)
- ❌ Pas de modification ad-hoc depuis l'interface
- ❌ Délai entre rédaction et publication (build CI)
- ❌ Workflow inadapté aux équipes non-tech

### Pertinence
- ⭐⭐⭐ Idéal pour un site purement tech-driven
- ❌ Mauvais pour FemiGlow où l'admin doit pouvoir corriger en 30s

---

## Approche B — « Tout en DB, édition admin temps réel »

Table `legal_pages` (slug, title, body_md, status, version, …). L'admin
édite via UI, sauvegarde = nouvelle version, publication = bascule
`status='published'`. Pas de touch git.

### Forces
- ✅ Édition admin sans deploy
- ✅ Workflow naturel (draft → publish)
- ✅ Versioning DB (table `legal_pages_history`)
- ✅ Multi-admins simultanés possibles

### Faiblesses
- ❌ Recovery désastre = restore DB only (pas de git fallback)
- ❌ Risque de modification non auditée si admin écrase sans review
- ❌ Pas de PR review possible pour la legal team externe
- ❌ Markdown stocké en DB = pas de syntax highlight au commit

### Pertinence
- ⭐⭐⭐⭐ Bon pour autonomie admin
- ⚠ Manque l'audit légal externe (notaire-style)

---

## Approche C — « Hybride : DB-first + export git automatique »

Le contenu vit en DB (édition admin temps réel). Chaque publication
déclenche un commit sur une branche `legal-versions` (automatisé,
non-bloquant). Le `legal_pages_history` reste source de vérité interne.

### Forces
- ✅ Combine édition rapide + audit git
- ✅ Recovery : DB OR git OR backup
- ✅ Diff git lisible (pour audit)
- ✅ Publication = ack admin + commit signé

### Faiblesses
- ⚠ Complexité un peu plus élevée (job background)
- ⚠ Doubles sources (DB et git) — risque de désync
- ⚠ Secrets git (token) à gérer

### Pertinence
- ⭐⭐⭐⭐⭐ Le meilleur des deux mondes
- ✅ Audit externalisable (le juriste peut review le repo)

---

## 🏆 Recommandation finale Chantier 1

**Approche C** : DB-first avec export git automatique chaque publication.

### Implications design
- **Backend** : table `legal_pages` (active) + `legal_pages_history` (audit)
- Job post-publish qui écrit `content/legal/<slug>.<version>.md` sur la
  branche `legal-versions` (non mergée master)
- Si DB perdue : `pnpm restore-legal-pages` lit le dernier état git
- **Frontend** : éditeur MD avec preview live (cf. chantier 2)
- **UX admin** : workflow Draft → Review → Publish (3 statuts)

---

# Chantier 2 — Éditeur admin

## Problème

Comment l'admin modifie le contenu d'une page ? Quel format ? Avec quel
niveau d'aide visuelle ?

## Approche A — « Raw MD textarea + Save »

Un textarea géant avec le markdown. L'admin tape, sauvegarde. Preview
séparée sur clic.

### Forces
- ✅ Ultra simple, 0 dépendance
- ✅ Performant (juste un textarea)
- ✅ Accessible (clavier natif)

### Faiblesses
- ❌ Pas de preview live → mauvaise UX
- ❌ Syntaxe MD peut intimider l'admin non-tech
- ❌ Pas d'aide (boutons gras/italique/lien)

### Pertinence
- ⭐⭐ OK pour MVP rapide
- ❌ Pas tenable long terme pour utilisateur non-tech

---

## Approche B — « MD raw + preview live split-pane »

Layout 2 colonnes : éditeur MD à gauche, preview rendu à droite (mise à
jour à chaque keystroke). Toolbar avec boutons utilitaires (gras, lien,
titre, liste).

```
┌──────────────────────────┬──────────────────────────┐
│ [B] [I] [H1] [link] [list]│  PREVIEW LIVE            │
├──────────────────────────┤                          │
│ ## Mentions légales       │ ## Mentions légales      │
│                           │                          │
│ **FemiGlow** est édité    │ FemiGlow est édité par…  │
│ par...                    │                          │
│                           │                          │
│ - Adresse : 25 bis…       │ • Adresse : 25 bis…      │
│ - Email : info@…          │ • Email : info@…         │
│                           │                          │
└──────────────────────────┴──────────────────────────┘
```

### Forces
- ✅ Preview immédiat → confidence ++
- ✅ Toolbar aide les non-experts
- ✅ MD reste source de vérité (clean, portable)
- ✅ Léger (markdown-it ou marked, déjà standard)

### Faiblesses
- ⚠ L'admin doit comprendre MD basique (mais 5 min de tuto)
- ⚠ Mobile : split-pane difficile (à dégrader en accordéon)

### Pertinence
- ⭐⭐⭐⭐⭐ Le sweet-spot pour FemiGlow
- ✅ Compatible avec le contenu seedé (qu'on stocke aussi en MD)

---

## Approche C — « WYSIWYG riche (TipTap / Lexical) »

Éditeur visuel comme Notion. L'admin ne voit jamais de MD. Sérialisation
en HTML ou ProseMirror JSON.

### Forces
- ✅ UX "presse-papier" familière
- ✅ Pas de syntaxe à apprendre

### Faiblesses
- ❌ Lourd (200+ KB JS)
- ❌ Difficile à exporter en MD propre (sérialisation lossy)
- ❌ Maintenance lib externe (breaking changes)
- ❌ A11y plus complexe
- ❌ Le contenu legal nécessite parfois du HTML précis (tables, classes
  CSS) que le WYSIWYG ne gère pas bien

### Pertinence
- ⭐⭐ Bon pour blog éditorial
- ❌ Trop lourd pour 9 pages légales rarement modifiées

---

## 🏆 Recommandation finale Chantier 2

**Approche B** : MD raw + preview live split-pane + toolbar utilitaire.

### Implications design

**Composant principal** : `<LegalPageEditor>` avec :
- Toolbar : Bold / Italic / H1 / H2 / Link / List / Quote
- Textarea MD (mono police 14px)
- Preview live (markdown-it ou remark)
- Indicateurs : count caractères, dernier auto-save (every 30s drafts)
- Bouton "Voir page publique" → ouvre `/<slug>` dans nouvel onglet

**Tooltip d'aide** : "Aide markdown" → popover avec syntaxes courantes

**Layout responsive** :
- Desktop : split horizontal 50/50
- Tablet : split horizontal 60/40
- Mobile : tabs "Éditer / Aperçu"

---

# Chantier 3 — Placement (footer & autres zones)

## Problème

Quelles pages apparaissent où ? Footer ? Header ? Banner cookies ? Modal
checkout ? Comment l'admin contrôle ça ?

## Approche A — « Hardcoded liens dans le footer component »

Liste fixe dans le code `Footer.tsx`. Modifier = deploy.

### Forces
- ✅ Simple, zéro DB

### Faiblesses
- ❌ Aucune flexibilité
- ❌ Admin doit demander deploy pour cacher/afficher une page
- ❌ Aucune granularité (toutes les pages affichées ou aucune)

### Pertinence
- ❌ Inadapté à un système configurable

---

## Approche B — « Une liste plate de "footer links" en DB »

Table `footer_links` (label, url, order, is_visible). Le footer lit cette
table.

### Forces
- ✅ Configurable
- ✅ Simple

### Faiblesses
- ⚠ Pas de granularité par zone (footer vs banner cookies vs autre)
- ⚠ Mélange légal et marketing (autres liens footer)

---

## Approche C — « Zones configurables : multi-placement »

Concept : une **page légale** a plusieurs **placements** possibles :
- `footer-main` (colonne légal du footer)
- `footer-bottom-bar` (ligne en bas, ex: © + Mentions légales)
- `cookie-banner-links` (liens dans la bannière cookies)
- `checkout-consent` (acceptation CGV au checkout)
- `signup-consent` (liens politique conf. au signup)
- `mobile-menu` (menu burger)

Chaque page peut être visible dans 0 ou plusieurs zones.

Table `legal_page_placements` :
```
(page_slug, zone_key, display_order, is_visible)
```

L'admin a une **matrice** par page :
```
            footer  footer-bb  cookie  checkout  signup
Mentions      ✅       ✅
CGV          ✅                          ✅
Conf         ✅                ✅                   ✅
Cookies      ✅                ✅
Retours      ✅                          ✅
Livraison    ✅
Sécurité     ✅
FAQ          ✅
```

### Forces
- ✅ Flexibilité maximale
- ✅ Admin contrôle granulaire
- ✅ Évite duplication (1 page → N placements)
- ✅ Évolutif (nouvelle zone = nouvelle key, no breaking)

### Faiblesses
- ⚠ Complexité UI un peu plus élevée (matrice à comprendre)
- ⚠ Risque : admin oublie de placer une page nouvelle (mitigation : alerte
  "Cette page n'est dans aucun placement visible")

### Pertinence
- ⭐⭐⭐⭐⭐ Architecture évolutive et propre

---

## 🏆 Recommandation finale Chantier 3

**Approche C** : zones configurables avec matrice admin.

### Implications design

**Backend** :
- Table `legal_zones` (key, label, description, max_items_recommended)
- Table `legal_page_placements` (page_slug, zone_key, order, visible)

**Frontend admin** :
- Page `/admin/legal/placements` : matrice cliquable
- OU intégré dans l'éditeur d'une page : section "Placement" avec
  checkboxes par zone

**Frontend public** :
- `<FooterLegalLinks>` lit `legal_page_placements WHERE zone='footer-main'`
- `<CookieBannerLinks>` lit `zone='cookie-banner-links'`
- etc.

**Wizard d'onboarding** : quand l'admin crée une nouvelle page légale, le
wizard propose les placements types ("Veux-tu placer cette page dans le
footer ?").

---

# Chantier 4 — SEO & visibilité

## Problème

Les pages légales doivent être accessibles mais **pas indexées** par
Google (pour ne pas polluer les SERP). Comment garantir ça par défaut ?

## Approche A — « robots.txt manuel »

Ajouter à `robots.txt` :
```
Disallow: /mentions-legales
Disallow: /cgv
Disallow: /politique-confidentialite
...
```

### Forces
- ✅ Simple

### Faiblesses
- ❌ Manuel : oubli sur nouvelle page
- ❌ Pas pris en compte par tous les crawlers
- ❌ Maintenance lourde

---

## Approche B — « `noindex` meta dans chaque page légale »

Chaque page légale rend `<meta name="robots" content="noindex, nofollow">`
côté `metadata`. Exclu du sitemap.

### Forces
- ✅ Standard
- ✅ Respecté par tous les crawlers majeurs
- ✅ Pas besoin de toucher robots.txt

### Faiblesses
- ⚠ Doit être appliqué par défaut (oubli possible si page créée par bypass)

---

## Approche C — « Default noindex + opt-in admin pour indexer »

Toutes les pages légales sont `noindex` par défaut au niveau du layout
`/legal/[slug]/page.tsx`. L'admin peut **explicitement** activer
`include_in_search` pour une page (ex : FAQ qui peut bénéficier de SEO).

Conséquences :
- `metadata.robots.index = page.includeInSearch ?? false`
- `sitemap.xml` exclut par défaut, inclut si flag

### Forces
- ✅ Sécurité par défaut (no accidental indexing)
- ✅ Flexibilité pour cas d'usage (FAQ)
- ✅ Visible dans l'admin (flag explicite)

### Faiblesses
- ⚠ L'admin doit savoir activer pour SEO (mais c'est un nice-to-know)

### Pertinence
- ⭐⭐⭐⭐⭐ Pattern sécurisé et adaptable

---

## 🏆 Recommandation finale Chantier 4

**Approche C** : `noindex` par défaut, opt-in via flag admin
`include_in_search`.

### Implications design

**Backend** :
- Champ `include_in_search` BOOLEAN DEFAULT false sur `legal_pages`
- `sitemap.xml` : SELECT slug FROM legal_pages WHERE include_in_search = true
- Route page : `metadata.robots = { index: page.includeInSearch, follow: page.includeInSearch }`

**Frontend admin** :
- Section "SEO" dans l'éditeur de page :
  - Toggle "Inclure dans la recherche Google" (default OFF)
  - Si activé : Title, Description, Canonical visible (champs SEO standard)
  - Avertissement si activé sur une page qui ne devrait pas être indexée
    ("Mentions légales — êtes-vous sûr ?")

---

# Chantier 5 — Vérification des liens

## Problème

L'admin doit garantir que :
1. Chaque page légale **publiée** est accessible via au moins un placement
2. Tous les liens du footer pointent vers des pages **existantes et publiées**
3. Aucune page **dépubliée** n'est encore référencée
4. Pas de lien cassé interne (404)

## Approche A — « Verification manuelle par l'admin »

L'admin teste à la main. Aucune automatisation.

### Forces
- ✅ Zéro coût dev

### Faiblesses
- ❌ Oubli inévitable
- ❌ Pas de visibilité

---

## Approche B — « Build-time check (Next.js plugin) »

Lors du `next build`, un script vérifie que tous les liens dans le footer
résolvent vers des pages existantes (200). Le build échoue si lien cassé.

### Forces
- ✅ Régression bloquée avant deploy
- ✅ CI-friendly

### Faiblesses
- ❌ Pas runtime (un placement créé après build ne sera pas check)
- ⚠ Augmente le build time

---

## Approche C — « Cron job + dashboard santé »

Job background toutes les 30 min qui :
1. Liste tous les `legal_page_placements` visibles
2. Pour chaque (page, zone) : vérifie que la page existe en DB et est `published`
3. Ping HTTP la route publique (200 attendu)
4. Calcule un score "footer health"
5. Dashboard `/admin/legal/health` affiche les anomalies
6. Alerte email si > 1 lien cassé

### Forces
- ✅ Détection continue (pas que au build)
- ✅ Dashboard visible
- ✅ Alerting automatique

### Faiblesses
- ⚠ Coût compute (mais minimal, 1 fois /30 min)

### Pertinence
- ⭐⭐⭐⭐ Pattern robuste

---

## 🏆 Recommandation finale Chantier 5

**Approche B + C combinées** :
- Build-time check (échec CI si placement réfère page absente)
- Cron job runtime + dashboard `/admin/legal/health`

### Implications design

**Backend** :
- Script `scripts/check-legal-links.ts` (utilisable en CI et cron)
- Table `legal_link_health_snapshot` (timestamp, zone, page_slug, status, http_code)
- Route `/api/admin/legal/health` agrège

**Frontend** :
- Page `/admin/legal/health` :
  - Liste des zones avec status (✅ all OK, ⚠ 2 broken, ❌ 5 broken)
  - Détail par zone : liens, status, dernière vérif
  - Bouton "Relancer la vérification"

**CI** :
```yaml
- name: Check legal links
  run: pnpm tsx scripts/check-legal-links.ts --strict
```

---

# Chantier 6 — Pré-remplissage légal

## Problème

L'admin n'a pas le temps (ni l'expertise) de rédiger 9 pages légales from
scratch. Comment livrer un site **légalement opérationnel** dès le seed
initial ?

## Approche A — « Templates vides à remplir »

Seed crée 9 pages avec headings vides : "## TODO". L'admin doit tout
écrire.

### Forces
- ✅ Pas de risque légal (rien n'est faux par défaut)

### Faiblesses
- ❌ Site non publiable immédiatement
- ❌ Friction énorme

---

## Approche B — « 9 pages complètes mais génériques »

Templates pré-rédigés, neutres, à compléter avec les infos FemiGlow (nom,
adresse, RC, ICE, etc.) via variables `${COMPANY_NAME}`, `${ADDRESS}` etc.

### Forces
- ✅ Site démarrable
- ✅ Variables explicites → admin sait quoi remplir
- ✅ Conforme aux standards

### Faiblesses
- ⚠ Génère un faux sens de sécurité (admin ne lit pas et publie)
- ⚠ Templates génériques peuvent manquer de spécificité (cosmétiques)

---

## Approche C — « 9 pages FemiGlow-spécifiques + workflow review obligatoire »

Templates pré-rédigés **adaptés au contexte FemiGlow** (nail care halal,
basé à Rabat, livraison Sendit, paiement COD principal) :
- Contiennent des sections spécifiques cosmétiques (composition INCI,
  conservation, allergies)
- Mentionnent Loi 24-99 et DMP
- Pré-remplis avec infos FemiGlow (à valider par admin)
- Status initial = `draft` (pas publié auto)
- Workflow : Draft → Review → Publish (admin doit cliquer "Review OK" puis
  "Publish")

### Forces
- ✅ Conformité maximale au démarrage
- ✅ Adapté à FemiGlow (pas générique)
- ✅ Review obligatoire = protection juridique
- ✅ Disclaimer en haut : "Validé par un juriste recommandé"

### Faiblesses
- ⚠ Effort de rédaction initial (mais payé une fois)
- ⚠ Maintenance si lois changent (à intégrer dans le runbook)

### Pertinence
- ⭐⭐⭐⭐⭐ Le meilleur pour FemiGlow

---

## 🏆 Recommandation finale Chantier 6

**Approche C** : 9 pages FemiGlow-spécifiques en `draft` avec workflow
Review → Publish.

### Liste des 9 pages à pré-rédiger

| # | Page | Slug | Obligatoire ? | Contenu spécifique FemiGlow |
|---|------|------|---|---|
| 1 | Mentions légales | `/mentions-legales` | ✅ Oui | RC, ICE, hébergeur |
| 2 | CGV | `/cgv` | ✅ Oui | Prix MAD, paiement COD/bank transfer, livraison Sendit |
| 3 | CGU | `/cgu` | ⚠ Recommandé | Compte client, navigation, propriété intellectuelle |
| 4 | Politique de confidentialité | `/confidentialite` | ✅ Oui (Loi 09-08) | CNDP, droits utilisateur |
| 5 | Politique cookies | `/cookies` | ✅ Oui | Cookies analytics, marketing, fonctionnels |
| 6 | Retours & remboursements | `/retours-remboursements` | ✅ Oui (Loi 31-08) | 14 jours, modalités, exclusions cosmétique entamée |
| 7 | Livraison | `/livraison` | ⚠ Recommandé | Zones Maroc, délais, frais |
| 8 | Avertissements sécurité produits | `/securite-produits` | ✅ Oui (Loi 24-99) | Test allergie, conservation, composition |
| 9 | FAQ / Service client | `/faq` | ⚠ Recommandé | Questions courantes |

---

# Wizards proposés

## Wizard "Créer une nouvelle page légale" (admin)

```
┌────────────────────────────────────────────────────────────┐
│  Nouvelle page légale                       Étape 1/5      │
│                                                            │
│  Quel type de page ?                                       │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ● Page personnalisée                                  │ │
│  │   Je rédige de zéro                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ○ Charte / Manifeste                                  │ │
│  │   Page éditoriale formelle                            │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ○ Politique spécifique                                │ │
│  │   Ex: Politique anti-spam, anti-fraude                │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│                              [ Annuler ] [ Continuer → ]  │
└────────────────────────────────────────────────────────────┘

Étape 2/5 : Métadonnées (titre, slug, description courte)
Étape 3/5 : Contenu (éditeur MD + preview live)
Étape 4/5 : Placement (matrix de zones où afficher)
Étape 5/5 : SEO + Publication (noindex default, status Draft)
```

## Wizard "Onboarding initial" (premier seed)

```
┌────────────────────────────────────────────────────────────┐
│  Bienvenue sur le gestionnaire de pages légales            │
│                                                            │
│  Nous avons pré-créé 9 pages légales pour FemiGlow,        │
│  adaptées au cadre marocain et au secteur cosmétique.      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ✓ Mentions légales                       Brouillon   │ │
│  │ ✓ Conditions Générales de Vente          Brouillon   │ │
│  │ ✓ Politique de confidentialité           Brouillon   │ │
│  │ ✓ Politique cookies                      Brouillon   │ │
│  │ ✓ Retours & remboursements               Brouillon   │ │
│  │ ✓ Livraison                              Brouillon   │ │
│  │ ✓ Avertissements sécurité produits       Brouillon   │ │
│  │ ✓ CGU                                    Brouillon   │ │
│  │ ✓ FAQ / Service client                   Brouillon   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ⓘ Toutes les pages sont en BROUILLON. Tu dois les         │
│    relire, compléter les variables ({{COMPANY_RC}},        │
│    {{ICE}}, etc.) et les publier une par une.              │
│                                                            │
│  ⚠ Recommandation forte : faire valider le contenu par     │
│    un juriste avant publication.                           │
│                                                            │
│                       [ Plus tard ] [ Commencer la revue ] │
└────────────────────────────────────────────────────────────┘
```

## Wizard "Publish workflow"

```
Étape 1 — Brouillon (Draft)
   ✏ L'admin édite, sauvegarde quand il veut
   ⓘ Pas accessible publiquement

Étape 2 — Revue (Review)
   👀 L'admin clique "Soumettre à revue"
   📋 Notification envoyée aux co-admins
   ⓘ Toujours pas publié

Étape 3 — Publication (Published)
   ✅ Un co-admin (ou le même) clique "Publier"
   🌐 Page accessible publiquement
   📝 Snapshot pris dans `legal_pages_history`
   🌳 Auto-commit sur branche `legal-versions` (Approche C chantier 1)

Étape 4 — Mise à jour
   ✏ Toute modification d'une page publiée → status passe à "Modifié"
   ⚠ Banner "Page modifiée — repasser par Review avant publier"
```

---

# Wireframes haute-niveau

## Liste des pages — `/admin/legal`

```
╔════════════════════════════════════════════════════════════════════════╗
║  Console FemiGlow > Pages légales                                      ║
║                                                                        ║
║  ┌─ KPIs ──────────────────────────────────────────────────────────┐   ║
║  │  ┌────┐  ┌────┐  ┌────┐  ┌────┐                                  │   ║
║  │  │ 9  │  │ 7  │  │ 2  │  │ 0  │                                  │   ║
║  │  │Tot.│  │Pub.│  │Drf.│  │404 │                                  │   ║
║  │  └────┘  └────┘  └────┘  └────┘                                  │   ║
║  └──────────────────────────────────────────────────────────────────┘   ║
║                                                                        ║
║                                       [+ Nouvelle page] [Health ▸]    ║
║                                                                        ║
║  ┌──────────────────────────────────────────────────────────────────┐ ║
║  │ Titre                  Slug        Status   Placements   Action  │ ║
║  ├──────────────────────────────────────────────────────────────────┤ ║
║  │ Mentions légales       mentions-l… ● Pub.   F, FB        [✏]    │ ║
║  │ CGV                    cgv         ● Pub.   F, CK        [✏]    │ ║
║  │ Politique conf.        confid…     ● Pub.   F, CB, CK    [✏]    │ ║
║  │ Politique cookies      cookies     ● Pub.   F, CB        [✏]    │ ║
║  │ Retours & rembours.    retours     ● Pub.   F, CK        [✏]    │ ║
║  │ Livraison              livraison   ● Pub.   F            [✏]    │ ║
║  │ Sécurité produits      securite    ◐ Drf.   F            [✏]    │ ║
║  │ CGU                    cgu         ◐ Drf.   —            [✏]    │ ║
║  │ FAQ                    faq         ● Pub.   F (SEO ✓)    [✏]    │ ║
║  └──────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  Légende placements : F=Footer · FB=Footer-bottom · CB=Cookie-banner   ║
║                       CK=Checkout · SU=Signup                          ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

## Éditeur — `/admin/legal/<slug>/edit`

```
╔════════════════════════════════════════════════════════════════════════╗
║  ◄ Pages légales  /  Mentions légales                                  ║
║                                                                        ║
║  Status : ● Publiée    Dernière modif : Sara, il y a 3 j               ║
║                                  [Voir page publique ▸] [Historique]   ║
║                                                                        ║
║  ┌─ Métadonnées ────────────────────────────────────────────────────┐ ║
║  │  Titre        [ Mentions légales                              ]   │ ║
║  │  Slug         [ mentions-legales              ]                   │ ║
║  │  Description  [ Informations légales obligatoires…           ]   │ ║
║  └──────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  ┌─ Contenu (Markdown) ─────────────┐┌─ Aperçu live ────────────────┐ ║
║  │ [B] [I] [H1] [H2] [link] [list] │ │ ## Mentions légales          │ ║
║  ├──────────────────────────────────┤ │                              │ ║
║  │ # Mentions légales                │ │ **FemiGlow** est édité par   │ ║
║  │                                   │ │ Sara Jebbari…                │ ║
║  │ **FemiGlow** est édité par        │ │                              │ ║
║  │ Sara Jebbari, dont le siège est   │ │ - **RC** : 12345 / Rabat    │ ║
║  │ à Rabat (25 bis avenue Lumumba).  │ │ - **ICE** : 0012345678…     │ ║
║  │                                   │ │                              │ ║
║  │ - **RC** : 12345 / Rabat          │ │                              │ ║
║  │ - **ICE** : {{ICE}}               │ │ ⚠ Variable {{ICE}} non       │ ║
║  │ - **Patente** : {{PATENTE}}       │ │   remplie                   │ ║
║  │ ...                               │ │                              │ ║
║  │                                   │ │                              │ ║
║  └──────────────────────────────────┘└──────────────────────────────┘ ║
║                                                                        ║
║  ┌─ Placement ──────────────────────────────────────────────────────┐ ║
║  │ ☑ Footer principal                                                │ ║
║  │ ☑ Footer bottom bar                                               │ ║
║  │ ☐ Bannière cookies                                                │ ║
║  │ ☐ Acceptation checkout                                            │ ║
║  │ ☐ Acceptation signup                                              │ ║
║  └──────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  ┌─ SEO ────────────────────────────────────────────────────────────┐ ║
║  │ ☐ Inclure dans les résultats Google (recommandé : décoché)        │ ║
║  │                                                                   │ ║
║  │   Cette page sera servie avec <meta name="robots" content=         │ ║
║  │   "noindex, nofollow"> et exclue du sitemap.xml.                  │ ║
║  └──────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║                            [Sauvegarder brouillon] [Soumettre revue]  ║
║                                                  [Publier (admin only)]║
╚════════════════════════════════════════════════════════════════════════╝
```

## Page publique — design cohérent FemiGlow

```
╔════════════════════════════════════════════════════════════════════════╗
║  [Logo FemiGlow]  Maison · Rituel · Kit · Journal      Sommaire        ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║                          Mise à jour : 13 mai 2026                     ║
║                                                                        ║
║                      ═══════════════════════════════                   ║
║                                                                        ║
║                            Mentions légales                            ║
║                       (font-display Cormorant)                         ║
║                                                                        ║
║   ┌─────────────────── prose container max-w-prose ──────────────────┐║
║   │                                                                  │║
║   │  Éditeur du site                                                 │║
║   │                                                                  │║
║   │  FemiGlow est édité par Sara Jebbari, dont le siège social      │║
║   │  est situé à Rabat (25 bis avenue Patrice Lumumba).             │║
║   │                                                                  │║
║   │  • Adresse : 25 bis avenue Patrice Lumumba, Rabat, Maroc        │║
║   │  • Email : info@femiglow-maroc.com                              │║
║   │  • Téléphone : +212 630-035905                                  │║
║   │  • Directrice de publication : Sara Jebbari                     │║
║   │                                                                  │║
║   │  Hébergement                                                     │║
║   │  ────                                                            │║
║   │  Le site est hébergé sur serveur dédié …                        │║
║   │                                                                  │║
║   │  …                                                               │║
║   │                                                                  │║
║   └──────────────────────────────────────────────────────────────────┘║
║                                                                        ║
║                                                                        ║
║                    [ Voir aussi : CGV · Confidentialité ]              ║
║                                                                        ║
╠════════════════════════════════════════════════════════════════════════╣
║   FOOTER avec liens légaux (footer-main zone)                          ║
╚════════════════════════════════════════════════════════════════════════╝
```

Style cohérent : police Cormorant Garamond (titres), Inter (body), prose
max-width, ton calme et pédagogique. Hiérarchie claire (h2, h3, listes).

---

# Synthèse finale

| Chantier | Approche retenue | Effort | Impact |
|---|---|---|---|
| 1 | DB-first + sync git | 8h | 🔴 Critique (audit) |
| 2 | MD raw + preview live | 6h | 🟠 Élevé (UX) |
| 3 | Zones placement DB | 5h | 🟠 Élevé (flexibilité) |
| 4 | noindex default + opt-in | 2h | 🔴 Critique (SEO) |
| 5 | Build + cron + dashboard | 4h | 🟡 Moyen (qualité) |
| 6 | 9 pages FemiGlow pré-rédigées | 6h | 🔴 Critique (legal) |
| Tests + a11y + e2e | | 5h | 🟠 Élevé |
| **TOTAL** | | **36h** | |

L'investissement de 36h livre un système qui :
- ✅ Permet à l'admin de gérer les pages légales sans deploy
- ✅ Garantit la non-indexation Google par défaut
- ✅ Vérifie l'intégrité des liens en continu
- ✅ Démarre avec 9 pages légales conformes au contexte marocain
- ✅ Préserve un audit trail (DB history + git)
- ✅ Reste flexible (nouvelles zones, nouvelles pages)

Le dossier technique complet suit en Phase 2.
