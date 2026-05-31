# Modèle de données

## Tables proposées

| Table | Rôle |
| --- | --- |
| `content_campaign` | Campagnes éditoriales |
| `content_idea` | Idées brutes ou structurées |
| `content_brief` | Briefs éditoriaux versionnés |
| `content_draft` | Brouillons générés ou édités |
| `content_asset_binding` | Association draft ↔ média |
| `content_generation_run` | Trace des appels IA |
| `content_brand_review` | Scores et violations |
| `content_post` | Objet publiable multi-canal |
| `content_postiz_delivery` | Export/schedule/publication Postiz |
| `content_performance_snapshot` | Métriques importées ou manuelles |
| `content_learning_note` | Enseignements validés |

## Statuts

```txt
idea, brief, generated, needs_review, approved, scheduled, published,
failed, cancelled, rejected, archived, measured
```

## Principes

- Tous les IDs sont textuels préfixés : `cc_`, `ci_`, `cb_`, `cd_`, `cp_`, `cr_`.
- Les outputs IA sont stockés en JSONB mais les champs critiques sont colonnes.
- Les prompts sont versionnés et reliés au run.
- Un post publié garde le snapshot exact du texte et du média.
- Les métriques externes sont append-only par snapshot.

## Exemple de lifecycle

```txt
content_idea(ci_1)
  -> content_brief(cb_1)
  -> content_generation_run(cgr_1)
  -> content_draft(cd_1, cd_2, cd_3)
  -> content_brand_review(cbr_1)
  -> content_post(cp_1)
  -> content_postiz_delivery(cpd_1)
  -> content_performance_snapshot(cps_1)
```

