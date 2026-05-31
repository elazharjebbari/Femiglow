# 90.4 — Risques

## Matrice

| ID | Risque | Probabilité | Impact | Score | Mitigation |
|---|---|---|---|---|---|
| R01 | Juriste indisponible/lent | Élevée | Critique | ★★★★ | Briefing 4 sem avant + juriste de back-up |
| R02 | Variable manquante en prod (publish accidentel) | Moyenne | Élevée | ★★★ | Validation au publish + tests |
| R03 | Sanitization HTML laisse passer XSS | Faible | Critique | ★★★ | Tests exhaustifs + audit sécu externe |
| R04 | Bundle size admin trop lourd (CodeMirror) | Moyenne | Moyenne | ★★ | Code-split + lazy + monitoring |
| R05 | Refactor Footer casse autres pages | Moyenne | Élevée | ★★★ | Tests visuels Storybook + e2e existants |
| R06 | Cookie banner non conforme ePrivacy | Faible | Critique | ★★★ | Review juriste explicite |
| R07 | RGPD breach détecté post-launch | Faible | Critique | ★★ | Audit avant launch + monitoring |
| R08 | Cron sature ressources | Faible | Moyenne | ★ | Limiter concurrency + timeout |
| R09 | Git sync échoue silencieusement | Moyenne | Faible | ★ | Alertes Sentry + backup DB primaire |
| R10 | Tests flaky en CI | Moyenne | Moyenne | ★★ | Retries + identification + fix |
| R11 | Régression mobile non détectée | Moyenne | Élevée | ★★★ | Tests Playwright iPhone + manuel |
| R12 | Admin se trompe et publie une page mal rédigée | Moyenne | Élevée | ★★★ | Workflow review + 4-yeux V2 |
| R13 | Chat IA hallucine des slugs | Élevée | Faible | ★★ | Legal-guard validation |
| R14 | Performance SEO impactée (sitemap) | Faible | Moyenne | ★ | Tests sitemap + monitoring search console |
| R15 | Charge admin trop lente sur DB (history queries) | Faible | Moyenne | ★ | Index + pagination |

## Détail des risques critiques

### R01 — Juriste lent

**Description** : Le juriste externe peut avoir un délai important pour relire (semaines), bloquant la publication.

**Indicateurs précoces** :
- Pas de réponse dans les 3 jours suivant l'envoi
- Demandes répétées de précisions

**Mitigations** :
1. Briefing du juriste **dès M0** (4 semaines avant le launch cible)
2. Envoi des pages **au fil de l'eau** dès M3 fini (pas en bulk fin de projet)
3. Identifier **un juriste de back-up** dans un autre cabinet
4. Préparer un **export PDF aisé** dès le départ
5. Mettre à disposition un **template de retour structuré** pour faciliter le feedback

**Plan B** :
- Si juriste KO à J-7 : publication minimale (mentions, CGV, privacy) avec disclaimer "en révision"
- Compléter dans la semaine post-launch

---

### R02 — Variable manquante publiée

**Description** : Une page publiée affiche `{{COMPANY_RC}}` ou similaire en clair, donnant une mauvaise image.

**Mitigations** :
1. `detectMissingVars` bloque le publish si var required manquante
2. Aperçu admin surligne les variables manquantes en rouge
3. Banner global "X pages ont des variables manquantes"
4. Cron quotidien détecte les vars vides
5. Health endpoint refuse le pass si `pages_missing_vars > 0`

**Plan B** :
- Détection runtime côté server : `if (html.includes('{{')) return 500`
- En production, retombe sur une page minimale "Cette page est en cours de mise à jour"

---

### R03 — XSS via contenu MD

**Description** : Un admin malveillant ou un bug parsing peut injecter du JS dans une page légale.

**Mitigations** :
1. DOMPurify config strict (whitelist explicite)
2. Markdown-it `html: false`
3. CSP strict en production (`script-src 'self'`)
4. Tests Jest exhaustifs sur XSS vectors connus
5. Audit sécurité externe pre-launch

**Plan B** :
- Si XSS détecté : `revalidatePath('/legal/[slug]')` ne sert pas la nouvelle version cassée, garde l'ancienne
- Dépublication d'urgence possible

---

### R05 — Refactor Footer casse autres pages

**Description** : Modifier le composant Footer global peut affecter toutes les pages du site.

**Mitigations** :
1. Tests visuels Storybook avant merge
2. Test e2e couvrant Footer sur 5+ pages clés
3. Refactor progressif (introduire `<FooterLegalLinks>` à côté de l'existant, puis swap)
4. Code review obligatoire par lead frontend

**Plan B** :
- Si régression détectée post-deploy : rollback du commit
- Test ultimate inclut un check Footer sur 3 pages

---

### R06 — Cookie banner non conforme

**Description** : Le banner pourrait ne pas respecter ePrivacy (cookies non essentiels actifs avant consentement).

**Mitigations** :
1. Audit du flow tracking par juriste
2. Tests e2e : aucun cookie tiers déposé avant click "Accepter"
3. Review explicite du code de ConsentBanner
4. Référence : guides CNIL FR et CNDP MA

**Plan B** :
- Si non-conformité détectée post-launch : patch en P0 (cookies tiers désactivés par défaut)

---

### R11 — Régression mobile non détectée

**Description** : Une UI cassée en mobile (Safari iOS notamment) non détectée car les tests sont desktop-first.

**Mitigations** :
1. Playwright projects : `desktop-chrome` + `mobile-safari` + `mobile-chrome`
2. Tests visuels Storybook avec viewports mobile
3. Manual QA sur device réel pre-launch
4. Lighthouse mobile dans CI

**Plan B** :
- Hotfix en moins de 4h si régression mobile critique détectée
- Fallback : retirer la zone problématique (ex: cookie banner mobile)

---

### R12 — Admin publie une page mal rédigée

**Description** : Maya publie une page contenant une erreur factuelle, contradiction, ou non-validée juridiquement.

**Mitigations** :
1. Modal publish avec checklist 4 items
2. Confirmation par tape "PUBLIER"
3. Historique permet rollback rapide
4. V2 : workflow 4-yeux obligatoire (review ≠ submit)

**Plan B** :
- Rollback via "Restaurer la version précédente"
- Dépublier immédiatement si grave

---

## Risques résiduels acceptés

| ID | Risque | Décision | Raison |
|---|---|---|---|
| R-A1 | Sitemap indexé par Google avant noindex propagé | Accepté | Délai 2-3j max ; risque marginal |
| R-A2 | Auto-save échoue temporairement | Accepté | Garantie best-effort, indicateur visible |
| R-A3 | Chat propose un lien légal très occasionnellement absent | Accepté | Mitigation post-V1 |

## Mise à jour des risques

Cette matrice est revue :
- En kickoff de chaque milestone
- Lors des incidents
- Trimestriellement post-launch

Owner : Tech Lead.
