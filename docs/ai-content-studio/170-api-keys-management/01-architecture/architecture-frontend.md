# Architecture Frontend - Gestion des Cles API

> Module : 170 - API Keys Management
> Couche : Frontend (React / Next.js App Router)
> Date : 2026-05-25

---

## 1. Vue d'ensemble

L'interface de gestion des cles API s'integre comme un nouvel onglet dans la page de configuration existante du AI Engine :

```
/admin/content-studio-v2/ai-engine/config
  +-- Onglet "Fournisseurs"     (existant)
  +-- Onglet "Workflows"        (existant)
  +-- Onglet "Prompts"          (existant)
  +-- Onglet "Cles API"         (NOUVEAU)
```

### 1.1 Modification du type Tab

```typescript
// Avant
type Tab = 'providers' | 'workflows' | 'prompts';

// Apres
type Tab = 'providers' | 'workflows' | 'prompts' | 'api-keys';
```

### 1.2 Ajout dans la navigation par onglets

Un nouvel onglet avec l'icone `Key` de lucide-react est ajoute a la liste `tabs` dans le composant `AIEngineConfigPage`.

---

## 2. Arborescence des composants

```
config/page.tsx (modifie)
  |
  +-- ApiKeysTab
       |
       +-- ApiKeyCard (x5, un par fournisseur)
       |    |
       |    +-- KeyMaskDisplay
       |    +-- ApiKeyStatusIndicator
       |    +-- ActionButtons (Tester / Editer / Supprimer)
       |
       +-- ApiKeyForm (conditionnel, affiché en inline)
            |
            +-- ProviderSelect
            +-- SecureKeyInput
            +-- ValidationFeedback
```

---

## 3. Composant ApiKeysTab

### 3.1 Responsabilites

- Afficher la grille de cartes de cles API (une par fournisseur)
- Gerer l'etat global du CRUD (loading, error, success)
- Orchestrer l'ouverture/fermeture du formulaire d'ajout/edition
- Gerer les appels API vers les routes backend

### 3.2 State local

```typescript
interface ApiKeysTabState {
  // Donnees
  apiKeys: ApiKeyData[];
  loading: boolean;
  error: string | null;

  // Formulaire
  showForm: boolean;
  formMode: 'create' | 'edit';
  formProvider: string | null;

  // Actions
  testingProvider: string | null;
  deletingId: string | null;
  saving: boolean;
}

interface ApiKeyData {
  id: string;
  providerType: string;
  providerName: string;
  maskedKey: string;
  keyPrefix: string | null;
  source: 'database' | 'env' | 'none';
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 3.3 Logique de chargement

```typescript
// Appel API au montage
const fetchApiKeys = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/admin/ai-engine/config/api-keys');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setApiKeys(data.keys);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Erreur inconnue');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);
```

---

## 4. Affichage masque des cles (KeyMaskDisplay)

### 4.1 Principe

Les cles API ne sont **jamais** envoyees en clair par l'API. Le backend renvoie uniquement une version masquee (`maskedKey`) qui est affichee telle quelle dans le composant.

### 4.2 Format d'affichage

```
Fournisseur    Affichage masque        Format
---------      ----------------        ------
OpenAI         sk-proj-...AbCd         prefixe detecte + 4 derniers chars
Anthropic      sk-ant-...XyZw          prefixe detecte + 4 derniers chars
Google AI      AIza...1234             prefixe detecte + 4 derniers chars
ElevenLabs     ****...5678             4 etoiles + 4 derniers chars
Ollama         http...1434             URL masquee
```

### 4.3 Implementation du composant

```typescript
interface KeyMaskDisplayProps {
  maskedKey: string;
  source: 'database' | 'env' | 'none';
}

function KeyMaskDisplay({ maskedKey, source }: KeyMaskDisplayProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--cs-font-mono)',
      fontSize: 'var(--cs-text-sm)',
    }}>
      <span style={{
        padding: '4px 10px',
        borderRadius: 'var(--cs-radius-sm)',
        background: 'var(--cs-bg-sunken)',
        color: 'var(--cs-fg-primary)',
        letterSpacing: '0.02em',
      }}>
        {maskedKey}
      </span>
      <Badge
        tone={source === 'database' ? 'accent' : source === 'env' ? 'neutral' : 'warning'}
        size="sm"
      >
        {source === 'database' ? 'Base de donnees' : source === 'env' ? 'Env var' : 'Non configuree'}
      </Badge>
    </div>
  );
}
```

---

## 5. Indicateur de statut (ApiKeyStatusIndicator)

### 5.1 Etats visuels

| Statut | Couleur | Icone | Label |
|--------|---------|-------|-------|
| `success` | `var(--cs-success)` | `CheckCircle2` | "Valide" |
| `failure` | `var(--cs-danger)` | `AlertTriangle` | "Invalide" |
| `untested` | `var(--cs-fg-muted)` | `HelpCircle` | "Non testee" |
| `testing` | `var(--cs-accent)` | `Loader2` (spin) | "Test en cours..." |
| `none` | `var(--cs-border)` | `MinusCircle` | "Non configuree" |

### 5.2 Composant

```typescript
interface ApiKeyStatusIndicatorProps {
  status: 'success' | 'failure' | 'untested' | 'testing' | 'none';
  lastTestedAt?: string | null;
  error?: string | null;
}
```

L'indicateur affiche egalement le temps ecoule depuis le dernier test ("Teste il y a 2h") sous le statut principal.

---

## 6. Formulaire securise (ApiKeyForm)

### 6.1 Principes de securite du formulaire

1. **Input de type password** : le champ de saisie de la cle est de type `password` pour eviter le shoulder surfing
2. **Toggle de visibilite** : un bouton oeil permet de reveler temporairement la cle (auto-masquage apres 5 secondes)
3. **Pas de copie dans le state global** : la cle n'est stockee que dans le state local du formulaire
4. **Nettoyage a la fermeture** : le state du formulaire est reinitialise a la fermeture (clear de la cle en memoire)
5. **Pas d'autocomplete** : attribut `autoComplete="off"` sur l'input
6. **Pas de paste event log** : aucun evenement de collage n'est logue

### 6.2 Champs du formulaire

| Champ | Type | Requis | Validation |
|-------|------|--------|-----------|
| Fournisseur | Select | Oui | Liste fixe des 5 fournisseurs |
| Cle API | Password input | Oui | min 10 chars, prefixe valide si applicable |
| Label | Text input | Non | max 100 chars |
| URL de base | Text input | Ollama uniquement | URL valide |

### 6.3 Validation cote client

```typescript
const apiKeyValidation: Record<string, (key: string) => string | null> = {
  openai: (key) => {
    if (!key.startsWith('sk-')) return 'La cle OpenAI doit commencer par "sk-"';
    if (key.length < 20) return 'La cle semble trop courte';
    return null;
  },
  anthropic: (key) => {
    if (!key.startsWith('sk-ant-')) return 'La cle Anthropic doit commencer par "sk-ant-"';
    if (key.length < 20) return 'La cle semble trop courte';
    return null;
  },
  google: (key) => {
    if (!key.startsWith('AIza')) return 'La cle Google AI doit commencer par "AIza"';
    if (key.length < 20) return 'La cle semble trop courte';
    return null;
  },
  elevenlabs: (key) => {
    if (key.length < 10) return 'La cle semble trop courte';
    return null;
  },
  ollama: (_key) => null, // Ollama n'a pas de cle API, juste une URL
};
```

### 6.4 Flow de soumission

```
1. Validation client (format de la cle)
   |-- Echec -> Afficher l'erreur sous le champ
   |-- Succes -> Continuer
2. Envoi au backend POST /api/admin/ai-engine/config/api-keys
   |-- Le backend chiffre et sauvegarde
   |-- Le backend teste la validite
3. Attente de la reponse
   |-- Succes -> Toast "Cle configuree avec succes"
   |             Fermer le formulaire
   |             Recharger la liste des cles
   |-- Echec validation -> Afficher "La cle est invalide : [erreur]"
   |-- Echec serveur -> Afficher "Erreur serveur : [message]"
4. Nettoyage du state du formulaire
```

---

## 7. Gestion du formulaire inline

### 7.1 Ouverture en mode creation

- Clic sur le bouton "Ajouter une cle" en haut de l'onglet
- Le formulaire s'affiche au-dessus de la grille de cartes
- Le champ "Fournisseur" est un select avec uniquement les fournisseurs qui n'ont pas de cle DB active

### 7.2 Ouverture en mode edition

- Clic sur le bouton "Editer" dans la carte d'un fournisseur
- Le formulaire s'affiche en remplacement de la carte (inline, comme les ProviderCard existants)
- Le champ "Fournisseur" est pre-selectionne et desactive (non modifiable)
- Le champ "Cle API" est vide avec un placeholder "Entrer la nouvelle cle..."

### 7.3 Confirmation de suppression

- Clic sur le bouton "Supprimer" dans la carte d'un fournisseur
- Une modale/dialog de confirmation s'affiche :
  - "Supprimer la cle API pour {provider} ?"
  - "La variable d'environnement prendra le relais si configuree."
  - Boutons "Annuler" et "Supprimer" (rouge)

---

## 8. Etats de chargement et erreurs

### 8.1 Squelette de chargement

Pendant le chargement initial, 5 squelettes de cartes sont affiches avec l'animation `cs-shimmer` existante.

### 8.2 Etat d'erreur

En cas d'erreur de chargement, le meme composant d'erreur que les autres onglets est reutilise (fond rouge, icone AlertTriangle, bouton "Reessayer").

### 8.3 Etat vide

Si aucune cle n'est configuree (ni DB ni env), un `EmptyState` est affiche :
- Icone : `Key`
- Titre : "Aucune cle API configuree"
- Description : "Ajoutez vos cles API pour activer les fournisseurs IA. Les cles sont chiffrees et securisees."
- CTA : Bouton "Ajouter une cle"

---

## 9. Integration avec le design system CS v2

### 9.1 Tokens utilises

| Token | Utilisation |
|-------|-----------|
| `--cs-bg-elevated` | Fond des cartes |
| `--cs-bg-sunken` | Fond des champs masques |
| `--cs-border-hair` | Bordures legeres |
| `--cs-accent` | Couleur principale (terracotta) |
| `--cs-success` | Indicateur cle valide |
| `--cs-danger` | Indicateur cle invalide |
| `--cs-warning` | Indicateur cle non testee |
| `--cs-font-mono` | Affichage des cles masquees |
| `--cs-font-display` | Titres et labels |
| `--cs-radius-md` | Coins des cartes |
| `--cs-shadow-sm` | Ombre des cartes |

### 9.2 Coherence avec les ProviderCard existantes

Les `ApiKeyCard` reprennent la meme structure visuelle que les `ProviderCard` existantes :
- Barre de statut coloree en haut (3px)
- Layout header avec icone + nom + badge statut
- Section centrale avec les infos
- Footer avec boutons d'action

### 9.3 Responsive

La grille de cartes utilise `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` comme les cartes fournisseurs existantes.

---

## 10. Accessibilite (a11y)

### 10.1 Navigation clavier

- Tab pour naviguer entre les cartes et boutons
- Enter pour activer les boutons
- Escape pour fermer le formulaire
- Le formulaire trap le focus quand ouvert

### 10.2 Attributs ARIA

```html
<input
  type="password"
  aria-label="Cle API pour {provider}"
  aria-describedby="api-key-help-{provider}"
  autoComplete="off"
/>
<button
  aria-label="Afficher la cle"
  aria-pressed="{visible}"
/>
<div role="status" aria-live="polite">
  {testResult}
</div>
```

### 10.3 Lecteurs d'ecran

- Les statuts de test sont annonces via `aria-live="polite"`
- Les cles masquees sont lues comme "Cle masquee se terminant par AbCd"
- Les messages d'erreur sont associes au champ via `aria-describedby`
