# ADR-001 — Trois couches plutôt qu'une seule

**Statut** : Accepté
**Date** : 2026-05-13
**Décideurs** : Tracking team

## Contexte

L'analyse stratégique a identifié 7 approches (cf. `00-overview/strategie.md`). Aucune approche seule n'est suffisante :
- Pré-import seul : contournable, ne couvre pas le drift dans le temps.
- Runtime seul : détecte trop tard, premier pageview en prod.
- Filet bundleId seul : trop discret, alerte noyée.

## Décision

On combine **3 couches indépendantes** :
- **Couche A — Pré-flight (Approche 7)** : Page admin de validation des 2 JSONs avant import.
- **Couche B — Sentinel runtime (Approche 5)** : Ping push + dashboard sync-status.
- **Couche C — bundleId partagé (Approche 1)** : Hash partagé entre les 2 fichiers.

## Conséquences

### Bénéfices
- Chaque couche compense les angles morts des autres : **défense en profondeur**.
- Aucune ne bloque l'admin → contournement = perte d'une couche seulement, pas du système entier.
- Coûts d'implémentation cumulés acceptables (Couche A = 1j, B = 3j, C = 2h).
- Évolutif : on peut ajouter une Couche D (test E2E Preview Mode) plus tard sans casser.

### Trade-offs
- Plus de surface de code à maintenir vs une approche monolithique.
- Risque que les 3 couches divergent (mitigé : tests d'intégration end-to-end).

## Alternatives rejetées

- **Approche 6 (HMAC crypto)** : overkill, mauvais outil pour le problème.
- **Approche 2 (pré-flight workspace complet)** : ROI faible vu que la couche A couvre l'essentiel.
- **Approche 3 (Preview Mode E2E)** : nice-to-have ultérieur, pas un Poka-Yoke.

## Critères de réévaluation

Cette décision sera revue si :
- MTTD > 4h en moyenne sur 30 jours
- Faux positifs > 5% sur 30 jours
- Charge de maintenance > 1j/mois
