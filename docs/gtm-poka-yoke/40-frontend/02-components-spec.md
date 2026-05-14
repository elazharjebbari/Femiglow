# Spécification des composants frontend

## `DriftBanner`

**Rôle** : Bandeau global d'alerte, en haut de toutes les pages `/admin/*`.

**Props** :
```ts
type DriftBannerProps = {
  status: 'warning' | 'critical';
  topReason: {
    code: string;
    expected?: string;
    got?: string;
    humanMessage: string;
  };
  linkTo: string;  // toujours /admin/tracking/gtm/sync-status
};
```

**Comportement** :
- Non rendu si `status === 'ok'`.
- Coloration : `critical` = rouge foncé, `warning` = orange.
- CTA : "Voir détails →" qui pointe vers `linkTo`.
- Persistant (pas dismissible) tant que `status !== 'ok'`.
- A11y : `role="alert"`, `aria-live="polite"`.

**Wireframe ASCII** :
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🚨  GTM exécute le mapping v16 alors que v17 est actif côté admin.        │
│     Importer la config GTM v4 et publier.        [Voir détails →]          │
└────────────────────────────────────────────────────────────────────────────┘
```

## `SyncStatusView`

**Rôle** : Vue principale de l'état Poka-Yoke.

**Props** :
```ts
type SyncStatusViewProps = {
  data: SyncStatusPayload;  // cf. API spec
  onRefreshRequested?: () => void;
};
```

**Layout** :
- Header avec statut global (badge vert/orange/rouge) + dernière maj.
- Grid 3 colonnes (cards) : Mapping, Config, Bundle.
- Section "Drift actuel" si pas `ok`.
- `PingTimeline` 30 jours.
- Liste des "Dernières transitions" (5 plus récentes).

## `SyncCard`

**Rôle** : Une card unique (Mapping / Config / Bundle ID).

**Props** :
```ts
type SyncCardProps = {
  title: string;          // "Mapping vendors"
  adminValue: string;     // "v17"
  runtimeValue: string;   // "v17"
  match: boolean;
  subtitle?: string;      // "actif depuis 3j"
  icon?: ReactNode;
};
```

**Wireframe ASCII** :
```
┌──────────────────────────────────────┐
│ Mapping vendors                      │
│ ──────────────────────────────────── │
│ Côté admin :       v17 ✓             │
│ Côté GTM runtime : v17 ✓             │
│                                      │
│ ✅ Cohérent depuis 3j                │
└──────────────────────────────────────┘
```

## `PingTimeline`

**Rôle** : Visualiser les pings/jour sur 30 jours.

**Props** :
```ts
type PingTimelineProps = {
  days: Array<{
    day: string;          // YYYY-MM-DD
    pingsCount: number;
    driftDetected: boolean;
  }>;
};
```

**Implémentation** : Pas de lib de graph. Une simple grid CSS de divs avec `height: ${(count / max) * 100}%`.

**Wireframe** :
```
Pings / jour
                                              ▄ ▄ █ █ ▄ ▄ ▄ ▄ █
                                          ▄ ▄ █ █ █ █ █ █ █ █ █
                                  ▄ ▄ ▄ ▄ █ █ █ █ █ █ █ █ █ █ █
                          ▄ ▄ ▄ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
                  ▄ ▄ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █ █
13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 ...    13
            ↑ drift résolu                  ↑ aujourd'hui
```

Couleur de la barre :
- Vert si `!driftDetected`
- Orange si `driftDetected`

## `ValidatePairWizard`

**Rôle** : Wizard 3 étapes pour valider les 2 fichiers.

**État local** :
```ts
const [step, setStep] = useState<1 | 2 | 3>(1);
const [configFile, setConfigFile] = useState<{ name: string; json: unknown } | null>(null);
const [mappingFile, setMappingFile] = useState<{ name: string; json: unknown } | null>(null);
const [result, setResult] = useState<PairValidationResult | null>(null);
const [submitting, setSubmitting] = useState(false);
```

**Étape 1 — Drop config**
```
┌──────────────────────────────────────────────────────────┐
│ Étape 1 / 3 : Configuration GTM                          │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │     📦                                             │  │
│  │  Drop config-vN.json ici                           │  │
│  │  ou clique pour sélectionner                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ℹ Ce fichier contient les tags, triggers, variables.    │
│                                                          │
│                                       [Suivant : Map →]  │
└──────────────────────────────────────────────────────────┘
```

**Étape 2 — Drop mapping**
```
┌──────────────────────────────────────────────────────────┐
│ Étape 2 / 3 : Mapping vendors                            │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│  ✅ config-v4.json chargé (bundleId: a7c4f2e9b81d)        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Drop mapping-vN.json ici                          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ℹ Ce fichier contient la correspondance event ↔ vendor. │
│                                                          │
│  [← Retour]                            [Valider →]       │
└──────────────────────────────────────────────────────────┘
```

**Étape 3 — Résultats**
```
┌──────────────────────────────────────────────────────────┐
│ Étape 3 / 3 : Validation                                 │
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ ✅ Bundle ID cohérent : a7c4f2e9b81d                      │
│ ✅ 12 events couverts                                    │
│ ⚠ Variable {{FG Locale}} absente côté config             │
│   → Ajouter dans GTM avant import                        │
│                                                          │
│ Verdict : ⚠ 1 warning, importable mais à valider         │
│                                                          │
│ Procédure recommandée :                                  │
│  1. Importer config-v4.json (Submit & Publish)           │
│  2. Importer mapping-v17.json                            │
│  3. Ouvrir GTM Preview, faire un pageview                │
│  4. Revenir sur Sync Status pour confirmer               │
│                                                          │
│ [← Recommencer]                  [Tout va bien, fermer]  │
└──────────────────────────────────────────────────────────┘
```

## `ValidationDiffViewer`

**Rôle** : Sous-composant qui affiche les errors/warnings.

**Props** :
```ts
type ValidationDiffViewerProps = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  recommendations: Recommendation[];
};
```

**Layout** : 3 sections collapsibles (errors expanded par défaut si non vide, warnings collapsed).
