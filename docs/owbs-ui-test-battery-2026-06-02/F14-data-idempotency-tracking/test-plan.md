# F14 — Plan de tests concret

## A. Intégration (invariants data)
- **F14-S03/S04** : rejeu même Idempotency-Key (lead_create / order_create) → 1 row / 1 commande.
- **F14-S10/S11** : `upsertWizardLead` re-appelé → fill-forward (pas de null destructeur), timestamps monotones.
- **F14-S06/S07** : `/sync` applyBatch désordre (address avant create) → convergence ; rejeu idempotent.
- **F14-S12/S13** : dédup effet outbox (UNIQUE) ; 1 `order_webhook` par commande.
- **F14-S20** : capture + abandon → row partielle présente (scanner ok).
- **F14-S32/S33** : rejeu d'un dead → pas de doublon CRM ; pont lead→Meta Purchase dédoublonne (réutilise `lead-as-purchase`).

## B. MSW / tracking
- **F14-S30 (critique ROAS)** : chat flag ON, `chatLeadOk(value=289)` → `generate_lead` émis avec value=289 (cf. F07-S05).
- **F14-S31** : conversion wizard → `purchase` émis 1× avec `value`/`items` (mock emit).

## C. Playwright (idempotence perçue)
- **F14-S01** double-tap lead → 1 lead ; **F14-S02** double-tap commander → 1 commande ; **F14-S05** beacon+reload → 1 lead. Oracle : compter via endpoint admin / `/sync` spy.
- **F14-S21** : abandon visible en admin (transverse F10).

## D. Étapes
1. Idempotence routes/upsert (S03/S04/S10/S11) + désordre (S06/S07).
2. Dédup effets (S12/S13) + scanner (S20) + pont Meta (S33).
3. **Tracking valorisé** (S30/S31) — gate ROAS.
4. e2e idempotence perçue (S01/S02/S05).
