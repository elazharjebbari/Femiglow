# Modele de Securite - Gestion des Cles API

> Module : 170 - API Keys Management
> Classification : CONFIDENTIEL
> Date : 2026-05-25
> Revue de securite requise avant mise en production

---

## 1. Resume executif

Ce document detaille le modele de securite pour la gestion des cles API du AI Engine FemiGlow. Les cles API des fournisseurs IA (OpenAI, Anthropic, Google AI, ElevenLabs, Ollama) representent des actifs sensibles dont la compromission pourrait entrainer des couts financiers non controles et une utilisation abusive des services IA.

**Niveau de sensibilite** : Eleve
**Impact en cas de compromission** : Financier (facturation API), Reputationnel (usage abusif)

---

## 2. Analyse des menaces (Threat Model)

### 2.1 Matrice STRIDE

| Menace | Categorie STRIDE | Probabilite | Impact | Risque | Mitigation |
|--------|------------------|-------------|--------|--------|-----------|
| Vol de la base de donnees (dump SQL) | Information Disclosure | Moyen | Eleve | ELEVE | Chiffrement AES-256-GCM des cles |
| Interception reseau (MITM) | Tampering / Disclosure | Faible | Eleve | MOYEN | HTTPS obligatoire, TLS 1.3 |
| Acces non autorise via session volee | Spoofing | Moyen | Eleve | ELEVE | iron-session sealed cookies, SameSite=Strict |
| Injection SQL | Tampering | Faible | Eleve | MOYEN | Drizzle ORM (requetes parametrees) |
| Brute force du chiffrement | Information Disclosure | Tres faible | Eleve | FAIBLE | AES-256-GCM, PBKDF2 100k iterations |
| Fuite dans les logs applicatifs | Information Disclosure | Moyen | Eleve | ELEVE | Jamais de cle en clair dans les logs |
| XSS pour voler la cle saisie | Information Disclosure | Faible | Eleve | MOYEN | CSP, input type=password, nettoyage state |
| CSRF pour creer/supprimer une cle | Tampering | Faible | Moyen | FAIBLE | SameSite cookies, validation origin |
| Perte de la cle de chiffrement | Denial of Service | Faible | Eleve | MOYEN | Documentation, backup securise |
| Attaque sur les env vars | Information Disclosure | Faible | Moyen | FAIBLE | Permissions fichier restrictives |
| Abus du endpoint de test | Denial of Service | Moyen | Faible | FAIBLE | Rate limiting 5 req/min |
| Admin malveillant | Elevation of Privilege | Faible | Eleve | MOYEN | Audit logging complet |

### 2.2 Surface d'attaque

```
+-------------------------------------------+
|            Surface d'attaque              |
+-------------------------------------------+
| 1. API Routes (4 endpoints)              |
|    - Authentication: requireAdminApi()    |
|    - Authorization: admin role only       |
|    - Input: Zod validation               |
|                                           |
| 2. Base de donnees                        |
|    - Cles chiffrees AES-256-GCM          |
|    - Connexion SSL                        |
|                                           |
| 3. Variables d'environnement              |
|    - AI_ENGINE_ENCRYPTION_KEY             |
|    - AI_ENGINE_ENCRYPTION_SALT            |
|    - Permissions fichier 0600            |
|                                           |
| 4. Memoire applicative                    |
|    - Cache des cles dechiffrees (5 min)   |
|    - State React formulaire (ephemere)    |
|                                           |
| 5. Reseau                                 |
|    - HTTPS (TLS 1.2+)                     |
|    - Appels aux providers (sortant)       |
+-------------------------------------------+
```

---

## 3. Chiffrement en detail

### 3.1 Algorithme : AES-256-GCM

**Pourquoi AES-256-GCM :**
- AES-256 : standard NIST, resistance quantique partielle (cle 256 bits)
- GCM (Galois/Counter Mode) : chiffrement authentifie (confidentialite + integrite)
- Performance : acceleration materielle (AES-NI) sur la majorite des CPU modernes
- Disponibilite : integre nativement dans `crypto` de Node.js

### 3.2 Derivation de cle (PBKDF2)

```
Master Key (env var) --> PBKDF2 --> Derived Key (256 bits)
                          |
                          +-- Hash : SHA-512
                          +-- Iterations : 100 000
                          +-- Salt : env var (>= 16 octets)
                          +-- Output : 32 octets
```

**Justification des parametres :**
- **100 000 iterations** : conforme aux recommandations OWASP 2024 pour PBKDF2-SHA512
- **SHA-512** : plus resistant que SHA-256 aux attaques GPU (operations 64-bit)
- **Salt en env var** : evite les rainbow tables meme si la DB est compromise

### 3.3 Generation du IV (Initialization Vector)

```
crypto.randomBytes(12) --> IV (96 bits)
```

- **12 octets (96 bits)** : taille recommandee par NIST SP 800-38D pour AES-GCM
- **Genere par CSPRNG** : `crypto.randomBytes()` utilise le generateur cryptographique du systeme
- **Unique par operation** : chaque chiffrement genere un IV different
- **Stocke avec le chiffre** : pas de probleme de reutilisation tant que le meme IV n'est pas utilise avec la meme cle

### 3.4 Tag d'authentification (AuthTag)

```
AES-GCM --> AuthTag (128 bits)
```

- **16 octets (128 bits)** : taille maximale du tag GCM
- **Stocke avec le chiffre** : necessaire pour le dechiffrement et la verification d'integrite
- **Verification automatique** : si le tag ne correspond pas lors du dechiffrement, une erreur est levee (integrite compromise)

### 3.5 Format de stockage

```
base64(iv) : base64(authTag) : base64(ciphertext)
```

Exemple pour une cle OpenAI `sk-proj-abc123...xyz789` :
```
MTIzNDU2Nzg5MDEy:YWJjZGVmZ2hpamtsbQ==:eHl6MTIzNDU2Nzg5MDEyMzQ1Njc4OQ==
```

---

## 4. Controle d'acces

### 4.1 Authentication

Toutes les routes API de gestion des cles sont protegees par `requireAdminApi()` qui :
1. Extrait le cookie de session `SESSION_COOKIE` via `cookies().get()`
2. Decode le token iron-session via `decodeSession()`
3. Verifie que la session est valide et non expiree
4. Retourne l'objet `AdminSession` avec l'email de l'administrateur

```typescript
// Extrait de apps/web/src/lib/content-studio/auth.ts
export async function requireAdminApi(): Promise<AdminSession> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await decodeSession(token);
  if (!session) {
    throw new HttpError('unauthorized', 'Session expiree. Veuillez vous reconnecter.');
  }
  return session;
}
```

### 4.2 Authorization

- Seuls les utilisateurs avec un role `admin` ont acces aux routes `/api/admin/*`
- Pas de granularite supplementaire (pas de permissions par fournisseur)
- L'email de l'admin est enregistre dans l'audit log pour tracabilite

### 4.3 Protection CSRF

- Cookies `SameSite=Strict` : les requetes cross-origin n'incluent pas le cookie de session
- Validation de l'header `Origin` sur les requetes mutatives (POST, DELETE)

### 4.4 Protection contre les sessions volees

- iron-session utilise des cookies scelles (encrypted + signed)
- TTL de session limite (configurable, par defaut 24h)
- Cookie `HttpOnly` : inaccessible depuis JavaScript (protection XSS)
- Cookie `Secure` : transmis uniquement via HTTPS

---

## 5. Audit Trail

### 5.1 Evenements journalises

Chaque operation sur les cles API genere une entree dans `ai_engine_audit_log` :

| Action | Donnees enregistrees |
|--------|---------------------|
| `api_key.created` | providerType, maskedKey, label, source=ui |
| `api_key.updated` | providerType, maskedKey, previousMaskedKey |
| `api_key.deleted` | providerType, maskedKey, fallbackAvailable |
| `api_key.tested` | providerType, result (success/failure), latencyMs, error |
| `api_key.test_rate_limited` | providerType, attemptCount, windowResetAt |
| `api_key.decryption_failed` | providerType, errorMessage (ALERTE SECURITE) |

### 5.2 Donnees JAMAIS enregistrees

- La cle API en clair
- La cle API chiffree
- La cle de chiffrement master
- Le salt de derivation
- Le contenu des reponses des fournisseurs

### 5.3 Contexte de l'audit

Chaque entree d'audit inclut :
- `actor_email` : email de l'admin (extrait de la session)
- `ip_address` : adresse IP du client (header `x-forwarded-for` ou `remoteAddress`)
- `user_agent` : User-Agent du navigateur
- `created_at` : timestamp UTC

### 5.4 Alertes automatiques

L'evenement `api_key.decryption_failed` est considere comme une alerte de securite :
- Indique potentiellement que la cle de chiffrement a ete modifiee
- Ou que les donnees en base ont ete alterees
- Devrait declencher une notification (email ou webhook, phase 2)

---

## 6. Securite en transit

### 6.1 HTTPS obligatoire

- Toutes les communications client-serveur transitent via HTTPS (TLS 1.2+)
- La cle API en clair n'est transmise que dans le body de la requete POST (creation/update)
- Les reponses ne contiennent jamais la cle en clair

### 6.2 Headers de securite

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
```

### 6.3 Pas de mise en cache des reponses

Les reponses des endpoints de gestion des cles incluent :
- `Cache-Control: no-store` pour empecher la mise en cache navigateur
- `Pragma: no-cache` pour compatibilite HTTP/1.0

---

## 7. Securite en memoire

### 7.1 Cache applicatif

Les cles dechiffrees sont cachees en memoire pour la performance :
- TTL de 5 minutes
- Cache invalide immediatement lors d'une modification (create/update/delete)
- Le cache est un `Map` en memoire (pas de persistence)

**Risque** : en cas de dump memoire du processus, les cles cachees sont accessibles en clair.
**Mitigation** : le risque est accepte car un acces a la memoire du processus implique deja un acces root au serveur, ce qui donne acces aux env vars et donc a la cle de chiffrement.

### 7.2 State React (frontend)

- La cle saisie dans le formulaire est stockee dans le state local du composant `ApiKeyForm`
- Le state est nettoye (`setApiKey('')`) a la fermeture du formulaire
- L'input utilise `type="password"` pour empecher la lecture visuelle
- L'attribut `autoComplete="off"` empeche le navigateur de sauvegarder la cle

---

## 8. Rotation des cles

### 8.1 Rotation de la cle API d'un fournisseur

**Processus :**
1. Generer une nouvelle cle API aupres du fournisseur (ex: dashboard OpenAI)
2. Saisir la nouvelle cle dans l'interface FemiGlow
3. La validation teste la nouvelle cle
4. L'ancienne cle est automatiquement desactivee
5. Revoquer l'ancienne cle dans le dashboard du fournisseur

**Duree d'indisponibilite** : aucune (la nouvelle cle est testee avant d'etre activee)

### 8.2 Rotation de la cle de chiffrement master

**Processus (manuel, phase 2 pour automatisation) :**
1. Generer une nouvelle `AI_ENGINE_ENCRYPTION_KEY`
2. Executer un script de re-chiffrement :
   - Pour chaque cle en base :
     - Dechiffrer avec l'ancienne cle
     - Re-chiffrer avec la nouvelle cle
     - Mettre a jour en base
3. Mettre a jour la variable d'environnement
4. Redemarrer l'application

```typescript
// Script de re-chiffrement (a executer manuellement)
async function rotateEncryptionKey(
  oldKey: string,
  oldSalt: string,
  newKey: string,
  newSalt: string,
): Promise<void> {
  const oldService = new EncryptionService(oldKey, oldSalt);
  const newService = new EncryptionService(newKey, newSalt);
  const database = db();
  const keys = await database.select().from(aiEngineApiKeys);
  for (const key of keys) {
    const plaintext = oldService.decrypt(key.encryptedKey);
    const newEncrypted = newService.encrypt(plaintext);
    await database
      .update(aiEngineApiKeys)
      .set({ encryptedKey: newEncrypted, updatedAt: new Date() })
      .where(eq(aiEngineApiKeys.id, key.id));
  }
}
```

---

## 9. Conformite

### 9.1 OWASP Top 10 (2021)

| Categorie OWASP | Application | Statut |
|-----------------|-------------|--------|
| A01 - Broken Access Control | requireAdminApi(), SameSite cookies | CONFORME |
| A02 - Cryptographic Failures | AES-256-GCM, PBKDF2, CSPRNG | CONFORME |
| A03 - Injection | Drizzle ORM (parametrise) | CONFORME |
| A04 - Insecure Design | Threat model STRIDE documente | CONFORME |
| A05 - Security Misconfiguration | Variables d'env documentees | CONFORME |
| A06 - Vulnerable Components | Dependances standard (crypto built-in) | CONFORME |
| A07 - Auth Failures | iron-session, session TTL | CONFORME |
| A08 - Software Integrity | Pas de CND externe pour les scripts | CONFORME |
| A09 - Logging Failures | Audit log complet sans cles en clair | CONFORME |
| A10 - SSRF | Pas d'URL user-controlled (sauf Ollama baseUrl) | PARTIEL |

### 9.2 RGPD

Les cles API ne constituent pas des donnees personnelles au sens du RGPD. Cependant :
- L'email de l'administrateur est stocke dans l'audit log (base legale : interet legitime)
- L'adresse IP est stockee dans l'audit log (base legale : interet legitime - securite)
- Retention : 365 jours (configurable)

### 9.3 PCI-DSS (non applicable)

Les cles API ne sont pas des donnees de carte de paiement. La norme PCI-DSS ne s'applique pas directement, mais les principes de chiffrement au repos et de controle d'acces sont alignes avec les exigences PCI-DSS DSS v4.0 sections 3.5 et 3.6.

---

## 10. Checklist de securite avant deploiement

- [ ] `AI_ENGINE_ENCRYPTION_KEY` generee avec `openssl rand -base64 32`
- [ ] `AI_ENGINE_ENCRYPTION_SALT` generee avec `openssl rand -base64 16`
- [ ] Variables d'environnement avec permissions fichier 0600
- [ ] HTTPS active sur tous les environnements
- [ ] Headers de securite configures (CSP, HSTS, X-Frame-Options)
- [ ] Tests de chiffrement/dechiffrement passes
- [ ] Tests de masquage passes (aucune cle en clair dans les reponses)
- [ ] Tests d'audit log passes (aucune cle en clair dans les logs)
- [ ] Rate limiting teste sur l'endpoint de test
- [ ] Revue de code securite effectuee
- [ ] Penetration test (optionnel mais recommande)
- [ ] Procedure de rotation de la cle master documentee
- [ ] Backup de la cle master dans un endroit securise (hors serveur)

---

## 11. Reponse aux incidents

### 11.1 Cle API compromise

1. Supprimer immediatement la cle via l'interface admin
2. Revoquer la cle dans le dashboard du fournisseur
3. Generer et configurer une nouvelle cle
4. Verifier les logs d'utilisation du fournisseur pour detecter un usage abusif
5. Documenter l'incident dans l'audit log

### 11.2 Cle de chiffrement master compromise

1. Generer immediatement une nouvelle `AI_ENGINE_ENCRYPTION_KEY` et `AI_ENGINE_ENCRYPTION_SALT`
2. Executer le script de re-chiffrement (section 8.2)
3. Redemarrer l'application
4. Revoquer et remplacer toutes les cles API des fournisseurs (par precaution)
5. Auditer les acces a la base de donnees

### 11.3 Base de donnees compromise

1. Evaluer l'etendue de la compromission
2. Les cles API sont chiffrees : elles sont inutilisables sans `AI_ENGINE_ENCRYPTION_KEY`
3. Par precaution, revoquer et remplacer toutes les cles API
4. Executer la rotation de la cle master
5. Renforcer les controles d'acces a la base de donnees
