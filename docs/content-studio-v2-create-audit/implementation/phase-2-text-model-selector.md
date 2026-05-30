# Phase 2 — Text Model Selector (IntentionForm)

## Objectif
Intégrer le composant ModelPicker dans IntentionForm pour permettre le choix du modèle texte avec suggestion par format.

## Durée estimée
1.5 jour-personne (dev) + 0.5 j (tests)

## Dépendances
- Phase 1 doit être terminée (registry + endpoint /models + MockModeBadge)

## Fichiers à créer

### 1. `apps/web/src/components/admin/content-studio-v2/create/ModelPicker.tsx`

Voir `features/F03-text-model-selection/spec.md` pour le squelette complet.

Points clés :
- Radix Popover + cmdk
- Fetch `GET /models?role=...&format=...` au open (pas au mount)
- Cache via useRef<Map> (clé `${role}:${format}`)
- Sections : "Recommandé pour {format}" + "Autres modèles" + "Custom"
- Item : icon provider, label, tier badge, pricing inline
- Source indicator (Static / Cache / Live)

### 2. Modifier `IntentionForm.tsx`

```tsx
import { ModelPicker } from './ModelPicker';

// Add state
const [model, setModel] = useState<string | null>(defaultValues?.model ?? null);

// Below format radio, before intention textarea:
<div style={{ marginTop: 12 }}>
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ fontSize: 11, color: 'var(--cs-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      Modèle de génération
    </span>
    <ModelPicker
      role="chat"
      format={format}
      value={model}
      onChange={setModel}
      allowCustom={true}
    />
  </label>
</div>

// In handleSubmit, include model in payload:
const parsed = contentIdeaCreateSchema.safeParse({
  campaignId: null,
  pillar, objective, platform, format, prompt,
  model: model ?? undefined,
});
```

## Backend

### 1. Étendre `contentIdeaCreateSchema` (Zod)

```ts
// apps/web/src/lib/content-studio/schemas.ts
export const contentIdeaCreateSchema = z.object({
  campaignId: z.string().uuid().nullable(),
  pillar: z.enum(CONTENT_PILLARS),
  objective: z.enum(CONTENT_OBJECTIVES),
  platform: z.enum(CONTENT_PLATFORMS),
  format: z.enum(CONTENT_FORMATS),
  prompt: z.string().min(8).max(2000),
  sourceType: z.string().optional(),
  sourceRef: z.string().optional(),
  model: z.string().optional(),  // NEW
});
```

### 2. Persister le modèle en idée
Optionnel : ajouter `model` au row `content_idea` OU le passer uniquement à `generate`. Pour minimiser le changement DB, passer via contexte de service uniquement.

### 3. Modifier `app/api/admin/content-studio/ideas/[id]/generate/route.ts`

```ts
const bodySchema = z.object({
  model: z.string().optional(),
}).optional();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.parse(body);
  const result = await generateIdeaDrafts({
    ideaId: params.id,
    actorId: ...,
    model: parsed?.model,  // NEW
  });
  return NextResponse.json(result);
}
```

### 4. Modifier `lib/content-studio/services/generation.ts`

```ts
export async function generateIdeaDrafts({ ideaId, actorId, model }: Args) {
  const idea = await getIdeaOrThrow(ideaId);
  const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY;
  const textModel = model ?? suggestForFormat(idea.format).chat?.id ?? env.CONTENT_STUDIO_TEXT_MODEL;

  // … existing logic but pass textModel to OpenAI client and log it in generation_run.model
  await insertGenerationRun({
    ...,
    model: textModel,
  });
}
```

### 5. Si UI envoie aussi le modèle au POST /ideas
Le model peut être uniquement transitoire (UI → /generate). Si on veut le persister, ajouter à `content_idea.model` (migration).

**Recommandation** : ne PAS persister pour l'instant — passer via /generate. Si pertinence prouvée plus tard, ajouter migration.

## Tests à écrire

### Unit
- `generation.test.ts` : modèle override propagé à `insertGenerationRun`

### Component
- `ModelPicker.test.tsx` (14 tests)
- `IntentionForm.test.tsx` : passage du modèle dans le payload

### Contract
- `content-studio-v2-ideas.contract.test.ts` : body.model accepté
- `content-studio-v2-ideas-generate.contract.test.ts` : runs[0].model = modèle envoyé

### E2E
- `create-model-switching.spec.ts` (S02) : switch model → vérifier badge "Généré par X"

## Validation

```bash
pnpm vitest run src/components/admin/content-studio-v2/create/ModelPicker.test.tsx
pnpm vitest run src/components/admin/content-studio-v2/create/IntentionForm.test.tsx
pnpm vitest run src/test/api-contracts/content-studio-v2-ideas*.contract.test.ts
```

## Acceptance

- [ ] ModelPicker visible dans IntentionForm
- [ ] Suggestion adapte au format change
- [ ] Soumission propage le model au backend
- [ ] `content_generation_run.model` reflète le choix
- [ ] Sans choix utilisateur, fallback sur suggestForFormat
- [ ] 0 fail tests Phase 2
