# 04 — Conception frontend

## Arborescence

```
apps/web/src/
├── app/admin/settings/reset/
│   ├── page.tsx                  # Server Component (auth + données initiales)
│   └── loading.tsx               # Skeleton
└── components/admin/settings/reset/
    ├── ResetWizard.tsx           # Orchestrateur d'étapes (machine d'état)
    ├── ResetCardSettings.tsx     # Carte à insérer dans /admin/settings
    ├── steps/
    │   ├── StepWelcome.tsx
    │   ├── StepMode.tsx
    │   ├── StepCustomOptions.tsx
    │   ├── StepPreservation.tsx
    │   ├── StepPreview.tsx
    │   ├── StepConfirm.tsx
    │   ├── StepExecute.tsx
    │   └── StepReport.tsx
    ├── widgets/
    │   ├── ModeCard.tsx          # carte radio par mode
    │   ├── DomainToggle.tsx
    │   ├── PreservationCheckbox.tsx
    │   ├── ImpactTable.tsx       # diff before/after
    │   ├── TypedConfirmInput.tsx
    │   ├── PhaseProgress.tsx     # bar par phase + ETA
    │   ├── LogStream.tsx         # console live des logs SSE
    │   └── BackupBadge.tsx
    └── hooks/
        ├── useResetStream.ts     # EventSource wrapper
        ├── useResetConfig.ts     # useReducer state machine
        └── usePreflight.ts       # SWR fetch /preflight
```

## Machine d'état du wizard

```
                    ┌───────────────────────────────────────────────┐
                    │                                               │
                    v                                               │
┌──────────┐  next  ┌──────────┐  next  ┌─────────────────┐  back   │
│ Welcome  │ ─────► │   Mode   │ ─────► │ CustomOptions ? │ ────────┤
└──────────┘        └──────────┘        └─────────────────┘         │
                         │  (skip if !custom)                       │
                         v                                          │
                    ┌──────────────┐                                │
                    │ Preservation │                                │
                    └──────────────┘                                │
                         │ next                                     │
                         v                                          │
                    ┌──────────┐                                    │
                    │ Preview  │  ← fetch /preflight                │
                    └──────────┘                                    │
                         │ next                                     │
                         v                                          │
                    ┌──────────┐                                    │
                    │ Confirm  │  ← typed "RESET" / "HARD RESET"    │
                    └──────────┘                                    │
                         │ Start                                    │
                         v                                          │
                    ┌──────────┐                                    │
                    │ Execute  │  ← SSE stream                      │
                    └──────────┘                                    │
                         │ jobComplete | jobFailed                  │
                         v                                          │
                    ┌──────────┐                                    │
                    │  Report  │ ─── "Refaire" ───────────────────► │
                    └──────────┘                                    │
                         │ "Fermer"                                 │
                         └─► retour /admin/settings                 │
```

État géré par `useReducer` :

```typescript
type WizardState = {
  step: 'welcome'|'mode'|'custom'|'preservation'|'preview'|'confirm'|'execute'|'report';
  config: ResetConfig;
  preflight?: PreflightResult;
  jobId?: string;
  jobStatus?: 'running'|'completed'|'failed'|'cancelled';
  events: ResetEvent[];        // bornés à 500
  error?: ClassifiedError;
};

type Action =
  | { type: 'NEXT' } | { type: 'BACK' }
  | { type: 'SET_MODE', mode: ResetMode }
  | { type: 'TOGGLE_DOMAIN', domain: ResetDomain }
  | { type: 'TOGGLE_PRESERVE', table: string }
  | { type: 'SET_CONFIRM', value: string }
  | { type: 'PREFLIGHT_OK', result: PreflightResult }
  | { type: 'START_JOB', jobId: string }
  | { type: 'EVENT', event: ResetEvent }
  | { type: 'CANCEL' }
  | { type: 'RESET_WIZARD' };
```

## Hook `useResetStream`

```typescript
export function useResetStream(jobId: string | null) {
  const [state, setState] = useState<{
    events: ResetEvent[];
    status: 'idle'|'running'|'completed'|'failed'|'cancelled';
    phases: Record<PhaseName, PhaseState>;
    globalEta?: number;
  }>(initialState);

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(`/api/admin/reset/jobs/${jobId}/stream`);
    es.addEventListener('phase.start', e => dispatch({ type: 'PHASE_START', ... }));
    es.addEventListener('phase.progress', e => dispatch({ type: 'PHASE_PROGRESS', ... }));
    es.addEventListener('phase.complete', e => dispatch({ type: 'PHASE_COMPLETE', ... }));
    es.addEventListener('phase.error', e => dispatch({ type: 'PHASE_ERROR', ... }));
    es.addEventListener('job.complete', e => dispatch({ type: 'JOB_COMPLETE', ... }));
    es.addEventListener('job.failed', e => dispatch({ type: 'JOB_FAILED', ... }));
    es.addEventListener('rollback.start', e => dispatch({ type: 'ROLLBACK_START', ... }));
    es.addEventListener('rollback.complete', e => dispatch({ type: 'ROLLBACK_COMPLETE', ... }));
    es.onerror = () => { /* tolerance: reconnect ou snapshot fallback */ };
    return () => es.close();
  }, [jobId]);

  return state;
}
```

Repli : si l'EventSource échoue, fallback via polling `GET /jobs/[id]` toutes les 2 s.

## Composants clés

### `ModeCard` (StepMode)

```
┌──────────────────────────────────────────┐
│  ●  SOFT                  (recommandé)   │
│  Re-seed uniquement (idempotent).        │
│  Pas de destructif. ~10 s.               │
└──────────────────────────────────────────┘
```

Disabled si conditions non remplies (ex : Hard désactivé si MEDIA_LOCAL_DIR non writable).

### `ImpactTable` (StepPreview)

```
┌─────────────────────────────────────────────────────────────┐
│ Table                  Avant    Après     Δ        Action  │
├─────────────────────────────────────────────────────────────┤
│ products                  1       1       =       upsert    │
│ product_variants          2       1       -1      TRUNCATE  │
│ media                    48      48       =       conservé  │
│ orders                  120     120       =       préservé  │
│ delivery_cities         430     430       =       upsert    │
│ ritual_testimonials      52      52       =       préservé  │
└─────────────────────────────────────────────────────────────┘
```

### `TypedConfirmInput` (StepConfirm)

```
┌──────────────────────────────────────────────────┐
│  ⚠ Action irréversible                            │
│                                                   │
│  Tapez exactement « HARD RESET » pour confirmer : │
│  ┌──────────────────────────────────────────┐    │
│  │ HARD RESET█                              │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  [ Annuler ]              [ Démarrer le reset ]  │
└──────────────────────────────────────────────────┘
```

Disable « Démarrer » tant que le texte ne match pas exactement.

### `PhaseProgress` (StepExecute)

```
Phase 4 / 10 · Wipe média
████████████████████░░░░░░░░  72 %       ETA 18 s

✅ Preflight                       1.2 s
✅ Backup                          14.8 s  · bkp_2026-05-13T08-15-22-345Z
✅ Audit counts                    0.4 s
✅ Wipe DB                         3.1 s
▶  Wipe média                      en cours…
   Migrate                         (~ 4 s)
   Seed (16 seeders)               (~ 60 s)
   Verify                          (~ 5 s)
   Cleanup                         (~ 1 s)

[ Annuler le reset ]
```

### `LogStream` (StepExecute, repliable)

Console live des logs (max 500 lignes, auto-scroll, filtre par niveau).
Visible si l'admin clique « Voir les logs ». Pas affiché par défaut pour ne pas effrayer.

### `StepReport`

```
✅ Reset terminé en 1 m 32 s

Backup           bkp_2026-05-13T08-15-22-345Z  (158 MB)
                 → /var/backups/femiglow/bkp_2026-05-13T08-15-22-345Z
                 [ Télécharger ]   [ Restaurer cet état ]

Tables wipées    27 dropped + 27 recreated
Médias wipés     596 dirs (704 MB)
Médias seedés    48 fichiers
Seeders          16/16 ✅

Vérifications post-reset :
✅ /kit accessible (200)
✅ Prix FEMI-KIT-100 = 199 dh
✅ Image hero présente
✅ 7 cartes admin/settings rendues
⚠  1 média orphelin détecté (non bloquant)

Audit log : [voir 11 entrées reset.* dans audit_events]

[ Fermer ]   [ Faire un autre reset ]
```

## Theming

Cohérent avec admin existant :
- Fond : `bg-stone-50`
- Cartes : `bg-white border-stone-200`
- Accent destructif : `bg-rose-100 text-rose-900` (ne JAMAIS utiliser rouge vif)
- Boutons primaires : `bg-stone-900 text-white`
- Boutons destructifs : `bg-rose-700 text-white` (uniquement Confirm/Start)
- Police : Inter (body), Cormorant Garamond (titres)

## Accessibilité

- Wizard navigable au clavier (Tab + Enter).
- Chaque step a un `<h1>` unique avec `tabIndex={-1}` focus on mount.
- ARIA : `role="progressbar"` sur `<PhaseProgress>` avec `aria-valuenow`/`aria-valuetext`.
- `aria-live="polite"` sur la zone phase courante.
- `aria-live="assertive"` sur les erreurs.
- Confirmation typée : `<input>` avec `aria-describedby` qui explique le texte attendu.
- Couleurs : contraste AA minimum, jamais info-only par couleur (icônes + texte).
- Reduced motion : pas de spinners infinis si `prefers-reduced-motion`.

## Responsive

- ≥ 1024 px : wizard centré, max-width 720 px.
- 768–1023 px : full-width avec padding.
- < 768 px : fonctionnel mais déconseillé (admin = desktop) → bannière "expérience optimisée desktop".

## États d'erreur dans le wizard

| État                       | Affichage                                          | Action                          |
|----------------------------|----------------------------------------------------|---------------------------------|
| Preflight failed           | Step Preview affiche bannière rouge + détail       | Bouton "Réessayer", "Annuler"   |
| Lock held by another job   | StepConfirm bouton disabled + info "reset en cours"| Polling toutes les 5 s           |
| SSE disconnect             | StepExecute bandeau jaune + spinner                 | Fallback polling jobs/[id]      |
| Phase critical failure     | StepExecute affiche erreur classifiée + rollback   | Lien vers audit + restore CLI   |
| Network down               | Toast + retry button                                | Snapshot via polling            |

## Carte d'entrée dans /admin/settings

À insérer dans `apps/web/src/app/admin/settings/page.tsx` après la carte « Seeders » :

```tsx
<Link
  href="/admin/settings/reset"
  data-testid="settings-card-reset"
  className="group flex flex-col rounded-md border border-rose-200 bg-rose-50/40 p-5 transition hover:border-rose-400 hover:shadow-sm"
>
  <div className="flex items-start justify-between">
    <h2 className="text-base font-semibold tracking-tight text-rose-900">
      Reset (zone sensible)
    </h2>
    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-800">
      Destructif
    </span>
  </div>
  <p className="mt-1 text-sm text-rose-900/70">
    Ré-initialise la base et les médias vers l'état canonique. Soft / medium / hard.
    Backup automatique + rollback.
  </p>
  <p className="mt-4 text-xs text-rose-900/60">
    Dernier reset : {lastResetDate ? relativeTime(lastResetDate) : 'jamais'}
  </p>
</Link>
```

Couleur rose (pas rouge vif) pour signaler la criticité sans agresser visuellement.
