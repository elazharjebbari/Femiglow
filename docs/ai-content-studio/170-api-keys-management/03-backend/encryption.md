# Documentation du chiffrement - AES-256-GCM

> Module : 170 - API Keys Management
> Classification : CONFIDENTIEL
> Date : 2026-05-25

---

## 1. Choix de l'algorithme

### 1.1 Pourquoi AES-256-GCM ?

| Critere | AES-256-GCM | AES-256-CBC | ChaCha20-Poly1305 |
|---------|-------------|-------------|-------------------|
| Chiffrement authentifie | Oui (integre) | Non (MAC separe) | Oui (integre) |
| Performance (AES-NI) | Excellente | Bonne | Bonne (sans AES-NI) |
| Standard NIST | Oui (SP 800-38D) | Oui | Non NIST (IETF) |
| Support Node.js | Natif (crypto) | Natif (crypto) | Natif (crypto) |
| Resistance aux oracles de padding | Oui (pas de padding) | Non (POODLE) | Oui (pas de padding) |

**Decision** : AES-256-GCM est le choix optimal pour notre cas d'usage car il fournit a la fois confidentialite et integrite (chiffrement authentifie) en une seule operation, avec d'excellentes performances grace a l'acceleration materielle AES-NI.

### 1.2 Proprietes de AES-256-GCM

- **Confidentialite** : le ciphertext ne revele rien sur le plaintext
- **Integrite** : le tag d'authentification detecte toute modification du ciphertext
- **Non-malleable** : il est impossible de modifier le ciphertext de maniere previsible
- **Streaming** : supporte le chiffrement/dechiffrement en flux (utile pour les cles longues)

---

## 2. Derivation de la cle de chiffrement

### 2.1 Processus PBKDF2

```
+----------------------------------+
|  AI_ENGINE_ENCRYPTION_KEY        |
|  (env var, >= 32 caracteres)     |
+----------------------------------+
              |
              v
+----------------------------------+
|  PBKDF2-HMAC-SHA512             |
|  - Salt: AI_ENGINE_ENCRYPTION_SALT
|  - Iterations: 100 000          |
|  - Output: 32 octets (256 bits) |
+----------------------------------+
              |
              v
+----------------------------------+
|  Derived Key (256 bits)          |
|  Utilisee pour AES-256-GCM      |
+----------------------------------+
```

### 2.2 Parametres PBKDF2

| Parametre | Valeur | Justification |
|-----------|--------|---------------|
| Fonction PRF | HMAC-SHA-512 | Plus resistant aux GPU que SHA-256 (operations 64-bit) |
| Iterations | 100 000 | Conforme OWASP 2024 pour PBKDF2-SHA512 (minimum 210 000 pour SHA256) |
| Salt | Variable d'env (>= 16 chars) | Evite les rainbow tables |
| Output length | 32 octets (256 bits) | Taille de cle requise par AES-256 |

### 2.3 Exigences sur le Master Key

- **Longueur minimale** : 32 caracteres
- **Entropie** : doit etre generee avec un CSPRNG (ex: `openssl rand -base64 32`)
- **Stockage** : variable d'environnement (0600), jamais dans le code source
- **Rotation** : voir section 7

### 2.4 Exigences sur le Salt

- **Longueur minimale** : 16 caracteres
- **Entropie** : doit etre generee avec un CSPRNG (ex: `openssl rand -base64 16`)
- **Unicite** : doit etre unique par environnement (staging vs production)
- **Fixe** : le meme salt est utilise pour toutes les operations (pas un salt par cle)

### 2.5 Generation des variables d'environnement

```bash
# Generer la cle master
openssl rand -base64 32
# Exemple de sortie : "dGhpcyBpcyBhIHNlY3VyZSByYW5kb20ga2V5IQ=="

# Generer le salt
openssl rand -base64 16
# Exemple de sortie : "c2FsdF9mb3JfcGJrZGYy"
```

---

## 3. Processus de chiffrement

### 3.1 Diagramme

```
+------------------+     +------------------+     +------------------+
| Plaintext        |     | Derived Key      |     | Random IV        |
| "sk-proj-abc..." |     | (256 bits)       |     | (96 bits)        |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         v                        v                        v
+--------------------------------------------------------------+
|                    AES-256-GCM Encrypt                        |
+--------------------------------------------------------------+
         |                                             |
         v                                             v
+------------------+                          +------------------+
| Ciphertext       |                          | Auth Tag         |
| (variable)       |                          | (128 bits)       |
+------------------+                          +------------------+
         |                                             |
         v                                             v
+--------------------------------------------------------------+
| Storage Format:                                               |
| base64(IV) : base64(AuthTag) : base64(Ciphertext)           |
+--------------------------------------------------------------+
```

### 3.2 Code de reference

```typescript
encrypt(plaintext: string): string {
  if (!this.derivedKey) {
    throw new Error('Cle de chiffrement non configuree');
  }

  // 1. IV aleatoire (CSPRNG, 12 octets = 96 bits)
  const iv = crypto.randomBytes(12);

  // 2. Cipher AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', this.derivedKey, iv, {
    authTagLength: 16, // 128 bits
  });

  // 3. Chiffrement
  const encryptedParts = [
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ];
  const encrypted = Buffer.concat(encryptedParts);

  // 4. Tag d'authentification
  const authTag = cipher.getAuthTag();

  // 5. Format de stockage
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}
```

### 3.3 Proprietes du format de stockage

| Partie | Encodage | Taille fixe | Sensible |
|--------|----------|-------------|----------|
| IV | base64 | 16 chars (12 octets) | Non (public) |
| AuthTag | base64 | 24 chars (16 octets) | Oui (integrite) |
| Ciphertext | base64 | Variable | Oui (confidentialite) |

**Separateur** : `:` (deux-points) - choisi car il n'apparait pas dans le base64 standard.

---

## 4. Processus de dechiffrement

### 4.1 Diagramme

```
+--------------------------------------------------------------+
| Stored Format:                                               |
| "MTIz...:YWJj...:eHl6..."                                   |
+--------------------------------------------------------------+
         |
         v (split sur ":")
+------------------+     +------------------+     +------------------+
| IV (base64)      |     | AuthTag (base64) |     | Ciphertext (b64) |
+------------------+     +------------------+     +------------------+
         |                        |                        |
         v                        v                        v
+--------------------------------------------------------------+
|                    AES-256-GCM Decrypt                        |
|  1. Verify AuthTag (integrity check)                          |
|  2. Decrypt Ciphertext                                        |
+--------------------------------------------------------------+
         |                                    |
         v (succes)                           v (echec)
+------------------+                  +------------------+
| Plaintext        |                  | Error:           |
| "sk-proj-abc..." |                  | "Unsupported     |
+------------------+                  |  state or unable |
                                      |  to authenticate"|
                                      +------------------+
```

### 4.2 Code de reference

```typescript
decrypt(encryptedString: string): string {
  if (!this.derivedKey) {
    throw new Error('Cle de chiffrement non configuree');
  }

  // 1. Decouvrir les 3 parties
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Format de chiffre invalide');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');

  // 2. Validation des tailles
  if (iv.length !== 12) throw new Error('Taille IV invalide');
  if (authTag.length !== 16) throw new Error('Taille authTag invalide');

  // 3. Decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', this.derivedKey, iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);

  // 4. Dechiffrement + verification d'integrite
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(), // Verifie l'authTag ici
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    // L'authTag ne correspond pas = integrite compromise
    throw new Error(
      'Dechiffrement echoue: cle corrompue ou cle master differente'
    );
  }
}
```

---

## 5. Gestion des IV (Initialization Vector)

### 5.1 Proprietes requises

- **Unique** : chaque operation de chiffrement doit utiliser un IV different
- **Non predictible** : genere par CSPRNG (`crypto.randomBytes()`)
- **Taille fixe** : 12 octets (96 bits) pour AES-GCM (recommandation NIST)

### 5.2 Risque de collision

Avec un IV de 96 bits genere aleatoirement :
- Probabilite de collision apres 2^32 (4 milliards) de chiffrements : ~50%
- Pour notre usage (quelques dizaines de cles maximum) : risque negligeable

### 5.3 Consequence d'une reutilisation d'IV

Si le meme IV est utilise avec la meme cle pour deux plaintexts differents :
- Le XOR des deux ciphertexts revele le XOR des deux plaintexts
- L'authTag devient predictible
- **Impact** : compromission totale de la confidentialite pour les deux messages

**Mitigation** : utilisation de `crypto.randomBytes()` (CSPRNG) garantit l'unicite avec une probabilite ecrasante.

---

## 6. Masquage des cles

### 6.1 Algorithme de masquage

Le masquage n'est **pas** une operation cryptographique. C'est une transformation a sens unique pour l'affichage :

```typescript
mask(plaintext: string): string {
  if (!plaintext || plaintext.length < 4) return '****';

  const last4 = plaintext.slice(-4);

  // Prefixes connus par ordre de longueur decroissante
  const prefixes = [
    'sk-ant-api03-',  // Anthropic nouveau format
    'sk-proj-',       // OpenAI projets
    'sk-ant-',        // Anthropic
    'https://',       // URLs
    'http://',        // URLs
    'sk-',            // OpenAI classique
    'AIza',           // Google
    'gsk_',           // Groq (futur)
  ];

  for (const prefix of prefixes) {
    if (plaintext.startsWith(prefix)) {
      return `${prefix}...${last4}`;
    }
  }

  // Fallback
  if (plaintext.length > 8) {
    return `${plaintext.slice(0, 4)}...${last4}`;
  }
  return `****${last4}`;
}
```

### 6.2 Exemples

| Cle originale | Masquee |
|---------------|---------|
| `sk-proj-abcdef123456789ABCDEF` | `sk-proj-...CDEF` |
| `sk-ant-api03-xyz789abc123def456` | `sk-ant-api03-...f456` |
| `AIzaSyD-abcdefghijk12345` | `AIza...2345` |
| `abc123def456gh` | `abc1...56gh` |
| `http://localhost:11434` | `http...1434` |
| `short` | `****hort` |

### 6.3 Securite du masquage

Le masque revele :
- Le **prefixe** de la cle (identifie le fournisseur, information non sensible)
- Les **4 derniers caracteres** (insuffisant pour reconstituer la cle)
- La **longueur approximative** est masquee (les `...` ne revelent pas la taille)

---

## 7. Rotation de la cle de chiffrement

### 7.1 Quand effectuer une rotation

- **Obligatoire** : si la cle master est suspectee d'etre compromise
- **Recommande** : tous les 12 mois (bonne pratique)
- **Optionnel** : lors d'un changement d'equipe (acces revoque)

### 7.2 Procedure de rotation

```
1. Generer les nouvelles valeurs :
   $ export NEW_KEY=$(openssl rand -base64 32)
   $ export NEW_SALT=$(openssl rand -base64 16)

2. Executer le script de re-chiffrement :
   $ npx tsx scripts/rotate-encryption-key.ts \
       --old-key "$AI_ENGINE_ENCRYPTION_KEY" \
       --old-salt "$AI_ENGINE_ENCRYPTION_SALT" \
       --new-key "$NEW_KEY" \
       --new-salt "$NEW_SALT"

3. Mettre a jour les variables d'environnement :
   AI_ENGINE_ENCRYPTION_KEY=$NEW_KEY
   AI_ENGINE_ENCRYPTION_SALT=$NEW_SALT

4. Redemarrer l'application

5. Verifier le bon fonctionnement :
   - Tester chaque cle API depuis l'interface
   - Verifier les logs pour des erreurs de dechiffrement
```

### 7.3 Script de rotation

```typescript
// scripts/rotate-encryption-key.ts
import { EncryptionService } from '../apps/web/src/lib/ai-engine/services/encryption-service';
import { db } from '../apps/web/src/lib/db/client';
import { aiEngineApiKeys } from '../apps/web/src/lib/db/schema-ai-engine';
import { eq } from 'drizzle-orm';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const oldService = new EncryptionService(args.oldKey, args.oldSalt);
  const newService = new EncryptionService(args.newKey, args.newSalt);

  const database = db()!;
  const allKeys = await database.select().from(aiEngineApiKeys);

  console.log(`Re-chiffrement de ${allKeys.length} cle(s)...`);

  let success = 0;
  let errors = 0;

  for (const key of allKeys) {
    try {
      // Dechiffrer avec l'ancienne cle
      const plaintext = oldService.decrypt(key.encryptedKey);

      // Re-chiffrer avec la nouvelle cle
      const newEncrypted = newService.encrypt(plaintext);

      // Mettre a jour en base
      await database
        .update(aiEngineApiKeys)
        .set({
          encryptedKey: newEncrypted,
          updatedAt: new Date(),
          updatedBy: 'rotation-script',
        })
        .where(eq(aiEngineApiKeys.id, key.id));

      console.log(`  [OK] ${key.providerType} (${key.maskedKey})`);
      success++;
    } catch (error) {
      console.error(`  [ERREUR] ${key.providerType}: ${error}`);
      errors++;
    }
  }

  console.log(`\nTermine: ${success} succes, ${errors} erreurs`);
  if (errors > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
```

---

## 8. Tests du chiffrement

### 8.1 Tests obligatoires

1. **Chiffrement/dechiffrement round-trip** : encrypt(X) -> decrypt -> X
2. **IV unique** : deux chiffrements du meme plaintext produisent des ciphertexts differents
3. **Integrite** : modifier un bit du ciphertext fait echouer le dechiffrement
4. **AuthTag** : modifier l'authTag fait echouer le dechiffrement
5. **Cle differente** : dechiffrer avec une autre cle master echoue
6. **Format invalide** : dechiffrer une chaine mal formee echoue proprement
7. **Masquage** : les prefixes sont correctement detectes et masques
8. **Service indisponible** : operations echouent proprement si la cle master est absente

### 8.2 Donnees de test

```typescript
const TEST_KEYS = [
  { provider: 'openai', key: 'sk-proj-abcdef123456789ABCDEFGHIJKLMNOP', expected_mask: 'sk-proj-...MNOP' },
  { provider: 'anthropic', key: 'sk-ant-api03-xyz789abc123def456ghi789', expected_mask: 'sk-ant-api03-...i789' },
  { provider: 'google', key: 'AIzaSyD-abcdefghijk1234567890', expected_mask: 'AIza...7890' },
  { provider: 'elevenlabs', key: 'el_abcdefghijk123456789', expected_mask: 'el_a...6789' },
  { provider: 'ollama', key: 'http://localhost:11434', expected_mask: 'http...1434' },
];
```
