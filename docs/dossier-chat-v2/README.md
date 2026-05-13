# Dossier conception chat FemiGlow v2

> **Version** : 2026‑05‑13 · v1.0 (draft 1)
> **Statut** : Read‑only — aucune ligne de code n'a été modifiée. Dossier de cadrage et conception.
> **Audience** : PO, tech‑lead, designers, ops, QA, copywriters FR/AR.
> **Objectif** : Passer le chat FemiGlow d'un assistant correct à un **moteur de conversion** triple‑langue, fiable, observable et délicieux à utiliser, sans casser l'existant.

Ce dossier est conçu comme livrable d'agence haut‑de‑gamme (référence : IDEO / Frog / Thoughtworks / WillowTree / STRV). Chaque sous‑dossier est autonome, chaque format de fichier est choisi pour son audience.

---

## Carte du dossier

| # | Sous‑dossier | Quoi y trouver | Audience principale | Formats |
|---|---|---|---|---|
| 00 | [`00-vision/`](00-vision/) | Pourquoi on fait ça, qui on sert, comment on mesure le succès | PO, sponsor | `.md` |
| 01 | [`01-architecture/`](01-architecture/) | Schémas systèmes, choix de stack, décisions (ADR) | Tech‑lead, archi | `.puml`, `.yaml`, `.md` |
| 02 | [`02-data/`](02-data/) | Modèle de données, taxonomies, datasets, rétention | Data, backend | `.puml`, `.csv`, `.md` |
| 03 | [`03-backend/`](03-backend/) | Pipeline, intent, retrieval, tools, contrats API | Backend | `.md`, `.yaml` |
| 04 | [`04-frontend/`](04-frontend/) | Composants, state machine, SSE, animations, A11y | Frontend | `.puml`, `.hjson`, `.md` |
| 05 | [`05-design-ui/`](05-design-ui/) | Design tokens, spec composants, wireframes | Designers, UI dev | `.yaml`, `.md` |
| 06 | [`06-ux-ergonomie/`](06-ux-ergonomie/) | Parcours, blueprint service, microcopy, ergonomie admin | UX, content | `.md`, `.csv`, `.puml` |
| 07 | [`07-analytics/`](07-analytics/) | KPIs, events, dashboards, A/B testing | Growth, data | `.md`, `.csv` |
| 08 | [`08-plan-conception/`](08-plan-conception/) | Phasing, jalons, dépendances, RACI, risques | PM, sponsor | `.md`, `.csv`, `.puml` |
| 09 | [`09-plan-developpement/`](09-plan-developpement/) | Sprints, tickets, definition of done | Tech‑lead, QA | `.md`, `.csv` |
| 10 | [`10-plan-action/`](10-plan-action/) | Calendrier jour‑par‑jour, livrables | PM, équipe | `.csv`, `.txt` |
| 11 | [`11-runbook/`](11-runbook/) | Déploiement, rollback, incidents, observabilité | Ops, on‑call | `.md`, `.yaml` |
| 12 | [`12-tests/`](12-tests/) | Stratégie de test, matrices, scénarios E2E, test ultime | QA, tech‑lead | `.md`, `.csv` |

---

## Comment lire ce dossier

### En 5 minutes (sponsor / PO)
1. [`00-vision/00-executive-summary.md`](00-vision/00-executive-summary.md)
2. [`00-vision/03-success-metrics.md`](00-vision/03-success-metrics.md)
3. [`08-plan-conception/phasing-roadmap.md`](08-plan-conception/phasing-roadmap.md)

### En 30 minutes (tech‑lead)
1. Toute la section [`01-architecture/`](01-architecture/)
2. [`02-data/erd.puml`](02-data/erd.puml) + [`02-data/data-dictionary.csv`](02-data/data-dictionary.csv)
3. [`03-backend/intent-detection.md`](03-backend/intent-detection.md) + [`03-backend/retrieval-routing.md`](03-backend/retrieval-routing.md)
4. [`12-tests/test-strategy.md`](12-tests/test-strategy.md)

### En 2 heures (équipe complète)
Lire dans l'ordre 00 → 12. Le dossier est conçu pour une lecture linéaire mais chaque section reste autonome.

---

## Conventions transverses

| Convention | Règle |
|---|---|
| Langues | FR par défaut. Chaque copy / canned / FAQ produite en triple : FR / AR (script arabe) / AR‑MA (darija script latin). |
| Citations | Toujours `path/file.ts:line`. Évidence > opinion. |
| Identifiants tickets | `CHA‑XXX` (continuité avec l'existant). Les nouveaux tickets : 310‑399. |
| Date | Toujours format ISO `YYYY‑MM‑DD`. Pas de relatif (« mardi »). |
| Statuts | `proposed` · `accepted` · `in-progress` · `done` · `superseded` |
| Niveaux d'effort | `S` ≤ 2 j · `M` 3‑5 j · `L` 1‑2 sem · `XL` ≥ 3 sem |
| Coût marginal LLM | `€` ≤ +1 % · `€€` +1‑5 % · `€€€` +5‑15 % · `€€€€` >15 % |
| Pertinence | `★☆☆☆☆` → `★★★★★` |

---

## Glossaire express

| Terme | Définition |
|---|---|
| **Canned pair** | Suggestion cliquable (`label`) + réponse pré‑écrite (`scripted_reply`) servie sans LLM. |
| **FAQ gateway** | Court‑circuit serveur qui détecte une question fréquente par embedding et sert sa réponse. |
| **Tool call** | Appel typé du LLM vers une fonction backend (ex. `get_product(slug)`). |
| **Hybrid retriever** | Routage intent → RAG, tool, ou les deux avant LLM. |
| **Humanize** | Streaming avec jitter et pauses ponctuation pour effet « typewriter humain ». |
| **Cascade intent** | Régex++ → embeddings centroïdes → LLM mini, du moins coûteux au plus précis. |

---

## Statut de validation

- [ ] PO : a lu le résumé exécutif et la roadmap
- [ ] Tech‑lead : a validé l'architecture et les ADRs
- [ ] Designer : a validé le design system et les wireframes
- [ ] Ops : a validé le runbook
- [ ] QA : a validé la stratégie de tests
- [ ] Compliance : a validé la section rétention RGPD

> Ouvrir une PR de validation par checkbox via Linear / GitHub Discussions une fois la lecture faite.
