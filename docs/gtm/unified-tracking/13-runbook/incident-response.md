# Incident response runbook

**Version** : 1.0  
**Dernière mise à jour** : 2026-05-14

## Définition d'un incident

Un **incident** est toute situation où le système ne se comporte pas comme attendu et affecte (ou risque d'affecter) le tracking en production.

## Niveaux de sévérité

| Niveau | Description | Réponse | Cible MTTR |
|---|---|---|---|
| **SEV-1** | Service down, perte de tracking, leak de secret | Immédiate, all-hands | < 1h |
| **SEV-2** | Dégradation critique, drift critique, > 10% erreurs | Immédiate, Lead + Younes | < 4h |
| **SEV-3** | Bug fonctionnel, drift mineur, < 1% erreurs | Triage J+1 | < 1 semaine |
| **SEV-4** | Tweak UI, typo, edge case rare | Backlog | Quand possible |

MTTR = Mean Time To Resolve.

## Sources d'incident

| Source | Cible alerte |
|---|---|
| Drift detector → critical | Slack `#tech-tracking-plan` + email Younes |
| Sentry → erreur 500 burst | Slack |
| Grafana → SLO breach | Slack + pager |
| User report (Amal, Aïcha) | Slack DM |
| Audit hebdo → anomalie | Issue GitHub |

## Workflow général

```
Détection → Triage → Investigation → Mitigation → Communication → Post-mortem
```

---

## Procédure SEV-1 : Service down ou perte de tracking

### Indicateurs
- 0 event GA4 reçu dans la dernière heure (vs baseline ~50-100/h).
- Healthcheck KO.
- Tous les admins voient des erreurs 500.
- Drift critique sur tous les environnements.

### Étapes (target < 15 min réponse)

#### 1. Acknowledge l'alerte (< 2 min)
- Réagir en Slack `#tech-tracking-plan`.
- Indiquer "On investigue."

#### 2. Identifier la nature (< 5 min)
```bash
# Logs serveur (Sentry / Datadog)
# Cherche : erreur 500 récente, stack trace, message

# Healthcheck
curl https://app.femiglow.ma/api/healthz

# Status page providers (Vercel, Postgres host, etc.)
```

#### 3. Décider du palier de remédiation
| Symptôme | Action |
|---|---|
| Code bug introduit récemment | Rollback L3 (revert deploy) |
| Mauvaise variable d'env | Fix env + redéploiement |
| DB down | Escalade DBA |
| Provider externe down (Vercel) | Attendre + comm |
| Secret leaked | Rotation immédiate + L4 si nécessaire |

#### 4. Exécuter (< 15 min)
Selon le palier, suivre le runbook adéquat (`rollback-runbook.md`).

#### 5. Vérifier (< 5 min)
- Healthcheck redevient OK.
- Erreurs s'arrêtent dans Sentry.
- Events GA4 reprennent (vérifier 5-10 min de patience).

#### 6. Communication (< 10 min)
Slack `#general` + email stakeholders :
> 🚨 Incident SEV-1 résolu à {time}. Cause : {short}. Pas d'impact data client. Post-mortem à venir.

#### 7. Post-mortem (< 48h)
Document complet, partagé en `docs/post-mortems/{date}-tracking-{short}.md`.

---

## Procédure SEV-2 : Drift critique détecté

### Indicateurs
- Drift detector → status = `critical`.
- Bundle hash sur client ≠ bundle hash plan actif.
- Persisté > 3 pings consécutifs.

### Étapes

#### 1. Vérifier la nature du drift
Aller sur `/admin/tracking/sync` :
- Plan actif : bundleId X
- Client ping : bundleId Y (différent)
- Reasons : "Bundle mismatch — client utilise version antérieure"

#### 2. Cas 1 : Le client utilise un JSON GTM périmé
**Action** :
- Re-télécharger le JSON depuis l'admin.
- Importer dans GTM (mode Overwrite).
- Publier le container GTM.
- Attendre 2-5 min.
- Vérifier que le drift status revient OK.

#### 3. Cas 2 : Le plan actif a été modifié sans re-publier dans GTM
**Action** :
- Identifier qui a fait le changement (audit log).
- Vérifier que les changements sont intentionnels.
- Re-télécharger + ré-importer dans GTM.

#### 4. Cas 3 : Un autre admin a modifié le GTM manuellement (mauvaise pratique)
**Action** :
- Identifier le changement non-managed.
- Soit ré-intégrer dans le plan actif (préférer).
- Soit annuler le changement GTM (overwrite avec JSON du plan).
- Rappeler à l'équipe : modifs GTM uniquement via admin tracking.

#### 5. Cas 4 : Faux positif (anomalie hash)
**Action** :
- Vérifier que les `events` array sont identiques après normalisation.
- Si oui : c'est probablement un bug détecteur → ouvrir issue.
- Mute manuel temporaire de l'alerte.

### Communication
Slack `#tech-tracking-plan` :
> Drift {cas X} détecté à {time}. Résolution : {action}. Status OK à {time}.

---

## Procédure SEV-2 : Burst d'erreurs 500

### Indicateurs
- > 10 erreurs 500 par minute.
- Pattern visible dans Sentry.

### Étapes

#### 1. Identifier la route impactée
Sentry → grouper par endpoint.

#### 2. Identifier la nature de l'erreur
- Stack trace.
- Recent commits sur ce code.
- Logs DB pendant la fenêtre.

#### 3. Si bug récent introduit
- Rollback L3 si déployé < 4h.
- Hotfix branch si > 4h.

#### 4. Si bug existant déclenché par data spécifique
- Identifier l'utilisateur / data trigger.
- Hotfix urgent.
- Communication ciblée à l'utilisateur.

#### 5. Si lié à dépendance externe
- Vérifier status page provider.
- Ouvrir ticket support.
- Si possible : circuit breaker pour dégrader proprement.

---

## Procédure SEV-3 : Bug fonctionnel

### Indicateurs
- Amal / Younes report un bug.
- Pas critique mais doit être fixé.

### Étapes

#### 1. Triage (J+0 ou J+1)
- Ouvrir issue GitHub.
- Reproduire.
- Assigner priorité (P0/P1/P2).
- Estimer.

#### 2. Fix
- Branche `fix/tp2-{ticket-id}-{short}`.
- PR + review + merge.
- Déploiement standard.

#### 3. Confirmation
- Tester en prod (compte test).
- Confirmer à l'utilisateur qui a reporté.

---

## Procédure : Bug a11y

### Indicateurs
- axe-core CI échoue.
- User screen reader report.

### Étapes

#### 1. Identifier la violation
```bash
npx playwright test --grep a11y
```

#### 2. Lire le détail (axe report)
- Component impacté.
- Type de violation (contrast, missing label, etc.).

#### 3. Fix
- Patch component.
- Test manuel NVDA/VoiceOver.

#### 4. Vérifier
- axe-core CI passe.
- Tests manuels OK.

---

## Procédure : Bug i18n

### Indicateurs
- Texte non traduit visible (e.g. "missing_translation_key" affiché).
- Layout cassé en arabe (RTL).

### Étapes

#### 1. Identifier la clé manquante
- Page concernée.
- Locale concernée (fr/ar).

#### 2. Ajouter la traduction
- Éditer `locales/{lang}/tracking-admin.json`.
- Vérifier que clés communes existent.

#### 3. Si bug RTL
- Vérifier les classes Tailwind logical (`ms-*` au lieu de `ml-*`).
- Tester sur Chrome avec `dir="rtl"`.

---

## Procédure : Bug performance

### Indicateurs
- Latence p95 > cible.
- Lighthouse score baisse.
- User report "ça lag".

### Étapes

#### 1. Mesurer
- Lighthouse (production).
- APM (server side).
- React DevTools Profiler (côté client).

#### 2. Identifier le bottleneck
- Re-render excessif ?
- Query DB lente ?
- Bundle trop gros ?

#### 3. Fix selon cause
- Memoization (`useMemo`, `React.memo`).
- Index DB.
- Code splitting.

---

## Communication interne pendant incident

### Pattern message
```
[SEV-X] Incident en cours : {short description}

Impact : {who/what}
ETA résolution : {time}
Actions en cours : {bullet points}

Updates : toutes les 15 min jusqu'à résolution.
```

### Update cycle
- < SEV-1 : Update toutes les 15 min.
- SEV-2 : Update toutes les 30 min.
- SEV-3 : Update quotidien.

### Communication externe (si impact visible)
- Si tracking côté client perdu > 30 min : envisager une communication directe à Aïcha (CMO).
- Si > 2h : email aux stakeholders.
- Si > 24h : escalade direction.

---

## Post-mortem (obligatoire pour SEV-1 et SEV-2)

### Template
```markdown
# Post-mortem : {Date} — {Short description}

## Résumé
- Sévérité : SEV-X
- Début : {time}
- Fin : {time}
- Durée : {N minutes}
- Impact : {users affected, data lost, etc.}

## Timeline
- {time} : Détection
- {time} : Acknowledge
- {time} : Identification cause
- {time} : Action prise
- {time} : Résolution

## Root cause
{Description technique précise.}

## Ce qui a bien fonctionné
- ...

## Ce qui a moins bien fonctionné
- ...

## Actions correctives
- [ ] {Action 1} — owner {X}, due {date}
- [ ] {Action 2} — owner {X}, due {date}

## Leçons apprises
- ...
```

Publier dans `docs/post-mortems/`.

Pas de blame, focus système et process.

---

## On-call rotation (futur)

Pour l'instant : Younes + Lead dev sur appel partagé.

V2 : si l'équipe grandit, rotation hebdo entre 3-4 ingés.

---

## Drills d'incident (annuel)

1× par an, simuler un incident SEV-1 :
- Lead dev déclenche un faux drift critical.
- Younes doit suivre le runbook.
- Mesurer le MTTR.
- Identifier les frictions.
- Mettre à jour les runbooks.
