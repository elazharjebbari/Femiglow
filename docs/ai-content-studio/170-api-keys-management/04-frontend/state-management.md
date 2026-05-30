# Gestion de l'etat (State Management) - Cles API

> Module : 170 - API Keys Management
> Framework : React 18 (useState/useCallback/useEffect)
> Date : 2026-05-25

---

## 1. Architecture de l'etat

L'etat est gere exclusivement via `useState` et `useCallback` dans le composant parent `AIEngineConfigPage`, conformement au pattern existant (pas de store global, pas de React Query, pas de Zustand).

### 1.1 Diagramme de l'etat

```
AIEngineConfigPage (page.tsx)
  |
  |-- Etat existant (inchange)
  |   |-- tab: Tab
  |   |-- loading: boolean
  |   |-- error: string | null
  |   |-- providers: ProviderData[]
  |   |-- workflows: WorkflowData[]
  |   |-- prompts: PromptData[]
  |   |-- testingProvider: string | null
  |   |-- (workflow form state)
  |   |-- (prompt form state)
  |
  |-- Nouvel etat (API Keys)
  |   |-- apiKeys: ApiKeyData[]
  |   |-- loadingKeys: boolean
  |   |-- keysError: string | null
  |   |-- showApiKeyForm: boolean
  |   |-- apiKeyFormMode: 'create' | 'edit'
  |   |-- apiKeyFormProvider: string | null
  |   |-- apiKeyFormLabel: string | null
  |   |-- savingApiKey: boolean
  |   |-- testingApiKeyProvider: string | null
  |   |-- deletingApiKeyId: string | null
  |
  |-- ApiKeyForm (state local)
  |   |-- selectedProvider: string
  |   |-- apiKey: string          <-- SENSIBLE (nettoyee a la fermeture)
  |   |-- label: string
  |   |-- baseUrl: string
  |   |-- keyVisible: boolean
  |   |-- validationError: string | null
  |
  +-- ApiKeyCard (pas de state significatif)
```

---

## 2. Cycle de vie de l'etat

### 2.1 Chargement initial

```
1. L'utilisateur selectionne l'onglet "Cles API"
2. useEffect detecte tab === 'api-keys'
3. fetchApiKeys() est appele
4. loadingKeys = true
5. GET /api/admin/ai-engine/config/api-keys
6. Succes : apiKeys = data.keys, loadingKeys = false
7. Echec : keysError = message, loadingKeys = false
```

### 2.2 Creation d'une cle

```
1. Clic "Ajouter une cle"
   -> showApiKeyForm = true, apiKeyFormMode = 'create'

2. Remplissage du formulaire (state local ApiKeyForm)
   -> selectedProvider, apiKey, label, baseUrl

3. Clic "Sauvegarder et tester"
   -> savingApiKey = true

4. POST /api/admin/ai-engine/config/api-keys
   -> Attente de la reponse

5a. Succes :
   -> toast.success()
   -> showApiKeyForm = false
   -> fetchApiKeys() (recharge la liste)
   -> savingApiKey = false
   -> ApiKeyForm cleanup : apiKey = '' (nettoyage securite)

5b. Echec validation (422) :
   -> toast.error() avec le message du serveur
   -> savingApiKey = false
   -> formulaire reste ouvert avec l'erreur

5c. Echec serveur (500) :
   -> toast.error()
   -> savingApiKey = false
```

### 2.3 Test d'une cle

```
1. Clic "Tester" sur une carte
   -> testingApiKeyProvider = providerType

2. POST /api/admin/ai-engine/config/api-keys/test
   -> ApiKeyCard affiche le spinner

3a. Succes :
   -> testingApiKeyProvider = null
   -> fetchApiKeys() (pour mettre a jour le lastTestResult)

3b. Echec :
   -> testingApiKeyProvider = null
   -> fetchApiKeys()
   -> Le statut "failure" est affiche par la carte
```

### 2.4 Suppression d'une cle

```
1. Clic "Supprimer" sur une carte
   -> window.confirm() ou dialog

2. Si confirme :
   -> deletingApiKeyId = id

3. DELETE /api/admin/ai-engine/config/api-keys/{id}

4a. Succes :
   -> toast.success() avec info fallback
   -> deletingApiKeyId = null
   -> fetchApiKeys()

4b. Echec :
   -> toast.error()
   -> deletingApiKeyId = null
```

---

## 3. Considerations de securite de l'etat

### 3.1 La cle API en clair dans le state React

**Probleme** : pendant la saisie du formulaire, la cle API est stockee en clair dans `useState` du composant `ApiKeyForm`.

**Mitigations** :
1. **State local uniquement** : la cle est dans le state du composant enfant `ApiKeyForm`, pas dans le composant parent
2. **Nettoyage a la fermeture** : `useEffect` cleanup reinitialise `apiKey` a `''`
3. **Nettoyage au unmount** : si le composant est demonte, le state est garbage-collected
4. **Pas de persistence** : pas de localStorage, pas de sessionStorage, pas de cookie
5. **Pas de logging** : la cle n'est jamais logguee dans la console
6. **Duree minimale** : la cle n'existe en memoire que pendant la saisie

### 3.2 Code de nettoyage

```typescript
// Dans ApiKeyForm
useEffect(() => {
  // Cleanup quand le composant est demonte
  return () => {
    setApiKey('');       // Effacer la cle
    setKeyVisible(false); // Masquer
  };
}, []);

// Apres soumission reussie (dans le parent)
const handleSaveApiKey = useCallback(async (data) => {
  setSavingApiKey(true);
  try {
    const res = await fetch('/api/admin/ai-engine/config/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // ... gestion de la reponse
    setShowApiKeyForm(false); // Demonte ApiKeyForm -> cleanup
  } finally {
    setSavingApiKey(false);
  }
}, []);
```

### 3.3 Pas de cle dans les reponses API

Les reponses du GET `/api/admin/ai-engine/config/api-keys` ne contiennent **jamais** :
- `encryptedKey` (le chiffre)
- `apiKey` (la cle en clair)

Seul `maskedKey` est retourne, ce qui est une donnee non sensible.

### 3.4 Protection contre les DevTools

Les React DevTools permettent d'inspecter le state des composants. Cela signifie qu'un utilisateur ayant les DevTools ouvertes pendant la saisie peut voir la cle.

**Mitigation** : ce risque est accepte car :
- L'utilisateur a deja la cle (il est en train de la saisir)
- L'acces aux DevTools implique un acces local a la machine
- Le state est nettoye des que le formulaire est ferme

---

## 4. Pattern de gestion d'erreurs

### 4.1 Erreurs de chargement

```typescript
// Affichage dans l'UI (meme pattern que les autres onglets)
if (keysError) {
  return (
    <section style={{
      background: 'var(--cs-danger-bg)',
      border: '1px solid var(--cs-danger)',
      borderRadius: 'var(--cs-radius-md)',
      padding: 32,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <AlertTriangle size={20} style={{ color: 'var(--cs-danger)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--cs-text-sm)' }}>
          Impossible de charger les cles API
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--cs-text-sm)', color: 'var(--cs-fg-secondary)' }}>
          {keysError}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={fetchApiKeys} leftIcon={<RefreshCw size={12} />}>
        Reessayer
      </Button>
    </section>
  );
}
```

### 4.2 Erreurs de sauvegarde

```typescript
// Gestion via toast (sonner)
try {
  const res = await fetch(...);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 422 && errorBody.code === 'VALIDATION_FAILED') {
      toast.error(`Cle invalide : ${errorBody.details?.validationError ?? 'erreur inconnue'}`);
    } else {
      toast.error(errorBody.error ?? `Erreur HTTP ${res.status}`);
    }
    return;
  }
  // Succes...
} catch (e) {
  toast.error('Erreur reseau. Verifiez votre connexion.');
}
```

### 4.3 Erreurs de rate limit

```typescript
if (res.status === 429) {
  toast.error('Trop de tests. Reessayez dans 1 minute.');
  return;
}
```

---

## 5. Optimisation du rendu

### 5.1 Chargement paresseux

Les cles API ne sont chargees que lorsque l'onglet "Cles API" est selectionne :

```typescript
useEffect(() => {
  if (tab === 'api-keys' && apiKeys.length === 0) {
    fetchApiKeys();
  }
}, [tab]);
```

### 5.2 Memoization des callbacks

Tous les handlers sont wrapes dans `useCallback` pour eviter les re-renders inutiles des composants enfants :

```typescript
const handleTestApiKey = useCallback(async (providerType: string) => {
  setTestingApiKeyProvider(providerType);
  try {
    await fetch('/api/admin/ai-engine/config/api-keys/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerType }),
    });
    await fetchApiKeys();
  } finally {
    setTestingApiKeyProvider(null);
  }
}, [fetchApiKeys]);
```

### 5.3 Pas de re-fetch inutile

Apres une operation CRUD, seul `fetchApiKeys()` est appele (pas de reload complet de la page). Les autres onglets (providers, workflows, prompts) ne sont pas recharges.

---

## 6. Flux de donnees complet

```
                        +-----------+
                        |  API Keys |
                        |  Backend  |
                        +-----------+
                         ^    |    ^
                    POST |    | GET  | DELETE/POST test
                         |    v    |
                  +------+----+----+------+
                  |   fetchApiKeys()       |
                  |   handleSaveApiKey()   |
                  |   handleDeleteApiKey() |
                  |   handleTestApiKey()   |
                  +------+--------+-------+
                         |        |
              setState() v        v setState()
                  +------+--------+-------+
                  |  AIEngineConfigPage    |
                  |  (parent state)        |
                  |  - apiKeys[]           |
                  |  - showApiKeyForm      |
                  |  - testingProvider     |
                  |  - deletingId          |
                  +---+-----+-----+-------+
                      |     |     |
               props  v     v     v  props
              +-------+ +-------+ +-------+
              | Card1 | | Card2 | | Form  |
              | (OAI) | | (Ant) | | (loc) |
              +-------+ +-------+ +-------+
                                     |
                              local state
                              - apiKey (SENSIBLE)
                              - keyVisible
                              - validationError
```
