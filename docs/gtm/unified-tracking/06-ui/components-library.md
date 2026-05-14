# Librairie de composants tracking

## 1. StatusCard

```tsx
interface StatusCardProps {
  plan: TrackingPlanSummary;
  sync: SyncStatus;
  className?: string;
}
```

Visuel :

```
┌──────────────────────────────┐
│ ● Plan actif                 │
│ Production v8                │
│ Activé 12/05 par amal@...    │
│                              │
│ 4 outils · 18 événements     │
│ bundleId: abc123...          │
│                              │
│ [Modifier]  [Voir détails]   │
└──────────────────────────────┘
```

- Liseré gauche sauge (status OK), ambre (warning), rouge (critical).
- `bundleId` cliquable → copy clipboard.

## 2. ProviderCard

```tsx
interface ProviderCardProps {
  kind: 'ga4' | 'googleAds' | 'meta' | 'tiktok' | 'snapchat' | 'pinterest';
  config: ProviderConfig;
  onChange: (patch: Partial<ProviderConfig>) => void;
  validationErrors?: ValidationIssue[];
}
```

Visuel :

```
┌──────────────────────────────────┐
│ [logo] Meta Pixel       [ON ▢]   │
│ ───────────────────────────────  │
│ Pixel ID                         │
│ [1234567890123456     ] [auto]   │
│ ⚠ Cet ID ressemble à un          │
│   placeholder (cf. validation)   │
│                                  │
│ CAPI Token (optionnel)            │
│ [••••••••••••••       ] [revert]  │
│                                  │
│ Test event code                   │
│ [                     ]           │
└──────────────────────────────────┘
```

- Logo provider en haut à gauche.
- Switch on/off à droite (désactive l'envoi mais garde la config).
- Badge `auto` si la valeur est pré-remplie depuis defaults.
- Bouton `revert` si l'admin a modifié la valeur auto-remplie.
- Warning rouge en bas de chaque champ avec erreur.

## 3. EventMatrixRow

```tsx
interface EventMatrixRowProps {
  eventName: string;
  event: EventConfig;
  enabledProviders: ProviderKind[];
  onChange: (patch: Partial<EventConfig>) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}
```

Visuel collapsed :

```
┌────────────────────────────────────────────────────────────────────────┐
│ ☑ lead_form_submit          GA4✓  Ads✓ lead  Meta✓ Lead   TT–          │
└────────────────────────────────────────────────────────────────────────┘
```

Visuel expanded :

```
┌────────────────────────────────────────────────────────────────────────┐
│ ☑ lead_form_submit                                              [▴]    │
│ Soumission du formulaire de capture lead (wizard step 1)               │
│                                                                        │
│ GA4         ☑ envoyer comme    [generate_lead         ] standard       │
│             Params : currency, value                                   │
│                                                                        │
│ Ads         ☑ envoyer comme conversion [lead-form-MAD ] lead           │
│                                                                        │
│ Meta        ☑ envoyer comme    [Lead                  ] standard       │
│                                                                        │
│ TikTok      ☐ envoyer comme    [SubmitForm            ] (provider off) │
│                                                                        │
│ Consent     ☑ ad_storage requis    ☑ analytics_storage requis          │
└────────────────────────────────────────────────────────────────────────┘
```

## 4. IdInput

```tsx
interface IdInputProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  validate?: (value: string) => string | null;
  autocomplete?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
}
```

Comportements :
- Validation regex inline avec error message.
- Détection placeholder → warning rouge "Ressemble à une valeur de démo".
- Badge `auto-rempli` si `value === autocomplete`.
- Bouton revert si `value !== autocomplete && autocomplete`.
- Copy button au focus.

## 5. JsonPreview

```tsx
interface JsonPreviewProps {
  json: unknown;
  highlight?: string;        // chemin à highlighter (ex: "containerVersion.tag[3]")
  collapsible?: boolean;     // expand/collapse récursif
  searchable?: boolean;      // barre de recherche
  maxHeight?: string;        // CSS height
}
```

- Syntax highlight (couleurs depuis design system).
- Numéros de ligne.
- Boutons : Copy, Download as .json, Expand all, Collapse all.
- Recherche en temps réel (Ctrl+F intercepté).

## 6. DiffViewer

```tsx
interface DiffViewerProps {
  left: { label: string; plan: TrackingPlan };
  right: { label: string; plan: TrackingPlan };
  mode?: 'split' | 'inline';
}
```

- Split (côte à côte) ou inline (rouge/vert).
- Synthèse en haut : `+ 2 events, ~ 3 mappings, - 1 provider`.
- Click sur une ligne → focus sur champ correspondant dans l'éditeur (si même page).

## 7. ValidationBadge

```tsx
interface ValidationBadgeProps {
  errors: number;
  warnings?: number;
  onClick?: () => void;
}
```

Visuels :

| Cas | Badge |
|---|---|
| 0 errors, 0 warnings | `✓ Validé` (vert sauge) |
| 0 errors, N warnings | `⚠ N avertissement(s)` (ambre) |
| N errors | `✗ N erreur(s)` (rouge) |

## 8. SyncStatusBanner

```tsx
interface SyncStatusBannerProps {
  status: 'ok' | 'warning' | 'critical';
  reasons?: DriftReason[];
  onAction?: () => void;
}
```

Bandeau en haut de la page admin tracking :

- OK : pas affiché.
- Warning ambre : `⚠ Drift mineur détecté — vérifier le container GTM` + bouton "Détails".
- Critical rouge : `✗ Le tracking client diverge de la version active` + bouton "Comprendre".

## 9. WizardShell

```tsx
interface WizardShellProps {
  steps: { number: number; title: string; isVisited: boolean }[];
  currentStep: number;
  onStepChange: (step: number) => void;
  children: ReactNode;
}
```

Header stepper + main area + footer nav.

```
[ 1 ─── 2 ─── 3 ─── ● 4 ─── 5 ]   Étape 4 sur 5
                                                          
   ─────────────── Main area (children) ───────────────────
                                                          
                                  [← Retour]  [Continuer →]
```

- Click sur step déjà visité = navigation directe.
- Click sur step futur = bloqué.
- Footer collante en bas.

## 10. HelpTooltip

```tsx
interface HelpTooltipProps {
  trigger?: ReactNode; // défaut = icône `?`
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}
```

Popover sur hover/click. Contenu enrichi (peut contenir liens, illustrations).

## 11. ConsentBadge

```tsx
interface ConsentBadgeProps {
  requiresAdStorage: boolean;
  requiresAnalyticsStorage: boolean;
  size?: 'sm' | 'md';
}
```

Compact :
```
[🔒 ad+analytics]   ← si les deux requis
[📊 analytics]      ← analytics seul
[—]                 ← aucun (rare)
```
