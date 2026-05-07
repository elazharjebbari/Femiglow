# Réponse à incident

Runbook opérationnel à activer dès qu'un incident sécurité est suspecté.
**Imprimer / archiver hors ligne** — il doit rester accessible si la
plateforme est compromise.

## Définitions

| Niveau | Critère | SLO de réponse |
|---|---|---|
| **P0** | confirmé : exfiltration DCP, accès admin compromis, indisponibilité totale | < 30 min |
| **P1** | suspicion forte : activité anormale, alertes Sentry, échec massif webhooks | < 2 h |
| **P2** | dégradation, faille découverte non exploitée | < 24 h |
| **P3** | demande RGPD complexe, audit légal | < 7 j |

## Rôles

| Rôle | Personne | Téléphone (interne) |
|---|---|---|
| Incident Commander | fondatrice | (à compléter) |
| Tech Lead | dev senior | (à compléter) |
| DPO | fondatrice (v1) | dpo@femiglow.ma |
| Communication | fondatrice | (idem) |

## Procédure générale

```
[1. Détection]
        │
        ▼
[2. Triage : P0/P1/P2/P3 ?]
        │
        ▼
[3. Confinement]
        │
        ▼
[4. Investigation + preuve]
        │
        ▼
[5. Remédiation]
        │
        ▼
[6. Notification CNDP/CNIL/personnes (si DCP)]
        │
        ▼
[7. Post-mortem + amélioration]
```

## 1. Détection — sources

| Source | Trigger |
|---|---|
| Sentry | erreur 500 inhabituelle, pic |
| Logs Vercel | `event=admin.login.failed` > 50/h |
| Vercel Analytics | pic de 5xx inhabituel |
| Signal externe | email à dpo@femiglow.ma, contact CNDP |
| Audit trimestriel | revue de `audit_events` |

## 2. Triage

Critères P0 :
- Authentification admin compromise (mot de passe, cookie)
- Snapshot DB téléversé hors infra
- Modification non autorisée de `webhook_endpoints` ou `admin_users`
- Indisponibilité > 30 min

→ Activer cellule de crise immédiatement.

## 3. Confinement

### Auth admin compromise

```bash
# Forcer rotation cookie de session (invalide toutes sessions)
vercel env rm ADMIN_SESSION_PASSWORD production
vercel env add ADMIN_SESSION_PASSWORD production
vercel deploy --prod --force

# Réinitialiser le mot de passe admin
psql $DATABASE_URL <<SQL
UPDATE admin_users
SET password_hash = '$argon2id$v=19$...'  -- nouveau hash, généré localement
WHERE id = $1;
SQL
```

### Compromission webhook secret

```bash
# Régénérer tous les secrets endpoints
pnpm tsx scripts/rotate-secrets.ts --all

# (Optionnel) Désactiver tous les endpoints suspects
psql $DATABASE_URL <<SQL
UPDATE webhook_endpoints SET active = false WHERE deleted_at IS NULL;
SQL
```

### Compromission DB

```bash
# Bloquer accès direct DB :
# 1. Tourner password Neon dans dashboard
# 2. Mettre à jour DATABASE_URL Vercel
# 3. Redéployer
vercel deploy --prod --force
```

### Activité suspecte rate-limit

```bash
# Voir les IPs en tête d'attaque
psql $DATABASE_URL <<SQL
SELECT ip, count(*) AS hits
FROM admin_login_attempts
WHERE created_at > NOW() - INTERVAL '1 hour' AND success = false
GROUP BY ip
ORDER BY hits DESC LIMIT 20;
SQL
```

Si l'IP est manifestement malveillante, ajouter une règle WAF Vercel
(via dashboard) : block country / IP.

## 4. Investigation

Sources :

```bash
# Logs Vercel récents
vercel logs --follow --output raw

# Audit events des 24 dernières heures
psql $DATABASE_URL -c "
SELECT created_at, actor_id, action, target_type, target_id, ip, meta
FROM audit_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC LIMIT 200;
"

# Sentry events
# (via dashboard sentry.io, filtre par release)
```

### Préserver les preuves

1. Snapshot DB immédiat : `pg_dump $DATABASE_URL > incident-$(date +%Y%m%d-%H%M).sql.gz`.
2. Export logs Vercel → fichier local horodaté.
3. Capture screenshots dashboards.
4. Hash chaque artefact (`sha256sum *`) → archiver dans dossier incident.
5. Nommage : `incidents/INC-YYYYMMDD-NN/`.

## 5. Remédiation

| Catégorie | Action |
|---|---|
| Vulnérabilité applicative | déployer patch en hotfix, ajouter test régressif |
| Configuration | corriger env Vercel + redéployer |
| Compromission credentials | rotation totale (cf. `secrets-rotation.md`) |
| Exfiltration DCP | identifier données concernées, préparer notification |

## 6. Notification

### Notification CNDP (Maroc)

**Délai 72 h** dès détection si risque pour les personnes.

Modèle de notification (à transmettre en français) :

```
À : CNDP (https://www.cndp.ma)
De : Élazhar Jebbari, FemiGlow, dpo@femiglow.ma
Objet : Notification de violation de données personnelles

Date de découverte : ____
Description : ____
Catégories de données concernées : ____
Nombre approximatif de personnes : ____
Mesures prises : ____
Mesures envisagées : ____
Évaluation du risque : ____

Signé : ____
```

### Notification CNIL (UE) si applicable

Si parmi les personnes concernées figurent des résidents UE → CNIL via
formulaire en ligne (https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles).

### Notification aux personnes

Si risque élevé pour leurs droits et libertés :
- email individuel,
- en français,
- description des faits, données concernées, conséquences possibles,
  mesures prises,
- contact DPO.

Ne pas envoyer en masse — préférer email individuel pour respecter
chaque destinataire.

## 7. Post-mortem

Sous 7 jours après résolution, rédiger document :

```markdown
# Post-mortem INC-YYYYMMDD-NN

## Contexte
…

## Timeline
- HH:MM — détection
- HH:MM — confinement
- HH:MM — résolution
- HH:MM — notification

## Cause racine
…

## Impact
- Personnes concernées : N
- Données exposées : …
- Durée d'indisponibilité : …

## Ce qui a bien marché
…

## Ce qui aurait pu mieux aller
…

## Actions préventives
- [ ] action 1 (responsable, échéance)
- [ ] action 2 …
```

Ajouter au registre `docs/admin/incidents/`.

## Procédures spécifiques

### Rotation du mot de passe admin

1. Générer mot de passe fort : `openssl rand -base64 24`.
2. Hasher localement :
   ```bash
   pnpm tsx scripts/hash-password.ts "$NEW_PWD"
   ```
3. Mettre à jour la DB :
   ```sql
   UPDATE admin_users SET password_hash = '$argon2id$...' WHERE email = $1;
   ```
4. Communiquer le mot de passe via canal hors-bande (signal, voix).
5. Informer les autres admins (s'il y en a) que leur compte est inchangé.
6. Auditer : `INSERT INTO audit_events (action, meta) VALUES ('admin.password.rotated', ...)`.

### Purge de session forcée

Mettre à jour `ADMIN_SESSION_PASSWORD` dans Vercel et redéployer.
**Toutes** les sessions actives sont invalidées (déconnexion immédiate).

### Rate-limit accidentel sur soi-même

```sql
DELETE FROM admin_login_attempts
WHERE ip = $1 OR email = $2;
```

À utiliser avec parcimonie, journaliser dans `audit_events`.

## Tests

Le runbook est testé annuellement par un exercice tabletop (sans vraie
attaque). Compte rendu archivé dans `docs/admin/incidents/exercises/`.
