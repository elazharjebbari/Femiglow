# Templates de communication - Batterie tests i18n FemiGlow

Documentation des 5 templates de communication pour relayer l'avancement, les résultats et apprentissages de la batterie de tests i18n.

Chaque template décrit la **structure**, les **sections obligatoires**, les **KPIs**, **l'audience**, la **fréquence**, et fournit un **exemple rempli**.

Audience : dev qui pilote, lead technique, founder, board, équipe élargie.

## Sommaire

- [Template 1 - Daily standup batterie](#template-1---daily-standup-batterie)
- [Template 2 - Hebdomadaire founder](#template-2---hebdomadaire-founder)
- [Template 3 - Synthèse finale post-deploy](#template-3---synthese-finale-post-deploy)
- [Template 4 - Post-mortem (si incident)](#template-4---post-mortem-si-incident)
- [Template 5 - One-pager exec summary](#template-5---one-pager-exec-summary)
- [Annexes - Bonnes pratiques](#annexes---bonnes-pratiques)

---

## Template 1 - Daily standup batterie

### Audience
Équipe dev (dev pilote, lead technique, QA) sur Slack `#dev-femiglow`.

### Fréquence
**Quotidien** pendant les 2 semaines de la phase 6.

### Format
Message Slack court (max 15 lignes), publié chaque matin à 9h.

### Structure

```markdown
# Batterie i18n - Daily J{N} ({YYYY-MM-DD})

## Wave en cours
Wave {N} - {nom}

## Hier
- Wave {N-1} : {green / red / partial}
- {nombre} tickets P0/P1 fermés
- {détail si remarquable}

## Aujourd'hui
- {prochaine action principale}
- Owner principal : @{username}
- Risques anticipés : {liste courte}

## Compteurs ouverts
- P0 : {N}
- P1 : {N}
- P2 : {N}
- Total tests verts : {X / Y} ({pct}%)
- Coverage : {pct}% (cible 90%)

## Blockers
{liste si présents, sinon "aucun"}

## Actions équipe
- @{username1} : {action}
- @{username2} : {action}
```

### Exemple rempli

```markdown
# Batterie i18n - Daily J5 (2026-06-03)

## Wave en cours
Wave 4 - E2E flows

## Hier
- Wave 3 (Integration) : green
- 2 P1 fermés (RTL switch, hreflang missing on /maison)
- Wave 3 coverage 91% (cible 90%)

## Aujourd'hui
- Lancement Wave 4 (E2E) à 10h sur staging
- Owner principal : @alice
- Risques : wizard AR step 3 historiquement instable

## Compteurs ouverts
- P0 : 0
- P1 : 3 (I18N-FIX-4-001, I18N-FIX-4-002, I18N-FIX-6-003)
- P2 : 8
- Total tests verts : 173 / 180 (96%)
- Coverage : 91% (cible 90%)

## Blockers
aucun

## Actions équipe
- @alice : pilote Wave 4 E2E
- @bob : finir I18N-FIX-6-003 (a11y label-missing)
- @claire : preparation Wave 5 visual baseline
```

### KPIs à inclure

| KPI | Type | Source |
|---|---|---|
| Wave en cours | string | Plan batterie |
| Status wave précédente | green/red | CI report |
| P0 / P1 / P2 ouverts | int | Tracker tickets |
| Tests verts / total | ratio | CI report |
| Coverage | % | Vitest coverage |
| Blockers | list | Triage daily |

### Anti-patterns

- Daily de 30 lignes (trop long, personne ne lit)
- Pas de chiffres ("ça avance bien") - invérifiable
- Daily annoncé à 14h (trop tard pour orienter la journée)
- Daily sans blocker explicite alors qu'il y en a (cache la dette)
- Ok : Daily concis, chiffres, blockers explicites

---

## Template 2 - Hebdomadaire founder

### Audience
Founder + lead technique. Diffusion via email + copie Slack DM.

### Fréquence
**Hebdomadaire** (J5 et J10 de la phase 6).

### Format
Email structuré, ~30-50 lignes, avec graphique optionnel.

### Structure

```markdown
Subject: Batterie i18n W{N}/2 - Status & KPIs (semaine {YYYY-MM-DD})

Bonjour {founder},

Récap semaine {N}/2 de la batterie de tests i18n.

## Avancement
- Waves complétées : {X / 8} ({pct}%)
- Tests verts : {X / Y} ({pct}%)
- Coverage helpers : {pct}% (cible 90%)
- Coverage components : {pct}% (cible 85%)
- Coverage API : {pct}% (cible 90%)
- Coverage clés AR : {pct}% (cible 90%)
- Coverage clés EN : {pct}% (cible 90%)

## Bugs trouvés et fixés cette semaine
- P0 fixés : {N} ({brève description})
- P1 fixés : {N} ({brève description})
- P2 fixés : {N}

## Bugs ouverts
- P0 : {N}
- P1 : {N} (ETA résolution : {date})
- P2 : {N}

## Risques identifiés
1. {risque 1, mitigation}
2. {risque 2, mitigation}

## Prochaine semaine
- {actions principales}
- Signoff phase 6 visé : {date}

## Décisions requises de votre part
{si aucune : "aucune cette semaine"}
{sinon : liste précise des questions}

## Lien tableau de bord détaillé
{URL Notion / Linear board}

Cordialement,
{dev pilote}
```

### Exemple rempli

```markdown
Subject: Batterie i18n W1/2 - Status & KPIs (2026-06-03)

Bonjour Sarah,

Récap semaine 1/2 de la batterie de tests i18n.

## Avancement
- Waves complétées : 4/8 (50%)
- Tests verts : 256/270 (95%)
- Coverage helpers : 92% (cible 90%) OK
- Coverage components : 87% (cible 85%) OK
- Coverage API : 91% (cible 90%) OK
- Coverage clés AR : 88% (cible 90%) gap -2pts
- Coverage clés EN : 47% (cible 90%) gap -43pts

## Bugs trouvés et fixés cette semaine
- P0 fixés : 1 (XSS sur messages ICU avec HTML escape)
- P1 fixés : 4 (RTL switch attribute, focus order RTL, hreflang manquant, label a11y)
- P2 fixés : 7

## Bugs ouverts
- P0 : 0
- P1 : 3 (ETA résolution : J+5)
  - I18N-FIX-4-008 : Wizard AR step 3 timeout sporadique
  - I18N-FIX-6-005 : Contrast ratio insuffisant sur footer AR
  - I18N-FIX-4-012 : Deep link UTM perdu après switch
- P2 : 11

## Risques identifiés
1. Coverage clés EN à 47% : besoin translateur EN +5 jours minimum. Mitigation : prioriser pages marketing + checkout (80%+), tolérer footer/admin à 60% en V1.
2. Wizard AR step 3 flaky : race condition sur fetch livraison. Mitigation : ajout waitForLoadState networkidle + investigation backend si persistant.

## Prochaine semaine (S2)
- Wave 5 (visual regression) - lundi-mardi
- Wave 6 (a11y) - mardi-mercredi
- Wave 7 (performance Lighthouse) - mercredi-jeudi
- Wave 8 (robustness fuzz + chaos) - jeudi-vendredi
- Signoff phase 6 visé : 2026-06-10

## Décisions requises de votre part
1. Coverage EN seuil V1 : OK pour tolérer 70% sur pages marketing + 90% sur checkout, ou bloquer ship si < 90% partout ?
2. Native speaker AR final review : confirmer Khalil disponibilité semaine prochaine J+8 ?

## Lien tableau de bord détaillé
https://linear.app/femiglow/team/I18N/projects/batterie-i18n

Cordialement,
Alice
```

### KPIs à inclure

| KPI | Source |
|---|---|
| Waves complétées | Plan batterie |
| Tests green / total | Cumul CI 7 jours |
| Coverage helpers / components / API | Vitest coverage |
| Coverage clés AR / EN | `/api/i18n/coverage` |
| Bugs fixés P0/P1/P2 | Ticker tracker |
| Bugs ouverts P0/P1/P2 | Ticker tracker |
| ETA résolution P1 | Ticker tracker |
| Risques identifiés | Daily triages |
| Décisions requises | Lead technique |

### Anti-patterns

- Email avec 200 lignes de jargon technique
- Pas de "décisions requises" alors qu'il y en a (frustration founder)
- Email à 23h dimanche (founder lit lundi mais perd 1 jour)
- Métriques sans cibles ("Coverage à 87%") au lieu de "87% (cible 85%) OK"
- Ok : Email envoyé vendredi PM, lisible en 5 min, décisions claires

---

## Template 3 - Synthèse finale post-deploy

### Audience
Founder + lead technique + équipe élargie + board (si demande).

### Fréquence
**Une fois** à la clôture de la phase 6 et après le deploy canary 100%.

### Format
Document Markdown ~100-200 lignes, archivé dans `docs/i18n-strategy-2026-05/11-test-execution/synthese-finale-{date}.md`.

### Structure

```markdown
# Synthèse finale - Batterie tests i18n FemiGlow

**Date** : {YYYY-MM-DD}
**Auteur** : {dev pilote}
**Reviewers** : {lead technique}, {founder}

## TL;DR

{3-5 phrases qui résument l'état final : exit criteria atteints, bugs notables fixés, recommandations V2}

## 1. Vue d'ensemble

### 1.1 Durée et effort
- Phase 6 lancée : {date}
- Phase 6 close : {date}
- Durée effective : {N} jours
- Effort cumulé : {N} JH

### 1.2 Totaux batterie
| Wave | Tests | Green | Coverage | Durée locale | Status |
|---|---|---|---|---|---|
| 1 Foundation | {N} | {N} | {pct}% | {min}m | OK |
| 2 Component | {N} | {N} | {pct}% | {min}m | OK |
| 3 Integration | {N} | {N} | {pct}% | {min}m | OK |
| 4 E2E | {N} | {N} | N/A | {min}m | OK |
| 5 Visual | {N} | {N} | N/A | {min}m | OK |
| 6 A11y | {N} | {N} | N/A | {min}m | OK |
| 7 Performance | {N} | {N} | N/A | {min}m | OK |
| 8 Robustness | {N} | {N} | N/A | {min}m | OK |
| Total | {N} | {N} | | {min}m | OK |

## 2. Coverage finale

### 2.1 Code coverage
{tableau par module avec target / actual / status}

### 2.2 Coverage des clés
{FR / AR / EN avec target / actual}

## 3. Bugs trouvés et fixés

### 3.1 Statistiques
- Total bugs détectés : {N}
- Total fixés : {N} ({pct}%)
- Reportés à V2 : {N}

### 3.2 Détail par sévérité
| Sévérité | Trouvés | Fixés | Ouverts |
|---|---|---|---|
| P0 | {N} | {N} | 0 |
| P1 | {N} | {N} | {N} |
| P2 | {N} | {N} | {N} |
| P3 | {N} | {N} | {N} |

### 3.3 Top 10 bugs marquants
{liste avec ID, description, fix résumé}

## 4. Métriques de performance

### 4.1 Lighthouse par locale
{tableau FR / AR / EN avec scores}

### 4.2 Bundle size
{tableau messages.json + total JS}

### 4.3 LCP / CLS / FID
{tableau par locale}

## 5. Robustness

- Fuzz runs cumulés : {N}
- Crashes détectés : {N}
- XSS leaks détectés : {N}
- Edge cases catched : {liste résumée}

## 6. Décisions clés prises

{décisions de scope, priorité, exclusions}

## 7. Risques résiduels

{liste des P1/P2 reportés à V2 avec justification}

## 8. Recommandations V2

{checklist d'améliorations pour le sprint suivant}

## 9. Apprentissages

### 9.1 Ce qui a bien marché
{liste}

### 9.2 Ce qui a été difficile
{liste}

### 9.3 Process à améliorer
{liste}

## 10. Signoffs

- [ ] Lead technique : {nom} - {date}
- [ ] Founder : {nom} - {date}
- [ ] QA : {nom} - {date}

## Annexes

- A. Logs détaillés par wave : `.test-execution/wave-{N}/`
- B. Verification checklist : `verification-checklist.csv`
- C. Tickets fermés : Linear filter `project:i18n status:closed`
- D. Coverage report HTML : `coverage/index.html`
- E. Playwright HTML report : `playwright-report/index.html`
```

### Exemple rempli (extrait)

```markdown
# Synthèse finale - Batterie tests i18n FemiGlow

**Date** : 2026-06-12
**Auteur** : Alice (dev pilote)
**Reviewers** : Mehdi (lead technique), Sarah (founder)

## TL;DR

La batterie de tests i18n a été exécutée sur 10 jours (2026-06-01 au 2026-06-10). Les 8 waves ont passé les exit criteria. 0 P0 ouvert, 2 P1 ouverts (reportés à V2), 11 P2 documentés. Coverage helpers 92%, components 87%, API 91%, clés FR 100% / AR 91% / EN 73%. Recommandation : ship V1 avec FR + AR (90%+), EN en mode preview jusqu'à 90% coverage clés.

## 1. Vue d'ensemble

### 1.1 Durée et effort
- Phase 6 lancée : 2026-06-01
- Phase 6 close : 2026-06-10
- Durée effective : 10 jours
- Effort cumulé : 18 JH (alice 10, bob 5, claire 3)

### 1.2 Totaux batterie
| Wave | Tests | Green | Coverage | Durée locale | Status |
|---|---|---|---|---|---|
| 1 Foundation | 80 | 80 | 92% | 1.9m | OK |
| 2 Component | 56 | 56 | 87% | 4.8m | OK |
| 3 Integration | 63 | 63 | 91% | 5.6m | OK |
| 4 E2E | 150 | 148 | N/A | 22m | OK (2 flaky fixés) |
| 5 Visual | 31 | 31 | N/A | 7.2m | OK (3 diffs approved) |
| 6 A11y | 18 | 18 | N/A | 3.8m | OK |
| 7 Performance | 9 | 9 | N/A | 4.4m | OK |
| 8 Robustness | 20 | 20 | N/A | 8.7m | OK |
| Total | 427 | 425 | | 58m | OK |

## 3. Bugs trouvés et fixés

### 3.1 Statistiques
- Total bugs détectés : 24
- Total fixés : 22 (92%)
- Reportés à V2 : 2

### 3.2 Détail par sévérité
| Sévérité | Trouvés | Fixés | Ouverts |
|---|---|---|---|
| P0 | 2 | 2 | 0 |
| P1 | 8 | 7 | 1 |
| P2 | 11 | 10 | 1 |
| P3 | 3 | 3 | 0 |

### 3.3 Top 10 bugs marquants
1. I18N-FIX-8-001 (P0) : XSS via ICU message HTML non escapé. Fix : sanitizeMessage utility avec HTML entities.
2. I18N-FIX-3-002 (P0) : Locale switch endpoint ne posait pas cookie en Edge runtime. Fix : cookies().set() sync API.
3. I18N-FIX-4-001 (P1) : html dir pas mis à jour après switch sans reload. Fix : useEffect synchronization client-side.
4. I18N-FIX-6-003 (P1) : LocaleSwitcher menu items sans aria-label en AR. Fix : aria-label depuis t(locale_switcher.choose).
5. I18N-FIX-4-008 (P1) : Wizard AR step 3 race condition sur fetch livraison. Fix : waitForLoadState networkidle + retry backend.
6. I18N-FIX-7-001 (P1) : Bundle messages/ar.json à 21 KB (cible 18 KB). Fix : compaction stringTable + minification ar suffixes.
7. I18N-FIX-5-002 (P2) : Diff visuel 0.7% sur footer AR (font fallback). Approved diff.

## 7. Risques résiduels

- I18N-OPEN-4-015 (P1, reportée V2) : Deep link UTM partiellement perdu sur switch FR vers AR si query param a "?lang=". Workaround documenté, fix complexe en routing.
- I18N-OPEN-7-002 (P2, reportée V2) : Lighthouse Performance EN à 89/100 sur mobile (cible 90). Cause : CSS unused. Fix purge V2.

## 8. Recommandations V2

- [ ] Améliorer coverage EN à 90% (translateur EN +5 JH)
- [ ] Activer mutation testing (Stryker) sur `src/lib/i18n/`
- [ ] Ajouter chaos Edge runtime tests (post-incident I18N-INC-001)
- [ ] Stocker baseline visuels en LFS si non fait
- [ ] Auto-update bundle budget dans CI si messages.json croît

## 10. Signoffs

- [x] Lead technique : Mehdi - 2026-06-11
- [x] Founder : Sarah - 2026-06-12
- [x] QA : Karim - 2026-06-11
```

### Anti-patterns Template 3

- Document de 1000 lignes (illisible)
- Pas de TL;DR (le founder lit le TL;DR + sign)
- Mentir sur les exit criteria ("on a passé même si...") - perte de confiance
- Pas de recommandation V2 (apprentissages perdus)
- Ok : Document TL;DR + détails accessibles + signoff explicite

---

## Template 4 - Post-mortem (si incident)

### Audience
Équipe élargie + founder.

### Fréquence
**Une fois par incident P0** ou bug critique passé en production.

### Format
Document Markdown blameless, ~80-150 lignes.

### Structure

```markdown
# Post-mortem I18N-INC-{nnn} - {titre court}

## Méta
- Date incident : {YYYY-MM-DD HH:MM UTC}
- Sévérité : P{0|1}
- Durée incident : {minutes}
- Reporter : @{username}
- Owner mitigation : @{username}
- Author post-mortem : @{username}
- Reviewers : @{lead}, @{founder}

## Résumé exécutif
{3-5 phrases : quoi, quand, impact, durée, statut actuel}

## Timeline (UTC)
| Heure | Action | Acteur |
|---|---|---|
| HH:MM | Détection | {qui} |
| HH:MM | Triage P0 | {qui} |
| HH:MM | Mitigation appliquée (rollback feature flag) | {qui} |
| HH:MM | Service restauré | - |
| HH:MM | Root cause identifiée | {qui} |
| HH:MM | Hot fix mergé | {qui} |
| HH:MM | Validation prod | {qui} |
| HH:MM | Incident clos | - |

## Impact utilisateurs
- Sessions impactées : {N}
- Locale(s) : {fr/ar/en/all}
- Flow(s) : {checkout / browsing / etc.}
- Perte revenue estimée : {montant} MAD/USD
- Perte de données : {oui/non, détail}
- Communication externe : {oui/non, comment}

## Cause racine
{description technique précise du root cause}

## Pourquoi c'est passé en prod
{ce que la batterie de tests n'a pas attrapé et pourquoi - orienté processus, pas blâme}

## Mitigation appliquée
{steps du rollback / hot fix avec timestamps}

## Fix permanent
{description du fix appliqué post-incident}

## Actions correctives

### Immédiat (déjà fait)
- [x] {action}
- [x] {action}

### Court terme (sprint en cours)
- [ ] {action}, owner @{user}, ETA {date}
- [ ] {action}, owner @{user}, ETA {date}

### Long terme (process)
- [ ] {action}, owner @{user}, ETA {date}

## Lessons learned

1. {leçon 1} : {explication}
2. {leçon 2} : {explication}
3. {leçon 3} : {explication}

## Actions sur la batterie de tests

Quels tests auraient dû attraper ça ? Et pourquoi ne l'ont-ils pas attrapé ?
- {analyse honnête}
- Test à ajouter : {description}

## Owner suivi

@{username} - review actions correctives J+30

## Liens

- Incident channel : {URL Slack}
- Commit du fix : {URL Git}
- Sentry events : {URL Sentry}
- PR fix : {URL GitHub}
```

### Exemple rempli (extrait)

```markdown
# Post-mortem I18N-INC-001 - Production 500 sur /ar/checkout

## Méta
- Date incident : 2026-06-18 14:32 UTC
- Sévérité : P0
- Durée incident : 58 minutes (14:32 au 15:30)
- Reporter : @alice (alert Sentry)
- Owner mitigation : @alice
- Author post-mortem : @alice
- Reviewers : @mehdi (lead), @sarah (founder)

## Résumé exécutif

Suite au déploiement v1.4.0 le 2026-06-18 à 14:25 UTC, les requêtes vers `/ar/checkout` retournaient HTTP 500 sur Vercel Edge runtime. 423 sessions AR ont été impactées en 58 minutes avant rollback complet du feature flag I18N_ENABLED à 14:42. Root cause : circular dependency entre dictionary.ts et messages/ar.json non détectée par la batterie (qui tournait sur Node.js, pas Edge). Hot fix mergé à 16:15, service restauré progressivement à 17:30.

## Timeline (UTC)
| Heure | Action | Acteur |
|---|---|---|
| 14:25 | Deploy v1.4.0 (canary 100%) | @bob |
| 14:32 | 1ère alerte Sentry (5xx spike) | Sentry |
| 14:33 | Triage on-call | @alice |
| 14:35 | Confirmation impact AR uniquement | @alice |
| 14:38 | Décision rollback feature flag | @alice + @mehdi |
| 14:42 | Rollback I18N_ENABLED=false sur Vercel | @alice |
| 14:50 | Confirmation service restauré FR/EN | - |
| 15:30 | Tous trafics OK FR/EN, AR redirected vers /fr | @alice |
| 16:15 | Root cause identifiée | @alice + @mehdi |
| 17:30 | Hot fix mergé + re-deploy | @alice |
| 17:45 | Re-activation I18N_ENABLED=true canary 50% | @alice |
| 18:30 | Canary 100% | @alice |
| 19:00 | Incident clos | - |

## Impact utilisateurs
- Sessions impactées : 423 sessions AR
- Locale(s) : ar uniquement
- Flow(s) : checkout (step 1, 2, 3)
- Perte revenue estimée : ~5 500 MAD (taux conversion 5%, panier moyen 260 MAD)
- Perte de données : non (DB intacte, sessions abandonnées non sauvegardées)
- Communication externe : non (pas de mention publique requise)

## Cause racine

Le fichier `src/lib/checkout/i18n/dictionary.ts` importait `messages/ar.json` via `require()` synchrone au module level. En Edge runtime Vercel, les fichiers JSON statiques sont chargés via `fetch` async par défaut, ce qui causait une promise non-awaited et un crash de l'instance Edge.

La batterie de tests Wave 3 (Integration) tournait sur Node.js (Vitest), où `require()` est synchrone. Wave 4 (E2E) tournait sur Playwright + Next.js Node serveur (`pnpm dev`), pas Edge runtime. Aucune wave ne couvrait Edge runtime spécifiquement.

## Pourquoi c'est passé en prod

1. Edge runtime != Node runtime : la batterie n'avait pas de test dédié Edge.
2. Canary 100% trop rapide : passage à 100% en 1 jour, sans pause pour observer.
3. Sentry n'avait pas d'alert sur 5xx spike par locale : alert globale 5xx existe, mais déclenche à 1% seulement (ici, 100% AR mais ~10% global donc sous seuil).

## Actions correctives

### Immédiat (déjà fait)
- [x] Rollback feature flag
- [x] Hot fix dictionary.ts
- [x] Re-deploy + canary progressif

### Court terme (sprint en cours)
- [x] Ajouter test Edge runtime dans Wave 3, owner @alice, ETA J+2
- [x] Ajouter chaos test Edge dans Wave 8, owner @alice, ETA J+3
- [ ] Sentry alert sur 5xx par locale, owner @bob, ETA J+5

### Long terme (process)
- [ ] Canary policy revue : minimum 24h par palier (10 / 50 / 100), owner @mehdi, ETA J+15
- [ ] Lighthouse CI doit run en Edge mode également, owner @claire, ETA J+30

## Lessons learned

1. Edge runtime nécessite tests dédiés : ne pas supposer que Node tests couvrent Edge. Toute Server Action, route API, middleware doit être testé en Edge si shipé en Edge.
2. Canary trop rapide = blind shot : 24h minimum par palier. Si trafic AR < 5%, on attend que les 5% soient atteints pour observer.
3. Alert granularité : 5xx alert globale n'est pas suffisante. Par locale, par route, par flow critique.
4. Pas de blâme individuel : le process a failli (pas de test Edge, pas de canary lent), pas la personne qui a deploy.

## Actions sur la batterie de tests

Quels tests auraient dû attraper ça ? Et pourquoi ne l'ont-ils pas attrapé ?

- Wave 3 aurait dû avoir un test Edge runtime pour chaque API route. Manquait.
- Wave 8 aurait dû simuler Edge runtime via `@vercel/edge-runtime`. Manquait.

Tests à ajouter :
- `src/lib/checkout/i18n/dictionary.edge.test.ts` : run module en Edge environment, assert no crash
- `e2e/chaos/edge-runtime-locales.spec.ts` : check `/ar/checkout` retourne 200 en preview Vercel Edge

## Owner suivi

@alice - review actions correctives J+30 (2026-07-18)

## Liens

- Incident channel : https://femiglow.slack.com/archives/CXXXXXX
- Commit du fix : https://github.com/femiglow/template-femiglow/commit/abc1234
- Sentry events : https://sentry.io/organizations/femiglow/issues/?query=I18N-INC-001
- PR fix : https://github.com/femiglow/template-femiglow/pull/2143
```

### Anti-patterns Template 4

- Document orienté blâme ("X a deploy sans tester")
- Pas de timeline précise (UTC + acteur)
- Actions correctives vagues sans owner ni date
- Ne pas analyser "pourquoi la batterie n'a pas attrapé"
- Ok : Blameless, factuel, actions concrètes avec owner + date

---

## Template 5 - One-pager exec summary

### Audience
Board, investisseurs, équipe non-technique étendue.

### Fréquence
**Une fois** à la clôture de la batterie ou en cas de demande exec.

### Format
**1 page max** (PDF ou Notion page), visuel avec graphiques optionnels.

### Structure

```markdown
# I18N FemiGlow - Exec One-Pager

**Date** : {YYYY-MM-DD}
**Phase** : Batterie de tests close, production live

## Le contexte en 3 phrases
{1. pourquoi i18n, 2. quoi shipé, 3. impact business attendu}

## KPIs de la batterie

| Métrique | Cible | Atteint | Status |
|---|---|---|---|
| Tests verts | 100% | {pct}% | {OK/warn} |
| Coverage code i18n | >= 85% | {pct}% | {OK/warn} |
| Coverage clés FR | 100% | {pct}% | {OK/warn} |
| Coverage clés AR | >= 90% | {pct}% | {OK/warn} |
| Coverage clés EN | >= 90% | {pct}% | {OK/warn} |
| Lighthouse Perf 3 locales | >= 90 | {pct}% | {OK/warn} |
| A11y critical/serious | 0 | {N} | {OK/warn} |
| P0 bugs ouverts | 0 | {N} | {OK/warn} |

## Highlights

- Robustesse validée : {N} tests, 8 vagues, 0 crash sur 1000+ fuzz runs
- Sécurité : XSS protection ajoutée, audit log sur écritures admin
- Accessibilité : WCAG 2.1 AA respecté en RTL (arabe)
- Performance : Bundle < +5% vs baseline, LCP < 2.5s sur 3 locales

## Impact business attendu

- Marché AR-MA : adressable dès maintenant (90% clés AR traduites, RTL OK)
- Marché EN tier-1 : preview ouverte (73% clés), full activation V2 (sprint +1)
- Conversion : à mesurer post-deploy via canary, hypothèse +5 à +10% AR

## Risques résiduels

1. EN coverage 73% : pages marketing OK 95%, footer/admin tolérés 60%. Plan rattrapage V2.
2. 2 P1 reportés à V2 : workaround documenté, non bloquant V1.

## Recommandation
GO ship V1 avec FR + AR + EN preview. Plan V2 (4 semaines) pour atteindre 90% EN partout.

## Signoffs
- Lead technique : Mehdi (2026-06-11)
- Founder : Sarah (2026-06-12)
- QA : Karim (2026-06-11)

## Liens
- Synthèse détaillée : {URL}
- Tableau bord live : {URL}
```

### Exemple rempli

```markdown
# I18N FemiGlow - Exec One-Pager

**Date** : 2026-06-12
**Phase** : Batterie de tests close, production live

## Le contexte en 3 phrases
FemiGlow s'ouvre aux marchés AR-MA (90% du trafic actuel) et EN (tier-1 marketing). La batterie de tests i18n a validé 427 tests sur 8 vagues, couvrant routing, traduction, RTL, performance et accessibilité. La V1 est shipée, conversion à mesurer canary, V2 plan dans 4 semaines.

## KPIs de la batterie

| Métrique | Cible | Atteint | Status |
|---|---|---|---|
| Tests verts | 100% | 99.5% (425/427) | OK |
| Coverage code i18n | >= 85% | 90% | OK |
| Coverage clés FR | 100% | 100% | OK |
| Coverage clés AR | >= 90% | 91% | OK |
| Coverage clés EN | >= 90% | 73% | warn |
| Lighthouse Perf 3 locales | >= 90 | 91/92/89 | warn EN |
| A11y critical/serious | 0 | 0 | OK |
| P0 bugs ouverts | 0 | 0 | OK |

## Highlights

- Robustesse : 427 tests, 8 vagues, 0 crash sur 2 500 fuzz runs (resolveLocale, formatters)
- Sécurité : XSS protection HTML entities + RTL override protection (U+202E stripped)
- Accessibilité : WCAG 2.1 AA respecté en RTL, focus order inversé OK
- Performance : Bundle messages AR à 14.8 KB gzipped (cible 18 KB), LCP < 2.5s sur 3 locales

## Impact business attendu

- Marché AR-MA : adressable immédiatement. Hypothèse +8 à +12% conversion (signal local).
- Marché EN tier-1 : pages marketing 95% prêtes, checkout 90%, admin 60%. Preview ouverte, full V2.
- Cookie consent localisé : conforme RGPD + ARCEP.

## Risques résiduels

1. EN coverage 73% : Lighthouse perf EN 89 (cible 90, gap -1). Cause : CSS purge V2. Non bloquant.
2. 2 P1 reportés à V2 : deep link UTM partiellement perdu sur switch FR-AR (workaround : preserve via query encoder).

## Recommandation
GO ship V1 avec FR + AR + EN preview. Plan V2 (4 semaines) pour atteindre 90% EN partout + résoudre 2 P1 reportés.

## Signoffs
- Lead technique : Mehdi (2026-06-11)
- Founder : Sarah (2026-06-12)
- QA : Karim (2026-06-11)

## Liens
- Synthèse détaillée : `docs/i18n-strategy-2026-05/11-test-execution/synthese-finale-2026-06-12.md`
- Tableau bord live : https://femiglow.metabase.com/dashboard/i18n
- Sentry dashboard locale : https://sentry.io/organizations/femiglow/dashboards/i18n-locale-errors/
```

### Anti-patterns Template 5

- One-pager qui devient 3 pages
- Jargon technique non expliqué
- Pas de "recommandation GO/NO-GO" claire
- KPIs sans cible (impossible à juger)
- Ok : 1 page, lisible 60 secondes, recommandation claire

---

## Annexes - Bonnes pratiques

### A. Cadence de communication

| Template | Audience | Fréquence | Canal |
|---|---|---|---|
| T1 Daily | Équipe dev | Quotidien J1 au J10 | Slack `#dev-femiglow` |
| T2 Weekly | Founder + lead | Vendredi PM | Email + Slack DM |
| T3 Synthèse finale | Founder + lead + équipe | À la clôture | Markdown dans `docs/` + email |
| T4 Post-mortem | Équipe élargie + founder | Par incident P0 | Markdown dans `docs/` + équipe Slack |
| T5 Exec one-pager | Board / invest | Demande exec ou clôture | PDF ou Notion |

### B. KPIs cumulés à tracker

| KPI | Calcul | Cible | Lecture |
|---|---|---|---|
| Tests green ratio | green / total | 100% | Bloquant si < 100% |
| Coverage helpers | Vitest --coverage | >= 90% | Bloquant |
| Coverage clés FR/AR/EN | `/api/i18n/coverage` | 100/90/90 | Bloquant FR |
| P0 / P1 / P2 ouverts | Tracker | 0 / <5 / <20 | Bloquant P0 |
| Flaky test rate | (flaky / total runs) | 0% sur 3 runs | Bloquant |
| LCP / CLS | Lighthouse | <2.5s / <0.1 | Warn |
| Bundle delta | Bundle-analyzer | <+5% | Warn |
| Time-to-fix P0 | Triage au merge | <24h | SLA |
| Time-to-fix P1 | Triage au merge | <7 jours | SLA |

### C. Outils de génération

| Outil | Usage |
|---|---|
| `scripts/generate-batterie-report.mjs` | T3 synthèse finale auto-générée depuis `.test-execution/` |
| `scripts/notify-slack.mjs` | Push notification daily/weekly sur Slack |
| Notion API | Templates auto-créés en début de phase 6 |
| Linear / JIRA report | Export bugs P0/P1/P2 par sprint |
| Metabase / Looker | Dashboards KPIs visuels |

### D. Stockage long terme

- Synthèses : `docs/i18n-strategy-2026-05/11-test-execution/synthese-{date}-{type}.md`
- Logs détaillés : `.test-execution/` (compressé en `.tar.gz` archivé sur S3 ou GH Release)
- Coverage HTML : `coverage/index.html` (snapshot par release)
- Playwright reports : `playwright-report/` (compressé)

### E. Anti-patterns transverses

- Communiquer sans déclarer la cible/threshold - invérifiable
- Communication descendante uniquement (founder ne sait pas demander)
- Pas de version archivée (perte d'historique pour V2)
- Communiquer en jargon technique au founder (perte de confiance)
- Pas de mention des risques résiduels (false sense of completion)
- Ok : KPIs avec cibles, audience-aware, archivé, risques transparents
