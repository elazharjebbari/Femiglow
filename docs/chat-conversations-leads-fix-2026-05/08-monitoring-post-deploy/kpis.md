# KPIs métier

> KPIs à observer pour mesurer le succès du fix.

## 1. KPIs primaires (santé fix)

### KPI 1 — Pollution rate

**Définition** : `wizard_pivot / total chat_session opened in last 7d`

**SQL** :
```sql
SELECT
  ROUND(100.0 *
    COUNT(*) FILTER (WHERE kind = 'wizard_pivot') /
    NULLIF(COUNT(*), 0),
    1
  ) AS pollution_pct
FROM chat_session
WHERE opened_at >= NOW() - INTERVAL '7 days';
```

**Cible** :
- Pre-fix observed : ~30-50%
- Post-fix expected (la pollution est filtrée, mais les rows existent toujours) : pollution rate ne change pas tant que ghosts ne sont pas archivés.
- Après cleanup : <15%

**Source** : `/admin/chat/audit` ou query SQL manuelle.

### KPI 2 — True chat conversation count

**Définition** : Sessions avec `kind='chat'` ET ≥1 message user (7d)

**SQL** :
```sql
SELECT COUNT(*) AS true_chat_count
FROM chat_session s
WHERE s.kind = 'chat'
  AND s.opened_at >= NOW() - INTERVAL '7 days'
  AND EXISTS (
    SELECT 1 FROM chat_message m
    WHERE m.session_id = s.id
      AND m.role = 'user'
      AND m.status = 'sent'
  );
```

**Cible** : stable ou croissant. Si chute > 50%, problème de funnel.

### KPI 3 — Chat leads count (sans pollution)

**Définition** : `chat_lead WHERE source IN ('chat_widget', 'inline')` (7d)

**SQL** :
```sql
SELECT COUNT(*) AS pure_chat_leads_7d
FROM chat_lead
WHERE source IN ('chat_widget', 'inline')
  AND created_at >= NOW() - INTERVAL '7 days';
```

**Cible** : stable ou croissant.

### KPI 4 — Coherence kind ↔ source

**Définition** : % de rows cohérentes entre `chat_session.kind` et `chat_lead.source`.

**SQL** :
```sql
WITH check_coherence AS (
  SELECT
    CASE
      WHEN s.kind = 'chat' AND l.source IN ('chat_widget', 'inline') THEN 'ok'
      WHEN s.kind = 'wizard_pivot' AND l.source IN ('wizard_kit', 'wizard_commander') THEN 'ok'
      WHEN s.kind = 'chat' AND l.source IN ('admin', 'newsletter') THEN 'ok'
      ELSE 'mismatch'
    END AS status
  FROM chat_session s
  JOIN chat_lead l ON l.session_id = s.id
)
SELECT
  ROUND(100.0 *
    COUNT(*) FILTER (WHERE status = 'ok') /
    NULLIF(COUNT(*), 0), 1
  ) AS coherence_pct
FROM check_coherence;
```

**Cible** : 100% (ou ≥99% acceptable post-backfill).

## 2. KPIs secondaires (santé business)

### KPI 5 — Conversion rate chat

**Définition** : (Sessions chat converties / Sessions chat avec messages) sur 30j

**SQL** :
```sql
WITH chat_sessions_30d AS (
  SELECT s.id, s.converted_at IS NOT NULL AS converted_via_order
  FROM chat_session s
  WHERE s.kind = 'chat'
    AND s.opened_at >= NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1 FROM chat_message m
      WHERE m.session_id = s.id AND m.role = 'user' AND m.status = 'sent'
    )
)
SELECT
  COUNT(*) AS total_chat_sessions,
  COUNT(*) FILTER (WHERE converted_via_order) AS converted,
  ROUND(100.0 *
    COUNT(*) FILTER (WHERE converted_via_order) / NULLIF(COUNT(*), 0), 2
  ) AS conversion_rate_pct
FROM chat_sessions_30d;
```

**Cible pre-fix** : ~3% (mesuré faussement à cause de la pollution)

**Cible post-fix** : ~5-10% (chiffre réel)

### KPI 6 — SLA Care (Hot pending overdue)

**Définition** : Chat leads pending dépassant le SLA Care (4h)

**SQL** :
```sql
SELECT COUNT(*) AS overdue_count
FROM chat_lead l
WHERE l.outcome = 'pending'
  AND l.trigger_reason IN ('purchase-intent', 'explicit-request', 'inline-contact')
  AND l.source IN ('chat_widget', 'inline')
  AND l.created_at < NOW() - INTERVAL '4 hours';
```

**Cible** : <5 en permanence.

### KPI 7 — Cleanup activity

**Définition** : Nombre de cleanups exécutés par mois.

**Source** : Logs Vercel `chat.admin.cleanup_ghosts`.

**Cible** : 0-2 / mois (manuel, rare).

## 3. KPIs techniques

### KPI 8 — Latency SSR pages admin chat

**Définition** : P95 du temps de réponse SSR pour `/admin/chat/*`

**Source** : Vercel Analytics

**Cible** : <500ms (avant fix : ~200-300ms, après fix : <500ms avec index correct).

### KPI 9 — DB query duration

**Définition** : Avg duration de `listConversations` et `listChatLeads`

**Source** : Drizzle logs (si enabled) ou pg_stat_statements

**Cible** :
- `listConversations` : <100ms p95
- `listChatLeads` : <50ms p95

### KPI 10 — Error rate `/admin/chat/*`

**Définition** : Errors / total requests sur `/admin/chat/*`

**Source** : Sentry + Vercel logs

**Cible** : 0% (zéro tolérance car admin = production critical).

## 4. Trend dashboard

Construire (manuellement ou auto) une vue trend sur 30 jours :

```
Pollution rate    : 35% → 12% (post-cleanup) → stable autour 12-15%
True chat count   : ~5/jour → ~5/jour (stable)
Pure leads count  : ~3/jour → ~3/jour (stable)
Conversion rate   : 3% → 8% (correction du dénominateur)
SLA overdue       : ~15 → ~3 (amélioration Care actionability)
```

## 5. Reporting

### Hebdo

- Lead checke `/admin/chat/audit` (1 min)
- Note pollution rate dans note Linear/Notion

### Mensuel

- Lead exporte les counts SQL §1-§4
- Compare au mois précédent
- Si dérive : audit + action

### Trimestriel

- Revue équipe : tendances + décisions (cleanup, evolutions schéma, etc.)

## 6. KPI fondatrice (user-facing)

Question posée à la fondatrice mensuellement :

> "Quand tu consultes `/admin/chat/leads`, est-ce que les leads que tu vois sont tous pertinents pour un rappel chat (oui/non) ?"

**Cible** : 90%+ oui.

Si non → audit pourquoi (problème de filtre ou de UX) + sprint correctif.

## 7. KPI Care team

Question posée à Care mensuellement :

> "Combien de leads `/admin/chat/leads` étaient déjà au tunnel checkout (donc inutile de rappeler en chat) ?"

**Cible** : 0% post-fix (vs ~30% estimé pré-fix).

## 8. Comparaison pré/post fix

Document à archiver dans `docs/.../snapshots/` :

| Métrique | Pre-fix (2026-05-26) | Post-fix J+30 | Δ |
|---|---|---|---|
| Total sessions visibles `/admin/chat/conversations` | 100 | ~30 | -70% |
| Total leads visibles `/admin/chat/leads` | 28 | ~5-10 | -64% |
| Total leads `/admin/leads` (global) | 31 | ~31 | inchangé ✅ |
| Conversion rate chat | 3% | 8% (réel) | corrigé |
| Overdue SLA Care | 17 | ~3 | -82% |
| Latency p95 `/admin/chat/conversations` | 200ms | 350ms | +75% (index ajouté) |
| Care manual sondage "leads pertinents %" | ~70% (estimé) | 95% (objectif) | +25 pts |

## 9. Décisions à prendre selon KPIs

| Si KPI dévie | Action |
|---|---|
| Pollution rate > 50% (post-cleanup) | Investigate bot abuse |
| True chat count chute > 50% | Investigate widget bug |
| Coherence < 95% | Audit cross-table + script fix |
| SLA overdue > 20 | Renforcer Care team ou notifications |
| Latency > 1s | Investigate index + slow query log |
| Error rate > 0 | Investigation immediate + possible rollback |

## 10. Long-term évolution

Après 30j d'observation, possible :
- Retirer le feature flag `CHAT_ADMIN_FILTERS_V2` (faire le default permanent)
- Ajouter cron automatique du cleanup (weekly)
- Réfléchir à une table `wizard_session` dédiée (ADR-001 Option B)
