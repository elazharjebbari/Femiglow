# F03 — Sélection du modèle Texte

## Objectif
Permettre à l'opérateur de choisir le modèle LLM utilisé pour générer le brief + les 3 variantes (caption, hook, cta, hashtags). Avec **suggestion adaptée au format** sélectionné.

## Importance
🔴 **P0** — gap critique mentionné par l'opérateur.

## Comportement attendu

### UI : composant `ModelPicker`
Combobox (Radix Popover + cmdk) :
- Trigger : bouton avec le modèle actuel ("GPT-4o mini · OpenAI · fast")
- Popover :
  - Champ recherche
  - Section "⭐ Recommandé pour {format}" en haut (1 ou 2 modèles)
  - Section "Autres modèles" groupée par provider
  - Footer "+ Ajouter un modèle custom" (saisie libre)
- Item : `[icône provider] [label] [tier badge] [pricing inline]`
- Indicateur source en haut à droite : Live / Cache / Static

### Logique
- Fetch `GET /api/admin/content-studio/models?role=chat&format={format}` au mount + au changement de format
- Cache local (useRef Map) pour éviter re-fetch lors d'un toggle popover
- Modèle par défaut : `suggested.id` de la réponse
- Le choix utilisateur est passé en payload `POST /ideas` et `POST /ideas/:id/generate`

### Feedback après génération
Après réponse :
- Afficher `runs[0].model` et `runs[0].costCents` dans une zone discrète sous VariantsCompare
- Badge "Généré par {model} · {cost}¢"
- Si fallback : warning "Provider indisponible — généré via template (gratuit)"

## Comportement actuel
Aucun. Modèle = `env.CONTENT_STUDIO_TEXT_MODEL`. Aucun feedback UI.

## Gaps
- G03 : pas de sélecteur (adressé ici)
- G07 : pas de feedback du modèle utilisé (adressé ici)
- G08 : pas de suggestion par format (adressé ici via P04)

## Propositions

### A — `<select>` natif simple
Voir P01 Option A. **Rejeté**.

### B — Popover combobox Radix + cmdk
Voir P01 Option B. **Recommandé**.

### C — Drawer paramètres global
Voir P01 Option C. **Rejeté**.

## Recommandation finale
**B** — Popover combobox. Détails dans `proposals/P01-model-selector-pattern.md`.

## Implementation

### Fichiers à créer/modifier
1. **Créer** `apps/web/src/lib/content-studio-v2/models/registry.ts` (cf P04)
2. **Créer** `apps/web/src/app/api/admin/content-studio/models/route.ts` :
   ```ts
   export async function GET(req) {
     const { searchParams } = new URL(req.url);
     const role = searchParams.get('role');
     const format = searchParams.get('format');
     const models = listModels(role);
     const suggested = format ? suggestForFormat(format)[role] : models.find(m => m.isDefault);
     const providers = listProviders();
     return Response.json({ models, suggested, providers });
   }
   ```
3. **Créer** `apps/web/src/components/admin/content-studio-v2/create/ModelPicker.tsx`
4. **Modifier** `IntentionForm.tsx` : intégrer ModelPicker, propager `model`
5. **Modifier** `app/api/admin/content-studio/ideas/route.ts` : accepter `model` optionnel, passer en aval
6. **Modifier** `lib/content-studio/services/generation.ts` : `generateForIdea({ ideaId, actorId, model? })` → utilise `model ?? env.CONTENT_STUDIO_TEXT_MODEL`
7. **Modifier** `app/api/admin/content-studio/ideas/[id]/generate/route.ts` : idem

### ModelPicker.tsx — squelette
```tsx
'use client';
import * as Popover from '@radix-ui/react-popover';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from 'cmdk';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface ModelPickerProps {
  role: 'chat' | 'image' | 'video';
  format?: ContentFormat;
  value: string | null;
  onChange: (modelId: string) => void;
  allowCustom?: boolean;
}

export function ModelPicker({ role, format, value, onChange, allowCustom = true }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [suggested, setSuggested] = useState<ModelEntry | null>(null);
  const [source, setSource] = useState<'live' | 'cache' | 'static'>('static');
  const cacheRef = useRef(new Map<string, { models: ModelEntry[]; suggested: ModelEntry | null }>());

  useEffect(() => {
    if (!open) return;
    const key = `${role}:${format ?? ''}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setModels(cached.models);
      setSuggested(cached.suggested);
      setSource('cache');
      return;
    }
    fetch(`/api/admin/content-studio/models?role=${role}${format ? `&format=${format}` : ''}`)
      .then(r => r.json())
      .then(j => {
        setModels(j.models);
        setSuggested(j.suggested);
        setSource(j.models[0]?.source ?? 'static');
        cacheRef.current.set(key, { models: j.models, suggested: j.suggested });
      })
      .catch(() => {});
  }, [open, role, format]);

  const current = models.find(m => m.id === value) ?? suggested;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-haspopup="listbox" /* …styled… */>
          {current?.label ?? 'Choisir un modèle'}
          <ChevronDown size={14} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} /* …styled… */>
          <Command>
            <CommandInput placeholder="Chercher un modèle…" />
            <CommandList>
              {suggested && (
                <CommandGroup heading={`⭐ Recommandé pour ${format ?? 'ce contenu'}`}>
                  <CommandItem value={suggested.id} onSelect={() => { onChange(suggested.id); setOpen(false); }}>
                    {suggested.label} · {suggested.provider} · {suggested.tier}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Autres modèles">
                {models.filter(m => m.id !== suggested?.id).map(m => (
                  <CommandItem key={m.id} value={m.id} onSelect={() => { onChange(m.id); setOpen(false); }}>
                    {m.label} · {m.provider} · {m.tier} · {formatCost(m)}
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCustom && (
                <CommandGroup heading="Custom">
                  <CommandItem onSelect={() => { /* open prompt for custom id */ }}>
                    + Ajouter un modèle custom
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

### Backend — registry.ts
Voir `proposals/P04-autocomplete-per-format.md` pour le contenu complet.

## Tests
Voir `test-scenarios.yaml`.
