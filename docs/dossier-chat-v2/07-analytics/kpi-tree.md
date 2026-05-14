# KPI Tree — Arbre N1 à N4 avec définitions complètes

> Toute métrique trace vers le **North Star**. Pyramide en 4 niveaux. Chaque KPI : définition, formule, source SQL, owner, cadence.

## North Star

### NS — Chat-to-purchase conversion rate

> Pourcentage de sessions chat qui aboutissent à une commande dans les 7 jours.

- **Formule** : `count(distinct session_id avec ≥1 lead) ∩ count(distinct phone dans orders dans 7j) / count(distinct session_id avec ≥1 message user)`
- **SQL** :
```sql
WITH chat_sessions AS (
  SELECT DISTINCT cs.id, cs.created_at
  FROM chat_session cs
  JOIN chat_message cm ON cm.session_id = cs.id AND cm.role = 'user'
  WHERE cs.created_at >= now() - interval '30 days'
),
converted AS (
  SELECT DISTINCT cs.id
  FROM chat_sessions cs
  JOIN chat_lead cl ON cl.session_id = cs.id
  JOIN orders o ON o.phone_hash = cl.phone_hash
    AND o.created_at BETWEEN cs.created_at AND cs.created_at + interval '7 days'
)
SELECT
  count(*)::float / (SELECT count(*) FROM chat_sessions) AS conversion_rate
FROM converted
```
- **Cible 90j** : 0.3% (vs baseline 0.029% sans chat moderne).
- **Owner** : Selma (PO).
- **Cadence** : revue hebdomadaire.

## Niveau N1 — Composantes directes du NS

### N1.1 — Chat engagement rate
- **Définition** : % visiteurs uniques qui ouvrent le chat.
- **Formule** : `unique sessions chat / unique visitors site (Vercel Analytics)`.
- **Cible** : 8% (baseline 4-5% observée Q1 2026).
- **Owner** : Selma.

### N1.2 — Message rate per chat
- **Définition** : Nombre moyen de messages user par session.
- **Formule** : `avg(messages_user_count per session)` sur sessions avec ≥1 message.
- **Cible** : 3.5 messages user.
- **Owner** : Yasmine.

### N1.3 — Lead capture rate
- **Définition** : % sessions avec ≥1 message user qui soumettent un lead.
- **Formule** : `count(sessions avec lead) / count(sessions avec ≥1 message user)`.
- **Cible** : 12%.
- **Owner** : Yasmine + Selma.

### N1.4 — Lead-to-order rate
- **Définition** : % leads qui aboutissent à une commande dans 7j.
- **Formule** : `count(leads convertis) / count(leads total)`.
- **Cible** : 30% (joint Care + product attractivité).
- **Owner** : Karim (Care).

## Niveau N2 — Drivers N1

### N2.1 — Time-to-first-message
- **Définition** : temps entre `chat_opened` et 1er `message_sent`.
- **Source** : event diff.
- **Cible** : < 30 s p50.
- **Owner** : design/UX.

### N2.2 — Suggestion CTR
- **Définition** : % chats où ≥1 pill est cliquée.
- **Formule** : `count(sessions avec suggestion_clicked) / count(sessions avec suggestions_shown)`.
- **Cible** : 35%.
- **Owner** : Yasmine.

### N2.3 — Canned reply satisfaction
- **Définition** : % canned replies notées 👍 par l'utilisateur.
- **Formule** : `sum(feedback +1 sur canned) / sum(feedback ±1 sur canned)`.
- **Cible** : 80% positifs.
- **Owner** : Yasmine.

### N2.4 — LLM reply satisfaction
- **Définition** : idem mais sur replies LLM.
- **Cible** : 75% positifs.
- **Owner** : Yasmine + Karim.

### N2.5 — First token latency p50
- **Définition** : `chat_message.first_token_ms` (assistant, non-canned).
- **Cible** : < 800 ms p50.
- **Owner** : dev.

### N2.6 — Steady-state delta cadence
- **Définition** : interval moyen entre deltas SSE.
- **Cible** : < 80 ms p50.
- **Owner** : dev.

### N2.7 — Resolution rate
- **Définition** : % conversations marquées `resolved=true` (par tour ou marqueur manuel).
- **Cible** : 70%.
- **Owner** : Karim.

### N2.8 — LeadForm completion rate
- **Définition** : % leadforms ouverts qui sont soumis.
- **Formule** : `count(lead_submitted) / count(lead_form_offered)`.
- **Cible** : 45%.
- **Owner** : design/UX.

## Niveau N3 — Composantes opérationnelles

### N3.1 — Intent detection accuracy
- **Définition** : % intents détectés correctement (manual sample).
- **Méthodologie** : 50 conversations/sem audit manuel.
- **Cible** : 85%.
- **Owner** : Yasmine.

### N3.2 — Tool success rate (par tool)
- **Définition** : `count(status=ok) / count(total)` par tool.
- **Source** : `chat_tool_call_log`.
- **Cible** : 99% par tool.
- **Owner** : dev.

### N3.3 — RAG hit rate
- **Définition** : % requêtes qui retrouvent ≥1 chunk avec sim > 0.7.
- **Cible** : 92%.
- **Owner** : dev.

### N3.4 — FAQ gateway match rate
- **Définition** : % messages user qui matchent FAQ (sim ≥ 0.85).
- **Cible** : 28%.
- **Owner** : Yasmine.

### N3.5 — Provider error rate
- **Définition** : 5xx + timeout + abort par provider.
- **Source** : Sentry + breaker logs.
- **Cible** : < 1% par provider.
- **Owner** : dev.

### N3.6 — Cost per assistant message
- **Définition** : moyenne `chat_message.cost` (assistant).
- **Cible** : < 0.002 USD.
- **Owner** : dev + Selma.

### N3.7 — Service level distribution
- **Définition** : % temps passé sur chaque sl (0, 1, 2, 3, 4) sur 30j.
- **Cible** : sl=0 ≥ 95%, sl=2+ ≤ 1%.
- **Owner** : dev.

## Niveau N4 — Hygiène & qualité technique

### N4.1 — Bundle size initial chat
- **Définition** : kB JS chargé avant 1er click launcher.
- **Cible** : < 8 kB.
- **Owner** : dev.

### N4.2 — Time to interactive panel
- **Définition** : click launcher → composer focusable.
- **Cible** : < 400 ms p50.
- **Owner** : dev.

### N4.3 — Memory leak chat ouvert 30 min
- **Définition** : drift heap.
- **Cible** : 0 MB.
- **Owner** : dev.

### N4.4 — KB freshness
- **Définition** : heures depuis dernière sync KB d'une source.
- **Cible** : < 26h.
- **Owner** : dev.

### N4.5 — Test coverage chat modules
- **Définition** : ligne coverage des `lib/chat/**`.
- **Cible** : ≥ 80%.
- **Owner** : dev.

### N4.6 — A11y audit pass rate
- **Définition** : % stories Storybook qui passent axe-core sans violation.
- **Cible** : 100%.
- **Owner** : dev + design.

### N4.7 — Webhook lead success rate
- **Définition** : % webhooks lead n8n livrés (retries inclus).
- **Cible** : 99.5%.
- **Owner** : dev.

### N4.8 — Daily budget burn
- **Définition** : USD/jour LLM.
- **Cible** : < 12 USD/jour avg.
- **Owner** : dev + Selma.

## Red flags — Seuils kill-switch

| Métrique | Seuil rouge | Action automatique |
|---|---|---|
| NS conversion rate | < 50% baseline 7j | Alerte PO, rollback feature |
| First token latency p95 | > 3 s sur 15 min | Switch provider primary |
| Provider error rate | > 5% sur 5 min | Open breaker, failover |
| Cost per message | > 2× cible sur 24h | Disable LLM mini classifier (fallback regex) |
| Service level | sl ≥ 3 sur 30 min | Page on-call |
| Webhook lead success | < 95% sur 1h | Alerte Care, processus manuel backup |

## Rituels de revue

| Cadence | Rituel | Participants |
|---|---|---|
| Quotidien | Health dashboard scan | Care/dev oncall |
| Hebdo | Métriques NS + N1 | PO + Yasmine + Karim + dev lead |
| Bi-hebdo | A/B test status | PO + dev |
| Mensuel | Deep-dive intent + canned satisfaction | Yasmine + PO |
| Trimestriel | Friction Score parcours + UX audit | Design + PO |
