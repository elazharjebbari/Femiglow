# 03 — Plan d'action par phase

## Vue d'ensemble

| Phase | Sujet | Effort | Statut |
|---|---|---|---|
| **L-1** | Fix CartRecap pricing (compareAt dynamique) | 30 min | ✅ Mergé (commits 4092b26 + 822e665) |
| **L0** | Préparation : flag + docs + tracking events | ½ j | 🟡 En cours |
| **L1** | Reorder sections derrière flag v2 | ½ j | ⏳ |
| **L2** | Trim 3 sections en v2 | ¼ j | ⏳ |
| **L3** | Tests E2E + Lighthouse + axe | ¼ j | ⏳ |
| **L4** | Rollout progressif (Canary → Ramp → Full) | J+7 mesures | 🛑 Gate humain |

---

## L0 — Préparation

### L0.1 — Dossier docs (ce dossier)
6 fichiers Markdown structurant la refonte. **Fait**.

### L0.2 — Feature flag
**Fichier** : `apps/web/src/lib/feature-flags/kit-layout.ts`

```ts
export const KIT_LAYOUT_VERSION: 'v1' | 'v2' =
  process.env.NEXT_PUBLIC_KIT_LAYOUT_V2 === 'true' ? 'v2' : 'v1';
```

3 tests vitest : default v1, env=true → v2, env=invalid → v1.

### L0.3 — Tracking events Zod
Étendre `apps/web/src/lib/tracking/schemas.ts` :
- `kit_section_viewed` — { sectionId, position, viewportPct }
- `kit_wizard_visible_first_time` — { timeFromPageLoadMs, scrollDepth }

Ajout dans `eventCategoryByName` : `'engagement'` pour les 2.

### L0.4 — Snapshots baseline
Git tag : `git tag kit-landing-baseline-2026-05-22`
Optionnel (si Playwright dispo) : screenshot baseline desktop + mobile.

### Critères acceptation L0
- [x] Dossier docs créé avec 6 fichiers
- [ ] Flag dispo (`KIT_LAYOUT_VERSION === 'v1'` par défaut)
- [ ] 3 tests vitest flag verts
- [ ] 2 nouveaux events Zod publiés
- [ ] Git tag créé

---

## L1 — Reorder sections

### L1.1 — Split `apps/web/src/app/(marketing)/kit/page.tsx`

Extraire deux composants serveur :
- `KitPageV1` (ordre actuel, inchangé)
- `KitPageV2` (nouvel ordre)

```tsx
export default async function KitPage() {
  const data = await Promise.all([...]);
  return KIT_LAYOUT_VERSION === 'v2'
    ? <KitPageV2 {...data} />
    : <KitPageV1 {...data} />;
}
```

### L1.2 — Sticky CTA mobile

**Fichier** : `apps/web/src/components/marketing/KitStickyMobileCta.tsx`

```tsx
'use client';
export function KitStickyMobileCta() {
  return (
    <a
      href="#commander-femiglow"
      data-testid="kit-sticky-cta"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden ..."
    >
      Commander · 199 MAD
    </a>
  );
}
```

Tracking : déclenche `cta_click` avec `{ source: 'sticky', target_anchor: '#commander-femiglow' }`.

### L1.3 — Tracking ancre
Vérifier `id="commander-femiglow"` reste sur `KitCommanderSection` (déjà présent).

### Critères acceptation L1
- [ ] Flag OFF → ordre v1 (zéro régression)
- [ ] Flag ON → ordre v2 visible
- [ ] Sticky CTA mobile présent en v2, smooth scroll
- [ ] Event `cta_click` avec `source=sticky` fire correctement

---

## L2 — Trim 3 sections

### L2.1 — Retirer imports + JSX en v2

Dans `KitPageV2` uniquement :
- `ComparatifSectionBound` — non importé
- `RitualsModuleBound` — non importé
- `PivotFinal` — non importé

Composants **conservés dans le repo**.

### L2.2 — Migration de contenu

**Avant retrait** :
- **Comparatif** : audit du tableau §4.7 Steps. Si gap d'objection → enrichir via CMS (1 ligne).
- **RitualsModule** : prendre 1-2 questions phares → ajouter à FAQ CMS.
- **PivotFinal** : son CTA est repris par sticky mobile + wizard pos. 7.

### Critères acceptation L2
- [ ] v2 = 10 sections (au lieu de 14)
- [ ] v1 = 14 sections (préservé)
- [ ] Contenu utile migré (FAQ enrichie si gap)

---

## L3 — Tests qualité

### L3.1 — Playwright `@kit-layout-v2`

Fichier : `apps/web-e2e/tests/kit/kit-layout-v2.spec.ts`

6 tests :
1. ordre v2 desktop
2. ordre v2 mobile
3. sticky CTA scroll-to-wizard
4. tracking `kit_section_viewed` fire dans le bon ordre
5. absence sections retirées en v2
6. présence sections en v1 (non-régression)

### L3.2 — Lighthouse
Cible : Performance ≥ 85 mobile, LCP < 2.5s, CLS < 0.1
Comparaison v1 vs v2 — la suppression de 3 sections doit améliorer LCP/TTI.

### L3.3 — axe
Zero violation `critical` ou `serious` en v2.

### Critères acceptation L3
- [ ] 6 tests Playwright @kit-layout-v2 verts
- [ ] Lighthouse mobile v2 ≥ v1 + 0 (au moins égal)
- [ ] axe : 0 violation critical/serious

---

## L4 — Rollout progressif (Gate humain)

Stop ici en mode autonome. Le rollout (Canary 10% → Ramp 50% → Full 100%) demande validation humaine + mesure 7 j.

Voir `05-runbook-rollout.md`.
