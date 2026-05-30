# Runbook d'Execution - Gestion des Cles API

> Module : 170 - API Keys Management
> Classification : CONFIDENTIEL
> Date : 2026-05-25
> Destinataire : Developpeur(s) implementant la fonctionnalite
> Pre-requis : Acces SSH au serveur, droits DB PostgreSQL, repository clone

---

## 1. Pre-requis de securite

### 1.1 Generation des cles de chiffrement

```bash
# ============================================================
# ETAPE 1 : Generer les variables de chiffrement
# Executer ces commandes dans un terminal securise.
# Ne JAMAIS copier les valeurs dans un channel Slack, email ou issue GitHub.
# ============================================================

# Generer la cle master (>= 32 caracteres, base64)
export AI_ENGINE_ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "ENCRYPTION_KEY generee (${#AI_ENGINE_ENCRYPTION_KEY} chars)"

# Generer le salt PBKDF2 (>= 16 caracteres, base64)
export AI_ENGINE_ENCRYPTION_SALT=$(openssl rand -base64 16)
echo "ENCRYPTION_SALT genere (${#AI_ENGINE_ENCRYPTION_SALT} chars)"

# Verifier les longueurs minimales
if [ ${#AI_ENGINE_ENCRYPTION_KEY} -lt 32 ]; then
  echo "ERREUR: ENCRYPTION_KEY trop courte (${#AI_ENGINE_ENCRYPTION_KEY} < 32)"
  exit 1
fi
if [ ${#AI_ENGINE_ENCRYPTION_SALT} -lt 16 ]; then
  echo "ERREUR: ENCRYPTION_SALT trop court (${#AI_ENGINE_ENCRYPTION_SALT} < 16)"
  exit 1
fi
echo "OK: Les deux variables respectent les longueurs minimales."
```

### 1.2 Configuration des variables d'environnement

```bash
# ============================================================
# ETAPE 2 : Configurer les variables dans les fichiers .env
# ============================================================

# Developpement local (.env.local)
cat >> apps/web/.env.local << 'ENVEOF'
# Chiffrement des cles API (genere avec openssl rand -base64)
AI_ENGINE_ENCRYPTION_KEY=<COLLER_VALEUR_GENEREE>
AI_ENGINE_ENCRYPTION_SALT=<COLLER_VALEUR_GENEREE>
ENVEOF

# Environnement de test (.env.test) - VALEURS DE TEST UNIQUEMENT
cat >> apps/web/.env.test << 'ENVEOF'
# Cles de test (ne JAMAIS utiliser en production)
AI_ENGINE_ENCRYPTION_KEY=test-master-key-for-unit-tests-only-32chars!
AI_ENGINE_ENCRYPTION_SALT=test-salt-16chars!
ENVEOF

# Documenter dans .env.example
cat >> apps/web/.env.example << 'ENVEOF'
# Chiffrement des cles API AI Engine (generer avec: openssl rand -base64 32)
AI_ENGINE_ENCRYPTION_KEY=
AI_ENGINE_ENCRYPTION_SALT=
ENVEOF

# Verifier les permissions sur les fichiers .env
chmod 600 apps/web/.env.local apps/web/.env.test
echo "Permissions fichier verifiees (0600)."
```

### 1.3 Verification du pre-requis

```bash
# ============================================================
# ETAPE 3 : Verification que l'environnement est pret
# ============================================================

cd /var/www/femiglow-staging

# Verifier Node.js
node --version  # Doit etre >= 18.x

# Verifier PostgreSQL
psql -c "SELECT version();" 2>/dev/null || echo "ATTENTION: PostgreSQL non accessible via psql"

# Verifier que la variable existe
node -e "
  const key = process.env.AI_ENGINE_ENCRYPTION_KEY;
  const salt = process.env.AI_ENGINE_ENCRYPTION_SALT;
  console.log('ENCRYPTION_KEY:', key ? 'OK (' + key.length + ' chars)' : 'MANQUANTE');
  console.log('ENCRYPTION_SALT:', salt ? 'OK (' + salt.length + ' chars)' : 'MANQUANT');
  if (!key || !salt) process.exit(1);
"
```

---

## 2. Migration de base de donnees

### 2.1 Generation et application de la migration

```bash
# ============================================================
# ETAPE 4 : Migration de base de donnees
# ============================================================

cd /var/www/femiglow-staging/apps/web

# Verifier l'etat actuel de la base
npx drizzle-kit check:pg
echo "---"

# Generer la migration SQL
npx drizzle-kit generate:pg --name add_api_keys_table
echo "Migration generee."

# Reviser le fichier SQL genere
echo "=== REVUE DE LA MIGRATION ==="
cat drizzle/migrations/*add_api_keys_table*.sql
echo "=== FIN REVUE ==="
echo "Verifier que la migration ne contient PAS de DROP TABLE ni de donnees sensibles."
read -p "Continuer l'application de la migration ? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Migration annulee."
  exit 0
fi

# Appliquer la migration
npx drizzle-kit push:pg
echo "Migration appliquee."
```

### 2.2 Verification post-migration

```bash
# ============================================================
# ETAPE 5 : Verification de la migration
# ============================================================

# Verifier la creation de la table
psql -d femiglow -c "
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'ai_engine_api_key'
  ORDER BY ordinal_position;
"

# Verifier les index
psql -d femiglow -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'ai_engine_api_key';
"

# Verifier l'index unique partiel
psql -d femiglow -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexname = 'ai_ak_unique_active_provider';
"

# Compter les colonnes (doit etre 17)
COLUMN_COUNT=$(psql -d femiglow -t -c "
  SELECT count(*) FROM information_schema.columns
  WHERE table_name = 'ai_engine_api_key';
")
echo "Nombre de colonnes: $COLUMN_COUNT (attendu: 17)"

# Verifier la table audit_log
psql -d femiglow -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'ai_engine_audit_log';
"

echo "=== Migration verifiee ==="
```

---

## 3. Implementation pas a pas

### 3.1 Service de chiffrement

```bash
# ============================================================
# ETAPE 6 : Creer le service de chiffrement
# ============================================================

# Creer le fichier
mkdir -p apps/web/src/lib/ai-engine/services

# Implementer selon 03-backend/service-layer.md section 2
# Fichier : apps/web/src/lib/ai-engine/services/encryption-service.ts

# VERIFICATION SECURITE : Apres implementation
echo "=== Verification securite EncryptionService ==="

# 1. Verifier que la cle derivee est private
grep -n "derivedKey" apps/web/src/lib/ai-engine/services/encryption-service.ts
echo "La propriete derivedKey doit etre 'private'."

# 2. Verifier l'utilisation de crypto.randomBytes
grep -n "randomBytes" apps/web/src/lib/ai-engine/services/encryption-service.ts
echo "Doit utiliser crypto.randomBytes(12) pour l'IV."

# 3. Verifier qu'aucun console.log ne contient de plaintext
grep -n "console\.\(log\|warn\|error\)" apps/web/src/lib/ai-engine/services/encryption-service.ts
echo "Aucun console.log ne doit contenir de cle en clair."

# 4. Test rapide du chiffrement
node -e "
  const { EncryptionService } = require('./apps/web/src/lib/ai-engine/services/encryption-service');
  const svc = new EncryptionService(
    process.env.AI_ENGINE_ENCRYPTION_KEY,
    process.env.AI_ENGINE_ENCRYPTION_SALT
  );
  const encrypted = svc.encrypt('sk-proj-test-verification');
  console.log('Encrypted:', encrypted.substring(0, 30) + '...');
  const decrypted = svc.decrypt(encrypted);
  console.log('Decrypted matches:', decrypted === 'sk-proj-test-verification');
  console.log('Mask:', svc.mask('sk-proj-test-verification'));
"
```

### 3.2 Gestionnaire de cles

```bash
# ============================================================
# ETAPE 7 : Creer le gestionnaire de cles
# ============================================================

# Implementer selon 03-backend/service-layer.md section 3
# Fichier : apps/web/src/lib/ai-engine/services/api-key-manager.ts

# VERIFICATION SECURITE : Apres implementation
echo "=== Verification securite ApiKeyManager ==="

# 1. Verifier que listAll ne retourne pas encryptedKey
grep -n "encryptedKey" apps/web/src/lib/ai-engine/services/api-key-manager.ts
echo "encryptedKey ne doit apparaitre que dans les operations internes, jamais dans les retours."

# 2. Verifier l'audit log
grep -n "insertAuditLog" apps/web/src/lib/ai-engine/services/api-key-manager.ts
echo "Chaque operation CRUD doit avoir un appel a insertAuditLog."

# 3. Verifier le cache TTL
grep -n "CACHE_TTL\|keyCache" apps/web/src/lib/ai-engine/services/api-key-manager.ts
echo "Le cache doit avoir un TTL de 5 minutes."
```

### 3.3 Validateur de cles et routes API

```bash
# ============================================================
# ETAPE 8 : Creer le validateur et les routes API
# ============================================================

# Implementer selon 03-backend/service-layer.md section 4
# Fichier : apps/web/src/lib/ai-engine/services/api-key-validator.ts

# Creer les routes
mkdir -p apps/web/src/app/api/admin/ai-engine/config/api-keys/\[id\]
mkdir -p apps/web/src/app/api/admin/ai-engine/config/api-keys/test

# Implementer selon 03-backend/api-routes.md
# Fichier : apps/web/src/app/api/admin/ai-engine/config/api-keys/route.ts
# Fichier : apps/web/src/app/api/admin/ai-engine/config/api-keys/[id]/route.ts
# Fichier : apps/web/src/app/api/admin/ai-engine/config/api-keys/test/route.ts

# VERIFICATION SECURITE : Apres implementation
echo "=== Verification securite Routes API ==="

# 1. Verifier que toutes les routes commencent par requireAdminApi
for f in apps/web/src/app/api/admin/ai-engine/config/api-keys/**/route.ts; do
  echo "--- $f ---"
  head -30 "$f" | grep -n "requireAdminApi"
done
echo "Chaque handler doit commencer par 'const session = await requireAdminApi()'"

# 2. Verifier les headers anti-cache
grep -rn "no-store\|no-cache" apps/web/src/app/api/admin/ai-engine/config/api-keys/
echo "Toutes les reponses doivent inclure Cache-Control: no-store"

# 3. Verifier qu'aucune reponse ne contient encryptedKey ou apiKey
grep -rn "encryptedKey\|\.apiKey" apps/web/src/app/api/admin/ai-engine/config/api-keys/ | grep -v "body\.\|parsed\.\|request\."
echo "Les reponses ne doivent jamais contenir ces champs."
```

### 3.4 Frontend

```bash
# ============================================================
# ETAPE 9 : Implementer les composants UI
# ============================================================

# Modifier page.tsx selon 04-frontend/components.md et 02-ui-ux-design/components.md
# Fichier : apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx

# VERIFICATION SECURITE : Apres implementation
echo "=== Verification securite Frontend ==="

# 1. Verifier le type=password
grep -n "type.*password" apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx
echo "Le champ de cle API doit etre type='password'."

# 2. Verifier autoComplete=off
grep -n "autoComplete.*off" apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx
echo "autoComplete='off' doit etre present."

# 3. Verifier le cleanup du state
grep -n "setApiKey.*''" apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx
echo "Le state apiKey doit etre nettoye a la fermeture (setApiKey(''))."

# 4. Verifier qu'aucune cle en clair n'est dans le code
grep -n "sk-proj-\|sk-ant-\|AIzaSy" apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx | grep -v "placeholder\|hint\|Doit commencer"
echo "Aucune cle reelle ne doit etre dans le code (seulement des placeholders)."
```

---

## 4. Execution des tests

### 4.1 Tests unitaires

```bash
# ============================================================
# ETAPE 10 : Executer les tests unitaires
# ============================================================

cd /var/www/femiglow-staging

# Executer tous les tests de la feature
npx vitest run --reporter=verbose \
  apps/web/src/lib/ai-engine/services/__tests__/encryption-service.test.ts \
  apps/web/src/lib/ai-engine/services/__tests__/api-key-manager.test.ts \
  apps/web/src/lib/ai-engine/services/__tests__/api-key-validator.test.ts \
  apps/web/src/app/api/admin/ai-engine/config/api-keys/__tests__/route.test.ts \
  apps/web/src/app/api/admin/ai-engine/config/api-keys/__tests__/route-delete.test.ts \
  apps/web/src/app/api/admin/ai-engine/config/api-keys/__tests__/route-test.test.ts \
  apps/web/src/app/api/admin/ai-engine/config/__tests__/api-keys-security.test.ts \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/api-key-card.test.tsx \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/api-key-form.test.tsx \
  apps/web/src/app/admin/content-studio-v2/ai-engine/config/__tests__/key-mask-display.test.tsx

echo "=== Resultat ==="
echo "Attendu : 60 tests passes, 0 echecs"
```

### 4.2 Couverture

```bash
# ============================================================
# ETAPE 11 : Verifier la couverture
# ============================================================

npx vitest run --coverage \
  --coverage.include="apps/web/src/lib/ai-engine/services/encryption-service.ts" \
  --coverage.include="apps/web/src/lib/ai-engine/services/api-key-manager.ts" \
  --coverage.include="apps/web/src/lib/ai-engine/services/api-key-validator.ts" \
  --coverage.include="apps/web/src/app/api/admin/ai-engine/config/api-keys/**"

echo "=== Seuils de couverture ==="
echo "encryption-service.ts : >= 95%"
echo "api-key-manager.ts    : >= 90%"
echo "Routes API             : >= 85%"
echo "Global                 : >= 88%"
```

### 4.3 Tests E2E

```bash
# ============================================================
# ETAPE 12 : Executer les tests E2E
# ============================================================

# Demarrer l'application en mode test
npm run dev:test &
DEV_PID=$!
sleep 5

# Executer les tests Playwright
npx playwright test \
  apps/web/e2e/api-keys/api-keys-crud.spec.ts \
  apps/web/e2e/api-keys/api-keys-ux.spec.ts \
  apps/web/e2e/api-keys/api-keys-security.spec.ts \
  --reporter=list

echo "=== Resultat ==="
echo "Attendu : 17 tests E2E passes, 0 echecs"

# Arreter le serveur de dev
kill $DEV_PID 2>/dev/null
```

### 4.4 Tests de securite automatises

```bash
# ============================================================
# ETAPE 13 : Tests de securite specifiques
# ============================================================

echo "=== Tests de securite automatises ==="

# 1. Grep pour les cles reelles dans les sources
echo "--- 1. Recherche de cles reelles dans le code ---"
LEAKS=$(grep -rn "sk-proj-[^t]\|sk-ant-[^t]\|AIzaSy[A-Z]" apps/web/src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|test\|mock\|fixture\|\.test\.\|\.spec\." \
  | grep -v "placeholder\|hint\|Doit commencer\|example\|doc")
if [ -z "$LEAKS" ]; then
  echo "OK: Aucune cle reelle trouvee dans le code."
else
  echo "ERREUR: Cles potentiellement reelles trouvees :"
  echo "$LEAKS"
  exit 1
fi

# 2. Verifier que encryptedKey n'est pas dans les types de reponse
echo "--- 2. Recherche de encryptedKey dans les types de reponse ---"
ENCRYPTED_LEAKS=$(grep -rn "encryptedKey" apps/web/src/app/api/admin/ai-engine/config/api-keys/ \
  | grep -v "select\|insert\|update\|delete\|\.test\.\|__tests__")
if [ -z "$ENCRYPTED_LEAKS" ]; then
  echo "OK: encryptedKey n'apparait pas dans les reponses API."
else
  echo "ATTENTION: encryptedKey trouve dans les routes (verifier que c'est interne) :"
  echo "$ENCRYPTED_LEAKS"
fi

# 3. Verifier les console.log dans le code de production
echo "--- 3. Recherche de console.log potentiellement dangereux ---"
CONSOLE_LEAKS=$(grep -rn "console\.\(log\|warn\|error\).*\(apiKey\|encryptedKey\|plaintext\|decrypted\)" \
  apps/web/src/lib/ai-engine/ apps/web/src/app/api/admin/ai-engine/ \
  --include="*.ts" \
  | grep -v "test\|__tests__\|mock")
if [ -z "$CONSOLE_LEAKS" ]; then
  echo "OK: Aucun console.log dangereux trouve."
else
  echo "ERREUR: Console.log potentiellement dangereux :"
  echo "$CONSOLE_LEAKS"
  exit 1
fi

echo "=== Tests de securite automatises termines ==="
```

---

## 5. Checklist de test de penetration (manuel)

### 5.1 Inspection des reponses HTTP

```bash
# ============================================================
# ETAPE 14 : Penetration test - Reponses HTTP
# ============================================================

# Pre-requis : application demarree en local avec une cle configuree

# 1. GET - Verifier que les cles ne sont pas en clair
curl -s -b "femiglow-admin-session=$SESSION_COOKIE" \
  http://localhost:3000/api/admin/ai-engine/config/api-keys \
  | python3 -m json.tool > /tmp/api-keys-get-response.json

echo "=== Reponse GET (premiers 500 chars) ==="
head -c 500 /tmp/api-keys-get-response.json

# Chercher des patterns de cles
echo "--- Recherche de patterns de cles ---"
grep -i "sk-proj-\|sk-ant-\|AIzaSy\|encryptedKey" /tmp/api-keys-get-response.json
echo "(Aucun resultat attendu)"

# 2. POST - Verifier que la cle envoyee n'est pas renvoyee
curl -s -X POST \
  -H "Content-Type: application/json" \
  -b "femiglow-admin-session=$SESSION_COOKIE" \
  -d '{"providerType":"openai","apiKey":"sk-proj-test-pentest-key-12345","skipValidation":true}' \
  http://localhost:3000/api/admin/ai-engine/config/api-keys \
  | python3 -m json.tool > /tmp/api-keys-post-response.json

echo "=== Reponse POST ==="
cat /tmp/api-keys-post-response.json

echo "--- Recherche de la cle envoyee dans la reponse ---"
grep "sk-proj-test-pentest" /tmp/api-keys-post-response.json
echo "(Aucun resultat attendu - seule la cle masquee doit apparaitre)"

# 3. Verifier les headers de securite
echo "--- Headers de securite ---"
curl -s -I -b "femiglow-admin-session=$SESSION_COOKIE" \
  http://localhost:3000/api/admin/ai-engine/config/api-keys \
  | grep -i "cache-control\|pragma\|strict-transport\|x-content-type\|x-frame"
```

### 5.2 Inspection de la base de donnees

```bash
# ============================================================
# ETAPE 15 : Penetration test - Base de donnees
# ============================================================

echo "=== Verification du chiffrement en base ==="

# Verifier que les cles sont chiffrees (format base64:base64:base64)
psql -d femiglow -c "
  SELECT
    id,
    provider_type,
    masked_key,
    -- Verifier le format : doit contenir 2 separateurs ':'
    (LENGTH(encrypted_key) - LENGTH(REPLACE(encrypted_key, ':', ''))) AS colon_count,
    -- Ne JAMAIS afficher encrypted_key en entier
    LEFT(encrypted_key, 20) || '...' AS encrypted_key_preview,
    -- Verifier que ce n'est PAS du texte lisible
    CASE
      WHEN encrypted_key LIKE 'sk-%' THEN 'ALERTE: Cle en clair !'
      WHEN encrypted_key LIKE 'AIza%' THEN 'ALERTE: Cle en clair !'
      WHEN encrypted_key LIKE 'http%' THEN 'ALERTE: URL en clair !'
      ELSE 'OK: Chiffre'
    END AS status
  FROM ai_engine_api_key;
"

# Verifier l'audit log
echo "=== Verification de l'audit log ==="
psql -d femiglow -c "
  SELECT
    action,
    actor_email,
    -- Verifier que details ne contient pas de cle en clair
    CASE
      WHEN details::text LIKE '%sk-proj-%' THEN 'ALERTE: Cle en clair dans audit !'
      WHEN details::text LIKE '%sk-ant-%' THEN 'ALERTE: Cle en clair dans audit !'
      WHEN details::text LIKE '%encryptedKey%' THEN 'ALERTE: Chiffre dans audit !'
      ELSE 'OK'
    END AS security_check,
    created_at
  FROM ai_engine_audit_log
  WHERE entity_type = 'api_key'
  ORDER BY created_at DESC
  LIMIT 10;
"
```

### 5.3 Inspection du DOM dans le navigateur

```
1. Ouvrir Chrome DevTools (F12)
2. Naviguer vers /admin/content-studio-v2/ai-engine/config
3. Cliquer sur l'onglet "Cles API"
4. Dans l'onglet Elements :
   a. Ctrl+F et chercher "sk-proj-"   -> 0 resultats attendus
   b. Ctrl+F et chercher "sk-ant-"    -> 0 resultats attendus (sauf le masque "sk-ant-...")
   c. Ctrl+F et chercher "encryptedKey" -> 0 resultats attendus
   d. Ctrl+F et chercher "apiKey"       -> 0 resultats dans les data attributes

5. Dans l'onglet Network :
   a. Filtrer sur "api-keys"
   b. Cliquer sur chaque reponse
   c. Verifier que le body ne contient pas de cle en clair

6. Dans l'onglet Application :
   a. Verifier localStorage : pas de cle stockee
   b. Verifier sessionStorage : pas de cle stockee
   c. Verifier les cookies : pas de cle dans les cookies

7. Dans l'onglet Console :
   a. Taper : JSON.stringify(localStorage)
   b. Verifier : pas de cle dans le resultat
```

---

## 6. Rollback

### 6.1 Rollback de la base de donnees

```bash
# ============================================================
# ROLLBACK : Supprimer la table et les donnees
# ATTENTION : Cette operation est irreversible !
# Les cles chiffrees en base seront perdues.
# ============================================================

echo "ATTENTION: Le rollback va supprimer toutes les cles API stockees."
echo "Les variables d'environnement resteront fonctionnelles."
read -p "Confirmer le rollback ? (yes/NO) " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Rollback annule."
  exit 0
fi

# Supprimer la table
psql -d femiglow -c "
  -- Supprimer les entrees d'audit associees
  DELETE FROM ai_engine_audit_log WHERE entity_type = 'api_key';

  -- Supprimer la table des cles
  DROP TABLE IF EXISTS ai_engine_api_key;

  -- Verifier
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'ai_engine_api_key'
  ) AS table_exists;
"

echo "Rollback termine. La table ai_engine_api_key a ete supprimee."
echo "Les variables d'environnement restent la source de cles active."
```

### 6.2 Rollback du code

```bash
# Revertir les modifications de code
git revert HEAD  # Si un seul commit
# OU
git revert <commit-hash>  # Si plusieurs commits
```

### 6.3 Nettoyage des variables d'environnement

```bash
# Optionnel : supprimer les variables si la feature est definitivement retiree
# Ne pas les supprimer si un rollback temporaire est prevu

# Supprimer de .env.local
sed -i '/AI_ENGINE_ENCRYPTION_KEY/d' apps/web/.env.local
sed -i '/AI_ENGINE_ENCRYPTION_SALT/d' apps/web/.env.local
```

---

## 7. Troubleshooting

### 7.1 Erreur : "Cle de chiffrement non configuree" (ENCRYPTION_KEY_MISSING)

**Symptome** : L'API POST retourne 500 avec le code `ENCRYPTION_KEY_MISSING`.

**Diagnostic** :
```bash
# Verifier que les variables sont definies
node -e "
  console.log('KEY:', process.env.AI_ENGINE_ENCRYPTION_KEY ? 'definie' : 'MANQUANTE');
  console.log('SALT:', process.env.AI_ENGINE_ENCRYPTION_SALT ? 'definie' : 'MANQUANT');
"
```

**Resolution** :
1. Si les variables sont manquantes : les ajouter au fichier `.env.local` ou aux variables d'environnement systeme
2. Si les variables sont presentes mais trop courtes : regenerer avec `openssl rand -base64 32`
3. Redemarrer l'application apres ajout

---

### 7.2 Erreur : "Dechiffrement echoue" (DECRYPTION_FAILED)

**Symptome** : Le dechiffrement d'une cle echoue avec le message "cle corrompue ou cle master differente".

**Diagnostic** :
```bash
# Verifier si la cle master a change
psql -d femiglow -c "
  SELECT id, provider_type, LEFT(encrypted_key, 20) || '...' AS preview,
         updated_at
  FROM ai_engine_api_key
  WHERE is_active = true
  ORDER BY provider_type;
"
```

**Causes possibles** :
1. **La cle master (`AI_ENGINE_ENCRYPTION_KEY`) a ete modifiee** sans re-chiffrement
   - Solution : restaurer l'ancienne cle master OU executer le script de rotation (voir `03-backend/encryption.md` section 7)
2. **Le salt (`AI_ENGINE_ENCRYPTION_SALT`) a ete modifie** sans re-chiffrement
   - Solution : restaurer l'ancien salt
3. **Les donnees en base ont ete corrompues** (modification manuelle)
   - Solution : supprimer la cle corrompue et en creer une nouvelle via l'interface
4. **Environnement different** (staging vs production)
   - Chaque environnement doit avoir ses propres cles de chiffrement

**Resolution urgente** :
```bash
# Si la cle master est perdue, les cles chiffrees sont irrecuperables.
# Supprimer toutes les cles corrompues :
psql -d femiglow -c "DELETE FROM ai_engine_api_key;"
# Reconfigurer les cles via l'interface admin.
```

---

### 7.3 Erreur : "Rate limit depasse" (RATE_LIMIT_EXCEEDED)

**Symptome** : L'endpoint POST /test retourne 429.

**Resolution** : Attendre 60 secondes avant de reessayer. Le rate limit est de 5 requetes par minute par session admin.

**Si le rate limit semble bloque indefiniment** :
```bash
# Redemarrer l'application (le rate limiter est en memoire)
pm2 restart femiglow  # ou l'equivalent sur votre setup
```

---

### 7.4 Erreur : "Base de donnees non disponible" (DB_UNAVAILABLE)

**Symptome** : Toutes les routes retournent 503.

**Diagnostic** :
```bash
# Verifier la connexion PostgreSQL
psql -d femiglow -c "SELECT 1;"

# Verifier les logs de connexion
grep "connection" /var/log/postgresql/postgresql-*.log | tail -20
```

**Resolution** :
1. Verifier que PostgreSQL est en cours d'execution
2. Verifier la chaine de connexion dans `DATABASE_URL`
3. L'application continue de fonctionner avec les variables d'environnement (degradation gracieuse)

---

### 7.5 Erreur : Les cles ne se resolvent pas depuis la DB

**Symptome** : L'application utilise toujours les variables d'environnement au lieu des cles DB.

**Diagnostic** :
```bash
# Verifier que des cles actives existent en base
psql -d femiglow -c "
  SELECT provider_type, is_active, masked_key
  FROM ai_engine_api_key
  WHERE is_active = true;
"

# Verifier que le service de chiffrement est disponible
node -e "
  const { getEncryptionService } = require('./apps/web/src/lib/ai-engine/services/encryption-service');
  console.log('Encryption available:', getEncryptionService().isAvailable());
"
```

**Resolution** :
1. Si `isAvailable()` retourne `false` : les variables de chiffrement sont manquantes
2. Si aucune cle active n'existe : ajouter une cle via l'interface
3. Verifier que `engine-config.ts` utilise bien `ApiKeyManager.resolveApiKey()`

---

### 7.6 Erreur : Migration echouee

**Symptome** : `drizzle-kit push:pg` echoue.

**Diagnostic** :
```bash
# Verifier si la table existe deja partiellement
psql -d femiglow -c "\dt ai_engine_api_key"

# Verifier les conflits d'index
psql -d femiglow -c "\di ai_ak_*"
```

**Resolution** :
```bash
# Si la table existe partiellement, supprimer et recommencer
psql -d femiglow -c "DROP TABLE IF EXISTS ai_engine_api_key CASCADE;"
npx drizzle-kit push:pg
```

---

### 7.7 Performance : dechiffrement lent

**Symptome** : Le dechiffrement prend > 5ms (objectif < 5ms).

**Diagnostic** :
```bash
node -e "
  const { EncryptionService } = require('./apps/web/src/lib/ai-engine/services/encryption-service');
  const svc = new EncryptionService(process.env.AI_ENGINE_ENCRYPTION_KEY, process.env.AI_ENGINE_ENCRYPTION_SALT);
  const encrypted = svc.encrypt('sk-proj-test-performance-check');
  const start = performance.now();
  for (let i = 0; i < 1000; i++) svc.decrypt(encrypted);
  const elapsed = performance.now() - start;
  console.log('1000 dechiffrements en', elapsed.toFixed(1), 'ms');
  console.log('Moyenne:', (elapsed / 1000).toFixed(3), 'ms/dechiffrement');
"
```

**Resolution** :
1. Le dechiffrement AES-256-GCM devrait etre < 0.1ms par operation (avec AES-NI)
2. Si la lenteur vient de la derivation PBKDF2 : c'est normal pour la premiere operation (derivation). La cle derivee est ensuite cachee dans l'instance.
3. Verifier que le cache `ApiKeyManager` fonctionne (evite des dechiffrements repetitifs)
