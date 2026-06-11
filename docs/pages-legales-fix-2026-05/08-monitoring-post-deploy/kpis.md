# KPIs métier

## 1. KPIs primaires (santé du fix)

| KPI | Cible | Mesure | Alerte si |
|---|---|---|---|
| Pages bloquées publish | 0 | SQL drafts avec drift | > 0 |
| Drift count (vars utilisées sans DB) | 0 | SQL §3 audit | > 0 |
| Pages exposant ICE/RC en clair | 0 | SQL §3 sensitive | > 0 |
| E2E orphans | < 5 | SQL count slug LIKE 'e2e-test-%' | > 10 |
| Erreur SSR `/legal/*` | 0 | Sentry | > 0 |
| Marketing pages prénom détecté | 0 | CI test invariant | > 0 |

## 2. KPIs secondaires (santé business)

| KPI | Cible | Mesure |
|---|---|---|
| Pages publiées totales | 9 pages métier | SQL count status='published' |
| Délai moyen draft → publish | < 1 jour | Diff publishedAt - createdAt |
| Volume créations vars / mois | 0-3 | Plausible event count |
| Email `legal@` SLA (5j ouvrés) | 100% | Spreadsheet tracking |
| Conversion `/legal/` → autre | Stable | Plausible funnel |

## 3. KPIs techniques

| KPI | Cible | Mesure |
|---|---|---|
| Latency SSR `/legal/*` | < 500ms p95 | Vercel Analytics |
| Latency SSR `/admin/legal/*` | < 500ms p95 | Vercel Analytics |
| DB query duration listAllTemplateVars | < 50ms p95 | pg_stat_statements |
| Error rate `/legal/*` | 0% | Sentry / Vercel |

## 4. Trend dashboard (30 jours)

```
Drift count       : 7 (pré-fix) → 0 (post-fix) → stable 0
E2E orphans       : 5 (pré-fix) → 0 (post-fix) → < 3 (cron)
Pages bloquées    : 3 (pré-fix) → 0 (post-fix) → stable 0
Sensitive leaks   : 0 (pré-fix UI, mais vars présentes en template) → 0 (anonymisé)
Email legal@ avg  : n/a (pre) → < 24h response → stable
Conversion rate   : Stable (anonymisation transparente)
```

## 5. Comparaison pré/post

| Métrique | Pré-fix | Post-fix J+30 | Δ |
|---|---|---|---|
| Total pages | 14 (incl. 5 E2E) | 9 (métier seuls) | -36% |
| Drafts bloqués | 3 (CGU, retours, sécurité) | 0 | -100% |
| Vars utilisées sans DB | 7 (CONTACT_*, HOST_*, etc.) | 0 | -100% |
| ICE/RC en clair sur pages publiques | YES (latent — vars rempliable) | NO (templates anonymisés) | sécurisé |
| Prénom fondatrice dans marketing | 9 occurrences | 0 | -100% |
| `/admin/legal/template-vars` create var | NON | OUI (UI + endpoint) | nouveau |

## 6. Reporting

### Hebdo

- Lead checke `/admin/legal/audit` (si créé) — 1 min
- Note drift count + e2e orphans
- Vérifier inbox `legal@` : 0 demandes > 4j

### Mensuel

- Audit SQL §3
- Compare au mois précédent
- Si dérive → ticket + action
- Revoir % SLA email legal@ (cible 100%)

### Trimestriel

- Revue équipe : tendances + décisions
- Audit cohérence cross-table
- Cleanup vars inutilisées si applicable

## 7. KPI fondatrice (user-facing)

Questions à poser à la fondatrice mensuellement :

1. *"Quand tu veux publier une page légale, est-ce que ça fonctionne du premier coup ?"*
   - **Cible** : 100% Oui (vs ~0% pré-fix)

2. *"Si tu dois ajouter une nouvelle information (ex. nouveau délai légal), peux-tu le faire toi-même depuis l'admin ?"*
   - **Cible** : 100% Oui

3. *"Es-tu rassurée que les infos sensibles (ICE, adresse) ne sont plus exposées publiquement ?"*
   - **Cible** : 100% Oui

## 8. KPI juriste / Care

Questions à poser au juriste mensuel (après J+30) :

1. *"Les emails reçus à `legal@femiglow-maroc.com` sont-ils légitimes (clients, autorités) ou spam ?"*
   - Cible : > 80% légitimes
2. *"Le délai 5j ouvrés est-il tenu ?"*
   - Cible : 100% Oui

## 9. Décisions selon KPIs

| Si KPI dévie | Action |
|---|---|
| Drift > 0 | Investiguer qui a ajouté la var sans définition |
| E2E orphans > 10 | Cron cleanup défaillant — fix |
| Latency > 1s | Index ou query lente — investiguer |
| Erreur > 0 | Investigation immédiate + possible rollback |
| Pages bloquées > 0 | Drift réapparu OU nouveau template avec var manquante |
| Spam legal@ > 50% | Configurer filtre anti-spam plus strict |
| Fondatrice insatisfaite | Sprint correctif UX |

## 10. Long-term évolution

Après 30j d'observation stable :
- Retirer le feature flag `LEGAL_VARS_V2` (faire le default permanent)
- Ajouter UI : edit/delete vars (vs juste create)
- Sondage utilisateur (clients) : "Les mentions légales sont-elles claires ?"
- Si volume `legal@` important → automatiser réponses standard
