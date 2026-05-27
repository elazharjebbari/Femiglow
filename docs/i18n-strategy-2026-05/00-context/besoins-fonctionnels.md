# Besoins fonctionnels

## 1. Personas + use cases

Cf. [`personas.md`](./personas.md) pour les détails.

### Persona 1 — Visiteur FR (marché Maroc francophone)

**Profil** : 25-45 ans, urbain, francophone, smartphone Android/iOS, 4G.

**Use cases** :
- Découvre FemiGlow via Instagram → atterrit sur `/kit`
- Lit en français, comprend les rituels, ajoute au panier
- Wizard checkout en français
- Reçoit email de confirmation en français

**Besoins i18n** :
- ✅ Site doit charger en FR par défaut (cookie/IP Maroc)
- ✅ Switcher visible mais non intrusif
- ✅ Devise MAD partout

### Persona 2 — Visiteur AR/Darija (marché Maroc arabophone)

**Profil** : 30-55 ans, mix urbain/périurbain, langue première arabe/darija, peut comprendre FR mais préfère AR pour confort.

**Use cases** :
- Atterrit sur le site
- **Doit pouvoir switcher en AR en 1 clic depuis le header**
- Lit le contenu en RTL (droite vers gauche)
- Wizard checkout en arabe
- Email de confirmation en arabe

**Besoins i18n** :
- ✅ **RTL complet** (text-align, paddings, icons mirrored)
- ✅ Locale detection (langue navigateur)
- ✅ Devise MAD
- ✅ Format date arabe (٢٧ مايو ٢٠٢٦)
- ✅ Numbers : optionnel arabes orientaux (٠١٢٣) vs latins

### Persona 3 — Visiteur EN (marché expat + export)

**Profil** : Expat Maroc, ou client international (France, Espagne, USA tier-1), 25-50 ans, anglophone.

**Use cases** :
- Découvre via Google EN ou Instagram FR
- Préfère lire en anglais → cherche le switcher
- Wizard checkout en EN
- Email en EN
- Devise EN local (USD, EUR ?) — à décider

**Besoins i18n** :
- ✅ Switcher EN visible
- ✅ Détection auto via `Accept-Language`
- ⚠️ Devise : MAD par défaut OU conversion EUR/USD si user choisit ?

### Persona 4 — Fondatrice / Admin (gestion contenu)

**Profil** : Bilingue FR/AR, peut écrire EN à l'aide outil.

**Use cases** :
- Modifie le titre d'une section homepage
- Veut traduire un nouveau article journal
- Active une nouvelle langue (ex: ES) sans toucher au code
- Voit dans l'admin "translation completeness" par langue

**Besoins i18n** :
- ✅ UI admin avec **onglets locale** (FR / AR / EN) par champ
- ✅ **Fallback visuel** : si AR pas rempli, montrer FR en grisé
- ✅ **Coverage gauge** : % de strings traduits par langue
- ✅ Pas besoin de redéployer pour ajouter une langue
- ⚠️ Workflow review (publication en draft puis valid)

## 2. Use cases techniques

### UC-T1 — Locale routing path-based

**Description** : URL doit refléter la langue : `/fr/kit`, `/ar/kit`, `/en/kit`.

**Détails** :
- Default : `/` redirige vers `/fr/` (ou langue détectée navigateur)
- Cookie `NEXT_LOCALE` persiste le choix
- `<html lang="fr|ar|en">` dynamique
- `<html dir="rtl">` pour AR

**Pourquoi path-based vs cookie** :
- ✅ SEO friendly (Google indexe `/fr/kit` ET `/ar/kit` séparément)
- ✅ Partageable (lien `/ar/kit` ouvre toujours en AR)
- ✅ Pas de flicker au reload (vs cookie qui demande JS)

### UC-T2 — Locale detection automatique

**Description** : visiteur sans cookie arrive → on choisit langue intelligente.

**Algorithme** :
1. Path URL contient `/[locale]/` → utiliser celle-là
2. Cookie `NEXT_LOCALE` existe → utiliser
3. Header `Accept-Language` contient `fr` → `fr`
4. Header `Accept-Language` contient `ar` → `ar`
5. IP geolocation (Maroc) → `fr` par défaut
6. Fallback ultime → `fr`

### UC-T3 — Switcher de langue ergonomique

**Description** : changer de langue en 1 clic depuis n'importe quelle page.

**UX** :
- Bouton dans header (icône globe + abréviation `FR`)
- Click → dropdown 3 langues
- Sélection → redirect vers même page en nouvelle langue (`/fr/kit` → `/ar/kit`)
- Cookie persisté
- Tracking event `locale_changed { from, to }`

### UC-T4 — Pluralization correcte

**Description** : "1 review" vs "2 reviews" vs "0 reviews".

**Pour AR** : règles plurielles plus complexes :
- 0 : `لا يوجد تقييمات`
- 1 : `تقييم واحد`
- 2 : `تقييمان`
- 3-10 : `3 تقييمات`
- 11+ : `11 تقييم`

Library doit gérer via `Intl.PluralRules` ou ICU MessageFormat.

### UC-T5 — Format de date / nombre / devise localisé

**Description** : `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`.

Exemples :
- FR : `27 mai 2026, 14h30`
- AR : `٢٧ مايو ٢٠٢٦، ١٤:٣٠`
- EN : `May 27, 2026, 2:30 PM`

Prix :
- FR : `199,00 MAD`
- AR : `١٩٩٫٠٠ درهم`
- EN : `199.00 MAD` (ou EUR si conversion)

### UC-T6 — RTL complet pour AR

**Description** : tout l'UI s'inverse pour AR.

Impacts :
- `dir="rtl"` sur `<html>`
- Marges/paddings logiques (`me-2` au lieu de `mr-2`)
- Icônes flèches inversées (chevron right → chevron left visuellement)
- Tables / listes : alignement droite
- Forms : labels alignés à droite

### UC-T7 — SEO localisé

**Description** : chaque page existe en N versions pour Google.

Détails :
- `<link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit">`
- `<link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/kit">`
- `<link rel="alternate" hreflang="en" href="https://femiglow.ma/en/kit">`
- `<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit">`
- `sitemap.xml` liste les 3 versions de chaque page
- JSON-LD localisé (`Organization` avec `inLanguage`)
- OG tags localisés (`og:locale`)

### UC-T8 — Emails transactionnels localisés

**Description** : email envoyé dans la langue de l'utilisateur.

Sources :
- `chat_lead.language` (lead) ou `chat_session.language` (chat)
- Cookie de la session checkout
- Préférence user si compte

Templates :
- `confirmation-commande.fr.mjml`
- `confirmation-commande.ar.mjml`
- `confirmation-commande.en.mjml`

### UC-T9 — Wizard checkout multilingue

**Description** : déjà en place côté code (CHA-231) — manque activation UI.

Effort : remettre le switcher du wizard et activer AR.

### UC-T10 — Activation dynamique nouvelle langue

**Description** : ajouter ES (espagnol) en 1 jour SANS redéploiement code.

Workflow attendu :
1. Admin → `/admin/i18n` → bouton "+ Ajouter langue"
2. Choisit `es` (ES) + ses méta (nom, direction, devise)
3. Upload fichier `es.json` traduit (ou édite en ligne)
4. Page `/es/kit` devient accessible automatiquement
5. Switcher montre ES dans le dropdown

**Pré-requis technique** : library i18n doit charger les locales dynamiquement (pas embarqué en build).

## 3. Constraintes business

| # | Contrainte | Source |
|---|---|---|
| C1 | Pas de duplication de code par langue (DRY) | Lead technique |
| C2 | Voix FemiGlow doit être respectée par langue (pas calque) | Fondatrice |
| C3 | RTL doit être pixel-perfect (pas juste `dir=rtl`) | Designer |
| C4 | Performance : pas plus de 10kb gzipped JS i18n par locale | Lead technique |
| C5 | SEO : ne pas perdre le ranking actuel FR | Marketing |
| C6 | Coût : éviter abonnement Crowdin si possible (>50 USD/mois) | Fondatrice |
| C7 | Délai : MVP (FR + EN + AR) dans 3 mois | Fondatrice |
| C8 | Admin doit pouvoir traduire sans dev | Fondatrice |

## 4. Non-besoins (out of scope)

- ❌ Géoblocage par pays
- ❌ Multi-devise dynamique (1 devise = MAD pour V1)
- ❌ Stripe Tax automation par pays
- ❌ Sub-domaines par pays (`fr.femiglow.ma`)
- ❌ Localisation des images produit (mêmes visuels pour toutes langues)
- ❌ Traduction du `/admin` console (reste FR)
- ❌ ML translation auto sans review humaine

## 5. Critères de succès business

| KPI | Cible 30j post-launch |
|---|---|
| Taux de bounce visiteurs AR | < 50% (vs ~70% actuel quand servi en FR) |
| Conversion EN audience | > 1% (nouveau segment) |
| Pages indexées par langue (Google Search Console) | 100% des URLs FR/AR/EN |
| Temps moyen ajout nouvelle langue (futur) | < 1 jour pour admin |
| `Lighthouse` score multilingue | ≥ 90 sur toutes locales |
