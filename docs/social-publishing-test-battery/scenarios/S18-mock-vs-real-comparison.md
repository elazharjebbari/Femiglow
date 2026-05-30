# S18 — Comparaison mock vs réel

## Objectif
Vérifier que les 2 chemins (mock dry-run et Postiz réel) produisent des UI states identiques côté opérateur.

## Étapes
1. Run S01 en mock mode (provider='dry_run')
2. Run S01 en mode réel (Postiz, opt-in)
3. Compare :
   - Toasts identiques
   - JobQueue rendering identique (badges, attempts)
   - Audit log structure identique
   - Cleanup possible (delete) dans les 2 cas

## Critères
- 0 différence visible côté UI (sauf permalinks)
- 0 différence dans la structure DB

## Spec
Test manuel pas automatisé. Diff via screenshots ou logs.
