# Refonte landing `/kit` — Reorder + Trim (Mai 2026)

> **Sprint** : `kit-landing-reorder-2026-05`
> **Référence Kolenda** : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §1.3, §2.1, §5
> **Effort total** : ~1.5 j-h (12h dev) + 7 j rollout
> **Lift estimé** : +8 à +12% conv rate

## Sommaire

| Doc | Sujet | Statut |
|---|---|---|
| `01-context-baseline.md` | Audit 14 sections actuelles + métriques baseline | ✅ |
| `02-vision-arc.md` | Arc Kolenda + nouvelle structure (10 sections) | ✅ |
| `03-plan-action-phases.md` | Détail des phases L0/L1/L2/L3 | ✅ |
| `04-tests-strategy.md` | Tests Vitest + Playwright + Lighthouse + axe | ✅ |
| `05-runbook-rollout.md` | Feature flag + bascule progressive + rollback | ✅ |

## TL;DR

**Problème** : 14 sections, wizard en position 3 (commande à froid), redondances Comparatif/RitualsModule, page mobile fatigue.

**Solution** :
1. Réordonner sections selon arc Kolenda *hero → preuve → décision*
2. Retirer 3 sections redondantes (Comparatif, RitualsModule, PivotFinal)
3. Remonter wizard à position 6 (après social proof)
4. Sticky CTA mobile vers `#commander-femiglow`

**Garde-fous** :
- Feature flag `NEXT_PUBLIC_KIT_LAYOUT_V2` — rollback en 60 sec
- Composants conservés (juste non-importés en v2)
- Zéro mention de la fondatrice par son nom
- Reversible : un revert du PR rétablit l'ancien ordre

## Lien avec L-1

Cette refonte suit la PR `fix/wizard-cart-recap-compare-at-dynamic` qui a :
- Supprimé le hardcode `priceCompareAt="390 MAD"` du wizard
- Aligné l'ancrage à 199/289 MAD (DB + mock + seed)
- Centralisé la projection cart snapshot dans des helpers purs

L0-L3 dépendent du wizard fixé, pas l'inverse.
