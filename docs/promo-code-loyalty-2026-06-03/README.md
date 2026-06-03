# Dossier — Code de fidélité mémorable, activé selon la ville, unique par téléphone

> Extension du système `coupon_grants` (Phase 3) pour livrer le besoin :
> à la fin de la commande, un **code mémorable** remis à la cliente, **activé après la durée max de livraison de sa ville**, **unique par téléphone**, **réutilisable** plus tard avec réduction.
> Sources : audit (`00-audit.md`), `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`, `docs/coupon-auto-appliqué.md`.

## Sommaire
- `00-audit.md` — audit du système actuel + matrice de couverture.
- `01-need-and-design.md` — analyse du besoin, résolution, UX/UI, wireframes (thank-you + admin), micro-copy, tokens.
- `02-architecture.md` — modèle de données, backend, frontend, contrats, invariants.
- `03-action-plan.md` — plan de conception + dev (vagues G1→G8) avec tests par étape.
- `04-tests.md` — Vitest / MSW / Playwright (cas, oracles).
- `05-runbook.md` — pilotage exécution, migration sans downtime, vérif preview, rollback.
- `schemas.puml` — modèle de données + cycle de vie du code.

## Principe directeur
Le code est un **geste de fidélité de la maison**, pas un coupon retail : voix maison, sobre, mémorable (FG-<mot>-<nnnn>), affiché calmement en fin de commande (« Gardez ce code »). L'**activation différée** protège l'intégrité (utilisable une fois la 1ʳᵉ commande reçue) ; l'**unicité par téléphone** évite le farming. Tout reste **server-authoritative** (valeur + activation validées au checkout).
