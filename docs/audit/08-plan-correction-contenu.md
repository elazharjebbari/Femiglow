# Plan de correction du contenu — alignement sur le brief mai 2026

Ce plan corrige les fixtures, feeds et contenus statiques du site pour les aligner sur les sept décalages communiqués par la fondation. **Aucune architecture n'est touchée** : composants, schémas Zod, routes Next.js, tables Drizzle restent identiques. On ne modifie que les valeurs portées par les mocks, le content chat-knowledge, les chaînes hardcodées dans les composants présentation, les feeds produit et les snapshots de test.

## 1. Les sept décalages — synthèse

| # | Décalage | Source actuelle | Source cible |
| --- | --- | --- | --- |
| 1 | **Adresse de la maison** | Casablanca (rue d'Oujda, quartier Bourgogne) | **Rabat — 25 bis avenue Patrice Lumumba** |
| 2 | **Prénom de la fondatrice** | Salma (formulatrice, dix ans de laboratoire) | **Souheila** |
| 3a | **Formation fondatrice** | « grand-mère qui préparait ses huiles » | **Master en biologie + plusieurs formations en fabrication de produits cosmétiques** |
| 3b | **Activité fondatrice** | Atelier de formulation à Casablanca | **Anime des formations sur place, possède plusieurs marques de produits cosmétiques naturels** |
| 4 | **Téléphone** | Aucun téléphone par défaut dans la majorité des fichiers ; `+212 630 035 905` présent uniquement dans `chat-knowledge/11-contact-info.md` | **+212 630-035905** uniformément |
| 5 | **Email** | `contact@femiglow.ma` (JSON-LD) | **info@femiglow-maroc.com** |
| 6 | **Produit phare** | Kit Rituel d'Éclat — **trois gestes** « base / fortifiant / lime » dans `mock/kit.ts` (alors que la spec originale parlait de quatre étiquettes paste / powder / shine / polish — décalage interne déjà existant) — prix 320 MAD | **Pack FemiGlow — coffret manucure japonaise halal en deux étapes** : 1 paste (étiquette circulaire vert sauge, pâte crème onctueuse) + 2 powder (étiquette circulaire rose poudré, poudre fine blanche) + polissoir rectangulaire bleu ciel/gris « Step 4 Polish & Shine ». **Prix d'introduction 199 dh au lieu de 390 dh, livraison offerte au Maroc** |
| 7 | **Spec source à reprendre** | `docs/plans/`, `docs/pages/` — laissés intacts | Vérification d'alignement, **pas de réécriture des plans**, juste mise à jour des fixtures et content qu'ils décrivent |

## 2. Arbitrages éditoriaux nécessaires

Le brief introduit deux éléments en tension directe avec la voix « maison » telle que consignée dans `docs/preparation/01-marque-vision-voix.md`, `docs/pages/FemiGlow_Charte_Graphique.md` et le document `04-charte-architecture.md` de cet audit.

### 2.1 Prix barré 199 dh / 390 dh

| Option | Description | Risque | Recommandation |
| --- | --- | --- | --- |
| **A — Maison stricte** | 199 dh affiché en grand. Le 390 dh apparaît comme « prix complet de référence », sans barre rouge ni étiquette « promo », dans une seconde ligne grise discrète. Pas de countdown. | Préserve la voix mais affaiblit le levier de conversion attendu d'un comparateur Meta Ads. | À privilégier par défaut si la voix prime. |
| **B — Commerciale assumée** | 390 dh barré explicitement, badge « Prix d'introduction », 199 dh en couleur d'accent. | Rompt la promesse « pas de promotion visible » de la charte ; demande révision de `01-marque-vision-voix.md` et `04-charte-architecture.md`. | À retenir si l'objectif acquisition prévaut. |

Le schéma Zod `Product` supporte déjà `promoPriceCents: number | null` — donc les deux options sont implémentables sans toucher au code. **Décision à confirmer avant Phase 1.**

### 2.2 « Livraison gratuite au Maroc »

Conflit moindre. Formulation maison proposée :

- **Mention courte** : « Livraison offerte au Maroc » (jamais « gratuite » qui sonne discount).
- **TrustSignal détaillé** : « Livraison offerte — Rabat 24 h, Maroc 48 à 72 h ».

Cette formulation respecte la voix tout en transmettant l'avantage.

### 2.3 « Manucure japonaise halal »

Le concept « halal » est mentionné dans le brief et déjà documenté dans `docs/carrousels-meta/b-halal/`. Aucun conflit éditorial — c'est un descripteur factuel à intégrer dans la fiche produit, le feed et la knowledge base chat.

### 2.4 Domaine email vs domaine site

- Email demandé : `info@femiglow-maroc.com`
- Sitemap, OG, canonical, feed produit actuels : `femiglow.ma`

**Question pour la fondation** : le site reste-t-il sur `femiglow.ma` ou bascule-t-il sur `femiglow-maroc.com` ? Tant que la décision n'est pas prise, on applique :

- Email : `info@femiglow-maroc.com` partout.
- Domaine site : `femiglow.ma` inchangé.
- `seo_settings` à reconfirmer une fois la décision prise.

## 3. Inventaire des fichiers à modifier

Trois lots, dans cet ordre.

### Lot A — Fixtures produit et page kit (priorité 1, impact visuel direct)

| Fichier | Modifications |
| --- | --- |
| `apps/web/src/data/mock/product.ts` | `name` → « Pack FemiGlow » (ou conserver « Le rituel FemiGlow » — choix à arbitrer). `tagline` → « Deux gestes, un polissoir, des ongles révélés. ». `description` → reformulation à partir du brief (coffret halal, deux étapes paste + powder, polissoir Step 4). `priceCents: 19900`, `promoPriceCents: 19900` + `comparePriceCents: 39000` si on étend le schéma (sinon mettre 39000 dans `priceCents` et 19900 dans `promoPriceCents` selon convention). `composition` → 3 items : « 1 paste » (étiquette sauge, pâte crème onctueuse), « 2 powder » (étiquette rose poudré, poudre fine blanche), « Polissoir Step 4 Polish & Shine » (rectangle bleu ciel/gris). `origin` → « Rabat ». `estimatedShipping` → « 24 h à Rabat, 48 à 72 h ailleurs au Maroc ». |
| `apps/web/src/data/mock/kit.ts` | `composition` (ligne 7–117) : refonte complète des 3 items pour matcher paste / powder / polissoir, avec INCI plausibles (cire, kaolin, jojoba conservés pour paste ; talc, silice, riz pour powder ; bois clair pour polissoir). `comparatif` (ligne 119–154) : ajuster « Tenue », « Récupération », « Coût annuel » à la nouvelle réalité 2 étapes. `faq` (ligne 155–204) : retirer toute mention « base / fortifiant / lime » et reformuler en paste / powder / polissoir. `faq.expedition` (ligne 181–185) : remplacer « Casablanca : 48 h en moyenne » par « Rabat : 24 h. Reste du Maroc : 48 à 72 h. ». `handsTestimonials` (ligne 205–266) : conserver les 3 cartes Amal / Lina / Sara, mais changer leur `city` (Amal → Rabat, Lina → Casablanca, Sara → Marrakech) pour garder une géographie marocaine mais déporter le centre de gravité à Rabat. `reassurances` (ligne 267–271) : remplacer « Livraison 48 h — Casablanca, Rabat, Marrakech » par « Livraison offerte — Rabat 24 h, Maroc 48–72 h ». |
| `apps/web/src/lib/schemas/product.ts` | Vérifier si le schéma Zod `Product` autorise déjà `promoPriceCents`. Si oui, rien à faire ; sinon, ajouter le champ et la validation `promoPriceCents <= priceCents`. **Modification mineure de schéma autorisée — n'altère pas l'architecture, juste un champ optionnel supplémentaire.** |
| `apps/web/src/components/sections/HeroProduit.test.tsx` | Mettre à jour les assertions sur prix et nom produit. |
| `apps/web/src/components/commerce/PriceDisplay.test.tsx` | Idem si fixtures de prix codées. |

### Lot B — Identité (fondatrice, adresse, contact)

| Fichier | Modifications |
| --- | --- |
| `apps/web/src/data/mock/homepage.ts` | Ligne 6 `kicker: 'Maison de Casablanca'` → `'Maison de Rabat'`. Ligne 61–62 `authorFirstName: 'Salma'`, `authorContext: 'Casablanca'` → arbitrage : soit on conserve les témoignages Salma + Lina + Sara comme initiées (donc on RENOMME la fondatrice mais on garde Salma comme une initiée), soit on remplace par d'autres prénoms. Recommandation : renommer la fondatrice en Souheila partout, conserver Salma comme initiée témoin (Casablanca acceptable car ce n'est plus l'adresse de la maison). |
| `apps/web/src/data/mock/maison.ts` | Ligne 9 « éditée à Casablanca » → « éditée à Rabat ». Ligne 21 paragraphe « idée à Casablanca, appartement bord de mer » → réécrire pour Rabat (avenue Patrice Lumumba, atmosphère résidentielle Hassan ou Agdal). Ligne 34 `titre: 'Salma, formulatrice...'` → `'Souheila, biologiste et formulatrice.'`. Ligne 36 biographie : remplacer « grand-mère huiles + mère lime + dix ans laboratoire » par « master en biologie + formations en fabrication cosmétique + animation de formations + plusieurs marques de cosmétiques naturels ». Ligne 49 `quartier: 'Bourgogne, Casablanca'` → `'25 bis avenue Patrice Lumumba, Rabat'`. Ligne 132 « expédié depuis Casablanca » → « expédié depuis Rabat ». |
| `apps/web/src/data/mock/rituel.ts` | Ligne 8 « racontée à Casablanca » → « racontée à Rabat ». Ligne 81 « Salma a posé son atelier rue d'Oujda, à Casablanca » → « Souheila a posé son atelier au 25 bis avenue Patrice Lumumba, à Rabat ». Ligne 84 alt portrait Salma → Souheila. Ligne 88 `nomInterviewee: 'Salma'` → `'Souheila'`. Vérifier le bloc « Sciences du soin » (ligne 76 référence Benyahia) — il reste pertinent (université marocaine, conserver). |
| `apps/web/src/data/mock/articles.ts` | Toutes les occurrences de « Salma » (signature, auteur, mentions narratives) → « Souheila ». Toute mention « Casablanca » dans les articles signés par la fondatrice → « Rabat ». Articles signés par des initiées (Lina, Yasmine, Inès, Amal, Sara) : on conserve leurs villes initiales (cohérence géographique des témoignages). |
| `apps/web/src/components/layout/Footer.tsx` | Ligne 67 « FemiGlow — Casablanca » → « FemiGlow — Rabat ». |
| `apps/web/src/components/layout/FooterMinimal.tsx` | Ligne 31 idem. |
| `apps/web/src/components/sections/DirectContactBlock.tsx` | Ligne 27 « depuis Casablanca » → « depuis Rabat ». Ajouter affichage email `info@femiglow-maroc.com` et téléphone `+212 630-035905` si pas déjà via props. |
| `apps/web/src/components/sections/TrustSignals.tsx` | Ligne 16 `title: 'Livraison Casablanca'` → `'Livraison Rabat'` (ou « Livraison offerte au Maroc » selon arbitrage 2.2). |
| `apps/web/src/components/sections/EditorialLetter.tsx` | Signature « Salma · FemiGlow » → « Souheila · FemiGlow ». Vérifier toute mention de ville. |
| `apps/web/src/components/sections/TimelineSteps.tsx` | Mention « depuis Casablanca » → « depuis Rabat ». |
| `apps/web/src/components/sections/AtelierGallery.tsx` | Captions photo atelier qui mentionnent Casablanca → Rabat. |
| `apps/web/src/components/sections/JournalHero.tsx` | « carnet de la maison à Casablanca » → « carnet de la maison à Rabat » (vérifier formulation actuelle). |
| `apps/web/src/components/sections/OrderRecap.tsx` | Mention adresse expéditeur / contact Casablanca → Rabat + email. |
| `apps/web/src/components/sections/AvisStripBound.tsx` | Si Salma figure comme initiée (témoin), conserver — sinon retirer si elle représentait la fondatrice. |
| `apps/web/src/components/commerce/steps/AddressStep.tsx` | Placeholder ville « Casablanca » → conserver (c'est un placeholder de saisie utilisateur, pas une affirmation maison) ou changer pour « Rabat » selon UX souhaitée. |
| `apps/web/src/components/chat/lead-form-copy.ts` | Vérifier mentions Casablanca, mises à jour Rabat. |
| `apps/web/src/components/forms/ContactForm.tsx` | Si email par défaut affiché → `info@femiglow-maroc.com`. |
| `apps/web/src/lib/seo/json-ld.tsx` | Ligne 29 `email: 'contact@femiglow.ma'` → `'info@femiglow-maroc.com'`. Ligne 35 `addressLocality: 'Casablanca'` → `'Rabat'`. Ajouter `streetAddress: '25 bis avenue Patrice Lumumba'` + `telephone: '+212 630-035905'` si pas déjà présent. |
| `apps/web/src/lib/menu-descriptions.ts` | Vérifier descriptions ville-spécifiques. |
| `apps/web/src/lib/components/registry.ts` | Defaults présents pour seed-on-boot — remplacer Casablanca / Salma par Rabat / Souheila. |
| `apps/web/src/lib/components/seed-alt.ts`, `seed-mapping.ts` | Idem (alternatives de seed). |
| `apps/web/src/lib/utils/shipping.ts` | Liste des villes — `Casablanca` n'est plus la ville prioritaire, `Rabat` passe en tête. Vérifier ordre. |
| `apps/web/src/lib/utils/shipping.test.ts` | Mettre à jour assertions. |
| `apps/web/src/lib/stores/cart-store.ts` | Si valeur par défaut ville → Rabat. |
| `apps/web/src/lib/chat/services/intent.ts` | Vérifier patterns d'intent qui matchent Casablanca, ajouter Rabat. |
| `apps/web/src/lib/schemas/order.ts` | Si exemple/placeholder Casablanca → Rabat. |
| `apps/web/src/app/(marketing)/page.tsx` | Hardcoded mentions Casablanca à passer en Rabat. |
| `apps/web/src/app/(marketing)/kit/page.tsx` | Idem. |
| `apps/web/src/app/(marketing)/rituel/page.tsx` | Idem + mentions Salma → Souheila. |
| `apps/web/src/app/(marketing)/maison/page.tsx` | Idem. |
| `apps/web/src/app/(marketing)/journal/page.tsx` | Idem. |
| `apps/web/src/app/(marketing)/contact/page.tsx` | Email + adresse + téléphone par défaut. |

### Lot C — Feeds, SEO, knowledge base chat

| Fichier | Modifications |
| --- | --- |
| `apps/web/src/lib/products/feed/kit-feed.ts` | Ligne 27 commentaire « affinée à Casablanca » → « affinée à Rabat ». Ligne 53 commentaire `// 320 pour 32000` → `// 199 pour 19900`. Ligne 245 description « pensé à Casablanca » → « pensé à Rabat ». Mettre à jour nom du produit, description, prix (`price` + `sale_price` Merchant), `availability`, `brand`, `gtin` si présent. Garder la structure XML, juste actualiser les valeurs. |
| `apps/web/src/lib/products/feed/__snapshots__/json-ld.test.ts.snap` | Snapshot à régénérer après modifs (`pnpm test -u`). |
| `apps/web/src/lib/products/feed/__snapshots__/merchant-xml.test.ts.snap` | Idem. |
| `apps/web/src/lib/products/feed/kit-feed.test.ts` | Vérifier assertions sur prix, ville, nom. |
| `apps/web/src/lib/products/feed/types.ts` | Si types contiennent des exemples Casablanca / 320 → Rabat / 199. |
| `apps/web/content/chat-knowledge/01-kit-overview.md` | Réécrire l'overview : « pack manucure japonaise halal », « 2 étapes paste + powder + polissoir Step 4 », « ongles nus naturellement éclatants », nouveau prix 199 dh. |
| `apps/web/content/chat-knowledge/02-pricing-shipping-maroc.md` | Ligne 31 « Casablanca, Rabat, Salé, Tanger, Marrakech, Fès : 24 à 48 h » → « Rabat : 24 h. Casablanca, Salé, Tanger, Marrakech, Fès : 24 à 48 h ». Prix 320 → 199 partout. Mention « livraison offerte au Maroc ». |
| `apps/web/content/chat-knowledge/03-ingredients.md` | Remplacer le détail base/fortifiant/lime par paste/powder + composition du polissoir. Conserver le ton inventaire INCI. Ajouter mention halal explicite. |
| `apps/web/content/chat-knowledge/04-rituel-soir.md` | Réécrire en 2 gestes paste + powder + finition au polissoir. |
| `apps/web/content/chat-knowledge/05-rituel-matin.md` | Si distinction matin/soir conservée, ajuster. Sinon fusionner en un seul rituel quotidien à 2 étapes. |
| `apps/web/content/chat-knowledge/06-objection-pas-medical.md` | Conserver structure, intégrer la composition halal comme argument. |
| `apps/web/content/chat-knowledge/07-objection-trop-cher.md` | Réécrire avec nouveau prix 199 dh (le rendre cohérent : « au prix d'introduction de 199 dh, soit moins qu'un mois de manucure classique »). |
| `apps/web/content/chat-knowledge/08-objection-ca-marche.md` | Conserver, vérifier mention 3 gestes → 2 gestes + polissoir. |
| `apps/web/content/chat-knowledge/09-shipping-delais.md` | Ligne 11 « Casablanca, Rabat, Salé : 24 à 48 h » → « Rabat : 24 h. Casablanca, Salé : 24 à 48 h ». |
| `apps/web/content/chat-knowledge/10-retour-garantie.md` | Vérifier mention ville expéditeur. |
| `apps/web/content/chat-knowledge/11-contact-info.md` | Téléphone déjà présent (`+212 630 035 905`) — uniformiser le format en `+212 630-035905`. Ajouter email `info@femiglow-maroc.com`. Adresse `25 bis avenue Patrice Lumumba, Rabat`. |
| `apps/web/content/chat-knowledge/12-confirmation-commande.md` | Vérifier mentions Casablanca / Salma. |
| `apps/web/content/chat-knowledge/13-avis-clients.md` | Ligne 18 « — Salma, Casablanca » → arbitrage : si Salma reste une initiée témoin, conserver ; si elle disparaît, remplacer par un autre prénom (ex. Yasmine, Casablanca). Recommandation : conserver Salma comme initiée + ajouter un témoignage Souheila ailleurs ? Non — Souheila est fondatrice, ne témoigne pas. Conserver Salma comme initiée. |

### Lot D — Tests et snapshots (auto-correction)

Une fois les fixtures du Lot A et le content du Lot C modifiés :

| Action | Commande |
| --- | --- |
| Mettre à jour les snapshots Vitest | `pnpm --filter @femiglow/web test -u` |
| Vérifier tests Playwright e2e | `pnpm --filter @femiglow/web test:e2e` |
| Vérifier typecheck | `pnpm typecheck` |
| Vérifier ESLint | `pnpm lint` |

Tests qui contiendront probablement des assertions à corriger (à scanner après modification des fixtures) :

- `apps/web/src/components/sections/TrustSignals.test.tsx`
- `apps/web/src/components/sections/DirectContactBlock.test.tsx`
- `apps/web/src/components/sections/HeroMaison.test.tsx`
- `apps/web/src/components/sections/EditorialLetter.test.tsx`
- `apps/web/src/components/sections/FAQAccordion.test.tsx`
- `apps/web/src/components/commerce/CartSummary.test.tsx`
- `apps/web/src/components/commerce/ShippingModeSelector.test.tsx`
- `apps/web/src/lib/utils/shipping.test.ts`
- `apps/web/src/lib/stores/cart-store.test.ts`
- `apps/web/src/lib/products/feed/kit-feed.test.ts`
- `apps/web/src/lib/products/feed/schema.test.ts`
- `apps/web/src/lib/products/feed/merchant-linter.test.ts`
- `apps/web/src/lib/products/feed/merchant-xml.test.ts` (+ son snapshot)
- `apps/web/src/lib/products/feed/__snapshots__/*.snap`

### Lot E — Documentation source (priorité 3 — alignement durable)

À mettre à jour **après** validation visuelle du front pour figer la nouvelle source de vérité. Ces fichiers ne sont pas servis directement, mais ils orientent les futures itérations.

| Fichier | Modifications principales |
| --- | --- |
| `docs/pages/FemiGlow_Architecture_Site.md` | Mentions Casablanca → Rabat + adresse + email + téléphone. |
| `docs/pages/FemiGlow_Charte_Graphique.md` | Aucun changement palette/typo. Vérifier mentions ville si présentes. |
| `docs/pages/b2c/FemiGlow_Page_Accueil.md` | Mise à jour mentions ville et fondatrice. |
| `docs/pages/b2c/FemiGlow_Page_Kit.md` | Refonte description produit, prix 199 dh, deux étapes + polissoir, halal. |
| `docs/pages/b2c/FemiGlow_Page_Maison.md` | Refonte biographie fondatrice (Souheila, biologiste, formatrice, plusieurs marques). |
| `docs/pages/b2c/FemiGlow_Page_Rituel.md` | Refonte « 4 gestes » → « 2 gestes + polissoir ». |
| `docs/pages/b2c/FemiGlow_Page_Contact.md` | Email + téléphone + adresse par défaut. |
| `docs/pages/b2c/FemiGlow_Page_Commander.md`, `FemiGlow_Page_Merci.md`, `FemiGlow_Page_Panier.md`, `FemiGlow_Page_Journal.md` | Mise à jour ponctuelle ville/fondatrice. |
| `docs/preparation/01-marque-vision-voix.md` | Persona Salma → Souheila (si Salma figurait comme fondatrice). Persona cliente Salma reste une initiée témoin. |
| `docs/preparation/04-specifications-pages.md` | Refonte fiches produit. |
| `docs/preparation/00-executive-summary.md` | Mise à jour adresse + produit. |
| `docs/preparation/annexes/glossaire-editorial.md` | Si Casablanca apparaît comme signature, mettre Rabat. |
| `docs/audit/00-rapport-executif.md` à `07-singularites-dette.md` | Mettre à jour les mentions Casablanca/Salma/320 dh pour rester cohérent avec le nouveau brief. |
| `docs/plans/*.md` | Les plans ne fixent pas les valeurs de contenu, donc faibles modifications. Vérifier les baselines `docs/plans/baselines/*.json` qui figurent comme snapshots de référence (les prix 320 dh y figurent). |
| `docs/chat-assistant/*.md`, `docs/components-cms/*.md`, `docs/checkout-funnel/*.md`, `docs/menu/*.md`, `docs/feed-produit/*.md`, `docs/carrousels-meta/*.md`, `docs/images/*.md`, `docs/admin/*.md`, `docs/analytics-insights/*.md` | Mentions ponctuelles à corriger, en se concentrant sur les README et glossaires. **Ces docs sont du backlog, pas une dépendance bloquante.** |

## 4. Stratégie de remplacement — patterns à grep

Une fois le plan validé, l'exécution s'appuie sur des `grep` ciblés. Patterns canoniques :

| Pattern | Remplacement | Précaution |
| --- | --- | --- |
| `Casablanca` (mot entier) | `Rabat` | **Garder** Casablanca dans les témoignages d'initiées (Lina, Amal originellement à Casablanca peuvent rester) ; **changer** dans toute mention de la maison FemiGlow elle-même. Faire une revue ligne par ligne, pas un `replace_all`. |
| `Salma` (en tant que fondatrice / signataire) | `Souheila` | **Conserver** Salma comme prénom d'initiée témoin ; **remplacer** uniquement les occurrences où elle est désignée comme fondatrice / formulatrice / signataire FemiGlow. |
| `contact@femiglow.ma` | `info@femiglow-maroc.com` | Substitution globale possible. |
| `\b320\b` (avec contexte prix) | `199` | Toujours en contexte « 320 MAD » / « 320 dh » / `priceCents: 32000`. |
| `\b32000\b` (priceCents) | `19900` | Et ajouter `promoPriceCents: 19900` + `comparePriceCents: 39000` ou équivalent selon convention. |
| `+212 630 035 905` ou variantes | `+212 630-035905` | Format canonique unique. |
| `4 gestes`, `quatre gestes`, `trois gestes` | `2 gestes`, `deux gestes` (avec polissoir comme accessoire) | Refonte narrative, pas substitution mécanique. |
| `paste/powder/shine/polish` (étiquettes circulaires originales) | `1 paste / 2 powder / polissoir Step 4` | Refonte narrative. Le polissoir conserve la marque « Step 4 Polish & Shine » sur le packaging — c'est un vestige du concept original japonais à 4 étapes que l'on assume comme tel, sans le réintroduire dans la narration. |
| `rue d'Oujda` ou `quartier Bourgogne` | `25 bis avenue Patrice Lumumba` | Adresse complète. |
| `base / fortifiant / lime` | `1 paste / 2 powder / polissoir Step 4` | Refonte composition produit. |

## 5. Ordre d'exécution recommandé

```
1. Décider arbitrages (§ 2)
   ├── 2.1 Prix barré : option A ou B
   ├── 2.2 « Livraison offerte »
   └── 2.4 Domaine site (femiglow.ma reste / bascule ?)

2. Lot A — Fixtures produit (product.ts, kit.ts)
   └── Vérification visuelle sur /kit + /panier en dev

3. Lot B — Identité (mocks, composants, JSON-LD, seeds)
   └── Vérification visuelle sur /, /maison, /contact, footer

4. Lot C — Feed produit + content chat
   └── Régénération snapshots feed + smoke test chat assistant

5. Lot D — Tests + snapshots
   ├── pnpm test -u
   ├── pnpm test:e2e
   ├── pnpm typecheck
   └── pnpm lint

6. Lot E — Documentation source (à différer, non bloquant)
```

## 6. Risques et précautions

| Risque | Mitigation |
| --- | --- |
| Remplacements `replace_all` aveugles qui mélangent fondatrice et initiée Salma | Forcer une revue ligne par ligne pour chaque fichier — pas de `sed -i` global. |
| Snapshots de tests qui masquent un bug en se re-générant | Après `test -u`, faire un `git diff --stat` sur les `.snap` et lire chaque hunk avant commit. |
| Conflit voix « pas de promo » vs nouveau prix barré | Trancher § 2.1 explicitement avant de toucher PriceDisplay et HeroProduit. Si Option A retenue, documenter le choix de formulation dans `04-charte-architecture.md` et `01-marque-vision-voix.md`. |
| « Step 4 Polish & Shine » imprimé sur le polissoir alors que le rituel est en 2 étapes | Assumer dans la narration : le polissoir hérite du marquage « Step 4 » du concept japonais original ; côté maison FemiGlow on parle de « deux gestes et un polissoir ». Ne pas réintroduire les étapes 1 / 2 / 3 inexistantes. |
| Décalage entre `femiglow.ma` (domaine site) et `femiglow-maroc.com` (domaine email) — risque déliverabilité, SPF/DKIM | Vérifier que le domaine email a un MX configuré et SPF/DKIM valides. À traiter par l'opérationnel hors code. |
| Tests e2e Playwright qui contiennent des assertions sur prix / ville en dur | Lancer la suite après Lot D et corriger les assertions une à une — ne pas désactiver les tests. |
| Multilingue Phase 2 — les valeurs FR sont en train d'être figées sans wrapper i18n | Ne pas hardcoder dans le JSX les nouvelles chaînes. Faire transiter par mocks ou registry de defaults. Cela aligne avec le constat de dette du document `07-singularites-dette.md` § 3.2. |

## 7. Définition de fini

Le plan est terminé lorsque :

- `pnpm typecheck` vert.
- `pnpm lint` vert.
- `pnpm test` vert.
- `pnpm test:e2e` vert (ou skip documenté si dépendance externe indispo).
- Une revue manuelle des 9 pages B2C en dev (`pnpm dev`) montre :
  - Adresse Rabat dans le footer, sur `/maison` et `/contact`.
  - Téléphone `+212 630-035905` cliquable sur `/contact` et widget chat.
  - Email `info@femiglow-maroc.com` cliquable sur `/contact` et footer.
  - Fiche `/kit` : nom « Pack FemiGlow », prix 199 dh, mention prix complet 390 dh selon arbitrage, composition 1 paste + 2 powder + polissoir Step 4, mention halal.
  - `/maison` : fondatrice Souheila, biographie biologiste, atelier 25 bis avenue Patrice Lumumba.
  - Avis initiées (Salma, Amal, Lina, Sara, Yasmine) conservés là où ils sont des témoignages clientes, retirés là où ils représentaient la fondatrice.
  - Feed Merchant XML régénéré contient prix 199 dh, ville Rabat, email info@femiglow-maroc.com.
- Le rapport d'audit `docs/audit/` est mis à jour pour refléter la nouvelle source de vérité (note de bas de chaque document concerné).

## 8. Ce que ce plan NE fait PAS

- Ne touche pas aux schémas Drizzle (`apps/web/src/lib/db/schema.ts`, `lib/chat/db/schema.ts`).
- Ne touche pas aux migrations (`apps/web/drizzle/migrations/`).
- Ne modifie pas les composants UI primitifs (`components/ui/`, `components/layout/` sauf chaînes hardcodées Casablanca/Salma).
- Ne modifie pas l'arborescence des routes Next.js (`apps/web/src/app/`).
- Ne crée pas de nouvelles tables, ni de nouveaux endpoints API.
- Ne réécrit pas les 9 plans `docs/plans/` ni la documentation Kolenda — seulement les mentions de valeurs (ville, fondatrice, prix).
- Ne modifie pas les assets `public/` (les images conservent leur nom de fichier ; seul leur `alt` change si nécessaire dans les fixtures). Une refonte visuelle des packshots produits (qui ne correspondent plus au coffret pastel 2 étapes décrit dans le brief) est à traiter dans un **chantier image séparé**.
- Ne déclare pas la promotion comme événement tracking — la mécanique `promoPriceCents` est statique côté contenu, pas un event campaign.
