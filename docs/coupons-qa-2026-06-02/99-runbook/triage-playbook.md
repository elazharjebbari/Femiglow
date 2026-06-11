# Playbook de triage des échecs

> Objectif : transformer chaque échec en un ticket actionnable avec la bonne couche de correction, en < 5 minutes.

## 1. Procédure de triage (par échec)

1. **Identifier** le `CPN-…` et le type (U/I/C/E/V/A/P).
2. **Reproduire** isolément : `pnpm test -t "CPN-…"` ou `playwright --grep "CPN-…"`.
3. **Classer** via la table §3.
4. **Ouvrir/màj** un ticket `EB-###` dans `execution-board.csv`.
5. **Router** vers `90-action-plan/correction-loop.md` (arbre cause racine).

## 2. Symptôme → diagnostic rapide

| Symptôme observé | Hypothèse n°1 | Vérifier | Couche probable |
|---|---|---|---|
| HTTP 422 `price_mismatch` en E2E | Surfaces non alignées | Les 3 points appellent le même `resolveProductPricing` ? bucket déterministe ? | code (branchement/engine) |
| Bucket différent affichage vs order | `visitorKey` instable | Cookie/hash identiques SC et API ? | context/bucketing |
| Prix 289 au lieu de 199 | Coupon non résolu / pas actif | `status=active` ? fenêtre ? cache invalidé ? | data/cache/engine |
| Double remise (109/10900) | Empilement coupon + promo | Le coupon doit OVERRIDE, pas s'ajouter | engine (CPN-17) |
| 2 events `converted` | Idempotence absente | Index partiel + `!replayed` | repo/route |
| 403 attendu mais 200 | RBAC après mutation | Ordre auth→perm→exec | route |
| Rouge/countdown/emoji détecté | Token/markup hors charte | Classes, absence d'éléments interdits | UI |
| Test vert puis rouge | Flaky | Timing réel ? état partagé ? `now` injecté ? `resetMemoryStore` ? | test |
| درهم absent / LTR en ar | i18n/RTL | Clés i18n, `dir=rtl` | UI |
| axe violation | a11y | Rôles, contraste, focus | UI |
| Couverture < gate | Branche non testée | Quel chemin manque ? (erreur/edge) | test |

## 3. Classification des échecs

- **BLOCKER (P0)** : viole un gate fonctionnel (`G-PRICE-PARITY`, `G-RBAC`, `G-IDEMPOTENCE`, `G-FALLBACK-LEGACY`, `G-HOLDOUT-DETERMINISM`, `G-TRACKING-VALUE`, `G-CHARTE`, `G-A11Y`). → release bloquée.
- **MAJOR (P1)** : comportement métier incorrect sans violer un gate bloquant (ex. stats uplift faux).
- **MINOR (P2)** : confort/cosmétique (ex. libellé).
- **FLAKY** : instable → quarantaine immédiate (`test.fixme` + ticket) puis correction déterminisme.

## 4. Règles de routage de la correction

- Bug **prix/checkout** → toujours P0, vérifier l'invariant maître avant tout.
- Échec **flaky** → corriger le test (déterminisme), JAMAIS le code, JAMAIS supprimer.
- Oracle contesté → remonter à `spec.md`, décider avec le métier, mettre à jour spec + test ensemble.
- Mock qui « connaît » la réponse → réécrire le handler MSW (anti-pattern).

## 5. Quarantaine (flaky)

```ts
// Temporaire, TOUJOURS avec ticket
test.fixme('CPN-08-E012 — flaky timing réseau (EB-027)', async () => { /* ... */ });
```
- Délai max en quarantaine : 24h.
- Un test quarantiné ne compte pas comme « vert » pour le gate.

## 6. Escalade

- 2 corrections successives échouent sur le même ticket → revue d'architecture (le contrat de la feature est peut-être à revoir).
- Gate bloquant rouge en fin de vague → NO-GO, la vague reste ouverte.
