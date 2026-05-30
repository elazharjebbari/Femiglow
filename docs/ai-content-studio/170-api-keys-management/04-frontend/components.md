# Composants Frontend - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : React 18 / Next.js 14 (client components)
> Date : 2026-05-25

---

## 1. Vue d'ensemble

Tous les composants sont implementes en **inline** dans le fichier `page.tsx` de la configuration, conformement au pattern existant (`ProviderCard`, `WorkflowCard`, `PromptCard`). Aucun fichier de composant separe n'est cree pour cette phase.

### 1.1 Fichier modifie
```
apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx
```

### 1.2 Nouveaux composants (inline dans page.tsx)

| Composant | Type | Description |
|-----------|------|-------------|
| `ApiKeyCard` | Presentationnel + interactif | Carte d'affichage d'une cle par fournisseur |
| `ApiKeyForm` | Formulaire | Ajout/edition d'une cle API |
| `ApiKeyStatusIndicator` | Presentationnel | Badge de statut (valide/invalide/...) |
| `KeyMaskDisplay` | Presentationnel | Affichage masque de la cle |
| `DeleteKeyDialog` | Interactif | Confirmation de suppression |

---

## 2. ApiKeysTab (section principale)

### 2.1 Emplacement dans page.tsx

Ajoute dans le rendu conditionnel du composant `AIEngineConfigPage`, apres l'onglet `prompts` :

```typescript
{/* API Keys Tab */}
{tab === 'api-keys' && (
  <ApiKeysTabContent
    apiKeys={apiKeys}
    loading={loadingKeys}
    error={keysError}
    // ... handlers
  />
)}
```

### 2.2 Types de donnees

```typescript
interface ApiKeyData {
  id: string | null;
  providerType: string;
  providerName: string;
  label: string | null;
  maskedKey: string | null;
  keyPrefix: string | null;
  source: 'database' | 'env' | 'none';
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestError: string | null;
  expiresAt: string | null;
  envVarName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
```

### 2.3 State ajoute au composant AIEngineConfigPage

```typescript
// Ajouter au type Tab
type Tab = 'providers' | 'workflows' | 'prompts' | 'api-keys';

// Nouveaux states
const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
const [loadingKeys, setLoadingKeys] = useState(false);
const [keysError, setKeysError] = useState<string | null>(null);
const [showApiKeyForm, setShowApiKeyForm] = useState(false);
const [apiKeyFormMode, setApiKeyFormMode] = useState<'create' | 'edit'>('create');
const [apiKeyFormProvider, setApiKeyFormProvider] = useState<string | null>(null);
const [savingApiKey, setSavingApiKey] = useState(false);
const [testingApiKeyProvider, setTestingApiKeyProvider] = useState<string | null>(null);
const [deletingApiKeyId, setDeletingApiKeyId] = useState<string | null>(null);
```

### 2.4 Chargement des donnees

```typescript
const fetchApiKeys = useCallback(async () => {
  setLoadingKeys(true);
  setKeysError(null);
  try {
    const res = await fetch('/api/admin/ai-engine/config/api-keys');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setApiKeys(data.keys ?? []);
  } catch (e) {
    setKeysError(e instanceof Error ? e.message : 'Erreur inconnue');
  } finally {
    setLoadingKeys(false);
  }
}, []);

// Charger quand l'onglet api-keys est selectionne
useEffect(() => {
  if (tab === 'api-keys') {
    fetchApiKeys();
  }
}, [tab, fetchApiKeys]);
```

---

## 3. ApiKeyCard - Specification detaillee

### 3.1 Signature

```typescript
function ApiKeyCard({
  keyData,
  onTest,
  onEdit,
  onDelete,
  onConfigure,
  testing,
  deleting,
}: {
  keyData: ApiKeyData;
  onTest: (providerType: string) => void;
  onEdit: (providerType: string) => void;
  onDelete: (id: string) => void;
  onConfigure: (providerType: string) => void;
  testing: boolean;
  deleting: boolean;
}) {
  // ...
}
```

### 3.2 Structure complete du JSX

```typescript
return (
  <div style={{
    background: 'var(--cs-bg-elevated)',
    border: `1px solid ${keyData.source !== 'none' ? 'var(--cs-border-hair)' : 'var(--cs-border)'}`,
    borderRadius: 'var(--cs-radius-md)',
    overflow: 'hidden',
    opacity: keyData.source !== 'none' ? 1 : 0.55,
    transition: 'all var(--cs-motion-base) var(--cs-easing)',
    boxShadow: 'var(--cs-shadow-sm)',
  }}>
    {/* Barre de statut (3px) */}
    <div style={{
      height: 3,
      background: statusBarColor(keyData),
      transition: 'background var(--cs-motion-base) var(--cs-easing)',
    }} />

    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header : icone + nom + badge statut */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Gauche : icone + nom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProviderIcon providerType={keyData.providerType} configured={keyData.source !== 'none'} />
          <div>
            <div style={{ fontFamily: 'var(--cs-font-display)', fontWeight: 500, fontSize: 'var(--cs-text-base)' }}>
              {keyData.providerName}
            </div>
            {keyData.label && (
              <div style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)', marginTop: 1 }}>
                {keyData.label}
              </div>
            )}
          </div>
        </div>
        {/* Droite : indicateur de statut */}
        <ApiKeyStatusIndicator
          status={testing ? 'testing' : keyData.source === 'none' ? 'none' : keyData.lastTestResult}
          lastTestedAt={keyData.lastTestedAt}
          error={keyData.lastTestError}
        />
      </div>

      {/* Affichage de la cle masquee */}
      {keyData.source !== 'none' ? (
        <KeyMaskDisplay
          maskedKey={keyData.maskedKey!}
          source={keyData.source}
          envVarName={keyData.envVarName}
        />
      ) : (
        <div style={{
          fontSize: 'var(--cs-text-sm)',
          color: 'var(--cs-fg-muted)',
          fontStyle: 'italic',
          padding: '8px 0',
        }}>
          Aucune cle configuree
        </div>
      )}

      {/* Meta-informations */}
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
        {keyData.lastTestedAt && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Activity size={10} />
            Teste {formatTimeAgo(keyData.lastTestedAt)}
          </span>
        )}
        {keyData.createdAt && keyData.source === 'database' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Shield size={10} />
            Configure {formatTimeAgo(keyData.createdAt)}
          </span>
        )}
        {keyData.source === 'env' && keyData.envVarName && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Source : {keyData.envVarName}
          </span>
        )}
      </div>

      {/* Boutons d'action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 4 }}>
        {keyData.source === 'none' ? (
          <Button variant="primary" size="sm" leftIcon={<Plus size={11} />} onClick={() => onConfigure(keyData.providerType)}>
            Configurer
          </Button>
        ) : (
          <>
            {keyData.source === 'database' && (
              <>
                <Button variant="ghost" size="sm" leftIcon={<Pencil size={11} />} onClick={() => onEdit(keyData.providerType)}>
                  Editer
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={deleting ? <Loader2 size={11} className="cs-spin" /> : <Trash2 size={11} />}
                  disabled={deleting}
                  onClick={() => {
                    if (keyData.id && window.confirm(`Supprimer la cle API pour ${keyData.providerName} ?`)) {
                      onDelete(keyData.id);
                    }
                  }}
                >
                  Supprimer
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw size={11} className={testing ? 'cs-spin' : ''} />}
              onClick={() => onTest(keyData.providerType)}
              disabled={testing}
            >
              Tester
            </Button>
          </>
        )}
      </div>
    </div>
  </div>
);
```

### 3.3 Fonction utilitaire de couleur de barre

```typescript
function statusBarColor(keyData: ApiKeyData): string {
  if (keyData.source === 'none') return 'var(--cs-border)';
  if (keyData.lastTestResult === 'success') return 'var(--cs-success)';
  if (keyData.lastTestResult === 'failure') return 'var(--cs-danger)';
  return 'var(--cs-warning)'; // untested
}
```

---

## 4. ApiKeyForm - Specification detaillee

### 4.1 Signature

```typescript
function ApiKeyForm({
  mode,
  providerType,
  existingLabel,
  configuredDbProviders,
  onSave,
  onCancel,
  saving,
}: {
  mode: 'create' | 'edit';
  providerType: string | null;
  existingLabel: string | null;
  configuredDbProviders: string[];
  onSave: (data: { providerType: string; apiKey: string; label?: string; baseUrl?: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  // ...
}
```

### 4.2 Constantes du formulaire

```typescript
const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI (Gemini)' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'ollama', label: 'Ollama (local)' },
];

const PROVIDER_KEY_HINTS: Record<string, string> = {
  openai: 'Doit commencer par "sk-"',
  anthropic: 'Doit commencer par "sk-ant-"',
  google: 'Doit commencer par "AIza"',
  elevenlabs: 'Minimum 10 caracteres',
  ollama: 'URL de base (ex: http://localhost:11434)',
};

const PROVIDER_KEY_PLACEHOLDERS: Record<string, string> = {
  openai: 'sk-proj-...',
  anthropic: 'sk-ant-api03-...',
  google: 'AIzaSy...',
  elevenlabs: 'Votre cle API ElevenLabs...',
  ollama: 'http://localhost:11434',
};
```

### 4.3 States internes et logique

```typescript
const [selectedProvider, setSelectedProvider] = useState(providerType ?? '');
const [apiKey, setApiKey] = useState('');
const [label, setLabel] = useState(existingLabel ?? '');
const [baseUrl, setBaseUrl] = useState('');
const [keyVisible, setKeyVisible] = useState(false);
const [validationError, setValidationError] = useState<string | null>(null);

// Validation en temps reel
useEffect(() => {
  if (!apiKey || !selectedProvider) {
    setValidationError(null);
    return;
  }
  const validator = apiKeyValidation[selectedProvider];
  setValidationError(validator ? validator(apiKey) : null);
}, [apiKey, selectedProvider]);

// Auto-masquage apres 5s
useEffect(() => {
  if (!keyVisible) return;
  const timer = setTimeout(() => setKeyVisible(false), 5000);
  return () => clearTimeout(timer);
}, [keyVisible]);

// Nettoyage a la fermeture
useEffect(() => {
  return () => { setApiKey(''); setKeyVisible(false); };
}, []);

// Fournisseurs disponibles pour creation
const availableProviders = mode === 'create'
  ? PROVIDER_OPTIONS.filter(p => !configuredDbProviders.includes(p.value))
  : PROVIDER_OPTIONS;

const isOllama = selectedProvider === 'ollama';
const canSubmit = !saving && selectedProvider && apiKey && !validationError;
```

### 4.4 Rendu du formulaire

Le formulaire reutilise exactement les memes styles inline (`formBoxStyle`, `fieldLabelStyle`, `fieldInputStyle`) que `WorkflowForm` et `PromptForm` existants pour la coherence visuelle.

---

## 5. ApiKeyStatusIndicator

### 5.1 Implementation complete

```typescript
function ApiKeyStatusIndicator({
  status,
  lastTestedAt,
  error,
}: {
  status: 'success' | 'failure' | 'untested' | 'testing' | 'none';
  lastTestedAt?: string | null;
  error?: string | null;
}) {
  const config = {
    success:  { icon: CheckCircle2, color: 'var(--cs-success)',  bg: 'var(--cs-success-bg)', label: 'Valide' },
    failure:  { icon: AlertTriangle, color: 'var(--cs-danger)',  bg: 'var(--cs-danger-bg)',  label: 'Invalide' },
    untested: { icon: HelpCircle,   color: 'var(--cs-fg-muted)', bg: 'var(--cs-bg-sunken)',  label: 'Non testee' },
    testing:  { icon: Loader2,      color: 'var(--cs-accent)',   bg: 'var(--cs-accent-bg)',  label: 'Test en cours...' },
    none:     { icon: MinusCircle,  color: 'var(--cs-border)',   bg: 'var(--cs-bg-sunken)',  label: 'Non configuree' },
  }[status];

  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--cs-radius-full)',
        background: config.bg,
        fontSize: 'var(--cs-text-xs)',
        fontWeight: 500,
        color: config.color,
      }}
    >
      <Icon size={10} className={status === 'testing' ? 'cs-spin' : ''} />
      {config.label}
    </div>
  );
}
```

---

## 6. KeyMaskDisplay

### 6.1 Implementation complete

```typescript
function KeyMaskDisplay({
  maskedKey,
  source,
  envVarName,
}: {
  maskedKey: string;
  source: 'database' | 'env';
  envVarName?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        aria-label={`Cle masquee : ${maskedKey}`}
        style={{
          fontFamily: 'var(--cs-font-mono)',
          fontSize: 'var(--cs-text-sm)',
          fontWeight: 500,
          padding: '5px 12px',
          borderRadius: 'var(--cs-radius-sm)',
          background: 'var(--cs-bg-sunken)',
          color: 'var(--cs-fg-primary)',
          letterSpacing: '0.02em',
        }}
      >
        {maskedKey}
      </span>
      <Badge
        tone={source === 'database' ? 'accent' : 'neutral'}
        size="sm"
      >
        {source === 'database' ? 'Base de donnees' : 'Env var'}
      </Badge>
    </div>
  );
}
```

---

## 7. Icones provider

### 7.1 Imports lucide-react supplementaires

```typescript
import {
  // ... imports existants
  Key,          // Icone onglet "Cles API"
  EyeOff,       // Toggle visibilite (masque)
  Eye,          // Toggle visibilite (visible)
  HelpCircle,   // Statut "non testee"
  MinusCircle,  // Statut "non configuree"
} from 'lucide-react';
```

### 7.2 Composant ProviderIcon (reutilise le style de ProviderCard)

```typescript
function ProviderIcon({ providerType, configured }: { providerType: string; configured: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--cs-radius)',
        background: configured ? 'var(--cs-accent-bg)' : 'var(--cs-bg-sunken)',
        color: configured ? 'var(--cs-accent)' : 'var(--cs-fg-muted)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 18,
      }}>
        <Key size={20} />
      </span>
      <span style={{
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 10,
        height: 10,
        borderRadius: 'var(--cs-radius-full)',
        border: '2px solid var(--cs-bg-elevated)',
        background: configured ? 'var(--cs-success)' : 'var(--cs-fg-muted)',
      }} />
    </div>
  );
}
```

---

## 8. Modification du tab navigation

### 8.1 Ajout de l'onglet

```typescript
const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
  { key: 'providers', label: 'Fournisseurs', icon: <Cpu size={14} />, count: providers.length },
  { key: 'workflows', label: 'Workflows', icon: <GitBranch size={14} />, count: workflows.length },
  { key: 'prompts', label: 'Prompts', icon: <FileText size={14} />, count: prompts.length },
  { key: 'api-keys', label: 'Cles API', icon: <Key size={14} />, count: apiKeys.filter(k => k.source !== 'none').length },
];
```

### 8.2 Ajout a la stat card

```typescript
// Remplacer ou ajouter une stat card pour les cles API
<StatCard
  icon={<Key size={18} />}
  value={`${apiKeys.filter(k => k.source !== 'none').length}/5`}
  label="Cles configurees"
  accent="var(--cs-clay)"
/>
```
