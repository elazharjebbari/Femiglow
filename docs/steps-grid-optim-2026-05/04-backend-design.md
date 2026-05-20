# 04 — Backend design

## 1. Architecture

```
KitPageContent (mock)
        +
Product (DB)
        ↓
buildKitProductFeed(product, content, stats)   ← builder pur enrichi
        ├─ buildSteps()                  ← ajoute duration, icon, isResult
        ├─ buildStepsHeader()            ← « EN TOUT / 5 minutes / lead »
        └─ buildStepsPostCta()           ← « Démarrer le rituel ↓ »
        ↓
ProductFeed (mock par défaut)
        ↓
resolveKitSteps(feed)                   ← G5 admin override (optionnel)
        ↓
StepsTimeline (Client / RSC)
```

## 2. Builder enrichi (`kit-feed.ts`)

Pur, déterministe, testé. Aucune lecture DB.

Voir doc 03 §7 pour le code.

**Invariants** :
- Toujours 4 steps (validation Zod `.length(4)`).
- `step.isResult = true` exclusivement sur step 4 (par convention métier
  — mais le schéma laisse la liberté à l'override admin de marquer un
  autre step si besoin futur).
- `step.duration` est facultatif côté schema, mais **toujours produit**
  par le builder pour les 4 steps (G0).

## 3. Override admin (G5 — optionnel)

Pattern singleton miroir de `KitPackOverride` :

### Store
`lib/kit/steps/store.ts` :
- `getKitStepsOverride()` → `KitStepsOverride | null`
- `upsertKitStepsOverride(patch, {actorId})` → merge champ par champ
- `publishKitStepsOverride()` → publishedAt = now
- `unpublishKitStepsOverride()` → repasse draft
- `resetKitStepsOverride()` → delete

Memorystore via `ext()` clé `'kit-steps'`.

### Resolver
`lib/kit/steps/resolver.ts` :
- `resolveKitSteps(feed)` → applique l'override publié sur le feed
- `resolveKitStepsDraft(feed)` → inclut le draft (admin preview)

### API routes
- `GET / PATCH /api/admin/kit/steps`
- `POST /api/admin/kit/steps/publish`
- `POST /api/admin/kit/steps/reset` (magic word `RESET-STEPS`)

### Audit events
- `kit_steps.update`
- `kit_steps.publish`
- `kit_steps.unpublish`
- `kit_steps.reset`

### Tag cache
`KIT_STEPS_TAG = 'kit-steps'` → `revalidateTag` après mutation.

## 4. Tracking côté serveur

Aucun side-effect serveur. Tous les events (`pack_steps_view`,
`pack_steps_complete_view`, `pack_steps_cta_click`) sont émis côté
client via `useTracking().emit()`.

Le serveur ne valide pas les events (le tracker side-server `validator.ts`
peut accepter ces events sans schema explicite, comme pour les events
`composition_*` existants).

## 5. Garanties / isolation

| Garantie | Mécanisme |
|---|---|
| Le feed XML Merchant Google Shopping reste inchangé | Le builder pur n'est jamais lu par `merchant-xml.ts` côté `steps` (déjà le cas, à conserver) |
| L'override admin n'impacte que le rendu HTML public, pas le XML | `resolveKitSteps()` n'est appelé QUE depuis `ProductFeedSectionBound`, pas depuis `app/feed.xml/route.ts` |
| Rétro-compat consommateurs schema | Tous nouveaux champs `.optional()` |
| Idempotence seed-pipeline | Re-seed = recalcule duration / icon depuis builder pur ; override admin reste préservé tant qu'aucun reset |

## 6. Décisions architecturales

| Décision | Raison |
|---|---|
| Header + PostCta sont sur `ProductFeed`, pas en composants top-level | Cohérence avec le pattern `hero`, `socialProof` qui sont déjà sur `ProductFeed` |
| Icônes en clé enum, pas en URL ou Component slot | Stabilité (les 4 icônes sont figées) + perf (SVG inline lazy) |
| Pas de Components-CMS pour les icônes des steps | Cohérence claims (leaf/drop/sparkle eux aussi en clé enum dans `ProductFeedClaim`) |
| Override admin = G5 (optionnel) | Le mock builder couvre 95 % des besoins ; l'override est un nice-to-have qui peut attendre une itération |
| Magic word distinct `RESET-STEPS` | Cohérence avec `RESET-PACK`, `RESET-VIDEO`, `RESET-COMPOSITION-{ID}` |

## 7. Diagramme cascade

```
                ┌────────────────────────────────┐
                │ buildKitProductFeed(product…)  │  (pure)
                └─────────────┬──────────────────┘
                              │ produces
                              ▼
                ┌────────────────────────────────┐
                │ ProductFeed (with steps,       │
                │ stepsHeader, stepsPostCta)     │
                └─────────────┬──────────────────┘
                              │
              ┌───────────────┴───────────────────────┐
              │                                       │
              ▼ public read                           ▼ G5 admin write
   ┌────────────────────┐               ┌────────────────────────────┐
   │ resolveKitSteps    │               │ KitStepsOverride (memstore)│
   │ (feed)             │←──── merge ───│ via /api/admin/kit/steps   │
   └─────────┬──────────┘               └────────────────────────────┘
             │
             ▼
  ProductFeed final → StepsTimeline (StepsHeader + 4 StepCard + PostCta)
```
