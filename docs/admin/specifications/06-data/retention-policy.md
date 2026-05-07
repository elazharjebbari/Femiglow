# Politique de rétention

Aligne les durées de conservation avec :
- **RGPD** (UE) — minimisation des données.
- **Loi marocaine 09-08** — protection des personnes physiques à l'égard du traitement.
- Contraintes métier (relance, audit légal).

## Tableau récapitulatif

| Donnée | Type | Durée active | Durée totale | Justification |
|---|---|---|---|---|
| Lead actif (`deleted_at IS NULL`) | DCP | jusqu'à action user | indéfini | finalité commerciale active |
| Lead soft-deleted (`deleted_at NOT NULL`) | DCP | — | 18 mois post-suppression | démarches commerciales (relance) |
| Lead spam (`status='spam'`) | DCP | 30 jours | 30 jours | aucun intérêt légitime |
| Order + items | DCP | suit le lead | 36 mois (obligation comptable Maroc) | conservation comptable |
| Lead events | technique | suit le lead | 18 mois | timeline historique |
| Webhook deliveries | technique | 90 jours | 90 jours | debug + replay opérationnel |
| Webhook endpoints (actifs) | technique | indéfini | indéfini | configuration utile |
| Webhook endpoints (soft-deleted) | technique | 18 mois | 18 mois | conservation historique deliveries |
| Audit events | légal | 36 mois | 36 mois | obligation traçabilité |
| Admin users actifs | technique | indéfini | indéfini | comptes actifs |
| Admin users soft-deleted | technique | 36 mois | 36 mois | corrélation audit historique |
| Admin login attempts | technique | 24 heures | 24 heures | rate-limit windowing |
| Rate limit counters | technique | 24 heures | 24 heures | rate-limit windowing |

## Tâches de purge automatiques

Pas implémentées en v1 (volumes faibles, purge manuelle trimestrielle).
Évolution v1.1 :

```sql
-- Purge admin_login_attempts > 24h
DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '24 hours';

-- Purge rate_limit_counters > 24h
DELETE FROM rate_limit_counters WHERE created_at < NOW() - INTERVAL '24 hours';

-- Purge webhook_deliveries > 90 jours
DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '90 days';

-- Purge audit_events > 36 mois
DELETE FROM audit_events WHERE created_at < NOW() - INTERVAL '36 months';

-- Purge leads soft-deleted > 18 mois
DELETE FROM leads
WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '18 months';
```

Programmées via Vercel Cron supplémentaire :
```json
{ "path": "/api/cron/purge", "schedule": "0 3 * * *" }
```
(quotidien 03:00 Casablanca).

## Demandes RGPD / loi 09-08

### Droit d'accès

L'admin peut exporter en CSV un lead complet via la page de détail
(évolution v1.1 : bouton "Exporter mes données" pour la personne
concernée — non disponible v1, traité manuellement).

### Droit à l'effacement

V1 : traitement manuel sur demande email à dpo@femiglow.ma.
Procédure documentée dans `docs/admin/operations/rgpd-effacement.md` :

1. Vérifier identité (pièce d'identité + email correspondant au lead).
2. SQL :
   ```sql
   UPDATE leads
   SET full_name = '[ANONYMISÉ]',
       email = 'anonymized-' || id || '@femiglow.deleted',
       phone = NULL,
       metadata = '{}'::jsonb,
       deleted_at = NOW()
   WHERE id = $1;
   ```
3. Purger immédiatement webhook_deliveries liées (PII dans payload).
4. Conserver l'audit event (preuve du traitement).
5. Confirmer à la personne par email.

### Droit à la rectification

L'admin peut modifier les notes (`lead_events` type `note_added`)
mais **pas** les données identitaires d'un lead — par principe
d'intégrité de la donnée d'origine. Évolution v1.2 si besoin opérationnel.

## Backups

| Type | Période | Conservation |
|---|---|---|
| Neon PITR | continu | 7 jours (plan Pro) |
| Export mensuel `pg_dump` | mensuel (1er du mois) | 12 mois (S3 chiffré) |
| Export trimestriel audit_events | trimestriel | 7 ans (compliance) |

Les backups contiennent des DCP — donc :
- Stockés en S3 avec `SSE-KMS`.
- Accès limité à 2 personnes (CTO + DPO).
- Documenté dans le registre des traitements.

## Registre des traitements

Tenu dans `docs/admin/compliance/registre-traitements.md` (v1.1).
Liste pour chaque traitement : finalité, base légale, catégories de
données, destinataires, durée, transferts hors UE (Maroc/Vercel/Neon).

## Tests

Pas de test automatique de la purge en v1 (manuelle). Tests d'intégrité
en place :

- `audit_events` ne doit jamais être supprimé en dehors de la purge planifiée.
- `leads.deleted_at` doit être strictement >= `created_at`.
- Aucune ligne `webhook_deliveries.payload` ne doit contenir de mot de passe ou de signature claire.
