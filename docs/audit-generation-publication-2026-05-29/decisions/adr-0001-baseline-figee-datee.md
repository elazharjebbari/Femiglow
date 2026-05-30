# ADR-0001 — Baseline d'audit figée et datée

- **Statut** : Accepté
- **Date** : 2026-05-29
- **Contexte décisionnel** : structuration des livrables d'audit

## Contexte

Le commanditaire exige un dossier `docs/` exhaustif constituant un **instantané de référence (baseline)** versionné et daté, **non réécrit** une fois produit. Le dépôt contient déjà un dossier `docs/` très peuplé (≈ 56 sous-dossiers, dont `ai-content-studio/`, `content-studio-v2-create-audit/`, `AUDIT-2026-05.md`). Écrire `README.md`, `manifest.yaml`, `CHANGELOG.md` à la racine de `docs/` entrerait en collision avec l'existant et diluerait l'instantané.

## Décision

L'intégralité de la baseline est placée sous un **dossier racine unique daté** :

```
docs/audit-generation-publication-2026-05-29/
```

contenant l'arborescence demandée (`01_audit/` … `07_runbook/`, `decisions/`, `manifest.yaml`, etc.). Le `manifest.yaml` porte version + date + empreinte de gel. Les évolutions ultérieures passent par `CHANGELOG.md` et de **nouveaux ADR**, jamais par réécriture silencieuse des fichiers gelés.

## Conséquences

- ✅ Aucune collision avec `docs/` existant ; l'instantané est auto-portant et identifiable.
- ✅ Plusieurs baselines datées peuvent coexister (audits successifs comparables).
- ⚠️ Les liens externes vers la baseline doivent inclure le préfixe daté.
- ⚠️ « Figé » est une convention de process, pas un verrou technique : la discipline CHANGELOG/ADR est requise.

## Alternatives écartées

- **Racine `docs/` directe** : collision avec l'existant, perte de la notion d'instantané daté.
- **Hors `docs/` (ex: `audit/`)** : contredit l'exigence explicite « dans un dossier docs/ ».
