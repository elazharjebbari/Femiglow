# Secrets rotation — Procédures

> Rotation régulière (quarterly) + rotation d'urgence si compromission. Toute clé exposée = rotation immédiate, sans débat. Mieux 30 min de blip qu'1 mois de fuite.

## Inventaire secrets

| Secret | Owner | Rotation routine | Stockage |
|---|---|---|---|
| `OPENAI_API_KEY` | dev_lead | Quarterly | Vercel env |
| `ANTHROPIC_API_KEY` | dev_lead | Quarterly | Vercel env |
| `MISTRAL_API_KEY` | dev_lead | Quarterly | Vercel env |
| `GEMINI_API_KEY` | dev_lead | Quarterly | Vercel env |
| `N8N_HMAC_SECRET` | dev_lead | Semi-annual | Vercel env + n8n |
| `ADMIN_SESSION_SECRET` | dev_lead | Annual | Vercel env (iron-session) |
| `SENTRY_DSN` | dev_lead | Si compromis | Vercel env |
| `DATABASE_URL` | dev_lead | Si compromis | Vercel env |
| Sendit API key (V7) | dev_lead | Quarterly | Vercel env |

## Procédure générale rotation

```
1. Générer nouvelle clé chez provider
2. Ajouter dans Vercel env comme secret EN PLUS de l'ancienne (clé temporaire shadow)
3. Déployer avec dual-key support si code le permet
4. Tester avec nouvelle clé
5. Supprimer l'ancienne clé chez provider
6. Supprimer la shadow env var
7. Log dans audit_logs
```

## Procédure rotation `OPENAI_API_KEY`

### 1. Générer nouvelle clé

```
Aller sur https://platform.openai.com/api-keys
"Create new secret key" → nommer "femiglow-chat-prod-YYYYMMDD"
Permissions : limiter à "All" si nécessaire, sinon "Restricted" + scopes
Copier la clé (ne sera plus visible)
```

### 2. Ajouter en parallèle

```bash
# Vercel CLI
echo "sk-new-key-..." | vercel env add OPENAI_API_KEY_NEW production
echo "sk-new-key-..." | vercel env add OPENAI_API_KEY_NEW preview
```

### 3. Déployer (le code essaie NEW d'abord, fallback OLD)

```typescript
// lib/chat/providers/openai.ts
const apiKey = process.env.OPENAI_API_KEY_NEW || process.env.OPENAI_API_KEY;
```

```bash
vercel --prod
```

### 4. Tester avec nouvelle clé

```bash
curl -X POST https://femiglow.com/api/chat/session \
  -H 'Content-Type: application/json' \
  -d '{"audience":"b2c","language":"fr"}'
# Doit créer session OK

# Trigger un message LLM
curl -N -X POST https://femiglow.com/api/chat/message ...
# Doit streamer
```

### 5. Promouvoir NEW vers OLD (swap)

```bash
# Récupérer la valeur de NEW
NEW_VALUE=$(vercel env pull --environment=production --output=- | grep OPENAI_API_KEY_NEW | cut -d= -f2)

# Remplacer OLD par NEW
vercel env rm OPENAI_API_KEY production
echo "$NEW_VALUE" | vercel env add OPENAI_API_KEY production

# Supprimer NEW
vercel env rm OPENAI_API_KEY_NEW production
```

### 6. Révoquer l'ancienne clé chez OpenAI

```
Sur https://platform.openai.com/api-keys
Trouver "femiglow-chat-prod-YYYYMMDD-1" (avant)
"Revoke"
```

### 7. Redéployer pour clean

```bash
vercel --prod
```

### 8. Log audit

```sql
INSERT INTO audit_logs(action, target, performed_at, performed_by, metadata)
VALUES ('secret_rotation', 'OPENAI_API_KEY', NOW(), 'dev_lead',
        '{"reason":"quarterly", "previous_key_suffix":"...abcd"}'::jsonb);
```

## Procédure rotation `N8N_HMAC_SECRET`

### Spécificité

Cette rotation est délicate car le secret est partagé entre Vercel (signe) et n8n (vérifie). Il faut faire la rotation coordonnée.

### 1. Générer nouveau secret

```bash
# 32 bytes random hex
NEW_HMAC=$(openssl rand -hex 32)
echo "$NEW_HMAC" | tee /tmp/n8n_hmac_new
```

### 2. Code dual-secret côté Vercel

```typescript
// lib/chat/services/webhooks/sign.ts
export function signWebhook(body: string): string[] {
  const signatures = [];
  if (process.env.N8N_HMAC_SECRET) {
    signatures.push(hmac(body, process.env.N8N_HMAC_SECRET));
  }
  if (process.env.N8N_HMAC_SECRET_NEW) {
    signatures.push(hmac(body, process.env.N8N_HMAC_SECRET_NEW));
  }
  return signatures;
}
```

```typescript
// Headers : envoyer LES DEUX signatures
'X-Signature-V1': sig1,
'X-Signature-V2': sig2,
```

### 3. Code dual-secret côté n8n

```javascript
// n8n Function node
const sigV1 = $request.headers['x-signature-v1'];
const sigV2 = $request.headers['x-signature-v2'];

const validV1 = sigV1 && hmac(body, $env.N8N_HMAC_SECRET_OLD) === sigV1;
const validV2 = sigV2 && hmac(body, $env.N8N_HMAC_SECRET_NEW) === sigV2;

if (!validV1 && !validV2) throw new Error('Invalid signature');
return { json: $input.item.json };
```

### 4. Ajouter NEW Vercel + n8n simultanément

```bash
# Vercel
echo "$NEW_HMAC" | vercel env add N8N_HMAC_SECRET_NEW production

# n8n env (via UI ou CLI)
# Ajouter N8N_HMAC_SECRET_NEW dans n8n environment variables
```

### 5. Deploy + tester

```bash
vercel --prod
# Créer un lead test
curl -X POST https://femiglow.com/api/chat/lead ...
# Vérifier dans n8n logs : "Webhook validated by V2"
```

### 6. Promouvoir NEW vers principal

```bash
# Vercel
vercel env rm N8N_HMAC_SECRET production
echo "$NEW_HMAC" | vercel env add N8N_HMAC_SECRET production
vercel env rm N8N_HMAC_SECRET_NEW production

# n8n
# Remplacer N8N_HMAC_SECRET_OLD par la nouvelle valeur
# Supprimer N8N_HMAC_SECRET_NEW
```

### 7. Code revert (single secret)

Restaurer le code dual-secret original (un seul `N8N_HMAC_SECRET`).

### 8. Log audit

## Procédure rotation `ADMIN_SESSION_SECRET` (iron-session)

⚠️ **Effet de bord** : toutes les sessions admin actives sont invalidées (force logout). Faire pendant off-hours.

### 1. Annoncer

```
Slack #chat-build :
"Rotation ADMIN_SESSION_SECRET planifiée demain 6h CET.
Yasmine et Karim, vous devrez vous reconnecter à l'admin.
Durée : 5 min."
```

### 2. Générer + remplacer

```bash
NEW_SECRET=$(openssl rand -hex 32)
vercel env rm ADMIN_SESSION_SECRET production
echo "$NEW_SECRET" | vercel env add ADMIN_SESSION_SECRET production
vercel --prod
```

### 3. Vérifier login admin

```bash
# Login manuel via UI
# Vérifier que la session se crée OK
```

## Procédure rotation d'URGENCE (compromission)

### Si une clé a été exposée (GitHub leak, log leak, etc.)

⚠️ Procédure accélérée. Pas de fenêtre de dual-key. On accepte un blip de quelques secondes.

```bash
# 1. Révoquer chez provider IMMÉDIATEMENT
# Aller sur platform.openai.com → Revoke key compromised

# 2. Générer + déployer nouvelle clé
NEW_KEY="sk-new-..."
vercel env rm OPENAI_API_KEY production
echo "$NEW_KEY" | vercel env add OPENAI_API_KEY production
vercel --prod  # ~3 min

# 3. Pendant les 3 min, le chat sera dégradé (provider OpenAI down → switch automatique)

# 4. Vérifier post-deploy
curl -s https://femiglow.com/api/chat/health | jq '.providers.openai'

# 5. Audit log + post-mortem
# Investiguer comment la clé a été exposée
```

### Post-mortem obligatoire

```markdown
# Post-mortem — OPENAI_API_KEY compromise

## Timeline
- HH:MM — Détection (comment ?)
- HH:MM — Révocation chez provider
- HH:MM — Nouvelle clé déployée

## Comment la fuite est-elle arrivée ?
[Investigation détaillée]

## Impact financier
[Y a-t-il eu usage abusif ?]

## Actions correctives
- [ ] Pre-commit hook scan secrets (truffleHog)
- [ ] Vault provider migration ?
- [ ] Formation équipe sur secrets management
```

## Pre-commit secret scanning

```bash
# Installer truffleHog ou git-secrets
brew install trufflehog

# Pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
trufflehog filesystem --no-update --since-commit=HEAD~1 . > /tmp/trufflehog_result
if [ -s /tmp/trufflehog_result ]; then
  echo "🚨 Secrets detected!"
  cat /tmp/trufflehog_result
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

## Vault future (V7+)

Migration envisagée vers HashiCorp Vault ou Doppler pour :
- Audit trail automatique des accès secrets.
- Rotation automatisée scheduled.
- Secrets injection au runtime (pas dans env Vercel).

## Anti-patterns secrets

- ❌ Commit accidentel d'une clé (git history reste).
- ❌ Partage clé dans Slack ou email.
- ❌ Pas de rotation depuis > 6 mois sur clés critiques.
- ❌ Rotation sans dual-key window (downtime garanti).
- ❌ Pas de scan secret en pre-commit.
- ❌ Clé "test" en prod (toujours environment-specific).
- ❌ Pas de log audit après rotation.
