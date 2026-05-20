# 01 — Contexte et analyse Kolenda

Document de référence justifiant le plan. Synthèse de la revue Kolenda du bloc « La composition » et inventaire technique.

## 1. État du composant actuel

### 1.1 Architecture

```
app/(marketing)/kit/page.tsx
  └─ CompositionRevealBound (Server Component)
       └─ CompositionReveal (component présentation)
            └─ ProductCard × 3 (un par sous-produit)
```

| Fichier | Rôle | Lignes clés |
|---|---|---|
| `apps/web/src/components/sections/CompositionRevealBound.tsx` | Resolve les `mediaSlots` Component-Media | 19-24 mapping ids → slots |
| `apps/web/src/components/sections/CompositionReveal.tsx` | Section avec H2 + intro + grid 3 cards | 28-61 |
| `apps/web/src/components/commerce/ProductCard.tsx` | Card individuelle d'un sous-produit | 17-52 |
| `apps/web/src/data/mock/kit.ts` | Source de vérité actuelle (Paste/Powder/Polissoir) | 14-126 |
| `apps/web/src/lib/schemas/product.ts` | Schema Zod `SubProduct` | 30-39 |

### 1.2 Schema de données actuel

`SubProduct` (`apps/web/src/lib/schemas/product.ts`) :

```ts
export const subProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(),
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema).min(1),
  certifications: z.array(certificationSchema),
});
```

7 champs. **Aucune** notion de sensation, d'image contextuelle, de couleur d'accent.

### 1.3 Source de données

- **Adapter mock** : `apps/web/src/lib/cms/mock/index.ts:80` → `mockKitPageContent`.
- **Mock** : `apps/web/src/data/mock/kit.ts:14-126` — 3 sous-produits hardcodés.
- **Adapter Sanity** : `apps/web/src/lib/cms/sanity/index.ts` — non implémenté (Phase 2).
- **Pas de table DB** : la composition est du contenu CMS statique, pas un produit catalogue.
- **Images** : Component-Media (component `kit-comparatif`, slots `kit-base`, `kit-fortifiant`, `kit-lime`).

### 1.4 Éditabilité admin

**Aucun éditeur dédié.** Les images sont pilotables via `/admin/components/kit-comparatif` (Component-Media). Les champs texte (nom, volume, description, ingrédients) **ne sont pas exposés en admin** — seule la modification du mock TS permet de les éditer.

### 1.5 Tests existants

| Sujet | Couverture |
|---|---|
| `CompositionReveal` rendering | **Aucun test** |
| `ProductCard` rendering | **Aucun test** |
| `SubProduct` schema validation | **Aucun test** |
| `getKitPageContent` (chaîne CMS) | Couvert indirectement via `feed.xml` tests |
| Component-Media binding pour `kit-comparatif` | **Aucun test** |
| Accessibilité (axe) | **Aucun test** |

Gap considérable : zéro garde-fou unitaire sur cette zone visuelle critique.

## 2. Analyse Kolenda — section 4.3 du playbook

### 2.1 Recommandations source

Citations du playbook (`docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.3) :

> Activer le `which-to-choose mindset` indirectement (la cliente choisit *son geste préféré*).
> Garder 3 cards (Paste, Powder, Polissoir) — *pas* d'ajout.
> **Ajouter en tête de section une vue éclatée annotée** du kit (composants étalés à plat, lignes fines vers chaque label). Format isométrique doux, fond sable.
> Image **détourée** (isolated) en premier état. Au hover ou en tap : image **contextuelle** (sur table de chevet, dans la main).
> Titre : nom du produit + volume (`1 Paste · 15 g`).
> Description : 2 phrases, voix maison, **continuité d'image** (l'objet de la phrase 1 devient sujet de la phrase 2).
> **Ajouter une mention de sensation** : « tiède au contact », « glisse lentement », « la lumière revient à la surface » — *induce sensation* (UX p. 8-9).
> Couleurs : fond sable, cards ivoire avec bordure gris-sauge 1 px. Un chiffre / numéro en or poudré `#B8956B`.

### 2.2 Comparaison état actuel vs cible

| Aspect | Actuel | Cible Kolenda | Écart |
|---|---|---|---|
| 3 cards | ✓ | ✓ | Conforme |
| H2 takeaway | ✓ « Trois objets, trois gestes. » | ✓ | Conforme |
| Continuité d'image (intro) | ✓ | ✓ | Conforme |
| Voix maison | ✓ | ✓ | Conforme |
| Photo isolated | ✓ | ✓ premier état | Conforme |
| Photo contextuelle (hover/tap) | ✗ | ✓ second état | **Écart** |
| Vue éclatée annotée | ✗ | ✓ en tête | **Écart** |
| Numéro or poudré | Sur la photo (1, 2) | Pastille typo dédiée `#B8956B` | **Écart** |
| Bordure gris-sauge cards | ✗ | ✓ 1 px `#C7CCC2` | **Écart** |
| Fond sable section | `bg-creme` | `#EFE9DD` | **Écart** |
| Volume inline | « 15 G » CAPS sur ligne séparée | « · 15 g » collé au titre | **Écart** |
| Mention sensation | ✗ | ✓ 3ᵉ phrase italique | **Écart** |
| Animation reveal | ✗ | Fade 400-600 ms | **Écart** |
| Hover state | ✗ | ✓ | **Écart** |

8 écarts identifiés.

## 3. Findings priorisés

### P0 — Quick wins visuels (sans backend, ≤ 0,5 j)

| ID | Item | Effort | Référence |
|---|---|---|---|
| F-01 | Volume inline `· 15 g` + tabular-nums | 10 min | §2.3 + Pricing §51-56 |
| F-02 | Numéro or poudré `01` / `02` / `03` | 30 min | §4.3 + Annexe A |
| F-03 | Bordure gris-sauge `#C7CCC2` + fond ivoire card | 20 min | §4.3 |
| F-04 | Section `bg-creme` → `bg-sable` `#EFE9DD` | 5 min | §4.3 |
| F-05 | Lien `Voir la composition ↓` → `Lire le détail ↓` | 5 min | UX §3 |

### P1 — Structuration et sensation (1-1,5 j)

| ID | Item | Effort | Référence |
|---|---|---|---|
| F-06 | Schema `SubProduct` étendu : `sensation`, `contextualImage`, `accentColor` | 1 h | §4.3 + Annexe A |
| F-07 | `CompositionCard` dédié (extrait `ProductCard`) | 0,5 j | Maintenabilité |
| F-08 | Mention sensation en italique Cormorant sous la description | 30 min | §4.3 + UX §13 |
| F-09 | Copy maison réécrite (Paste/Powder/Polissoir + sensations) | 1 h | Annexe B playbook |

### P2 — Image contextuelle + animation (1,5 j)

| ID | Item | Effort | Référence |
|---|---|---|---|
| F-10 | Image contextuelle au hover/tap (crossfade 500 ms) | 0,5 j | §4.3 + Ecommerce §6 |
| F-11 | Animation reveal au scroll (Framer Motion stagger 120 ms) | 0,5 j | Luxury §18 |
| F-12 | Skeleton blur-up sur les images | 0,5 j | UX §8 |

### P3 — Vue éclatée et admin (3,5 j)

| ID | Item | Effort | Référence |
|---|---|---|---|
| F-13 | Vue éclatée annotée en tête | 1,5 j (dont DA) | §4.3 reco explicite |
| F-14 | Admin éditeur `/admin/kit/composition` | 2 j | Éditabilité native |

### P4 — Confort et scale (backlog)

| ID | Item | Effort |
|---|---|---|
| F-15 | Mobile scroll-snap horizontal (A/B) | 1 j |
| F-16 | Tooltip étymologie / origine japonaise au tap sur termes | 0,5 j |
| F-17 | Variant dark hover preview désactivé (volontaire) | — |

## 4. Hypothèses retenues pour le plan

- Le **mock TS reste source de vérité court terme**. Sanity est planifié mais hors scope ici.
- Le **schema `SubProduct` est rétrocompatible**. Les nouveaux champs `sensation`, `contextualImage` sont optionnels.
- L'**admin éditeur** (phase 6) utilise les conventions admin existantes (`/admin/components`, `/admin/products`).
- Component-Media reste le système de pilotage media des **images isolated**. Les images contextuelles passent par une extension du même système (nouveau slot par sous-produit).
- Pas de migration DB destructive.

## 5. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Régression visuelle sur `/kit` lors de l'extraction `CompositionCard` | Moyen | Élevé | Snapshot Vitest + Playwright sur `section#composition-title` |
| Hover contextuel mal supporté sur mobile (pas de hover) | Élevé | Moyen | Alternance default (1/3 contextuelles d'emblée sur mobile) + bouton lever |
| Vue éclatée DA non livrée dans les temps | Moyen | Faible | Phase isolée, livrable hors chemin critique |
| Admin éditeur déclenche surcharge cognitive | Faible | Moyen | Réutilisation patterns admin existants, formulaire séquentiel |
| Performance hero perdue par animations | Faible | Moyen | Framer Motion `whileInView` + `once: true`, pas d'observers globaux |
| Tests existants cassent suite à extraction | Moyen | Faible | Aucun test existant sur ce périmètre (à créer) |

## 6. Sources

- Analyse Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §2.3, §4.3, Annexe A, Annexe B.
- Inventaire technique : agent Explore (2026-05-20).
- Conversation de revue visuelle : 2026-05-20.
- Dossier précédent SEO : `docs/seo-action-plan-2026-05/` (référence conventions plan).
