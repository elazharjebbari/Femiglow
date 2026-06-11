# Runbook — Exécution du câblage frontend crédit fidélité

> Pilote l'exécution de `action-plan.md`. Boucle par étape : implémenter → tester → vérifier → étape suivante. Commandes depuis `apps/web/`.

## 0. Pré-requis
```bash
cd apps/web
# DATABASE_URL présent (.env) pour la vérif live ; tests vitest tournent en memoryStore.
```

## 1. Boucle par étape (S1 → S7)
Pour chaque étape :
```
ÉDITER les fichiers de l'étape
  ↓
TESTER l'étape :   pnpm exec vitest run <fichier-test-de-l-étape>
  ↓ (rouge ?) → triage (cf. §4) → corriger → re-tester
GATE local vert → étape suivante
```

## 2. Commandes par étape
```bash
# S1 — store
pnpm exec vitest run src/lib/checkout/state/wizard-store.test.ts

# S2 — InvitationCodeField (anti-stale)
pnpm exec vitest run src/components/sections/InvitationCodeField.test.tsx

# S3 — AddressStep (MSW redeem)
pnpm exec vitest run src/components/checkout/wizard/steps/AddressStep.test.tsx

# S4 — recap total ajusté
pnpm exec vitest run src/components/checkout/wizard/WizardCartRecap.test.tsx

# S5 — soumission (anti-422) — LE PLUS CRITIQUE
pnpm exec vitest run src/lib/checkout/state/use-wizard-mutations.test.tsx

# S6 — e2e
pnpm exec playwright test e2e/coupon-credit.spec.ts --project=chromium

# S7 — global
pnpm exec tsc --noEmit
pnpm exec vitest run src/lib/coupons src/lib/checkout src/components/checkout src/components/sections
```

## 3. Gate de sortie (release)
- `tsc --noEmit` = 0 erreur.
- S1–S5 unit/intégration verts ; non-régression `cart-snapshot-builder.test.ts` (14) intacte.
- Gate **G-PRICE-PARITY** : aucun 422 sur le parcours crédit ; `expectedTotalCents == total − min(credit,total)`.
- Vérif live OK (cf. §5).

## 4. Triage rapide
| Symptôme | Cause probable | Action |
|---|---|---|
| 422 `price_mismatch` au checkout avec crédit | expectedTotalCents ≠ total−credit | Vérifier le calcul S5 ; crédit issu de l'endpoint (même valeur que grant) |
| total affiché non ajusté | prop `appliedCreditCents` non câblée | Vérifier WizardShell→WizardCartRecap (S4) |
| crédit « collé » après édition du code | onClear non branché | S2/S3 : reset creditCents=0 à l'édition |
| régression total sans crédit | défaut prop ≠ 0 | `appliedCreditCents ?? 0` |

## 5. Vérification live (manuelle)
```bash
# 1) Seeder un grant de test (template post_purchase actif requis)
node --env-file=.env -e "import('postgres').then(async({default:pg})=>{const sql=pg(process.env.DATABASE_URL,{max:1,prepare:false});const t=await sql\`SELECT id,value_amount FROM coupons WHERE type='post_purchase' LIMIT 1\`;await sql\`INSERT INTO coupon_grants (id,template_coupon_id,code,status,value_cents,currency) VALUES ('grt_live','\${''}', 'FG-LIVE01','issued',\${t[0].value_amount},'MAD') ON CONFLICT (code) DO NOTHING\`;console.log('ok');await sql.end();})"
# 2) Démarrer la preview, ouvrir /kit, dérouler « J'ai un code », saisir FG-LIVE01 → total ajusté.
# 3) Terminer la commande → 201, pas de 422 ; vérifier le grant redeemed :
node --env-file=.env -e "import('postgres').then(async({default:pg})=>{const sql=pg(process.env.DATABASE_URL,{max:1,prepare:false});console.log(await sql\`SELECT code,status,redeemed_order_id FROM coupon_grants WHERE code='FG-LIVE01'\`);await sql.end();})"
# 4) Nettoyer : DELETE FROM coupon_grants WHERE code='FG-LIVE01';
```

## 6. Rollback
- Le champ est additif : retirer `<InvitationCodeField>` d'AddressStep + remettre `expectedTotalCents = cartSnapshot.totalCents` désactive la fonctionnalité sans toucher au backend. `couponCode` simplement non envoyé → comportement Phase 1/2 inchangé.
