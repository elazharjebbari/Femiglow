# GABARIT IMPOSÉ — sous-dossier feature

Chaque dossier `NN-<slug>/` contient **exactement** ces fichiers (omettre `flow.puml` seulement si
aucune machine à états/séquence n'est pertinente). Style : dense, opérationnel, orienté **comportement
observable** et **point de vue opérateur/cliente**. Toujours référencer les `INV-*` de l'overview.

## 1. `spec.md`
```
# FNN — <Titre>

## Rôle & surface
<Quoi, pour qui (opérateur/cliente), sur quel écran/route, fichier(s) cible(s).>

## Fonctionnement optimal (ce qui DOIT se passer)
<Description très détaillée du comportement nominal, vu de l'UI. États, transitions, textes exacts,
montants, couleurs (terracotta économie), i18n FR/AR, accessibilité.>

## Contrat I/O
<Props/inputs, événements émis, endpoints appelés (méthode+chemin), payloads, réponses, codes/reason.>

## Cas limites & non-happy-path
<Erreurs réseau (403/409/422/500), latence, payload malformé, frontières (floor crédit, <3 chars,
code expiré/not_yet_active/already_redeemed), RTL, viewer vs admin, archivé verrouillé.>

## Invariants couverts
<Liste INV-* + lacune d'audit adressée.>

## Critères d'acceptation (observables)
<Liste à puces d'oracles : "le badge affiche Actif", "role=alert contient HTTP 403", "téléphone masqué 06…78".>

## Points à vérifier — tous points de vue
- Backend: <…>  · Frontend: <…>  · UI/UX/design: <…>  · Data: <…>  · A11y: <…>  · i18n: <…>
```

## 2. `test-cases.csv`
En-tête EXACT :
`id,feature_id,titre,type,priorite,couche,preconditions,etapes,donnees,resultat_attendu,oracle,risque_couvert,fichier_test_cible`
- `id` = `FNN-XSSS` (X = type U/I/C/M/E/A/V, SSS = 001…). Repris verbatim dans `it('FNN-XSSS …')`.
- Couvrir : happy path, chaque erreur, chaque frontière, a11y/charte si UI.
- `oracle` = assertion exacte et observable.

## 3. `scenarios.md`
Gherkin FR. ≥1 happy + ≥2 edges. Persona nommé réaliste (opérateur « Karim », cliente « Yasmine »).
```
## Scénario FNN-S1 — <nom> (happy)
Contexte: …
Étant donné …
Quand …
Alors …
```

## 4. `fixtures.json`
Données minimales valides + variantes d'erreur, réutilisables par les tests.
```json
{ "coupons": [...], "grants": [...], "redeem": { "FG-XXX": { "valid": true, "valueCents": 2000 } }, "sessions": { "admin": {...}, "viewer": {...} } }
```
Téléphones de grants **déjà masqués** dans les réponses.

## 5. `flow.puml` (si pertinent)
Machine à états (ex. cycle de vie d'un grant : issued→not_yet_active→active→redeemed/expired) ou
séquence (ex. saisie code → redeem → setCoupon → order).

---

### Rappels de cohérence
- Toute API appelée par un composant ⇒ au moins un cas **succès** + un cas **échec** via MSW.
- Aucune PII en clair. Charte : pas de `%`/`!`/emoji/compte à rebours ; terracotta `#C28A6E` = économie.
- `cd apps/web` pour exécuter. Titres de tests préfixés par l'`id` pour grep.
