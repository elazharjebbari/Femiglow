# Rollout strategy

## 1. Approche : Progressive rollout via feature flag

Plutôt que de basculer 100% des admins en une fois, le nouveau système est activé **progressivement** sur 3 jours, contrôlé par un feature flag.

```
J+0    →  Younes only       (1 admin)
J+1    →  + Amal             (2 admins)
J+2    →  + tous les autres  (100%)
```

Cette approche permet de détecter une régression critique **avant** qu'elle n'impacte tout le monde.

## 2. Feature flag

### Configuration

```typescript
// Variable d'environnement
TRACKING_PLAN_V2_ENABLED=false  // défaut
TRACKING_PLAN_V2_ENABLED_USERS=  // CSV : liste user emails autorisés si !global

// Utilisé dans middleware
if (
  process.env.TRACKING_PLAN_V2_ENABLED === 'true' ||
  process.env.TRACKING_PLAN_V2_ENABLED_USERS?.split(',').includes(currentUser.email)
) {
  // route vers nouveau système
} else {
  // route vers ancien système
}
```

### Granularité

| Mode | Description |
|---|---|
| **Off global** | Tout le monde sur ancien système (default initial) |
| **Allow-list** | Seuls les users dans `_USERS` ont accès nouveau (rollout progressif) |
| **On global** | Tout le monde sur nouveau (release complète) |

### Switch operations

| De | Vers | Commande | Effet |
|---|---|---|---|
| Off | Allow-list younes | `TRACKING_PLAN_V2_ENABLED_USERS=younes@...` | Younes voit nouveau, autres non |
| Allow-list | + Amal | `TRACKING_PLAN_V2_ENABLED_USERS=younes@,amal@` | Younes + Amal voient nouveau |
| Allow-list | On global | `TRACKING_PLAN_V2_ENABLED=true` | Tous voient nouveau |
| On global | Off (rollback) | `TRACKING_PLAN_V2_ENABLED=false` | Retour ancien, instant |

Le switch nécessite **redémarrage** du serveur Next.js (ou ENV reload selon infra). Cible : < 30 secondes pour appliquer le changement.

## 3. Calendrier détaillé

### Jour J+0 (après migration prod)

| Heure | Action | Responsable |
|---|---|---|
| 09h00 | Confirmer migration OK (vérifier tables) | Younes + Lead |
| 09h15 | Set flag `TRACKING_PLAN_V2_ENABLED_USERS=younes@...` | Younes |
| 09h20 | Redémarrer serveur prod | Younes |
| 09h25 | Younes teste : login admin, vérifie qu'il voit le nouveau | Younes |
| 09h30 | Smoke tests : créer un plan test, valider, ne pas activer | Younes |
| 11h00 | Vérifier metrics Grafana | Younes |
| Reste journée | Younes utilise normalement | Younes |
| 17h00 | Bilan J+0 : metrics OK ? bugs ? feedback ? | Lead |

### Jour J+1 (rollout Amal)

| Heure | Action | Responsable |
|---|---|---|
| 09h30 | Décision GO/NO-GO pour ajouter Amal (basé sur J+0) | Lead |
| 10h00 | Onboarding session Amal (30 min, Meet) | Younes + Amal |
| 10h35 | Set flag `_USERS=younes@,amal@` | Younes |
| 10h40 | Redémarrer serveur prod | Younes |
| 10h45 | Amal teste son premier flow | Amal |
| Reste journée | Amal opère, Younes monitor en temps réel | Younes (support actif) |
| 17h00 | Bilan J+1 : Amal feedback ? metrics ? | Lead |

### Jour J+2 (rollout full)

| Heure | Action | Responsable |
|---|---|---|
| 09h30 | Décision GO/NO-GO pour rollout 100% | Lead |
| 10h00 | Email d'annonce envoyé à tous | Lead |
| 10h15 | Slack message canal général | Lead |
| 10h30 | Set flag global `TRACKING_PLAN_V2_ENABLED=true`, clear `_USERS` | Younes |
| 10h35 | Redémarrer serveur prod | Younes |
| 10h40 | Vérifier admin de test : tout le monde sur nouveau | Younes |
| Reste journée | Monitoring actif | Younes |

### Jours J+3 à J+7 (surveillance)

Quotidien :
- 09h00 : Review Grafana dashboard.
- 09h15 : Triage bugs reportés (Slack `#tech-tracking-plan`).
- 17h00 : Bilan journalier en Slack.

Hebdomadaire :
- Vendredi 16h : démo + rétro avec Lead + Amal.

## 4. Critères de progression

### J+0 → J+1 (ajout Amal)

GO si TOUS :
- [ ] Younes a complété ≥ 1 flow complet (create + validate + activate).
- [ ] 0 erreur 500 dans les logs Sentry.
- [ ] Latence p95 endpoints < cibles (< 500ms validate, < 2s activate).
- [ ] Drift status : pas de critical alert.
- [ ] Younes confirme "OK pour Amal" subjectivement.

NO-GO si :
- 1 erreur 500 non triviale.
- Latence p95 > 2× cible.
- Bug bloquant non corrigé.

### J+1 → J+2 (rollout full)

GO si TOUS :
- [ ] Amal a complété son onboarding sans aide majeure (< 3 questions).
- [ ] Amal feedback ≥ 4/5 sur "facilité d'usage".
- [ ] 0 erreur 500.
- [ ] Métriques stables vs J+0.
- [ ] 0 bug P0 ouvert.

NO-GO si :
- Amal frustrée ou perdue.
- Bug bloquant.
- Régression observée vs ancien système.

## 5. Critères de rollback

Si pendant ou après le rollout :
- ❌ Drift critique non résolu en < 1h.
- ❌ Erreurs 500 en cascade (> 10/min).
- ❌ Perte de tracking observable (events GA4 absents en prod).
- ❌ Sécurité compromise (secret leaké).

→ **Rollback immédiat** : `TRACKING_PLAN_V2_ENABLED=false`, redémarrer, ancien admin revient.

Plus de détails dans `13-runbook/rollback-runbook.md`.

## 6. Communication par phase de rollout

| Phase | Comm | Audience |
|---|---|---|
| J+0 | Slack interne dev | Tech |
| J+1 morning | Slack DM "Tu as accès au nouveau tracking, on en parle ce matin" | Amal |
| J+1 evening | Slack `#tech-tracking-plan` : "Day 2 going well" | Tech |
| J+2 morning | Email all admins + slack annonce | All |
| J+7 | Email recap "1 semaine, voici les résultats" | All |
| J+30 | Email "Migration achievement, rappel cleanup à venir" | Tech |

## 7. Monitoring intensif (J+0 à J+7)

Métriques surveillées en temps réel :

```
┌─────────────────────────────────────────────┐
│ Tracking Plan v2 — Live monitoring (J+0)   │
├─────────────────────────────────────────────┤
│                                             │
│ Active users on V2 : 1 / 1 (younes)         │
│ Active users on V1 : 0 (none expected)      │
│                                             │
│ Endpoints :                                 │
│   /plans                   200 OK    45ms   │
│   /plans/:id               200 OK    38ms   │
│   /plans/validate          200 OK   142ms   │
│   /plans/export            200 OK    98ms   │
│                                             │
│ Drift status : OK ✓                         │
│ Last drift event : never                    │
│                                             │
│ Errors (last 5 min) : 0                     │
│                                             │
│ GA4 events received (last 1h) : 89          │
│ Baseline (yesterday same hour) : 87         │
│ Δ : +2% (stable) ✓                          │
│                                             │
└─────────────────────────────────────────────┘
```

Tableau de bord Grafana à créer (ticket TP2-049).

## 8. Plan B : Si rollback total

Si on doit revenir totalement à l'ancien système :

1. `TRACKING_PLAN_V2_ENABLED=false` (toutes routes legacy ré-actives).
2. Comm : "On suspend temporairement le nouveau tracking, on investigue."
3. Investigation root cause.
4. Fix.
5. Re-tentative rollout depuis J+0.

L'investissement build n'est pas perdu : la prochaine tentative repart avec corrections.

## 9. Anti-patterns à éviter

- **Rollout du vendredi soir** : pas d'équipe disponible le weekend si problème.
  → Toujours faire les rollouts en milieu de semaine (mardi-jeudi).
- **Communication tardive** : "On a migré ce matin" sans préavis.
  → Toujours T-3 jours minimum.
- **Pas de monitoring actif** : flip flag puis partir en réunion.
  → Quelqu'un dédié au monitoring pendant rollout window.
- **Ignorer feedback Amal "ça va à peu près"** : tiède → rouge ensuite.
  → Investiguer "à peu près" jusqu'à comprendre.

## 10. Success criteria à 30 jours

Si à T+30j :
- Adoption mode wizard > 80%.
- 0 régression metrics.
- Feedback Amal ≥ 4/5.
- 0 demande de "remettre l'ancien".

→ Rollout réussi. Continuer vers Phase 5 cleanup.
