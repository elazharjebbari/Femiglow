# Scripts utilitaires — i18n-content

## `validate-seeds.py`

**Rôle** : Go/No-Go check des seeds i18n avant ingestion dans le code applicatif et la DB.

### Usage

```bash
# Depuis la racine du repo
python3 docs/i18n-content-2026-05/scripts/validate-seeds.py
```

### Sortie

- `0` → tout est OK, prêt pour ingestion (`pnpm seed:i18n` ou équivalent)
- `0` avec warnings → GO conditionnel, à arbitrer founder
- `1` → blocking issues détectées (résoudre avant ingestion)
- `2` → fichier manquant / config absente

### Vérifications effectuées (6 checks)

| # | Check | Critère |
|---|---|---|
| 1 | Structure du dossier | 18 fichiers essentiels présents |
| 2 | messages-*.json | JSON valide, parité namespaces FR/AR/EN, `_meta.total_keys` cohérent, aucun emoji, aucun « ! » marketing, mots interdits FemiGlow absents, ≥ 20 impératifs féminins en AR |
| 3 | Component bindings CSV | Parité `(component_slug, field_key)` exacte entre les 3 locales, colonnes attendues |
| 4 | Pages légales | 9 slugs × 3 locales = 27 .md, frontmatter complet (`slug`/`locale`/`title`/`status`), bodies ≥ 1500 bytes |
| 5 | Mock data articles | 15 articles par locale, body non-null partout, aucun emoji |
| 6 | Review notes | Couverture des 10 sujets critiques (drifts founder, enrichissements, etc.) |

### Constantes à mettre à jour si évolution

```python
EXPECTED_TOTAL_KEYS = 790
EXPECTED_NAMESPACES = {'common', 'navigation', 'marketing', 'legal',
                       'errors', 'seo', 'email', 'chat', 'mock-data'}
EXPECTED_LEGAL_SLUGS = {'cgv', 'cgu', 'confidentialite', 'cookies',
                        'retours-remboursements', 'livraison',
                        'securite-produits', 'faq', 'mentions-legales'}
EXPECTED_ARTICLES_COUNT = 15
```

### Quand l'exécuter ?

- **Avant toute ingestion** (`pnpm tsx scripts/seed-i18n-*.ts`)
- **Après toute édition** d'un des `messages-*.json` ou `component-bindings-*.csv`
- **En CI** (futur) : ajouter un job qui lance ce script à chaque PR touchant `docs/i18n-content-2026-05/`

### Dépendances

Aucune dépendance externe — uniquement la stdlib Python 3.

### Limitations

- Ne vérifie PAS la qualité éditoriale du copy (ce n'est pas un LLM judge)
- Ne valide PAS les drifts métier (Casablanca/Rabat, gestes 3/4/5) — c'est l'objet de `04-quality/review-notes.md`
- N'opère PAS d'ingestion réelle — c'est juste un check pré-ingestion

### Exemple de sortie (état actuel — tout vert)

```
======================================================================
FemiGlow i18n seeds — Go/No-Go validation
======================================================================

CHECK 1 — Structure du dossier
  ✓ 18 fichiers essentiels présents

CHECK 2 — messages-*.json (validité, parité, voix)
  ✓ Parité namespaces FR/AR/EN OK (9)
  ✓ _meta.total_keys = 790 (FR/AR/EN)
  ✓ 0 emoji dans les 3 locales
  ✓ 0 "!" marketing
  ✓ 0 mot interdit (FR)
  ✓ 45 impératifs féminins (AR) — adresse féminine OK

CHECK 3 — Component bindings CSV
  ✓ Parité (component_slug, field_key) FR/AR/EN OK (510 pairs)

CHECK 4 — Pages légales
  ✓ 9 slugs × 3 locales = 27 .md tous OK

CHECK 5 — Mock data articles
  ✓ 15/15 articles avec body × 3 locales

CHECK 6 — Review notes
  ✓ 10/10 sujets critiques couverts

======================================================================
✅ Tout est OK — GO pour ingestion
```

## Futurs scripts envisageables (non implémentés)

- `extract-from-source.py` — re-runner l'audit code pour détecter les nouvelles strings hardcoded (drift detection après évolution du code)
- `diff-locales.py` — diff sémantique entre FR/AR/EN pour repérer désynchros
- `generate-ingestion-sql.py` — produire les fichiers SQL prêts à `psql -f` (à partir des CSV bindings)
- `coverage-report.py` — rapport coverage par namespace/section/page avec heat map
