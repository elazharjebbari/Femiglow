# F13 — Approbation & création du postId

## Objectif
Transitionner un draft de `needs_review` à `approved` via un bouton UI dédié, créant le `content_post` qui débloque la publication.

## Importance
🔴 **P0** — sans cela, l'opérateur ne peut JAMAIS publier (gap G01).

## Comportement attendu

### Bouton "Valider et préparer la publication"
- Position : dans `PreviewPane`, sous l'aperçu média (centre droit)
- Variant : `primary` (couleur accent), icône CheckCircle
- States :
  - `disabled` (avec tooltip) si :
    - draft est null
    - caption vide
    - aucun média attaché
    - brand_review.status='blocked'
  - `enabled` sinon
- Click : appelle `POST /drafts/:id/approve`
- Loading state pendant la requête
- Toast succès "Draft validé, prêt à publier"
- Erreur 409 → toast "Brand review bloque" ou "Média manquant"

### Effet
- Draft.status → approved
- content_post créé (postId disponible)
- Stepper avance à 'Valider'
- PublishActionGroup débloqué

## Comportement actuel
**Aucun**. L'endpoint existe (`POST /drafts/:id/approve`) mais aucun bouton UI ne l'appelle. Le contournement actuel : appeler curl ou attendre une approbation manuelle qui n'arrive jamais.

## Gaps
- G01 : pas de bouton (adressé ici)

## Propositions

### A — Bouton dans PreviewPane
Position logique (aperçu = endroit où on valide visuellement).

### B — Bouton en footer dédié, à côté de PublishActionGroup
Sépare validation et publication en deux étapes verticales.

### C — Bouton intégré au dropdown Publier
"Valider et publier maintenant" comme première option du dropdown. Une action.

## Recommandation
**A** — bouton dans PreviewPane. Hiérarchie claire :
1. Sélectionner variante (Stepper "Générer")
2. Attacher média (Stepper "Visuel")
3. Aperçu + cliquer "Valider et préparer la publication" (Stepper "Valider" actif)
4. Choisir mode de publication (PublishActionGroup débloqué)

## Implementation

### Fichiers à modifier
1. `PreviewPane.tsx` : ajouter `ApproveButton` ou intégrer directement
2. `CreateWorkspace.tsx` : passer `onApprove` callback
3. (Nouveau) `ApproveButton.tsx`

### ApproveButton.tsx
```tsx
'use client';
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/admin/content-studio-v2/primitives';
import type { ContentDraft } from '@/lib/content-studio/types';

interface ApproveButtonProps {
  draft: ContentDraft | null;
  hasMedia: boolean;
  brandBlocked: boolean;
  onApproved: (post: ContentPost) => void;
}

export function ApproveButton({ draft, hasMedia, brandBlocked, onApproved }: ApproveButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  const disabled =
    !draft ||
    !hasMedia ||
    !draft.caption.trim() ||
    brandBlocked ||
    draft.status === 'approved';

  const disabledReason = !draft ? 'Sélectionnez une variante'
    : !hasMedia ? 'Attachez un visuel'
    : !draft.caption.trim() ? 'Ajoutez une caption'
    : brandBlocked ? 'Brand review bloque la publication'
    : draft.status === 'approved' ? 'Déjà validé'
    : '';

  async function handleClick() {
    if (!draft) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/content-studio/drafts/${draft.id}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      onApproved(json.post);
      toast.success('Draft validé, prêt à publier.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      variant="primary"
      type="button"
      disabled={disabled}
      loading={submitting}
      leftIcon={<CheckCircle size={16} />}
      onClick={handleClick}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled ? 'true' : undefined}
    >
      Valider et préparer la publication
    </Button>
  );
}
```

### Intégration CreateWorkspace
```tsx
function handleApproved(post: ContentPost) {
  upsertPost(post);
  // optionnel : auto-scroll vers PublishActionGroup
  setTimeout(() => publishRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
}

<PreviewPane
  draft={selectedDraft}
  media={selectedMedia}
  onApprove={handleApproved}
  brandBlocked={brandViolations.some(v => v.severity === 'blocked')}
/>
```

## Tests
Voir `test-scenarios.yaml`.
