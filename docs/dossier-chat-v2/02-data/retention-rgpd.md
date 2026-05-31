# Rétention & RGPD

> Politique applicable au chat. Toutes les durées sont **maximales** : la purge automatique peut nettoyer plus tôt si la consent est révoquée ou si l'utilisateur exerce son droit à l'oubli.

## Bases légales

| Donnée | Base légale | Référence |
|---|---|---|
| Conversation anonyme (cookie `fg_v`) | Intérêt légitime du responsable | RGPD art. 6.1.f |
| Coordonnées lead (téléphone, email, nom) | Consentement explicite | RGPD art. 6.1.a |
| Suivi commande (`get_order_status`) | Exécution du contrat | RGPD art. 6.1.b |
| Logs erreurs Sentry | Intérêt légitime sécurité | RGPD art. 6.1.f |

Version consent active : `CHAT_LEAD_CONSENT_VERSION=2026-05-06` (env). À incrémenter à chaque changement matériel de la politique.

## Matrice de rétention

| Donnée | Table | Durée standard | Trigger purge |
|---|---|---|---|
| Sessions sans lead | `chat_session` | 30 jours | `last_seen_at + 30 j` |
| Messages anonymes | `chat_message` | 30 jours (suit la session) | cascade session |
| Événements KPI | `chat_conversation_event` | 90 jours (aggrégés au‑delà) | cron `gdpr-purge` |
| Leads (PII) consent valide | `chat_lead` | 24 mois | `created_at + 24 m` |
| Leads (PII) consent révoqué | `chat_lead` | 7 jours (délai opérationnel) | `consent_revoked_at + 7 j` |
| Logs tool calls | `chat_tool_call_log` | 90 jours | cron |
| Feedback (thumbs up/down) | `chat_feedback` | 24 mois | cron |
| KB ingestions | `chat_knowledge_*` | indéfini (contenu maison) | manuel |
| Embeddings | `chat_knowledge_embedding` | suit chunk | cascade |
| Audit admin | `audit_events` | 7 ans (obligation comptable) | jamais auto |

## Droits utilisateurs

### Droit d'accès (art. 15)
- Endpoint admin `POST /api/admin/chat/gdpr/export` (RBAC : ops uniquement).
- Input : `phone` OU `email`.
- Output : ZIP contenant `lead.json`, `sessions.json` (toutes les sessions liées via `visitor_token` ou direct), `messages.json` (anonymisés mais joints), `events.json`.
- SLA : 30 jours max, cible 7 jours.

### Droit à l'oubli (art. 17)
- Endpoint admin `POST /api/admin/chat/gdpr/forget` (RBAC).
- Action : suppression hard de `chat_lead` correspondant + UPDATE `chat_message.content = '[redacted]'` + UPDATE `chat_session.visitor_token = NULL`.
- Préservation : audit_events conservés (obligation comptable) mais avec PII redacted.
- SLA : 30 jours max, cible 5 jours.

### Droit de portabilité (art. 20)
- Identique au droit d'accès, format JSON exportable.

### Droit de rectification (art. 16)
- Admin lead détail : édition manuelle des champs.

## Sanitization automatique (PII redaction inline)

Avant persistance, **toute** entrée user passe par [`sanitize.ts`](../../../apps/web/src/lib/chat/services/sanitize.ts) qui détecte et masque :

| Pattern | Regex (simplifiée) | Replacement |
|---|---|---|
| Email | `[\w.-]+@[\w.-]+\.\w+` | `[email-redacted]` |
| Téléphone MA | `0[5-7]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}` | `[phone-redacted]` |
| Téléphone FR | `0[1-9]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}` | `[phone-redacted]` |
| IBAN | `[A-Z]{2}\d{2}[A-Z0-9]{1,30}` | `[iban-redacted]` |
| CB (Luhn check) | `\d{4}\s?\d{4}\s?\d{4}\s?\d{4}` + Luhn | `[card-redacted]` |
| CNI MA | `[A-Z]{1,2}\d{5,7}` | `[cni-redacted]` |

**Exception CHA‑225** : pour le téléphone, la valeur originale est extraite et passée au `lead-decision` engine **sans la persister dans `chat_message.content`**, juste en mémoire le temps de pré‑remplir le lead form. Sinon, redacted comme les autres.

## Cron `gdpr-purge`

```
Schedule : 0 4 * * *   (04:00 daily)
Endpoint : /api/cron/gdpr-purge
Secret    : CRON_SECRET

Steps :
  1. DELETE chat_session WHERE last_seen_at < now() - interval '30 days'
     AND id NOT IN (SELECT session_id FROM chat_lead WHERE consent_revoked_at IS NULL)
     (cascade messages, events)
  2. DELETE chat_lead WHERE
       (consent_revoked_at IS NOT NULL AND consent_revoked_at < now() - interval '7 days')
       OR (created_at < now() - interval '24 months')
  3. DELETE chat_conversation_event WHERE created_at < now() - interval '90 days'
  4. DELETE chat_tool_call_log WHERE created_at < now() - interval '90 days'
  5. UPDATE audit_events SET payload = jsonb_set(payload, '{pii}', '"[expired]"')
     WHERE created_at < now() - interval '24 months'
  6. LOG run summary into health_check table
```

Monitoring : alerte Sentry si la dernière exécution > 26 h ou si > 10 % d'erreurs dans le batch.

## Exports analytics

Aucun export analytics (Plausible, dashboards internes) ne contient de PII. Règles :
- `chat_message.content` → jamais exporté brut. Hash ou stats agrégées uniquement.
- `chat_lead.phone_e164` → hashé sha256 si nécessaire pour matching avec orders.
- `audit_events.payload` → filtré côté export.

## Co‑responsabilité providers LLM

Les providers LLM (OpenAI, Anthropic, Mistral) reçoivent le contenu des messages user pour générer la réponse. **Aucun lead n'est jamais envoyé à un provider** (ni nom, ni téléphone, ni email — déjà redacted par sanitize.ts).

DPA en cours de vérification :
- [ ] OpenAI Enterprise DPA signé
- [ ] Anthropic DPA signé
- [ ] Mistral DPA signé
- [ ] Neon DPA signé
- [ ] Sentry DPA signé

## Procédure incident données

En cas de breach présumé :
1. Activer service level 3 (`canned only`) → met l'app en sécurité.
2. Notifier DPO sous 1 h.
3. Notifier CNDP (Maroc) sous 72 h si confirmé.
4. Notifier utilisateurs concernés si risque élevé.

Procédure complète dans [`11-runbook/incidents.md`](../11-runbook/incidents.md).

## Checklist conformité (à valider par le DPO)

- [ ] Politique de confidentialité publique mise à jour (mention chat)
- [ ] Cookie banner conforme (consent visiteur `fg_v` accepté)
- [ ] Bandeau in‑widget mentionnant traitement IA + DPA providers
- [ ] Procédure droit d'accès opérationnelle (SLA testé)
- [ ] Cron `gdpr-purge` actif et monitoré
- [ ] DPA tous providers signés
- [ ] Registre des traitements à jour
- [ ] Tests de purge passés
