# F15 — Account selection (multi-compte)

## Importance : 🟠 P1

## Objectif
Quand plusieurs comptes sont connectés pour la même plateforme, l'opérateur choisit lequel utiliser pour publier.

## Comportement attendu

### UI (dans confirm dialog publish-now)
- Si > 1 compte actif pour la platform de draft → afficher dropdown "Compte"
- Default : 1er compte par ordre alphabétique
- Disabled / hidden si 1 seul compte

### API
- `accountId` envoyé dans body
- Si non fourni : server sélectionne le 1er compte actif

## Tests
Voir `test-scenarios.yaml`.
