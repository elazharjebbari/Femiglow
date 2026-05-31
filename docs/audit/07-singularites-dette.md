# Singularités, dette technique, manques

Ce document explicite ce qui rend FemiGlow différent d'un e-commerce générique, les zones où la base technique précède l'usage actuel, et les manques connus à anticiper dans les itérations futures.

## 1. Décisions éditoriales fortes

### 1.1 Refus systématique du marketing transactionnel

- Pas de countdown.
- Pas de bandeau « offre flash » ou « stock limité ».
- Pas de pop-up d'aucune sorte (newsletter, exit-intent, promotion).
- Pas de point d'exclamation.
- Pas d'emoji.
- Pas d'étoiles de notation.
- Pas de réduction visible.

Le luxe se signale par ce qu'il refuse — appui académique : Sevilla & Townsend 2016 (espace blanc → +23 % premium perçu).

### 1.2 Langage rituel, pas produit

| Interdit | Préféré |
| --- | --- |
| Acheter | Recevoir |
| Client B2B | Partenaire |
| Produit | Rituel |
| Ajouter au panier | Ajouter au rituel |
| Cliente | Initiée |
| Vernis | (mot tabou) |
| Promotion | (jamais) |

Le vocabulaire crée une grammaire existentielle : la maison ne vend pas, elle initie.

### 1.3 Mains et gestes, jamais visages

- Aucune photo de plein face sur tout le site.
- Mains tenant pots, détails table, gestes, silhouettes de profil, marbre, café.
- Photo fondatrice de profil au travail.
- Témoignages : photos de mains uniquement.

Appui : Lu (2023), trace humaine + efficacité > visages.

### 1.4 Slow motion comme marqueur de luxe

- Toutes les vidéos sont en slow motion (300–400 ms perception).
- Mute par défaut, captions FR + AR.
- Autoplay sur intersection observer 50 %.

La lenteur est un marqueur de luxe perçu (Kolenda, Luxury Branding).

### 1.5 Deux univers, une maison

B2C et B2B partagent palette, typographies et fleurons. Seuls les dosages changent :

| Univers | Dominante | Voix |
| --- | --- | --- |
| B2C | Sauge 60 % | Sensorielle, complice |
| B2B | Crème 60 %, sauge 30 % | Factuelle, partenariale |

Pas de second branding. Une seule maison.

### 1.6 Manifeste structurel

```
Pas une marque. Une maison.
Pas un produit.   Un rituel.
Pas une cliente.  Une initiée.
```

Énoncé sur `/` (hero), développé sur `/maison`, sous-jacent dans chaque CTA. Imprint par triple exposition.

## 2. Contraintes techniques particulières

### 2.1 Image optimization non-négociable

- Vagues SVG inline (jamais rasterisées).
- Photos AVIF/WebP via `next/image`.
- Vidéos lazy + autoplay scroll-trigger.
- Web Vitals stricts : LCP < 2.5 s, CLS < 0.1, INP < 200 ms.

### 2.2 Découplage CMS dès Phase 1

- Tous les composants typés Zod, agnostiques de la source.
- Mocks `data/mock/` Phase 1, Sanity (ou autre) Phase 2.
- Adaptateur `lib/cms/` est le seul point de passage.
- Migration = swap d'adaptateur. Aucun composant ni page modifié.

Discipline architecturale exigeante, payoff : économie massive de refactor Phase 2.

### 2.3 Paiement Maroc

- COD (cash on delivery) = 35–40 % des commandes au Maroc.
- Stripe seul est insuffisant : CMI Maroc + Stripe + COD doivent coexister.
- Le tunnel actuel privilégie Stripe Elements. COD doit être visible dès l'étape 2.
- Validation téléphone format Maroc : `^(\+212|0)[5-7][0-9]{8}$`.

### 2.4 Accessibilité comme posture, pas afterthought

- WCAG 2.2 AA minimum, axe-core en CI.
- Focus management critique sur le tunnel checkout.
- `prefers-reduced-motion: reduce` respecté partout.
- Labels explicites sur tous les formulaires.
- Touch targets ≥ 44 × 44 px.

### 2.5 Pagination plutôt qu'infinite scroll

- Journal : 12 articles initiaux + load-more progressif.
- Aucun infinite scroll.

Appui : Baymard 2022 (load-more améliore conversion, UX plus claire).

## 3. Dette technique anticipée

### 3.1 Décalage admin UI / schéma BDD

La BDD couvre 40+ tables exploitables. L'admin UI est plus partielle, notamment côté `components-cms` et `products-cms`. Risque : une nouvelle variante de produit demanderait aujourd'hui de modifier directement la BDD via Drizzle Studio ou un script de seed, plutôt que via l'admin.

Mitigation : finir les UI admin avant de pousser de nouvelles itérations produit.

### 3.2 Multilingue Phase 2 (FR / AR / AR-MA)

- Le chat est prêt (`chat_instruction_version.body` + `bodyAr` + `bodyArMa`).
- Les tables `component_field_bindings` supportent un champ `locale`.
- En revanche, la couche `lib/i18n/` est minimale et aucun wrapper `t('clé')` n'est imposé dans les composants.

Risque : refactor coûteux si des chaînes sont hardcodées dans les pages Phase 1.

Mitigation : pour toute itération, exposer dorénavant les textes éditoriaux via les schémas Zod / mocks, jamais en littéral dans le JSX.

### 3.3 Catalogue mono-produit

- Phase 1 assume un seul kit (`product.ts`).
- Le schéma `products` + `product_variants` supporte le multi-produit.
- Les mocks et la page `/kit` doivent être préparés à une extension.

Mitigation : tester rapidement un second produit (par exemple une recharge powder) pour valider le multi-produit avant Phase 2.

### 3.4 Comptes guest-only

- Phase 1 : guest checkout obligatoire.
- Aucune entité `User` dans les schémas Zod.
- Schéma `customer` minimal dans `orders`.

Phase 2 : comptes persistants, historique commande, wishlist. À anticiper dès maintenant via un champ `customer_id` nullable dans `orders` (peut-être déjà présent — à vérifier dans `schema.ts`).

### 3.5 Routes B2B en Phase 2

- `/partenaires`, `/programme`, `/echantillon`, `/espace-pro` réservés Phase 1.
- Header prêt pour 5e entrée menu.

Risque : confusion navigation B2C / B2B fragile Phase 2.

Mitigation : clear route groups `(b2c)` / `(b2b)` quand l'arborescence B2B sera implémentée.

### 3.6 Attribution et A/B tests

- Tables `experiments`, `experiment_variants`, `experiment_assignments` posées (migration `0011`).
- Aucun framework A/B running Phase 1.
- Feature flags via Vercel Edge Config envisagés.

Mitigation : ne pas lancer de nouvelle page sans déjà câbler une expérience de référence.

### 3.7 Gestion de stock simple

Phase 1 : `inStock: boolean` sur la fiche kit. Phase 2 : variantes, « bientôt de retour », notifications. Le schéma Zod `inStock: boolean` est extensible vers `stock: { quantity, eta? }` sans casser l'existant.

## 4. Manques visibles

### 4.1 Pas de reviews/UGC

- Pas de système d'avis ratings 5-stars.
- Les avis sont éditoriaux (textes curés, photos de mains).

Décision intentionnelle : les étoiles seraient bruit, et incompatibles avec la voix de la maison. Possibilité Phase 2 si demande forte.

### 4.2 Pas de wishlist / save for later

Aucune mécanique de favoris. Phase 2 si stratégie fidélité.

### 4.3 Pas de double opt-in newsletter

- Inscription en single opt-in actuellement.
- `webhook_endpoints` peut servir de stub.

Phase 2 si conformité légale stricte (RGPD strict, ANCFCC) demande un double opt-in.

### 4.4 Pas de cartes cadeaux / vouchers

Aucune mécanique cadeau. Promo codes simples uniquement (champ replié sur `/panier`). Phase 2 si lien B2B avec instituts.

### 4.5 Pas de recherche dans le journal

Articles explorables uniquement via filtre catégories. Search full-text absent. À ajouter Phase 2 (`searchArticles(q)` côté `cms/`).

### 4.6 Pas d'inventaire de tests de charge

- Dossier `apps/web/k6/` présent, scripts à vérifier.
- Aucune campagne benchmark documentée Phase 1.

Mitigation : préparer un benchmark k6 sur `/kit` + `/commander` avant la mise en production.

### 4.7 Pas de documentation utilisateur final

- README.md projet présent.
- Pas de Storybook publié, ni de site interne de documentation des composants.
- `docs/preparation/annexes/composants-index.md` recense les composants, mais n'est pas relié à des stories.

Mitigation : à activer si l'équipe s'agrandit (rédacteurs CMS Phase 2).

## 5. Singularités à protéger dans les itérations

| Singularité | Pourquoi la protéger |
| --- | --- |
| Refus du marketing agressif | Différenciation marque, base de la promesse |
| Vocabulaire rituel | Crée la grammaire existentielle ; toute fissure casse l'effet |
| Mains, jamais visages | Cohérence visuelle, accessibilité culturelle (Maroc), unicité |
| Slow motion | Marqueur de luxe perçu, signature animée |
| Manifeste 3 lignes | Pivot rhétorique, gradient narratif |
| Round pricing (320 dh) | Émotionnel luxe vs psychologique discount |
| Wordmark Pinyon Script | Identité historique, jamais à autre usage |
| Champagne ≤ 5 % | Préciosité par rareté |
| Pas de bouton « Acheter » | Cohérence linguistique du verbe d'engagement |

## 6. Synthèse — règles de garde-fou pour les itérations

1. Avant toute reformulation : relire `docs/preparation/annexes/glossaire-editorial.md` et le document 04 du présent dossier (lexique do/don't).
2. Avant toute variante produit : vérifier que le schéma `products` + `product_variants` couvre le cas, puis enrichir les mocks et la page `/kit` en respectant les invariants (round pricing, contextual photo, slow reveal).
3. Avant toute nouvelle page : suivre le gabarit `docs/pages/b2c/FemiGlow_Page_*.md` + le plan canonique `docs/plans/` (objectif, KPIs, dépendances, écarts, phases, DoD, métriques, risques).
4. Avant toute nouvelle section : vérifier qu'elle ne dégrade pas LCP < 2.5 s, CLS < 0.1, INP < 200 ms.
5. Avant tout nouveau message utilisateur : vérifier qu'il n'introduit pas de point d'exclamation, d'emoji, de mot interdit, ou d'urgence.
6. Avant tout déploiement : `pnpm test` + `pnpm typecheck` + axe-core CI verts ; sinon refus.
7. Avant toute extension i18n : passer par les schémas Zod + `lib/i18n/`. Aucune chaîne éditoriale en littéral dans le JSX.
8. Avant toute publication de variante de feed produit : passer le linter Merchant + fuzz tests.

## 7. Mot de la fin

Le projet est remarquablement bien spécifié : chaque page a sa fiche, chaque composant son schéma Zod, chaque tactique UI sa citation. L'architecture est production-ready Phase 1, extensible Phase 2 par design. Le principal risque n'est pas technique mais éditorial : tenir la voix sur la durée. Toutes les itérations futures s'inscriront dans ce périmètre, ou devront être justifiées comme exceptions documentées.
