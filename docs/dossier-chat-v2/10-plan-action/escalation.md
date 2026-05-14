# Escalation paths — Quand on dérape

> Anticiper les dérapages = ne pas dériver de 30%. L'escalation n'est pas un aveu d'échec : c'est un signal sain. Mieux escalader tôt que naviguer dans le brouillard.

## Triggers d'escalation

### Trigger 1 — Sprint vélocité < 70% à mi-sprint (🔴 rouge)

**Quoi** : moins de 30% des points sprint Done à la fin de la première semaine.

**Symptômes** :
- Tickets In Progress qui stagnent depuis 3+ jours
- Plusieurs tickets bloqués sans owner pour débloquer
- PR ouvertes qui ne se ferment pas

**Action immédiate** :
1. **PO + dev_lead sync 30 min** (mardi/mercredi semaine 2).
2. Identifier le blocker principal (souvent 1 seul).
3. Scope cutter : couper le ticket le moins critique du sprint.
4. Slack `#chat-build` annonce transparent : "Sprint NN reprio — voici ce qui shippe, voici ce qui glisse."

**Owner décision** : PO Selma.

### Trigger 2 — Blocker tech > 24h sans solution

**Quoi** : un dev annonce en daily qu'il est bloqué, et 24h après il l'est toujours.

**Symptômes** :
- "Je tourne en rond sur ce bug d'embedding HNSW"
- "Le provider OpenAI répond bizarre"
- "Drizzle migration down ne passe pas"

**Action immédiate** :
1. **Pair programming forcé** (dev_lead + dev_intermediate, 2h block).
2. Si pas résolu : **consultant externe contacté** (ex. Drizzle Discord, OpenAI support).
3. Si > 48h : **scope cutter** + ticket de suivi pour V6.

**Owner décision** : dev_lead.

### Trigger 3 — Provider LLM outage > 30 min

**Quoi** : OpenAI/Anthropic/Mistral down ou dégradés.

**Symptômes** :
- Sentry alerts 5xx provider > 10% sur 5 min
- Conversations qui timeout
- Service level drop alert

**Action immédiate** :
1. **dev_lead pinged immédiatement** (Sentry → Slack #chat-launch).
2. **Vérifier breaker actif** : le système doit avoir basculé sur provider de fallback. Si non, hot-fix.
3. **Communication transparente** : annonce dans `#chat-launch` + status page si > 1h.
4. **Post-mortem dans les 48h** si P0/P1.

**Owner décision** : dev_lead + PO (communication externe).

### Trigger 4 — Budget LLM dépasse 80% mensuel à mi-mois

**Quoi** : `cron-budget-watch` alerte que la consommation va dépasser le seuil mensuel.

**Symptômes** :
- Alert Slack `#chat-launch` "Budget 80% reached"
- Cost dashboard montre courbe ascendante

**Action immédiate** :
1. **Switch service level à RAG_ONLY** automatique (déjà configuré).
2. **PO + dev_lead audit cause** :
   - Spike trafic légitime ?
   - Bug qui appelle LLM en boucle ?
   - Provider qui a changé pricing ?
3. **Décision** : augmenter budget, optimiser, ou rester degraded jusqu'au mois suivant.

**Owner décision** : PO Selma (budget) + dev_lead (technical mitigation).

### Trigger 5 — Conversion NS < 50% baseline 7 jours

**Quoi** : `chat_to_purchase_conversion_rate` post-V5 ship est inférieur à la baseline pré-V5 pendant 7 jours consécutifs.

**Symptômes** :
- Dashboard Business rouge
- Care signal moins de leads HOT
- CEO commence à demander des explications

**Action immédiate** :
1. **War room PO + dev_lead + content + care** (2h).
2. **Funnel analysis** : où la conversion drop-t-elle ? (chat_opened → message_sent → suggestion_clicked → lead_form → order)
3. **A/B test urgent** : tester une hypothèse de fix (greeting, suggestions, leadForm).
4. **Rollback partiel** si nécessaire (feature flag).

**Owner décision** : PO Selma + CEO si décision rollback complet.

### Trigger 6 — Incident P0 (chat down complètement)

**Quoi** : `/api/chat/message` retourne 500 ou ne stream plus du tout.

**Symptômes** :
- Sentry P0 alert + #chat-launch
- 0 messages servis en 5 min
- Care signal "le chat ne marche pas du tout"

**Action immédiate** :
1. **dev_lead on-call répond < 15 min** (mobile push).
2. **Rollback immédiat** via Vercel deploy revert (cf. `runbook/rollback.md`).
3. **Status page** updated.
4. **Slack `#chat-launch`** : "Incident P0 — investigating".
5. **Post-mortem obligatoire** dans 48h (cf. `runbook/incidents.md`).

**Owner décision** : dev_lead. PO informé en temps réel.

### Trigger 7 — Dev burnout signaux

**Quoi** : un membre de l'équipe montre signaux de burnout.

**Symptômes** :
- Pull requests en dehors des heures (soir/weekend) systématiques
- Daily standup silencieux ou agressif
- Tickets stagnants malgré effort visible
- Erreurs basiques en code review

**Action immédiate** :
1. **1:1 confidentiel PO ↔ dev** (le jour même si possible).
2. **Reduce scope sprint** : on accepte vélocité diminuée temporairement.
3. **Renfort externe** : freelance dev si charge structurelle.
4. **Pas de jugement, pas de pénalité, pas de communication externe**.

**Owner décision** : PO Selma uniquement.

## Process escalation général

```
1. Détecter signal (daily, dashboard, Sentry, intuition)
   ↓
2. Évaluer sévérité (P0/P1/P2/P3 ou impact business)
   ↓
3. Convoquer le bon cercle (pas plus que nécessaire)
   ↓
4. Décider action concrète (rollback / scope cut / renfort / communication)
   ↓
5. Communiquer transparent (Slack, status page, équipe)
   ↓
6. Post-mortem si P0/P1 sous 48h
   ↓
7. Mettre à jour escalation.md avec lesson learned
```

## Cercles d'escalation par sévérité

| Sévérité | Cercle | Réponse cible |
|---|---|---|
| **P0 / incident prod** | dev_lead → PO → CEO si > 2h | < 15 min |
| **P1 / feature broken** | dev_lead → PO | < 1h |
| **P2 / dégradation UX** | dev_intermediate → dev_lead | < 4h |
| **P3 / cosmétique** | Owner ticket | Sprint courant |
| **Sprint dérapage** | PO + dev_lead | < 24h |
| **Budget alert** | dev_lead + PO | < 6h |
| **Burnout** | PO + dev concerné | Le jour même |

## Post-mortem template (P0/P1)

```markdown
# Post-mortem — [Titre incident]

## Métadonnées
- Date : YYYY-MM-DD
- Durée : HH:MM (début → fin)
- Sévérité : P0 / P1
- Owner post-mortem : [dev_lead]

## Timeline
- HH:MM — Symptôme détecté
- HH:MM — Premier diagnostic
- HH:MM — Mitigation déployée
- HH:MM — Résolu

## Root cause
[Description technique précise]

## Mitigation court-terme (déjà déployée)
- [...]

## Mitigation long-terme (ticket créé)
- CHAT-XYZ : ...

## Lessons learned
1. ...
2. ...

## Pas de blame
[Pas de noms de responsables, on parle de systèmes, pas de personnes.]
```

## Anti-patterns escalation

- ❌ Cacher un dérapage pour ne pas "stresser" le PO : ça stresse plus à mi-sprint.
- ❌ Escalader systématiquement à CEO : court-circuite PO et brûle la confiance.
- ❌ Escalation sans proposition de solution : "voici le problème" sans "voici ce que je propose".
- ❌ Post-mortem qui pointe une personne : c'est toujours un système qui a failli.
- ❌ Pas de post-mortem après P0 : on perd les leçons.
- ❌ Rollback brutal sans communication : confusion équipe + stakeholders.
