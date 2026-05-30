# 170 - Gestion des Cles API - Vue d'ensemble

> Feature : API Keys Management pour le AI Engine FemiGlow
> Statut : A implementer
> Date de creation : 2026-05-25
> Priorite : Haute (pre-requis securite pour la mise en production)

---

## 1. Objectif

La fonctionnalite **Gestion des Cles API** permet aux administrateurs FemiGlow de configurer, stocker et gerer les cles d'acces aux fournisseurs IA (OpenAI, Anthropic, Google AI, ElevenLabs, Ollama) directement depuis l'interface d'administration du Content Studio v2, sans necessite de modifier les variables d'environnement serveur.

### 1.1 Probleme actuel

Aujourd'hui, les cles API sont exclusivement chargees depuis les variables d'environnement via `engine-config.ts` avec une chaine de resolution hierarchique :

```
openai:     AI_ENGINE_OPENAI_API_KEY || CONTENT_STUDIO_OPENAI_API_KEY || CHAT_OPENAI_API_KEY || OPENAI_API_KEY
anthropic:  AI_ENGINE_ANTHROPIC_API_KEY || CHAT_ANTHROPIC_API_KEY
google:     AI_ENGINE_GOOGLE_API_KEY || CHAT_GEMINI_API_KEY
elevenlabs: AI_ENGINE_ELEVENLABS_API_KEY
ollama:     AI_ENGINE_OLLAMA_BASE_URL || CHAT_OLLAMA_BASE_URL
```

Cette approche presente plusieurs limites :
- **Acces serveur requis** : toute modification necessite un acces SSH ou une redeploiement
- **Pas d'audit** : aucune trace de qui a modifie quelle cle et quand
- **Pas de test** : impossible de valider une cle avant de l'activer
- **Pas de rotation** : aucun mecanisme pour faire tourner les cles facilement
- **Risque de partage** : les memes variables d'environnement sont partagees entre AI Engine, Chat et Content Studio

### 1.2 Solution proposee

Un systeme complet de gestion des cles API avec :
- **Stockage chiffre en base de donnees** (AES-256-GCM) dans une nouvelle table `ai_engine_api_keys`
- **Interface d'administration** dans l'onglet "Cles API" de la page de configuration
- **Validation en temps reel** : test de connectivite avant sauvegarde
- **Masquage systematique** : les cles ne sont jamais exposees en clair dans le frontend
- **Audit trail** : journalisation de toutes les operations sur les cles
- **Chaine de resolution configurable** : DB > env vars (par defaut) ou l'inverse

---

## 2. Perimetre (Scope)

### 2.1 Dans le perimetre (In Scope)

| Composant | Description |
|-----------|-------------|
| Table `ai_engine_api_keys` | Nouvelle table Drizzle pour le stockage chiffre des cles |
| Service `EncryptionService` | Chiffrement/dechiffrement AES-256-GCM avec derivation de cle |
| Service `ApiKeyManager` | CRUD des cles, resolution, validation |
| Route GET `/api/admin/ai-engine/config/api-keys` | Liste les cles (masquees) |
| Route POST `/api/admin/ai-engine/config/api-keys` | Cree ou met a jour une cle |
| Route DELETE `/api/admin/ai-engine/config/api-keys/[id]` | Supprime une cle |
| Route POST `/api/admin/ai-engine/config/api-keys/test` | Teste la validite d'une cle |
| Composant `ApiKeysTab` | Onglet UI dans la page de configuration |
| Composant `ApiKeyCard` | Carte d'affichage d'une cle avec statut |
| Composant `ApiKeyForm` | Formulaire d'ajout/edition de cle |
| Integration `getEngineConfig()` | Modification pour supporter la resolution DB + env |
| Audit logging | Journalisation des operations CRUD sur les cles |
| Migration Drizzle | Script de migration pour la nouvelle table |

### 2.2 Hors perimetre (Out of Scope)

| Element | Raison |
|---------|--------|
| Rotation automatique des cles | Phase 2 - necessite integration avec les APIs providers |
| Gestion multi-tenant des cles | Architecture mono-tenant actuelle |
| Import/export de cles | Risque de securite trop eleve |
| Cles par workflow | Complexite prematuree, a evaluer apres usage |
| Vault externe (HashiCorp, AWS KMS) | Overkill pour le volume actuel, envisageable Phase 2 |
| Cles OAuth2 / tokens bearer | Seules les API keys statiques sont gerees |

---

## 3. Modele de securite

### 3.1 Principes fondamentaux

1. **Chiffrement au repos** : toutes les cles sont chiffrees avec AES-256-GCM avant stockage en base
2. **Jamais en clair dans le frontend** : seuls les 4 derniers caracteres sont visibles (`sk-...AbCd`)
3. **Cle de chiffrement derivee** : utilisation de PBKDF2 avec un secret d'application (`AI_ENGINE_ENCRYPTION_KEY`)
4. **IV unique par cle** : chaque operation de chiffrement utilise un IV aleatoire de 12 octets
5. **AuthTag stocke** : le tag d'authentification GCM est stocke avec le chiffre pour garantir l'integrite
6. **Acces admin uniquement** : toutes les routes sont protegees par `requireAdminApi()`
7. **Rate limiting** : les endpoints de test sont limites a 5 requetes/minute
8. **Audit complet** : chaque operation (create, update, delete, test) est journalisee

### 3.2 Menaces adressees

| Menace | Mitigation |
|--------|-----------|
| Vol de base de donnees | Cles chiffrees AES-256-GCM, inutilisables sans la cle de chiffrement |
| Interception reseau | HTTPS obligatoire + cles jamais transmises en clair dans les reponses |
| Acces non autorise | `requireAdminApi()` + iron-session sealed cookies |
| Injection SQL | Drizzle ORM (requetes parametrees) |
| Brute force test endpoint | Rate limiting 5 req/min |
| Fuite dans les logs | Les cles ne sont jamais logguees en clair |
| XSS | Les cles ne sont jamais stockees dans le state React plus longtemps que necessaire |

---

## 4. User Stories

### US-170.1 : Voir les cles API configurees
**En tant qu'** administratrice FemiGlow,
**je veux** voir la liste des cles API configurees avec leur statut,
**afin de** savoir quels fournisseurs IA sont operationnels.

**Criteres d'acceptation :**
- [ ] La liste affiche tous les 5 fournisseurs (OpenAI, Anthropic, Google, ElevenLabs, Ollama)
- [ ] Chaque cle affiche : nom du fournisseur, statut (configuree/non configuree), source (DB/env), date de derniere modification
- [ ] Les cles sont masquees : seuls les 4 derniers caracteres sont visibles
- [ ] Un indicateur visuel montre si la cle est valide (dernier test reussi)

### US-170.2 : Ajouter une cle API
**En tant qu'** administratrice FemiGlow,
**je veux** ajouter une cle API pour un fournisseur directement depuis l'interface,
**afin de** configurer un nouveau fournisseur IA sans modifier les variables d'environnement.

**Criteres d'acceptation :**
- [ ] Un formulaire permet de selectionner le fournisseur et saisir la cle
- [ ] La cle est validee avant sauvegarde (test de connectivite)
- [ ] Si la validation echoue, un message d'erreur explicite est affiche
- [ ] La cle est chiffree avant stockage en base de donnees
- [ ] Un toast de confirmation s'affiche apres sauvegarde reussie
- [ ] L'evenement est journalise dans l'audit log

### US-170.3 : Modifier une cle API existante
**En tant qu'** administratrice FemiGlow,
**je veux** mettre a jour une cle API existante,
**afin de** remplacer une cle expiree ou compromise.

**Criteres d'acceptation :**
- [ ] Le formulaire d'edition pre-remplit le fournisseur (non modifiable)
- [ ] L'ancienne cle n'est jamais affichee en clair
- [ ] Un placeholder masque indique qu'une cle existe deja
- [ ] La nouvelle cle est validee avant de remplacer l'ancienne
- [ ] L'evenement est journalise avec mention "update"

### US-170.4 : Supprimer une cle API
**En tant qu'** administratrice FemiGlow,
**je veux** supprimer une cle API stockee en base,
**afin de** revoquer l'acces ou revenir aux variables d'environnement.

**Criteres d'acceptation :**
- [ ] Une confirmation est demandee avant suppression ("Etes-vous sure ?")
- [ ] Le message de confirmation indique si une variable d'environnement prendra le relais
- [ ] Apres suppression, le statut du fournisseur se met a jour (env var ou non configure)
- [ ] L'evenement est journalise avec mention "delete"

### US-170.5 : Tester une cle API
**En tant qu'** administratrice FemiGlow,
**je veux** tester la validite d'une cle API,
**afin de** m'assurer que le fournisseur est accessible avant de l'utiliser en production.

**Criteres d'acceptation :**
- [ ] Un bouton "Tester" est disponible pour chaque cle configuree
- [ ] Le test effectue un appel minimal au fournisseur (models/list ou equivalent)
- [ ] Le resultat est affiche : succes (vert) ou echec (rouge avec detail de l'erreur)
- [ ] Le statut de sante du fournisseur est mis a jour apres le test
- [ ] Le test est rate-limite a 5 executions par minute

### US-170.6 : Resoudre la cle active pour un fournisseur
**En tant que** systeme (AI Engine),
**je veux** resoudre la cle API a utiliser pour un fournisseur selon la priorite configuree,
**afin de** toujours utiliser la source la plus appropriee (DB ou env var).

**Criteres d'acceptation :**
- [ ] Par defaut, la cle en DB a priorite sur la variable d'environnement
- [ ] Si aucune cle DB n'existe, la chaine env var existante est utilisee (compatibilite ascendante)
- [ ] Si ni la DB ni les env vars ne contiennent de cle, le fournisseur est marque "non configure"
- [ ] Le comportement est transparent pour les services consommateurs (interface identique)

---

## 5. Criteres d'acceptation globaux

### 5.1 Fonctionnels
- [ ] Les 5 fournisseurs sont geres : OpenAI, Anthropic, Google AI, ElevenLabs, Ollama
- [ ] Le CRUD complet fonctionne (Create, Read, Update, Delete)
- [ ] Le test de validite fonctionne pour chaque fournisseur
- [ ] La chaine de resolution DB > env fonctionne correctement
- [ ] L'UI est coherente avec le design system CS v2 (palette ivory/terracotta)
- [ ] Les formulaires sont accessibles (navigation clavier, aria-labels)

### 5.2 Securite
- [ ] Toutes les cles sont chiffrees AES-256-GCM en base
- [ ] Les cles ne sont jamais exposees en clair dans les reponses API
- [ ] Les cles ne sont jamais logguees en clair
- [ ] L'audit log enregistre toutes les operations
- [ ] Les endpoints sont proteges par `requireAdminApi()`
- [ ] L'endpoint de test est rate-limite

### 5.3 Performance
- [ ] Le dechiffrement d'une cle prend < 5ms
- [ ] La page de configuration charge les cles en < 200ms
- [ ] Le test de connectivite repond en < 10s (timeout)

### 5.4 Tests
- [ ] Couverture Vitest >= 90% pour les services d'encryption et de gestion des cles
- [ ] Tests E2E Playwright pour les flux CRUD complets
- [ ] Tests de securite pour le masquage et le chiffrement

---

## 6. Dependances

### 6.1 Dependances techniques
| Dependance | Usage | Statut |
|-----------|-------|--------|
| `crypto` (Node.js built-in) | AES-256-GCM, PBKDF2, randomBytes | Disponible |
| Drizzle ORM | Schema et queries | Disponible |
| PostgreSQL | Stockage des cles chiffrees | Disponible |
| Zod | Validation des schemas API | Disponible |
| iron-session | Authentification admin | Disponible |
| sonner (toast) | Notifications UI | Disponible |
| lucide-react | Icones | Disponible |

### 6.2 Dependances fonctionnelles
| Dependance | Description |
|-----------|-------------|
| `engine-config.ts` | Fichier a modifier pour integrer la resolution DB |
| `schema-ai-engine.ts` | Fichier a etendre avec la nouvelle table |
| `config/page.tsx` | Page a modifier pour ajouter l'onglet "Cles API" |
| `ai-engine-handlers.ts` (MSW) | Handlers mock a creer pour les tests |

### 6.3 Variable d'environnement requise
| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `AI_ENGINE_ENCRYPTION_KEY` | Cle de chiffrement principale (>= 32 caracteres) | Oui |
| `AI_ENGINE_ENCRYPTION_SALT` | Salt pour PBKDF2 (>= 16 caracteres) | Oui |

---

## 7. Risques et mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|-----------|
| Perte de la cle de chiffrement | Toutes les cles API inaccessibles | Faible | Documentation de la procedure de backup de `AI_ENGINE_ENCRYPTION_KEY` |
| Cle API compromise | Acces non autorise aux services IA | Moyen | Audit log + possibilite de suppression rapide |
| Migration DB echoue | Table non creee | Faible | Migration reversible + test en staging |
| Test de validite trop lent | UX degradee | Moyen | Timeout de 10s + indicateur de chargement |
| Conflit DB/env vars | Cle incorrecte utilisee | Moyen | Indicateur visuel de la source active + documentation claire |

---

## 8. Metriques de succes

| Metrique | Objectif | Methode de mesure |
|----------|----------|-------------------|
| Temps de configuration d'un fournisseur | < 2 minutes | Chronometrage UX |
| Taux d'erreurs de configuration | < 5% | Audit log |
| Couverture de test | >= 90% | Vitest coverage |
| Temps de dechiffrement | < 5ms | Performance tests |
| Zero fuite de cles en clair | 0 incident | Security review |

---

## 9. Arborescence des fichiers a creer/modifier

```
apps/web/src/
  lib/
    ai-engine/
      config/
        engine-config.ts                    # MODIFIER - ajouter resolution DB
      services/
        encryption-service.ts               # CREER - AES-256-GCM
        api-key-manager.ts                  # CREER - CRUD + resolution
        api-key-validator.ts                # CREER - test connectivite providers
    db/
      schema-ai-engine.ts                   # MODIFIER - ajouter table ai_engine_api_keys
      migrations/
        XXXX_add_api_keys_table.sql         # CREER - migration SQL
  app/
    api/admin/ai-engine/config/
      api-keys/
        route.ts                            # CREER - GET + POST
        [id]/
          route.ts                          # CREER - DELETE
        test/
          route.ts                          # CREER - POST (test validite)
    admin/content-studio-v2/ai-engine/config/
      page.tsx                              # MODIFIER - ajouter onglet "Cles API"
  components/admin/content-studio-v2/
    ai-engine/
      ApiKeyCard.tsx                        # CREER
      ApiKeyForm.tsx                        # CREER
      ApiKeyStatusIndicator.tsx             # CREER
      KeyMaskDisplay.tsx                    # CREER
  test/
    msw/
      ai-engine-handlers.ts                # MODIFIER - ajouter handlers api-keys
```
