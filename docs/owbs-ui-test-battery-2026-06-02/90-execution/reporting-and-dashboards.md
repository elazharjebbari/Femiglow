# 90 — Reporting & tableaux de bord

> Rend l'avancement et la **qualité** lisibles : couverture des risques, défauts,
> décisions. À tenir à jour à chaque vague.

## 1. Tableau de bord d'avancement (par module)
| Module | P0 écrits | P0 verts | P1 verts | a11y | i18n | métier (≥2) | non-régr. | statut |
|---|---|---|---|---|---|---|---|---|
| F01 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ⬜ |
| F02 | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ⬜ |
| F03 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F04 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F05 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ⬜ |
| F06 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F07 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ⬜ |
| F08 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ⬜ |
| F09 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F10 | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ⬜ |
| F11 | ☐ | ☐ | ☐ | ☐ | — | ☐ | ☐ | ⬜ |
| F12 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F13 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |
| F14 | ☐ | ☐ | ☐ | — | — | ☐ | ☐ | ⬜ |

Légende statut : ⬜ à faire · 🟧 en cours · 🟩 vert (gate module passée).

## 2. Couverture des risques (registre)
Chaque risque `severity=high` doit avoir ≥ 1 test vert. Suivi :
`RSK-01..RSK-22 → scénario(s) → statut`. **Aucun high non couvert** en sortie.

## 3. Defect log (CSV recommandé)
Colonnes : `id, date, module, scenario, severity(S1/S2/S3), symptom_ui,
root_cause, layer(UI/state/net/server/data), fix_commit, tests_added, status(open/fixed/verified)`.
Règle : **0 défaut S1/S2 ouvert** à la clôture.

## 4. KPIs qualité (pas de vanity metrics)
- **Risques high couverts** : x/ (cible 100 %).
- **Parcours métier verts** : x/ (≥ 2 par module concerné).
- **Zéro-perte** : prouvé chromium + webkit (oui/non).
- **Double-conversion impossible** : prouvé (oui/non).
- **Flaky rate** : 0 toléré (un flaky = S2).
- **Décisions de build** : F05 indicateur (fait/non), F11 UI vs procédure (tranché).

## 5. Rapport final (clôture)
- Synthèse : ce qui a été durci, bugs trouvés (par sévérité), décisions prises.
- Capture des commandes de validation full (vert).
- Statut dossier → `EXECUTED` ; recommandations résiduelles (ex. webkit cross, vue outbox).
