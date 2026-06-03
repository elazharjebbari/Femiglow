# Décisions tranchées (2026-06-02)

| ID | Décision | Choix retenu | Justification |
|---|---|---|---|
| D-1 | Code HTTP erreurs Zod sur routes coupons | **422** via mapping dédié sur les routes coupons | Le dossier QA fige 422 comme oracle ; on ajoute un mapping local (ne touche pas au défaut global 400 de `http-error.ts`) |
| D-2 | Re-seed welcome_auto | **Préserve `status` existant** (n'écrase pas une pause volontaire) ; upsert par clé interne stable | Évite de réactiver un coupon mis en pause par l'opérateur |
| D-3 | Holdout Phase 1 | **`holdoutPct=0`** (tout treatment) ; contrat holdout branché mais inactif | Reproduit exactement l'existant, mesure incrémentale activable plus tard |
| D-4 | Hash bucketing | **sha256(visitorKey + ':' + couponId) → 4 premiers octets → entier → %100** (déterministe, `node:crypto`) | Stable, uniforme, implémentation-définie ; tests figent le contrat (stabilité/distribution) |
| D-5 | Copie arabe module | **Clés i18n** ; textes ar marqués à valider par la rédaction maison | Tests assertent les clés/structure, pas des chaînes ar dupliquées |
| D-6 | Champ « code d'invitation » Phase 1 | **Option A** : disclosure `<details>` sans champ (inerte total) | Anti-friction, zéro risque de soumission accidentelle |
