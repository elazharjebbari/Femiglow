# Audit i18n FemiGlow — Résumé exécutif

> Audit exhaustif des strings affichables à l'utilisateur dans le code source FemiGlow (apps/web/src/).
> Date : 2026-05-27. Périmètre : pages marketing publiques + composants + mocks + emails + erreurs + SEO + legal.
> Hors périmètre : admin, wizard checkout (CHA-231 déjà géré), tests, scripts seed (logs).

## Chiffres clés

- **Total strings auditées : 766** (vs estimation antérieure 600–800)
- **Fichiers parcourus : 85+** (50 lus en profondeur, 35 listés)
- **Drift détecté : ≥ 12 incohérences éditoriales** (voir section "Alertes" ci-dessous)
- **Doublons détectés : 27 strings** dans 2+ fichiers → candidats `common.*`

## Répartition par namespace

| Namespace | Count | % | Notes |
|---|---:|---:|---|
| `marketing` | 485 | 63 % | Pages publiques + composants + mocks |
| `chat` | 65 | 8,5 % | Widget chat (déjà multilingue FR/AR/AR-MA) |
| `seo` | 54 | 7 % | Metadata pages + JSON-LD + known-pages |
| `email` | 44 | 5,7 % | 6 templates transactionnels + shared layout |
| `legal` | 42 | 5,5 % | Mentions légales + composants dynamic |
| `navigation` | 38 | 5 % | Header / Footer / Sommaire menu |
| `errors` | 22 | 2,9 % | 404 / 500 / validation Zod / chat errors |
| `common` | 16 | 2,1 % | Boutons réutilisés, labels génériques |

## Répartition par priorité

| Priorité | Count | % | Cible |
|---|---:|---:|---|
| **P0** | 362 | 47 % | Critical path — home, kit, panier, merci, header, footer, errors, emails critiques |
| **P1** | 331 | 43 % | Important — maison, rituel, contact, journal, FAQs, secondaires |
| **P2** | 73 | 9,5 % | Nice-to-have — alt texts détaillés, dates relatives, articles longs |

→ Sur le critical path (P0), **362 strings à traduire en priorité** (≈ 200 mots × 3 langues = 600 trad units pour FR→AR/EN si on inclut les phrases longues).

## Répartition par catégorie

| Catégorie | Count | Description |
|---|---:|---|
| `ui-static` | 338 | Strings JSX en dur dans composants/pages |
| `mock-data` | 257 | Données seed/mock (homepage, kit, maison, rituel, articles, product) |
| `email-template` | 44 | Templates emails + catalog subjects/preheaders |
| `legal-page` | 42 | Mentions légales (statique) + composants legal dynamic |
| `seo-meta` | 41 | Metadata Next.js (title, description, OG, Twitter) |
| `error-message` | 31 | Erreurs 404/500/validation/lead chat |
| `cms-default-seed` | 13 | Known pages seed (lib/seo/known-pages.ts) |

## Top 10 fichiers par volume

| # | Fichier | Strings | Pourquoi |
|---|---|---:|---|
| 1 | `src/data/mock/kit.ts` | 101 | Composition complète : 3 sous-produits × ingrédients × FAQ × testimonials |
| 2 | `src/data/mock/maison.ts` | 47 | Origine + fondatrice + atelier + matières + 6 engagements + cross-links |
| 3 | `src/lib/products/feed/kit-feed.ts` | 42 | Builder Kolenda-driven : hero + 4 steps + 3 claims + social proof |
| 4 | `src/data/mock/rituel.ts` | 40 | Origine japonaise + sciences (3 essais) + interview (5 Q/R) + pivot |
| 5 | `src/data/mock/articles.ts` | 34 | 14 articles journal (titres + excerpts) — body markdown du 1er article inclus partiellement |
| 6 | `src/components/chat/lead-form-copy.ts` | 32 | 7 variantes (explicit, b2b, purchase, etc.) × FR (déjà mirror AR/AR-MA dispo) |
| 7 | `src/data/mock/homepage.ts` | 29 | Hero + 3 gestes + manifesto + 3 testimonials |
| 8 | `src/app/(marketing)/mentions-legales/page.tsx` | 27 | Page légale statique (avant migration vers `legal/[slug]` CMS) |
| 9 | `src/components/chat/LeadFormBubble.tsx` | 18 | Form fields + country options + error messages FR/AR |
| 10 | `src/app/(marketing)/contact/page.tsx` | 17 | 5 FAQs + cross-links + ContactPoint schema |

## Doublons détectés (candidats `common.*` ou refactor)

| String FR | Occurrences | Recommandation |
|---|---:|---|
| `Le rituel` | 5 | Refactor : c'est à la fois nom de menu/section + label kicker. Garder `navigation.rituel` + alias `marketing.*.kicker_rituel` |
| `La maison` | 4 | Idem — menu + section CrossLink + breadcrumbs |
| `Le journal` | 4 | Idem |
| `Mentions légales` | 4 | OK car contexte différent (footer link, page title, default link, known page) |
| `Retour à l'accueil` | 3 | **`common.back_home`** ← extraction commune |
| `Référence :` | 3 | `common.reference_label` |
| `Le pack` | 3 | Naming hetérogène : `Le pack` vs `Le kit` vs `Pack FemiGlow` — **drift à résoudre** |
| `Panier` | 3 | `navigation.cart` |
| `Journal` | 3 | Variante courte vs `Le journal` |
| `Paiement à la livraison` | 3 | `marketing.checkout.payment_on_delivery` |
| `Sous-total` | 2 | `common.subtotal` (cart_summary + cart_contents) |
| `Continuer le rituel` / `Continuer à découvrir` | 2 | Variantes proches — uniformiser |
| `Retirer` | 2 | `common.remove` (cart_contents + minicart) |
| `Fermer` | 4 | `common.close` (overlay, dialog, minicart, chat) |
| `Voir le kit` | 2 | `marketing.cta.see_kit` |
| `Cire d'abeille` | 2 | Cohérent : ingredient + matière maison |
| `Huile de jojoba` | 2 | Idem |
| `Trois lectures` / `Trois lectures de la maison.` | 2 | Variantes journal grid title |
| `Kératine renforcée ...` | 1 | Pas un dup mais à vérifier (claim) |
| `Livraison offerte` | 3 | `marketing.checkout.shipping_free` |
| `Retour 30 jours` | 2 | `marketing.checkout.return_30_days` |

→ **Recommandation** : créer ~20 clés `common.*` consolidées avant les traductions pour éviter de payer 3× une même phrase à un traducteur.

## Alertes éditoriales (à corriger AVANT traduction)

### A. Drift géographique : Casablanca vs Rabat

L'organisation est éditée à **Rabat** (audit 08/09 — `25 bis avenue Patrice Lumumba`).
Mais :

- `src/lib/seo/defaults.ts` L46 : `addressLocality: 'Casablanca'` (Organization JSON-LD)
- `src/lib/seo/defaults.ts` L71 : `defaultDescription` mentionne `éditée à Casablanca`
- `src/data/mock/articles.ts` L275 : `Le soleil casablancais reprend sa hauteur.` (article excerpt)
- `src/lib/products/feed/kit-feed.ts` L243 : `{count} maisons en France` (incohérent — au Maroc, pas en France)

→ **À corriger côté contenu avant freeze i18n** sinon les 3 versions héritent du drift.

### B. Drift gestes : 3 vs 4 vs 5

- `src/components/sections/GestesGrid.tsx` L16 : default title `"Cinq gestes, cinq minutes."` MAIS la liste actuelle contient 3 gestes (paste/powder/polish)
- `src/lib/seo/defaults.ts` L38 : `"Rituel de manucure japonaise halal en quatre gestes."`
- `src/lib/products/feed/kit-feed.ts` L174 : `"Quatre gestes lents, une fois par semaine."` (préparation + paste + powder + step 4)
- `src/data/mock/homepage.ts` : 3 gestes
- `src/data/mock/rituel.ts` L11 : `"Manucure japonaise. Deux gestes. Un éclat lent."`

→ **Source unique** à trancher : 3 gestes (paste / powder / polish) OU 4 gestes (préparation + 3) OU 2 gestes + 1 polissoir.

### C. Drift sur le nom du produit

- `Pack FemiGlow` (kit-feed, product.ts, comparatif) — **forme officielle**
- `Le pack` (menu, footer columns kit)
- `Le kit` (footer.tsx L15 `routes.kit` label) — divergence
- `Le Kit` (known-pages.ts L10 — capitalisation)

→ Choisir : `Pack FemiGlow` (officiel) ou `Le pack` (commercial sobre).

### D. Drift sur la fondatrice

- `Yasmine Jebbari` dans `src/lib/seo/defaults.ts` L42 (Organization founder)
- `Salma Jebbari` dans `src/app/(marketing)/mentions-legales/page.tsx` L51 (directrice de publication)
- `notre fondatrice` dans la plupart des mocks (anonymisation marketing post-commit `1d3a8c5`)
- `Notre fondatrice` (capitalisé) dans `src/data/mock/rituel.ts` L104

→ Trancher : nom réel OR anonymisé. Le commit récent `1d3a8c5 fix(legal-v2): finaliser anonymisation marketing` indique une intention d'anonymisation, mais `defaults.ts` et `mentions-legales` n'ont pas suivi.

### E. Drift sur volumes/dimensions

- `src/data/mock/kit.ts` L24 : Paste `15 g`
- `src/lib/products/feed/kit-feed.ts` L294 : `1 Paste · 30 ml`  ← drift unité (g vs ml) + valeur (15 vs 30)
- `src/data/mock/kit.ts` L75 : Powder `8 g`
- `src/lib/products/feed/kit-feed.ts` L294 : `2 Powder · 30 g` ← drift valeur (8 vs 30)

→ Founder à trancher avant traduction (les volumes seront traduits tels quels).

### F. Typo / faute frappe détectée

- `src/data/mock/kit.ts` L48 : `Hémisphage des cuticules` (huile de jojoba) → probablement `Hydrophage` ou `Émollient` — **bug texte**.

### G. Strings en MAJUSCULES (à normaliser éventuellement)

| Source | Texte | Recommandation |
|---|---|---|
| `src/lib/products/feed/kit-feed.ts` L172 | `EN TOUT` | Lowercase `En tout` (voix sobre) |
| `src/data/mock/rituel.ts` L10 | `LE RITUEL` | `Le rituel` |
| `src/components/sections/rituals/RitualsModule.tsx` L39, 75 | `LES VOIX DE LA MAISON` | `Les voix de la maison` |

→ Tailwind `uppercase` + tracking en CSS, pas dans la string. **Charte VII Kolenda copywriting #13** : éviter les CAPS d'emphase.

### H. Emojis présents (à arbitrer pour les traductions)

- `✨` apparaît dans : `contact-acknowledgement.tsx`, `order-confirmation.tsx`, `newsletter-confirm.tsx`, `cart-abandoned.tsx`, `lead-form-copy.ts` (4 occurrences FR + 4 AR + 4 AR-MA)
- `🔥` dans `lead-notification.tsx` (interne admin, sortable hors scope)
- `🖨` dans `LegalPrintButton.tsx`
- `→` (flèche) dans nombreux CTAs (emails et UI) — pas un emoji mais un caractère décoratif
- Flags 🇲🇦 🇫🇷 🇧🇪 🇨🇭 🇩🇿 🇹🇳 dans `LeadFormBubble.tsx` (sélecteur pays — légitime)

→ Décision à prendre : garder les emojis ou les retirer (la voix éditoriale FemiGlow est sobre).

### I. Strings d'urgence factice / forcing commercial

Auditées (rien trouvé) :

- ✅ Pas de countdown
- ✅ Pas de `Plus que X en stock !`
- ✅ Pas de `Vente flash`
- ✅ Pas de superlatif `meilleur`, `incroyable`, `révolutionnaire`

→ La voix FemiGlow est respectée — pas d'urgence factice à corriger.

### J. Pages mentionnées dans known-pages.ts mais inexistantes

- `/manifeste` — pas de route correspondante
- `/fondatrice` — pas de route correspondante
- `/temoignages` — pas de route correspondante
- `/faq` — pas de route correspondante
- `/cgv` — gérée via `/legal/cgv` dynamique
- `/cookies` — gérée via `/legal/cookies` dynamique
- `/confidentialite` — gérée via `/legal/confidentialite` dynamique

→ Soit retirer de `known-pages.ts`, soit créer les routes statiques. Impacte les overrides SEO admin.

## Strings à interpolation complexe (candidats ICU MessageFormat)

| Clé | Pattern | Recommandation |
|---|---|---|
| `marketing.commerce.cart.hero.subtitle.*` | 3 branches (0/1/n) | ICU `plural` |
| `marketing.commerce.minicart.quantity_label` | `Quantité {qty}` | ICU `number` |
| `marketing.commerce.merci.order_hero.title` | `Merci, {first_name}.` | Simple var |
| `marketing.commerce.merci.order_hero.estimate` | `entre le {min} et le {max}` | 2 vars date |
| `mock-data.ritual_module.headline_many` | `{total} initiées ont partagé. {oui} reprendraient.` | 2 vars + 2 plurals (initiées + reprendraient) |
| `mock-data.ritual_module.headline_one` / `_many` | Branche 1 / n | ICU `plural` consolidé |
| `mock-data.ritual_module.read_all` | `Lire les {total} rituels partagés` | Var + plural (rituel/rituels) |
| `marketing.kit.hero.savings` | `Économie {savings} MAD` | Var + currency format |
| `email.password_reset.body_expires` | `expire dans {expires} minutes` | Var + plural |
| `chat.message_bubble.sources_label` | `Sources · {count}` | Var + plural (source/sources) |
| `seo.json_ld.product.aggregateRating` | rating + reviewsCount | Numeric format |
| `legal.dynamic.contact_block.updated_line` | `Mise à jour le {date} · v{version}` | Date + var |
| `marketing.commerce.merci.letter.opening_named` | `{first_name}, merci...` | Var |
| `email.order_confirmation.preheader` | `{itemsCount} article(s) · livraison {deliveryEstimate}` | Plural + var |
| `email.cart_abandoned.subject` | `{firstName}, tu as oublié quelque chose ✨` | Var + emoji policy |
| `marketing.journal.metadata.description_filtered` | `articles de la catégorie {category}, écrits à Rabat` | Var |

→ Au total **~16 strings avec interpolations**, dont **6 candidats stricts ICU plural** (count, items, etc.).

## Strings où nom de pays "France" est embarqué (à reviewer)

- `chat.lead_form.countries.france` (légitime — sélecteur pays)
- `marketing.kit.product_feed.social_proof.count_label_geo` (`{count} maisons en France`) — **bug : on est au Maroc**

## Conventions de nommage observées vs `naming-conventions.md`

Mes clés suivent la convention `<namespace>.<section>.<element>` documentée dans `docs/i18n-strategy-2026-05/02-design-conception/naming-conventions.md`. Quelques particularités :

- **Profondeur** : jusqu'à 6 niveaux pour ingrédients (`marketing.kit.composition.paste.ingredient.cire.name`). La convention dit max 5 — à arbitrer (regrouper paste/powder/polissoir sous une clé commune ?).
- **Casse** : tout lowercase + snake_case OK
- **Variables d'interpolation** : nommées en snake_case (`first_name`, `order_id`, `items_count`) selon convention §6.1

## Particularités du chat (CHA-211)

Le widget chat est **déjà multilingue** (FR/AR/AR-MA) via :
- `src/components/chat/lead-form-copy.ts` — copy form
- `src/components/chat/ChatComposer.tsx` — placeholders
- `src/components/chat/LeadFormBubble.tsx` — error messages

→ La structure i18n du chat est **un proof of concept** réutilisable pour le reste de l'app : 3 langues côte-à-côte, sélection par `language: ChatLanguage` typé.

→ **Recommandation** : convertir cette structure en messages.json next-intl pour conserver l'investissement et harmoniser avec le reste.

## Particularités legal (CMS dynamic)

Les pages légales mature (`/legal/[slug]`) sont alimentées par DB (`legal_pages.body_md` rendu Markdown) avec template vars (`{{COMPANY_EMAIL}}`, `{{COMPANY_PHONE}}`, etc.).

→ **Approche i18n recommandée** : les pages CMS legal doivent porter leur traduction **en DB** (`legal_pages_translations` table), pas dans messages.json. Seuls les chrome statiques (kicker, headings, contact-block) restent dans messages.json.

→ La page `/mentions-legales` (statique, hors CMS) doit être migrée vers `/legal/mentions-legales` (CMS) pour bénéficier de la traduction DB. **Sinon : 27 strings statiques à traduire à part.**

## Estimation effort traduction

Si on prend P0 + P1 (chemin critique + important), on a 693 strings.

| Métrique | Estimation |
|---|---|
| Mots FR à traduire (P0+P1) | ~ 12 000 mots (moyenne 17 mots/string) |
| Vers AR | 12 000 mots × 1 = ~12 000 mots AR |
| Vers EN | 12 000 mots × 0,85 = ~10 200 mots EN |
| Total traduction P0+P1 | ~ 34 000 mots tous langues |
| Coût agence (0,12 €/mot) | ~ 4 080 € |
| Coût LLM (review humain) | ~ 800–1 200 € |

→ Estimation cohérente avec budget docs `docs/i18n-strategy-2026-05/00-context`.

## Recommandations next steps

1. **Avant freeze i18n** : corriger les 12 incohérences éditoriales (drift géo, gestes, founder, volumes, typo "Hémisphage").
2. **Avant freeze i18n** : trancher politique emoji (✨ visible 8 fois — à conserver ou retirer).
3. **Phase extraction** : créer `messages/fr.json` en suivant les clés du CSV.
4. **Phase extraction** : extraire 20 strings `common.*` (Retour, Fermer, Sous-total, etc.) avant les autres.
5. **Phase CMS** : prévoir tables `*_translations` pour mocks → DB (`homepage_content_translations`, `kit_page_content_translations`, etc.).
6. **Phase CMS legal** : migrer `/mentions-legales` statique vers `/legal/mentions-legales` (CMS) pour homogénéité.
7. **Phase chat** : convertir `lead-form-copy.ts` en next-intl pour cohérence (l'AR/AR-MA existant servira de base).
