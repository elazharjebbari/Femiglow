# Contenu traduit FemiGlow — FR / AR / EN

> **Objectif** : pré-produire le contenu traduit de **toute l'UI + tous les seeds/mocks par défaut** (hors admin), prêt à être injecté dans `messages/[locale].json` et dans les seeds DB le jour J du sprint i18n.
>
> **Statut** : préparation hors-sprint (no prod). Le contenu est **versionné en doc** pour relecture éditoriale et évolution ; il **n'est pas encore consommé par le code**.

## Pourquoi ce dossier (et pas `docs/i18n-strategy-2026-05/`)

`docs/i18n-strategy-2026-05/` = **étude stratégique** (90+ fichiers : audit, options techniques, plan d'action, tests, runbook). C'est le **comment** on va le faire.

`docs/i18n-content-2026-05/` (ici) = **livrable de contenu** prêt à brancher. C'est le **quoi** on va injecter.

Ne pas mélanger : ce dossier doit pouvoir être consommé par un script seed sans dépendre de la doc stratégique.

## Structure

```
docs/i18n-content-2026-05/
├── README.md                          ← ce fichier
├── 00-style-reference.md              ← synthèse des règles de style/voix/conversion à respecter en traduction
├── 01-audit/
│   ├── inventory-complete.csv         ← inventaire exhaustif issu d'un grep réel du code (UI + seed + mock + SEO + emails)
│   ├── audit-summary.md               ← top-level lecture (nb strings, top namespaces, gaps)
│   └── extraction-log.md              ← méthode utilisée + edge cases rencontrés
├── 02-translations/
│   ├── messages-fr.json               ← FR canonical (voix FemiGlow + leviers Kolenda)
│   ├── messages-ar.json               ← AR (MSA simplifié, adresse féminine, RTL prêt)
│   ├── messages-en.json               ← EN (international, sobre, retenue)
│   └── _meta.json                     ← versioning, completeness pct, reviewers
├── 03-seed-data/
│   ├── README.md
│   ├── component-bindings-fr.csv      ← rows pour `component_field_bindings` (locale=fr)
│   ├── component-bindings-ar.csv      ← rows AR
│   ├── component-bindings-en.csv      ← rows EN
│   ├── legal-pages-fr/                ← markdown des pages légales par slug (FR)
│   ├── legal-pages-ar/
│   ├── legal-pages-en/
│   ├── mock-data-fr.json              ← traduction des `src/data/mock/*.ts`
│   ├── mock-data-ar.json
│   └── mock-data-en.json
└── 04-quality/
    ├── glossary-applied.csv           ← contrôle : termes clés (Maison, kit, rituel, etc.) traduits de manière cohérente
    ├── conversion-leverage-checklist.md ← contrôle : les 12 leviers Kolenda sont-ils respectés dans FR ?
    └── review-notes.md                ← bugs/typos remontés en relecture
```

## Convention de versioning

Chaque fichier `messages-*.json` doit avoir un bloc `_meta` :

```json
{
  "_meta": {
    "locale": "fr",
    "schema_version": "1.0",
    "completeness_pct": 100,
    "last_updated": "2026-05-27",
    "voice_check": "passed (FemiGlow tone + Kolenda leverage)",
    "reviewer": "founder@femiglow.local"
  },
  "common": { ... },
  "navigation": { ... },
  ...
}
```

## Workflow d'usage

### 1. Côté étude / relecture éditoriale (maintenant)

1. Lire `00-style-reference.md` pour ancrer la voix
2. Lire `01-audit/audit-summary.md` pour voir l'ampleur
3. Relire `02-translations/messages-fr.json` (sample 50 strings) pour valider la voix
4. Reporter corrections dans `04-quality/review-notes.md`

### 2. Côté ingestion (jour J du sprint i18n — Phase 1-2 de `08-plan-action/phases.md`)

```bash
# Côté code applicatif
cp docs/i18n-content-2026-05/02-translations/messages-fr.json apps/web/messages/fr.json
cp docs/i18n-content-2026-05/02-translations/messages-ar.json apps/web/messages/ar.json
cp docs/i18n-content-2026-05/02-translations/messages-en.json apps/web/messages/en.json

# Côté DB seeds
pnpm tsx scripts/seed-i18n-components.ts \
  --bindings docs/i18n-content-2026-05/03-seed-data/component-bindings-fr.csv

pnpm tsx scripts/seed-i18n-legal.ts \
  --pages docs/i18n-content-2026-05/03-seed-data/legal-pages-fr/
```

### 3. Côté évolution (ajout langue, correction copy)

- Pour ajouter `es` : duplicate `messages-fr.json` → `messages-es.json`, briefer translator avec `00-style-reference.md` + `04-quality/glossary-applied.csv`
- Pour corriger une typo : éditer ici, puis re-seed via script

## Hors périmètre

- ❌ **Admin** : reste 100% FR (cf. ADR-008)
- ❌ **Chat assistant content** (déjà géré via `chat_faq_entry.language`)
- ❌ **Wizard checkout** : déjà via `WizardDictionary` (CHA-231) — pas régresser

## Standard de qualité

Avant qu'une traduction soit considérée comme "livrable" :

- [ ] Voix FemiGlow vérifiée vs `00-style-reference.md`
- [ ] Glossaire FR/AR/EN appliqué (cf. `04-quality/glossary-applied.csv`)
- [ ] Aucun emoji, aucun "!", aucune urgence fabriquée
- [ ] Adresse féminine cohérente en AR (verbes au féminin)
- [ ] Longueur compatible (titres < 70 chars SEO, descriptions < 160 chars)
- [ ] Préservation des marqueurs ICU (`{count, plural, ...}`, `{name}`)
- [ ] Échantillon relu par founder (50 strings min)

## Liens

- 📜 **Voix FemiGlow** : `~/.claude/projects/.../project_femiglow.md` + `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md`
- 🎨 **Style i18n** : `docs/i18n-strategy-2026-05/05-ui-ux-design/tone-style-guide.md`
- 📚 **Glossaire i18n** : `docs/i18n-strategy-2026-05/05-ui-ux-design/content-style-guide.csv`
- 🏗 **Architecture cible** : `docs/i18n-strategy-2026-05/02-design-conception/architecture-cible.puml`
- 📋 **Plan d'action** : `docs/i18n-strategy-2026-05/08-plan-action/phases.md`
