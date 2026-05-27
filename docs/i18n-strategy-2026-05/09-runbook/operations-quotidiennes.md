# Opérations quotidiennes i18n

> Tâches récurrentes pour maintenir l'i18n FemiGlow en production : daily, weekly, monthly, quarterly et on-demand.
>
> **Audience** : lead technique (orchestration), dev (exécution), founder (validation), QA (vérifications).
>
> **Principe** : la **discipline opérationnelle** vaut autant que la qualité du build initial. Sans routine, la dette s'accumule (drift entre locales, traductions périmées, perf qui dégrade).

---

## Sommaire

- [Vue d'ensemble des tâches récurrentes](#vue-densemble-des-tâches-récurrentes)
- [Daily — Tâches quotidiennes](#daily--tâches-quotidiennes)
- [Weekly — Tâches hebdomadaires](#weekly--tâches-hebdomadaires)
- [Monthly — Tâches mensuelles](#monthly--tâches-mensuelles)
- [Quarterly — Tâches trimestrielles](#quarterly--tâches-trimestrielles)
- [On-demand — Tâches ponctuelles](#on-demand--tâches-ponctuelles)
- [Templates de rapport](#templates-de-rapport)
- [Anti-patterns](#anti-patterns)

---

## Vue d'ensemble des tâches récurrentes

| Cadence | Tâche | Durée | Owner |
|---|---|---|---|
| Daily | Vérifier Sentry alerts | 5 min | Lead ou on-call |
| Daily | Spot-check 1 page random | 2 min | Founder |
| Weekly | Review coverage traductions | 15 min | Lead |
| Weekly | Audit perf Lighthouse | 10 min | Lead |
| Weekly | Triage typos / bugs cosmétiques | 30 min | Dev |
| Monthly | Audit drift FR vs AR vs EN | 1h | Dev |
| Monthly | Review locale distribution | 30 min | Founder + Lead |
| Monthly | Test rollback drill (staging) | 30 min | Lead |
| Quarterly | Rotation review traducteur | 2h | Founder + Lead |
| Quarterly | Bilan effort i18n vs business | 2h | Founder + Lead |
| Quarterly | Audit a11y profond | 4h | QA |
| On-demand | Ajouter une clé i18n | Variable | Dev |
| On-demand | Corriger une typo | 15 min | Founder via admin |
| On-demand | Update voix éditoriale | Variable | Founder + Dev |

---

## Daily — Tâches quotidiennes

### Tâche D1 — Vérifier Sentry alerts (5 min)

**Quand** : début de journée ouvrée.

**Owner** : lead technique ou personne on-call.

**Procédure** :

1. Ouvrir Sentry : https://sentry.io/organizations/femiglow/issues/
2. Filtrer :
   - Time : Last 24h
   - Tags : `locale:ar OR locale:en OR locale:fr`
   - Status : Unresolved
3. Trier par event count décroissant
4. Pour chaque nouvelle erreur :
   - Est-elle critique (5xx, JS crash, hydration error) ? → Créer ticket urgent
   - Est-elle un missing translation key ? → Voir [missing keys workflow](#missing-translation-key-detection)
   - Est-elle un bug fonctionnel mineur ? → Backlog

**Checklist quotidienne** :

- [ ] Aucune erreur critique nouvelle sur 24h
- [ ] Aucun spike inhabituel (× 5 vs baseline)
- [ ] Aucun missing translation key non triagé

**Si problème** :

- Spike erreurs : déclencher procédure rollback si > seuils (cf. [`deploiement.md`](./deploiement.md))
- Missing key isolé : créer ticket, fix dans la journée
- Pattern inquiétant : investigation immédiate

### Tâche D2 — Missing translation key detection

**Owner** : dev (auto-monitoring).

next-intl rapporte automatiquement les `MISSING_MESSAGE` errors dans Sentry. Voir :

```
Sentry filter : message:"MISSING_MESSAGE"
```

**Workflow correction missing key** :

```bash
# 1. Identifier la key manquante (ex: contact.newField)
# 2. L'ajouter dans messages/fr.json + en.json + ar.json

# 3. PR de fix
git checkout -b fix/i18n-missing-key-contact-newField
# Éditer les 3 fichiers
git add apps/web/messages/
git commit -m "fix(i18n): add missing key contact.newField"
git push
gh pr create --title "fix(i18n): add missing key contact.newField"

# 4. Auto-merge après CI verte
```

⚠️ Si plus de 5 missing keys par semaine : signe que le workflow extraction n'est pas suivi. Re-brief l'équipe sur les conventions.

### Tâche D3 — Spot-check 1 page random (2 min)

**Owner** : founder (ou n'importe qui).

**Procédure** :

Chaque matin, ouvrir une page random du site dans une locale random :

```bash
# Quelques exemples
https://femiglow.ma/ar/kit
https://femiglow.ma/en/maison
https://femiglow.ma/fr/journal
```

Check rapide :

- [ ] La page charge en < 3s
- [ ] Pas de string non traduite (FR sur page AR ?)
- [ ] Pas de layout cassé visible
- [ ] LocaleSwitcher fonctionnel
- [ ] Aucun `[TODO-XX]` ou `MISSING_MESSAGE` visible

Si problème détecté : Slack #team-femiglow avec screenshot.

---

## Weekly — Tâches hebdomadaires

### Tâche W1 — Review coverage traductions (15 min)

**Quand** : lundi matin.

**Owner** : lead technique.

**Procédure** :

```bash
cd apps/web
pnpm -F web exec tsx scripts/i18n/coverage-report.ts
```

Sortie attendue :

```
=== i18n Coverage Report ===
Date : 2026-06-15

Locale FR (source) : 723 keys
Locale AR : 723 keys (100% coverage)
Locale EN : 723 keys (100% coverage)

Status :
- ✓ All locales at 100%
- 0 keys missing in AR
- 0 keys missing in EN
- 2 keys flagged as outdated (FR changed since last AR translation)

Outdated keys :
- contact.newSubtitle (FR updated 3 days ago, AR not refreshed)
- kit.heroDescription (FR updated 1 day ago, AR not refreshed)

→ Action : commission translator AR for 2 outdated keys
```

**Actions selon le rapport** :

| Situation | Action |
|---|---|
| 100% coverage, 0 outdated | Rien à faire |
| < 100% coverage AR ou EN | Compiler les missing, exporter CSV, briefer translator |
| Outdated keys (FR modifié, trad pas refresh) | Décider : refresh ou laisser (selon importance) |

**Reporter dans Slack** :

```
[I18N Weekly Review]
- Coverage FR : 723 keys (référence)
- Coverage AR : 100% ✓
- Coverage EN : 100% ✓
- Outdated : 2 keys (kit + contact) → commission AR refresh
```

### Tâche W2 — Audit perf Lighthouse (10 min)

**Quand** : lundi matin.

**Owner** : lead.

**Procédure** :

```bash
# Run Lighthouse CI sur les 3 locales × 6 routes principales
cd apps/web
pnpm exec lhci collect --url=https://femiglow.ma/fr/
pnpm exec lhci collect --url=https://femiglow.ma/ar/
pnpm exec lhci collect --url=https://femiglow.ma/en/
pnpm exec lhci assert
```

Comparer aux thresholds de référence :

| Métrique | Threshold | Critique si |
|---|---|---|
| Performance | ≥ 90 | < 80 |
| Accessibility | ≥ 95 | < 90 |
| Best Practices | ≥ 90 | < 80 |
| SEO | ≥ 95 | < 90 |
| LCP | < 2.5s | > 4s |
| CLS | < 0.1 | > 0.25 |

**Actions** :

- Score stable : OK, prochain check dans 7j
- Score en baisse (-5 points par exemple) : investigation
- Score critique : ticket prioritaire P1

### Tâche W3 — Triage typos / bugs cosmétiques (30 min)

**Quand** : vendredi après-midi (avant weekend).

**Owner** : dev.

**Procédure** :

1. Récupérer les tickets ouverts cette semaine avec label `i18n` :
   ```bash
   gh issue list --label i18n --state open --limit 20
   ```

2. Pour chaque ticket :
   - Catégoriser : P0 (critique), P1 (important), P2 (cosmétique)
   - Estimer effort (< 1h, 1-4h, > 4h)
   - Assigner à dev disponible la semaine prochaine

3. Pour les typos trivial (1 string à corriger) :
   - Workflow rapide via admin UI (cf. [tâche on-demand](#corriger-une-typo))
   - Pas besoin de PR si juste un fichier `messages/*.json`

4. Compiler un mini-rapport :

```
[I18N Weekly Triage]
Tickets ouverts : 7
Triés cette semaine :
- 3 typos AR → admin UI direct (founder peut fixer)
- 2 bugs layout RTL → P1 sprint prochain
- 1 missing translation EN → fix today
- 1 perf issue /ar/kit → P2 backlog

Sprint prochain priorité : 2 bugs RTL layout
```

---

## Monthly — Tâches mensuelles

### Tâche M1 — Audit drift FR vs AR vs EN (1h)

**Quand** : 1er du mois (ou vendredi le plus proche).

**Owner** : dev.

**But** : détecter le **drift** entre locales — strings FR modifiées mais pas répercutées en AR/EN.

**Procédure** :

```bash
cd apps/web
pnpm -F web exec tsx scripts/i18n/drift-report.ts \
  --since "30 days ago" \
  -o /tmp/i18n-drift-$(date +%Y%m).md
```

Sortie attendue :

```markdown
# i18n Drift Report — 2026-06

## Strings modifiées en FR sur 30 derniers jours

| Key | Modif FR | AR refreshed ? | EN refreshed ? |
|---|---|---|---|
| contact.subtitle | 2026-06-10 | Non | Non |
| kit.heroTitle | 2026-06-15 | Oui | Non |
| journal.intro | 2026-06-20 | Non | Oui |

## Statistiques

- Total strings modifiées FR : 12
- AR refreshed : 5 (42%)
- EN refreshed : 7 (58%)
- Drift critique (P0 strings) : 2

## Recommandations

- Commander batch trad AR pour 7 keys outdated
- Commander batch trad EN pour 5 keys outdated
- Total volume : ~12 strings, effort traducteur ~1h chacun
```

**Workflow correction drift** :

1. Si peu de strings (< 20) : un email au translateur AR + EN avec la liste
2. Si beaucoup (> 50) : export CSV dédié, mini-mission de refresh
3. Si récurrent : revoir le workflow (peut-être que la fondatrice modifie FR sans signaler)

### Tâche M2 — Review locale distribution (30 min)

**Quand** : 1er du mois.

**Owner** : founder + lead.

**Procédure** :

1. Ouvrir GA4 ou Plausible
2. Filtrer sur le mois écoulé
3. Récupérer :
   - Sessions par locale
   - Bounce rate par locale
   - Conversion par locale
   - Pages les plus consultées par locale

4. Comparer à la baseline et au mois précédent

5. Templater :

```markdown
# Bilan locale — Juin 2026

## Distribution sessions

| Locale | Sessions | % | Δ vs mai |
|---|---|---|---|
| FR | 12 500 | 76% | +2% |
| AR | 2 100 | 13% | +5% |
| EN | 1 800 | 11% | -1% |

## Performance funnel

| Locale | Visit → Cart | Cart → Purchase | Funnel overall |
|---|---|---|---|
| FR | 8% | 35% | 2.8% |
| AR | 6% | 28% | 1.7% (-1.1pt vs FR) |
| EN | 7% | 30% | 2.1% (-0.7pt vs FR) |

## Observations

- AR conversion < FR : à investiguer (clarté CTA ? trust signals ?)
- EN sessions stable : marché tier-1 demande encore du contenu
- Pas de spike erreur sur locale spécifique

## Actions

- Optimisation AR funnel : analyse parcours utilisateur AR (Hotjar / Microsoft Clarity)
- Plan marketing EN : revoir SEO sur mots-clés tier-1
```

### Tâche M3 — Test rollback drill (30 min)

**Quand** : 15 du mois.

**Owner** : lead.

**But** : s'assurer que la procédure rollback **fonctionne toujours** (env vars, scripts, communication).

**Procédure** :

1. Annoncer dans #team-femiglow :

```
[I18N] Drill rollback prévu aujourd'hui à {time}
Pas d'impact prod attendu (drill sur staging).
```

2. Sur staging, simuler un rollback :

```bash
# Sur staging
vercel env rm I18N_ENABLED preview
vercel env add I18N_ENABLED preview
# Entrer : false
vercel --target preview

# Démarrer chrono
TIME_START=$(date +%s)

# Attendre que le deploy soit fini + tester
while ! curl -s https://staging.femiglow.ma/contact | grep -q "Contact"; do
  sleep 5
done

TIME_END=$(date +%s)
echo "Rollback effectif en $((TIME_END - TIME_START)) secondes"
```

3. Vérifier :

- [ ] `/contact` sur staging retourne la version legacy
- [ ] `/fr/contact` 404 ou redirige vers `/contact`
- [ ] Pas d'erreur Sentry pendant le rollback

4. Re-enable :

```bash
vercel env rm I18N_ENABLED preview
vercel env add I18N_ENABLED preview
# Entrer : true
vercel --target preview
```

5. Reporter :

```
[I18N Drill] Rollback test {date}
- Temps total rollback : {N}s
- Temps cible : < 300s (5 min)
- Statut : ✓ vert / ⚠ jaune / 🚨 rouge
```

Si rollback > 5 min : investigation, optimisation procédure.

---

## Quarterly — Tâches trimestrielles

### Tâche Q1 — Rotation review traducteur (2h)

**Quand** : 1er du trimestre.

**Owner** : founder + lead.

**But** : évaluer la qualité du translateur, décider de continuer ou changer.

**Procédure** :

1. Compiler les **livrables des 3 derniers mois** :
   - Nombre de strings traduites
   - Nombre de révisions demandées
   - Délais respectés
   - Qualité (typos, glossaire, ton)

2. Évaluer sur 5 critères (1-5) :

| Critère | Note 1-5 | Notes |
|---|---|---|
| Qualité linguistique | | |
| Respect du glossaire | | |
| Respect du ton | | |
| Délais | | |
| Communication | | |

3. Si moyenne < 3.5 : envisager rotation

4. Si moyenne ≥ 4 : prolongation contrat

5. Documenter dans `docs/i18n-strategy-2026-05/00-context/review-translator-{xx}-Q{n}.md`

### Tâche Q2 — Bilan effort i18n vs business (2h)

**Owner** : founder + lead.

**Procédure** :

1. Calculer le coût i18n du trimestre :
   - Heures dev (à internaliser)
   - Heures translateur (factures)
   - Coût infrastructure (Vercel + Neon delta)
   - Coût outils (Lighthouse CI, Sentry, etc.)

2. Calculer le bénéfice :
   - Sessions AR/EN gagnées
   - Conversion AR/EN
   - Revenue attribué aux locales non-FR

3. Comparer ROI :

```markdown
# Bilan ROI i18n — Q2 2026

## Coût

- Heures dev : 80h × 50€/h = 4 000€
- Translateur AR : 1 200€
- Translateur EN : 600€
- Outils (delta) : 50€
- **Total** : 5 850€

## Bénéfice

- Sessions AR : 6 500 (vs 0 avant i18n)
- Sessions EN : 5 400 (vs 0 avant i18n)
- Revenue AR : 12 000€
- Revenue EN : 8 500€
- **Total** : 20 500€

## ROI

- Profit brut : 14 650€
- ROI : 250%

## Décision

- Continuer i18n FR + AR + EN
- Envisager ajout ES Q3 (cf. ajouter-nouvelle-langue.md)
```

### Tâche Q3 — Audit a11y profond (4h)

**Owner** : QA.

**Procédure** :

1. Run automated audit (axe, Lighthouse) sur 3 locales × 6 routes :

```bash
pnpm -F web exec playwright test e2e/a11y/ --reporter=html
```

2. Run manual audit avec screen reader :

| Outil | Pour locales | Scope |
|---|---|---|
| **NVDA** (Windows) | FR, EN | 6 routes principales |
| **VoiceOver** (macOS) | FR, EN | 6 routes principales |
| **VoiceOver iOS** | AR (RTL) | 6 routes principales |
| **TalkBack** (Android) | AR (RTL) | 6 routes principales |

3. Documenter findings :

```markdown
# Audit a11y Q2 2026

## Score automated

- FR : 96/100 (axe)
- AR : 94/100
- EN : 97/100

## Findings manuels

### Critiques (P0)
- {description}

### Sérieux (P1)
- {description}

### Mineurs (P2)
- {description}

## Recommandations

- Fixes prioritaires : {liste}
- Sprint dédié a11y : {oui/non}
```

---

## On-demand — Tâches ponctuelles

### Ajouter une clé i18n (workflow dev)

**Trigger** : dev ajoute une nouvelle string sur une page.

**Workflow** :

```bash
# 1. Identifier la string et son contexte
# Exemple : nouveau bouton "Télécharger le guide" sur /kit

# 2. Choisir la key (convention namespace.scope.action)
# kit.guide.downloadButton

# 3. Ajouter dans les 3 fichiers messages
# apps/web/messages/fr.json
{
  "kit": {
    ...
    "guide": {
      "downloadButton": "Télécharger le guide"
    }
  }
}

# apps/web/messages/en.json — DeepL puis review
{
  "kit": {
    ...
    "guide": {
      "downloadButton": "Download the guide"
    }
  }
}

# apps/web/messages/ar.json — DeepL puis review native (ou TODO-AR)
{
  "kit": {
    ...
    "guide": {
      "downloadButton": "[TODO-AR] Télécharger le guide"
    }
  }
}

# 4. Utiliser dans le code
# apps/web/src/app/[locale]/kit/page.tsx
const t = useTranslations('kit.guide');
return <button>{t('downloadButton')}</button>;

# 5. Tester en local sur les 3 locales
pnpm -F web dev
# Tester /fr/kit, /en/kit, /ar/kit

# 6. PR + merge
git checkout -b feat/i18n-add-kit-guide-download
git add apps/web/messages/ apps/web/src/app/\[locale\]/kit/
git commit -m "I18N-add-key-kit.guide.downloadButton"
gh pr create

# 7. Après merge : commissionner trad AR si TODO-AR
```

**Délai entre PR et trad finale** : 5-7 jours (le translateur AR traduit la batch hebdo).

### Corriger une typo (workflow translator + admin UI)

**Trigger** : founder remarque une typo sur le site.

**Workflow rapide** (si juste un message JSON) :

```bash
# 1. Identifier la string et sa key
# Exemple : sur /fr/contact, "Nous repondons sous 24h" → devrait être "répondons"

# 2. Trouver la key
grep -r "Nous repondons" apps/web/messages/
# Trouve : contact.subtitle dans fr.json

# 3. Fix dans les 3 locales si applicable
# (AR et EN peut-être OK, juste FR à corriger)

# 4. Mini-PR
git checkout -b fix/i18n-typo-contact-subtitle
# Éditer apps/web/messages/fr.json
git add apps/web/messages/fr.json
git commit -m "fix(i18n): typo contact.subtitle"
gh pr create
```

**Workflow via admin UI** (si CMS multilang feature active) :

1. Founder se connecte à `/admin/cms/components`
2. Sélectionne le composant concerné
3. Onglet FR → corrige la typo
4. Save → revalidation auto
5. Vérifier sur le site (cache invalidé sous 30s)

**Pas de PR nécessaire pour cas trivial** — la modification admin est trackée en DB.

### Update voix éditoriale globale

**Trigger** : la fondatrice décide d'adoucir le ton sur l'ensemble du site.

**Workflow** :

1. **Workshop fondatrice + lead + translator** (1h)
   - Identifier les axes du change (ex: moins de "absolument", plus de "sereinement")
   - Lister les keys touchées (~50-100 strings)

2. **Exporter le CSV ciblé**
   ```bash
   pnpm -F web i18n:export --source fr --priority P0,P1 --filter "tone-update" -o /tmp/tone-update.csv
   ```

3. **Founder révise FR** (2h)
4. **Translateurs alignent AR + EN** (3-5 jours)
5. **Import + tests + deploy** (1 jour)

Effort total : **1 semaine** pour ~100 strings.

---

## Templates de rapport

### Rapport weekly (Slack format)

```
[I18N Weekly — Semaine {N}]

Coverage :
- AR : 100% ✓
- EN : 100% ✓
- Outdated : {N} keys

Perf Lighthouse :
- FR : {X}/100
- AR : {Y}/100
- EN : {Z}/100

Tickets ouverts :
- P0 : {N}
- P1 : {N}
- P2 : {N}

Actions semaine prochaine :
- {action 1}
- {action 2}

Bonne semaine ✓
```

### Rapport monthly (markdown format)

```markdown
# Bilan i18n — {Mois} {Année}

## Stats traffic

| Locale | Sessions | Conversion | Δ vs M-1 |
|---|---|---|---|
| FR | ... | ... | ... |
| AR | ... | ... | ... |
| EN | ... | ... | ... |

## Stats opérations

- Strings ajoutées : {N}
- Strings modifiées : {N}
- Strings retraduites : {N}
- Drift résolu : {N}

## Incidents

- {date} : {description} ({sévérité}) → résolu en {N}h

## Actions du mois

- ✓ {action 1}
- ✓ {action 2}
- ⚠ {action incomplete}

## Plan mois prochain

- {plan 1}
- {plan 2}
```

### Rapport quarterly (markdown format)

```markdown
# Bilan trimestriel i18n — Q{N} {Année}

## Synthèse

{1 paragraphe TL;DR}

## ROI

| Item | Coût | Bénéfice | ROI |
|---|---|---|---|
| FR (baseline) | n/a | n/a | n/a |
| AR | ... | ... | ... |
| EN | ... | ... | ... |

## Performance équipe

- Translateur AR : note moyenne {X}/5
- Translateur EN : note moyenne {Y}/5
- Délais respectés : {Z}%

## Roadmap Q+1

- {item 1}
- {item 2}
- {item 3}

## Décisions

- Continuer translateur AR : oui/non
- Continuer translateur EN : oui/non
- Ajouter nouvelle locale : oui/non (laquelle ?)
```

---

## Anti-patterns

### Anti-pattern 1 — Ne pas faire la review hebdomadaire

**Symptôme** : on prend du retard, le drift s'accumule.

**Conséquence** : au bout de 3 mois, 50+ strings sont obsolètes en AR/EN, refresh massif douloureux.

**Bonne pratique** : la review weekly W1 prend 15 min, fait économiser des heures plus tard.

### Anti-pattern 2 — Considérer les missing keys comme "des warnings"

**Symptôme** : Sentry remonte 5 missing keys, on les ignore.

**Conséquence** : utilisateurs voient `contact.newField` au lieu du texte. Image marque dégradée.

**Bonne pratique** : missing key = bug P1, fix dans la journée.

### Anti-pattern 3 — Ne pas tester le rollback drill

**Symptôme** : on suppose que la procédure marche, on ne teste jamais.

**Conséquence** : le jour J de l'incident, la procédure foire (env var typo, redeploy bloqué).

**Bonne pratique** : drill mensuel, 30 min, peu coûteux, vaut son pesant d'or quand l'incident arrive.

### Anti-pattern 4 — Founder modifie FR sans signaler

**Symptôme** : founder fait des PR sur `messages/fr.json` sans prévenir.

**Conséquence** : drift entre locales, AR et EN obsolètes.

**Bonne pratique** : tout changement FR → automatique commission trad refresh. Process discipliné.

### Anti-pattern 5 — Pas de revue qualité translateur

**Symptôme** : on garde le même translateur AR par habitude, sans audit qualité.

**Conséquence** : la qualité baisse insidieusement, on découvre tard.

**Bonne pratique** : audit trimestriel formel, retours documentés au translateur.

### Anti-pattern 6 — Skipper le monitoring perf

**Symptôme** : on ne lance plus Lighthouse une fois en prod.

**Conséquence** : perf dégrade lentement, on découvre au bout de 6 mois avec un LCP à 5s.

**Bonne pratique** : Lighthouse CI weekly automatique, alerts si threshold passe en dessous.

### Anti-pattern 7 — Bug cosmétique = "on verra plus tard"

**Symptôme** : 20 typos accumulées dans le backlog, jamais fixées.

**Conséquence** : impression que le site n'est pas maintenu, image marque.

**Bonne pratique** : sprint de 30 min vendredi pour clore les typos accumulées. Workflow admin UI pour founder = fix direct.

---

## Annexe — Tableau de bord récap

Dashboard à garder en bookmark :

| Lien | Quoi |
|---|---|
| Sentry issues | https://sentry.io/organizations/femiglow/issues/ |
| Vercel Analytics | https://vercel.com/femiglow/web/analytics |
| GA4 / Plausible | (URL FemiGlow) |
| GitHub Issues label i18n | https://github.com/femiglow/web/issues?q=label:i18n |
| Coverage report (généré weekly) | (interne) |
| Drift report (généré monthly) | (interne) |

---

## Liens utiles

- [`./troubleshooting.md`](./troubleshooting.md) — Erreurs et fixes
- [`./deploiement.md`](./deploiement.md) — Procédure deploy
- [`./ajouter-nouvelle-langue.md`](./ajouter-nouvelle-langue.md) — Ajouter une locale
- [`./workflow-translateur.md`](./workflow-translateur.md) — Workflow translateur
- [`../08-plan-action/rollback.md`](../08-plan-action/rollback.md) — Rollback détaillé
- [`../10-monitoring/`](../10-monitoring/) — Dashboards et KPIs

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
