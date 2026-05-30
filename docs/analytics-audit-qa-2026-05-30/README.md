# Analytics — Audit approfondi + Batterie de tests QA (Funnel · CTA · Checkout · Insights)

> Date : 2026-05-30 · Périmètre : `/admin/analytics/{funnel,cta,checkout,insights}` et tout le
> code qui les alimente (`lib/analytics/**`, `components/admin/analytics/**`,
> `app/api/admin/analytics/**`). Mode : lecture du code réel + vérifications ciblées.
> Méthode : à la manière des dossiers d'audit les plus détaillés du repo
> (`live-systems-audit-2026-05`, `audit-complet-2026-05-18`), enrichie d'une **stratégie de
> tests orientée UI/opérateur** au standard d'une grosse agence (Accenture / Capgemini / TCS…).

Ce dossier répond à deux demandes :

1. **Auditer** le fonctionnement des 4 onglets analytics : sont-ils **optimaux, fonctionnels,
   précis, corrects** ? → Partie **00-audit** (verdict argumenté + registre de findings).
2. **Outiller** une batterie de tests **très robuste, complète, de très haute qualité**, surtout
   **côté UI / point de vue opérateur**, avec couches **MSW + Vitest/RTL + Playwright**, scénarios
   métier réalistes, plan d'action et runbook. → Parties **10 à 40**.

## Verdict en une ligne

> Les 4 systèmes sont **architecturés avec soin et largement testés en unitaire**, mais **NON
> validés en l'état** : un **bug de réactivité des filtres** (Funnel/CTA/Checkout n'actualisent pas
> l'affichage quand l'opérateur change période/device/source), une **erreur d'unité sur le revenu
> CTA (÷100)**, une **incohérence de modèle de funnel**, un **décalage de fuseau horaire** et une
> **double barre de filtres sur Insights** entachent la **précision** et l'**expérience opérateur**.
> Détail et preuves `file:line` dans `00-audit/`.

## Structure du dossier

| Dossier | Contenu | Formats |
|---|---|---|
| [`00-audit/`](00-audit/) | Audit : synthèse/verdict, architecture, 4 fiches système, transverse, registre findings | md, csv, puml |
| [`10-catalogue-fonctionnalites/`](10-catalogue-fonctionnalites/) | Énumération **exhaustive** des fonctionnalités + matrice de couverture | md, csv |
| [`20-test-strategy/`](20-test-strategy/) | Vision, architecture de test, fixtures/scénarios métier, **un sous-dossier par système** | md, csv, yaml |
| [`30-plan-action/`](30-plan-action/) | Plan d'action phasé + boucle correction/vérification | md, csv, puml |
| [`40-runbook/`](40-runbook/) | Runbook d'exécution pas-à-pas + commandes + checklist Go/No-Go | md, txt |
| [`config/`](config/) | Cibles de couverture, matrice de tests | yaml, json |

## Comment lire

- **Décideur / lead** : `README` → `00-audit/00-synthese-verdict.md` → `30-plan-action/plan-action-global.md`.
- **Dev / QA** : `00-audit/` (système concerné) → `20-test-strategy/<système>/` → `40-runbook/`.
- **Exécuter la batterie** : `40-runbook/runbook-execution.md` pilote tout (boucle test → fix → re-test).

## Stack de test cible (déjà présente dans le repo)

Vitest 2.1 (`vitest run`), MSW 2.14 (`src/test/setup/msw.setup.ts`, handlers `src/test/msw/`),
Testing Library, Playwright 1.48 (`test:e2e`), faker. **Aucune nouvelle dépendance requise.**

## Principe directeur

> « On se fiche du nombre de tests : ce qui compte, c'est la **robustesse** et la capacité à
> **attraper un bug d'opérateur réel**. » Chaque test part d'un **geste opérateur** (changer un
> filtre, exporter, rafraîchir, dériller) et vérifie la **conséquence observable** (chiffres,
> états, accessibilité), pas l'implémentation interne.
