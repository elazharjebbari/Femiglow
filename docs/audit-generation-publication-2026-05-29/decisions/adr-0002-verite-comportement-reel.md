# ADR-0002 — Vérité = comportement réel, vérifié en mock ET live, avec réfutation adversariale

- **Statut** : Accepté (principe directeur de l'audit)
- **Date** : 2026-05-29

## Contexte

Le problème central : **décalage systématique** entre des tests « au vert » et le comportement réel en interface. Cas d'école capturés dès le cadrage :
- `vitest` rapporte **1695 passed / 0 failed** mais le **process sort en exit 1** (unhandled rejection — `BUG-010`) ;
- le picker annonce des modèles `source:"live"` **non générables** ;
- la publication par défaut est **simulée** (`dry_run`) tout en marquant les posts `published`.

## Décision

L'audit adopte un **principe directeur non négociable** :

> La vérité = le **comportement réel** de l'app exercée par un opérateur, **pas** le rapport de tests ni une conclusion antérieure.

Règles opérationnelles appliquées et à pérenniser :
1. Toute affirmation « ça marche » est **prouvée en exerçant** le chemin (curl read-only authentifié, parcours Playwright, exécution du binaire réel).
2. Qualification **séparée mock vs live** ; **non vérifié dans les deux modes ⇒ cassé par défaut**.
3. Chaque finding passe un **vérificateur adversarial indépendant** qui tente de le **réfuter** ; seuls les `confirmed`/`adjusted` entrent au registre.
4. Le **vérificateur lui-même est vérifiable** : ex. le finding « lavfi indisponible » (BUG-012/013) a été **réfuté par contre-exécution** du binaire `ffmpeg-static` réel (cf. `evidence/ffmpeg-binary-verification.md`) et reclassé.

## Conséquences

- ✅ Findings robustes (68 confirmés, 1 réfuté, 9 ajustés sur ~78).
- ✅ Méthode reproductible (cf. `01_audit/01_methodology.md`).
- ⚠️ Coût : exécution réelle + double passe adversariale.
- ➡️ Implique l'investissement structurel d'**ADR-0003** (harnais de parité mock/live) pour rendre ce principe **automatique** en CI, pas seulement manuel à l'audit.

## Alternatives écartées

- **Se fier au rapport de tests** : précisément la cause du problème.
- **Vérification simple (non adversariale)** : laisse passer des causes racines fausses (cf. BUG-012/013).
