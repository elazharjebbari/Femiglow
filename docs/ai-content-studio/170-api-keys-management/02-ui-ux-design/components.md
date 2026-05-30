# Decomposition des composants UI - Gestion des Cles API

> Module : 170 - API Keys Management
> Framework : React 18 (Next.js 14 App Router, client components)
> Date : 2026-05-25

---

## 1. Arbre de composants

```
AIEngineConfigPage (page.tsx - MODIFIE)
  |
  +-- [tab === 'api-keys']
       |
       +-- ApiKeysTab
            |
            +-- ApiKeyForm (conditionnel)
            |    |
            |    +-- ProviderSelect (select natif style)
            |    +-- SecureKeyInput
            |    |    +-- EyeToggle
            |    +-- ValidationHint
            |
            +-- ApiKeyCard (x5, map sur les fournisseurs)
                 |
                 +-- KeyMaskDisplay
                 +-- ApiKeyStatusIndicator
                 +-- SourceBadge
                 +-- TimeAgo
                 +-- ActionButtons
                      +-- TestButton
                      +-- EditButton
                      +-- DeleteButton
```

---

## 2. Composant ApiKeyCard

### 2.1 Localisation
```
apps/web/src/app/admin/content-studio-v2/ai-engine/config/page.tsx
(composant inline dans le fichier, comme ProviderCard existant)
```

### 2.2 Props

```typescript
interface ApiKeyCardProps {
  /** Donnees de la cle API pour ce fournisseur */
  keyData: ApiKeyData;
  /** Callback lors du clic sur "Tester" */
  onTest: (providerType: string) => void;
  /** Callback lors du clic sur "Editer" */
  onEdit: (providerType: string) => void;
  /** Callback lors du clic sur "Supprimer" */
  onDelete: (id: string) => void;
  /** Callback lors du clic sur "Configurer" (pour les fournisseurs non configures) */
  onConfigure: (providerType: string) => void;
  /** Indique si un test est en cours pour cette carte */
  testing: boolean;
  /** Indique si une suppression est en cours pour cette carte */
  deleting: boolean;
}
```

### 2.3 States internes

```typescript
// Aucun state interne significatif
// L'etat de l'edition est gere par le parent (ApiKeysTab)
```

### 2.4 Rendu conditionnel

| Condition | Rendu |
|-----------|-------|
| `source === 'none'` | Carte grisee avec bouton "Configurer" |
| `source === 'database'` | Carte complete avec "Editer" + "Supprimer" + "Tester" |
| `source === 'env'` | Carte complete avec "Tester" uniquement (pas d'edit/delete sur env) |
| `testing === true` | Spinner sur le bouton "Tester" |
| `deleting === true` | Spinner sur le bouton "Supprimer" |

### 2.5 Structure HTML

```
div.api-key-card
  |-- div.status-bar (3px, couleur selon statut)
  |-- div.card-body
       |-- div.header
       |    |-- div.provider-info
       |    |    |-- span.provider-icon (Cpu)
       |    |    |-- span.provider-indicator (dot vert/gris)
       |    |    |-- div.provider-name
       |    |    +-- div.provider-subtitle (source + date)
       |    +-- ApiKeyStatusIndicator
       |
       |-- div.key-display
       |    +-- KeyMaskDisplay
       |
       |-- div.meta-info
       |    |-- span.last-tested ("Teste il y a 2h")
       |    +-- span.configured-date ("Configure le ...")
       |
       +-- div.actions
            |-- TestButton
            |-- EditButton (si source === 'database')
            +-- DeleteButton (si source === 'database')
```

### 2.6 Evenements

| Evenement | Declencheur | Action |
|-----------|-------------|--------|
| `onClick` sur TestButton | Clic utilisateur | Appelle `onTest(providerType)` |
| `onClick` sur EditButton | Clic utilisateur | Appelle `onEdit(providerType)` |
| `onClick` sur DeleteButton | Clic utilisateur | Affiche dialog de confirmation, puis `onDelete(id)` |
| `onClick` sur ConfigureButton | Clic utilisateur | Appelle `onConfigure(providerType)` |

---

## 3. Composant ApiKeyForm

### 3.1 Props

```typescript
interface ApiKeyFormProps {
  /** Mode du formulaire */
  mode: 'create' | 'edit';
  /** Type de fournisseur pre-selectionne (pour l'edition) */
  providerType?: string;
  /** Label existant (pour l'edition) */
  existingLabel?: string;
  /** URL de base existante (pour Ollama en edition) */
  existingBaseUrl?: string;
  /** Liste des fournisseurs deja configures en DB (pour filtrer le select en creation) */
  configuredProviders: string[];
  /** Callback a la soumission */
  onSave: (data: ApiKeyFormSubmission) => Promise<void>;
  /** Callback a l'annulation */
  onCancel: () => void;
  /** Indique si la sauvegarde est en cours */
  saving: boolean;
}

interface ApiKeyFormSubmission {
  providerType: string;
  apiKey: string;
  label?: string;
  baseUrl?: string;
}
```

### 3.2 States internes

```typescript
const [selectedProvider, setSelectedProvider] = useState<string>(
  props.providerType ?? ''
);
const [apiKey, setApiKey] = useState<string>('');
const [label, setLabel] = useState<string>(props.existingLabel ?? '');
const [baseUrl, setBaseUrl] = useState<string>(props.existingBaseUrl ?? '');
const [keyVisible, setKeyVisible] = useState<boolean>(false);
const [validationError, setValidationError] = useState<string | null>(null);
const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
```

### 3.3 Logique de validation

```typescript
// Validation executee a chaque changement du champ apiKey
useEffect(() => {
  if (!apiKey || !selectedProvider) {
    setValidationError(null);
    return;
  }
  const validate = apiKeyValidation[selectedProvider];
  if (validate) {
    setValidationError(validate(apiKey));
  }
}, [apiKey, selectedProvider]);
```

### 3.4 Logique d'auto-masquage

```typescript
// Quand la visibilite est activee, masquer apres 5 secondes
useEffect(() => {
  if (keyVisible) {
    const timer = setTimeout(() => {
      setKeyVisible(false);
    }, 5000);
    setAutoHideTimer(timer);
    return () => clearTimeout(timer);
  }
}, [keyVisible]);
```

### 3.5 Nettoyage a la fermeture

```typescript
// Nettoyer le state a la fermeture du formulaire
useEffect(() => {
  return () => {
    setApiKey('');       // Effacer la cle de la memoire
    setKeyVisible(false);
    if (autoHideTimer) clearTimeout(autoHideTimer);
  };
}, []);
```

### 3.6 Soumission

```typescript
async function handleSubmit() {
  // 1. Validation finale
  if (!selectedProvider || !apiKey) return;
  const error = apiKeyValidation[selectedProvider]?.(apiKey);
  if (error) {
    setValidationError(error);
    return;
  }
  // 2. Soumettre au parent
  await props.onSave({
    providerType: selectedProvider,
    apiKey,
    label: label || undefined,
    baseUrl: baseUrl || undefined,
  });
  // 3. Nettoyage (le parent ferme le formulaire)
  setApiKey('');
}
```

---

## 4. Composant ApiKeyStatusIndicator

### 4.1 Props

```typescript
interface ApiKeyStatusIndicatorProps {
  /** Statut actuel de la cle */
  status: 'success' | 'failure' | 'untested' | 'testing' | 'none';
  /** Date du dernier test */
  lastTestedAt?: string | null;
  /** Message d'erreur du dernier test */
  error?: string | null;
}
```

### 4.2 States internes

Aucun (composant purement presentationnel).

### 4.3 Mapping statut -> rendu

```typescript
const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: 'var(--cs-success)',
    bgColor: 'var(--cs-success-bg)',
    label: 'Valide',
  },
  failure: {
    icon: AlertTriangle,
    color: 'var(--cs-danger)',
    bgColor: 'var(--cs-danger-bg)',
    label: 'Invalide',
  },
  untested: {
    icon: HelpCircle,
    color: 'var(--cs-fg-muted)',
    bgColor: 'var(--cs-bg-sunken)',
    label: 'Non testee',
  },
  testing: {
    icon: Loader2,
    color: 'var(--cs-accent)',
    bgColor: 'var(--cs-accent-bg)',
    label: 'Test en cours...',
  },
  none: {
    icon: MinusCircle,
    color: 'var(--cs-border)',
    bgColor: 'var(--cs-bg-sunken)',
    label: 'Non configuree',
  },
};
```

### 4.4 Structure HTML

```
div.status-indicator
  |-- Icon (dynamique selon statut)
  |-- span.status-label (ex: "Valide")
```

Style : badge arrondi avec fond colore et texte en correspondance.

---

## 5. Composant KeyMaskDisplay

### 5.1 Props

```typescript
interface KeyMaskDisplayProps {
  /** Cle masquee a afficher (ex: "sk-proj-...AbCd") */
  maskedKey: string;
  /** Source de la cle */
  source: 'database' | 'env' | 'none';
  /** Nom de la variable d'environnement (affiche si source === 'env') */
  envVarName?: string;
}
```

### 5.2 States internes

Aucun (composant purement presentationnel).

### 5.3 Structure HTML

```
div.key-mask-display
  |-- span.masked-key (font mono, fond sunken)
  |-- Badge (source : "Base de donnees" ou "Env var" ou "Non configuree")
  +-- [si source === 'env'] span.env-var-name (petite police, couleur muted)
```

### 5.4 Accessibilite

```html
<span
  aria-label="Cle masquee se terminant par {last4chars}"
  role="text"
>
  {maskedKey}
</span>
```

---

## 6. Composant SecureKeyInput (interne a ApiKeyForm)

### 6.1 Props

```typescript
interface SecureKeyInputProps {
  /** Valeur du champ */
  value: string;
  /** Callback de changement */
  onChange: (value: string) => void;
  /** Placeholder */
  placeholder: string;
  /** Indique si le champ est desactive */
  disabled: boolean;
  /** Message d'erreur de validation */
  error?: string | null;
  /** Message d'aide contextuel */
  hint?: string;
  /** Label du champ */
  label: string;
  /** ID du fournisseur pour l'aria-describedby */
  providerId: string;
}
```

### 6.2 States internes

```typescript
const [visible, setVisible] = useState(false);
const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);
```

### 6.3 Structure HTML

```html
<div>
  <label style={fieldLabelStyle}>{label}</label>
  <div style={{ position: 'relative' }}>
    <input
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-describedby={`key-help-${providerId}`}
      aria-invalid={!!error}
      style={fieldInputStyle}
    />
    <button
      type="button"
      onClick={toggleVisibility}
      aria-label={visible ? 'Masquer la cle' : 'Afficher la cle'}
      aria-pressed={visible}
      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
    >
      {visible ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  </div>
  {error && (
    <p style={{ color: 'var(--cs-danger)', fontSize: 'var(--cs-text-xs)' }}>
      {error}
    </p>
  )}
  {hint && !error && (
    <p id={`key-help-${providerId}`} style={{ color: 'var(--cs-fg-muted)', fontSize: 'var(--cs-text-xs)' }}>
      {hint}
    </p>
  )}
</div>
```

---

## 7. Composant TimeAgo (utilitaire)

### 7.1 Props

```typescript
interface TimeAgoProps {
  /** Date ISO string */
  date: string | null;
  /** Prefixe du texte */
  prefix?: string;
  /** Texte si la date est null */
  fallback?: string;
}
```

### 7.2 Logique

```typescript
function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'a l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(date).toLocaleDateString('fr-FR');
}
```

### 7.3 Rendu

```
<span style={{ fontSize: 'var(--cs-text-xs)', color: 'var(--cs-fg-muted)' }}>
  {prefix} {formatTimeAgo(date)}
</span>
```

---

## 8. Interactions entre composants

### 8.1 Flow "Ajouter une cle"

```
1. ApiKeysTab : utilisateur clique "Ajouter une cle"
   -> setShowForm(true), setFormMode('create')
2. ApiKeyForm : rendu avec mode='create'
   -> Select fournisseur filtre (exclut ceux deja en DB)
3. ApiKeyForm : utilisateur remplit le formulaire et soumet
   -> onSave({ providerType, apiKey, label })
4. ApiKeysTab : appelle POST /api/admin/ai-engine/config/api-keys
   -> setSaving(true)
5. ApiKeysTab : reponse OK
   -> toast.success(), setShowForm(false), fetchApiKeys()
6. ApiKeysTab : reponse erreur
   -> toast.error() ou afficher l'erreur dans le formulaire
```

### 8.2 Flow "Tester une cle"

```
1. ApiKeyCard : utilisateur clique "Tester"
   -> onTest(providerType)
2. ApiKeysTab : setTestingProvider(providerType)
3. ApiKeyCard : testing=true -> spinner sur le bouton, statut "Test en cours..."
4. ApiKeysTab : appelle POST /api/admin/ai-engine/config/api-keys/test
5. ApiKeysTab : reponse recue
   -> setTestingProvider(null), fetchApiKeys()
6. ApiKeyCard : mise a jour du statut (Valide/Invalide)
```

### 8.3 Flow "Supprimer une cle"

```
1. ApiKeyCard : utilisateur clique "Supprimer"
   -> onDelete(id)
2. ApiKeysTab : affiche window.confirm() ou Dialog
3. Si confirme : appelle DELETE /api/admin/ai-engine/config/api-keys/{id}
   -> setDeletingId(id)
4. ApiKeysTab : reponse OK
   -> toast avec info sur le fallback, fetchApiKeys()
5. ApiKeyCard : carte mise a jour (source passe de 'database' a 'env' ou 'none')
```

---

## 9. Diagramme de flux des etats du formulaire

```
[Ferme]
  |
  | clic "Ajouter" ou "Editer"
  v
[Ouvert - Vide/Pre-rempli]
  |
  | saisie
  v
[Ouvert - Validation en cours]
  |
  +-- erreur de format -> [Ouvert - Erreur affichee]
  |                          |
  |                          | correction
  |                          v
  +-- format valide   -> [Ouvert - Pret a soumettre]
                            |
                            | clic "Sauvegarder et tester"
                            v
                         [Ouvert - Envoi en cours]
                            |
                            +-- succes -> [Ferme] + toast succes
                            |
                            +-- erreur validation provider
                            |     -> [Ouvert - Erreur serveur]
                            |          |
                            |          | correction + re-soumission
                            |          v
                            |        [Ouvert - Envoi en cours]
                            |
                            +-- erreur serveur -> toast erreur
                                                   [Ouvert - Erreur serveur]
```
