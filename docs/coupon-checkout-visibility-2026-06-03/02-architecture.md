# 02 — Architecture (data flow · backend · frontend)

## 1. Vue d'ensemble

Le coupon `welcome_auto` est déjà résolu côté serveur par le moteur (`resolveCoupon`). Il suffit de **propager le signal « welcome actif » jusqu'au récap du wizard**, comme on l'a fait pour `/kit` via `ProductFeedSectionBound`. Aucune logique de prix nouvelle : l'économie est déjà portée par le snapshot (`compareAtTotalCents − totalCents`).

```
KitCommanderSectionBound (RSC, server)
   │  buildKitPublicProduct() + projectCartSnapshotFromVariant → initialCart {totalCents:199, compareAtTotalCents:289}
   │  resolveCoupon({}) ──► welcomeActive = coupon?.type === 'welcome_auto'   ← NOUVEAU
   ▼
KitCommanderSection (client) ── prop welcomeCoupon={{active}} ──►
   ▼
WizardShell (client) ── lit store langue ──►
   ▼
WizardCartRecap (RSC pur) ── welcomeCoupon + cart ──► <WizardWelcomeCouponLine/>
```

## 2. Backend
**Aucune modification backend.** Le moteur `resolveCoupon` (server-only) et le snapshot existent déjà. La résolution se fait dans le RSC `KitCommanderSectionBound` (déjà serveur). Pas de nouvelle route, pas de DB.

Garde : `resolveCoupon` est tolérant (DB indispo → null → ligne masquée, jamais d'erreur). Holdout=0 en Phase 1 → contexte vide suffit (cohérent avec `/kit`).

## 3. Frontend (contrats de composants)

- **`KitCommanderSectionBound`** (server) : après le build du snapshot, `const active = (await resolveCoupon(buildCouponContext({referer,ua,session}))) ?.type === 'welcome_auto'`. Passe `welcomeCoupon={{ active }}` à `KitCommanderSection`.
- **`KitCommanderSection`** (client) : nouvelle prop optionnelle `welcomeCoupon?: { active: boolean }`, transmise telle quelle à `WizardShell`.
- **`WizardShell`** (client) : prop `welcomeCoupon?`, transmise à `WizardCartRecap`. Libellé court/long selon viewport via CSS (pas de JS).
- **`WizardCartRecap`** (RSC pur) : nouvelle prop `welcomeCoupon?: { active: boolean }` + `welcomeLabel?`/`economyLabel?` (i18n injectés par le shell, comme `currencyLabel`). Rend `<WizardWelcomeCouponLine/>` **ssi** `welcomeCoupon.active && (compareAtTotalCents − totalCents) > 0`.
- **`WizardWelcomeCouponLine`** (présentational, nouveau, ou inline dans le recap) : libellé + « Économie {montant} » (terracotta), `tabular-nums`, `data-testid="wizard-welcome-coupon"`.

## 4. Invariants & non-régression
- **Aucun impact prix** : la ligne est purement informative ; `totalCents`/`compareAt` inchangés → pas de risque 422.
- **Non-régression** : `welcomeCoupon` absent/`active:false` → récap identique à l'existant (défaut). Tous les tests existants du récap restent verts.
- **Cohérence `/kit` ↔ wizard** : même source (`resolveCoupon`) → si pausé en admin, la mention disparaît des deux surfaces (revalidateTag déjà câblé sur les mutations admin).
- **i18n** : libellés passés en props (le récap est un RSC pur, pas de hook i18n) — même pattern que `currencyLabel`/`packLabel`.

## 5. Fichiers
- Modifiés : `KitCommanderSectionBound.tsx`, `KitCommanderSection.tsx`, `WizardShell.tsx`, `WizardCartRecap.tsx` (+ i18n copy du wizard).
- Créé (optionnel) : `WizardWelcomeCouponLine.tsx` (ou inline dans le recap pour limiter la surface).
- Non touchés : moteur coupons, snapshot builder, routes, DB.
