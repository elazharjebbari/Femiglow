# P3 -- Review Toggle + Mock Review Payload

## Composant

**Nom:** Pas de nouveau composant -- modification du flux existant
**Fichiers principaux:**
- `apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx` (handleGenerate + state)
- `apps/web/src/components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx` (toggle, fait partie de P2)
- `apps/web/src/test/msw/ai-engine-handlers.ts` (mock handler)

**But:** Permettre a l'operateur d'activer la review humaine via un toggle. En mode mock, generer un `reviewPayload` realiste avec du contenu FemiGlow pour rendre l'etape Review testable.

---

## Toggle "Review humaine avant publication"

Defini dans la spec P2 (AdvancedParams). Ce document se concentre sur:
1. Le flux de donnees du toggle vers handleGenerate
2. La logique de forcement de la review en mock
3. Le mock reviewPayload realiste
4. Les modifications du handler MSW

---

## State dans AIEngineCreatePage

```typescript
const [humanReviewRequired, setHumanReviewRequired] = useState(false);
```

Cette valeur est:
- Passee a `<AdvancedParams humanReviewRequired={humanReviewRequired} onHumanReviewChange={setHumanReviewRequired} />`
- Lue dans `handleGenerate()` pour enrichir le body POST
- Utilisee pour forcer la transition vers la phase `review` en mode mock

---

## Modification de handleGenerate

### Body POST enrichi

```typescript
const res = await fetch('/api/admin/ai-engine/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // champs existants...
    objective: form.objective,
    platform: form.platform,
    format: form.format,
    tone: form.tone,
    keyMessage: form.keyMessage,
    productFocus: form.productFocus || undefined,
    trendReference: form.trendReference || undefined,
    // nouveau champ:
    humanReviewRequired: humanReviewRequired,
  }),
});
```

### Logique de traitement de la reponse

Le backend (ou le mock handler) repond avec `status: 'review'` quand `humanReviewRequired: true`. Le code existant (ligne 624 de page.tsx) gere deja ce cas:

```typescript
if (data.status === 'review') {
  simulateProgress(() => {
    setReviewJobId(data.jobId);
    setReviewPayload(data.reviewPayload ?? { ... });
    setTotalCost(data.totalCostCents ?? data.costTracking?.totalCents);
    setPhase('review');
  });
  return;
}
```

Pas de modification necessaire de la logique client pour ce bloc -- c'est le handler qui doit renvoyer `status: 'review'` quand le flag est active.

---

## Mock Review Payload (Contenu FemiGlow Realiste)

```typescript
const MOCK_REVIEW_PAYLOAD = {
  jobId: 'mock-review-job-001',
  status: 'review',
  reviewPayload: {
    script: {
      hook: 'Decouvrez le secret des mains japonaises, un rituel millénaire qui transforme vos ongles.',
      scenes: [
        {
          sceneNumber: 1,
          narration: 'Gros plan sur des mains dans une lumiere douce. Un geste precis applique le soin FemiGlow.',
          visualNote: { description: 'Lumiere naturelle, mains soignees, texture creme onctueuse' },
          durationSeconds: 4,
          transition: 'fade',
        },
        {
          sceneNumber: 2,
          narration: 'Le produit penetre en douceur. Les ongles retrouvent leur eclat naturel, sans vernis.',
          visualNote: { description: 'Macro ongles lumineux, reflets soyeux, fond bokeh vegetal' },
          durationSeconds: 4,
          transition: 'slide',
        },
        {
          sceneNumber: 3,
          narration: 'Resultat : des ongles forts, brillants et naturellement beaux. Le rituel FemiGlow.',
          visualNote: { description: 'Plan large mains ouvertes, ongles parfaits, fond minimaliste japonais' },
          durationSeconds: 4,
          transition: 'fade',
        },
      ],
      cta: 'Commandez maintenant sur femiglow.com et decouvrez le rituel.',
      voiceoverRequired: true,
      musicRequired: true,
      musicMood: 'zen',
      estimatedDurationSeconds: 15,
    },
    caption: 'Decouvrez le secret des mains japonaises\n\nChez FemiGlow, nous croyons que la beaute commence par un geste simple et patient. Notre rituel J-Beauty nourrit, protege et revele l\'eclat naturel de vos ongles -- sans vernis, sans chimie agressive.\n\nUn soin ancestral reinvente pour les femmes modernes.\n\nCommandez maintenant sur femiglow.com',
    hashtags: [
      '#FemiGlow',
      '#JBeauty',
      '#SoinDesOngles',
      '#RituelBeaute',
      '#BeauteJaponaise',
      '#OnglesNaturels',
      '#SoinNaturel',
      '#BeauteAuthentique',
    ],
    images: [
      {
        assetId: 'mock-review-img-001',
        url: '/_media/ai-engine/mock/review-hands-care.png',
        mimeType: 'image/png',
        width: 1080,
        height: 1080,
        provider: 'mock',
        costCents: 0,
      },
      {
        assetId: 'mock-review-img-002',
        url: '/_media/ai-engine/mock/review-product-hero.png',
        mimeType: 'image/png',
        width: 1080,
        height: 1350,
        provider: 'mock',
        costCents: 0,
      },
    ],
    videos: [],
    qualityScores: {
      overall: 0.82,
      creativity: 0.78,
      brandAlignment: 0.91,
      hookStrength: 0.85,
      ctaClarity: 0.80,
      visualCoherence: 0.76,
    },
    moderationResult: {
      safe: true,
      flags: [],
      canRetry: false,
      brandScore: 88,
    },
  },
  costTracking: {
    totalCents: 0.22,
    breakdown: {
      generate_script: 0.10,
      generate_caption: 0.07,
      generate_images: 0.05,
    },
    tokensUsed: {
      'openai:gpt-4o': 2800,
    },
  },
};
```

---

## Modification du MSW Handler

Le handler `POST /generate` doit lire le body et retourner `status: 'review'` quand `humanReviewRequired === true`.

```typescript
// Dans ai-engine-handlers.ts:
http.post(`${BASE}/generate`, async ({ request }) => {
  const body = await request.json() as Record<string, unknown>;

  if (body.humanReviewRequired === true) {
    return HttpResponse.json(MOCK_REVIEW_PAYLOAD);
  }

  return HttpResponse.json(MOCK_GENERATION_RESULT);
}),
```

Le handler existant (ligne 128-130) doit etre modifie pour lire le body au lieu de toujours retourner `MOCK_GENERATION_RESULT`.

---

## Backend Real API

Le backend doit aussi respecter le flag:

```typescript
// Dans le route handler POST /generate:
const { humanReviewRequired, ...briefParams } = body;

// Dans le pipeline LangGraph:
if (humanReviewRequired) {
  // Forcer le noeud de review humaine dans le graphe
  // Retourner status='review' au lieu de 'completed'
}
```

---

## Modification du ReviewPanel

Le `ReviewPanel` (deja existant dans page.tsx, lignes 240-525) n'a besoin d'aucune modification. Il recoit deja `reviewPayload` et affiche le script, caption, hashtags, images et scores.

Le mock payload ci-dessus est compatible avec l'interface `ReviewPayload`:

```typescript
interface ReviewPayload {
  jobId?: string;
  script?: Record<string, unknown> | null;
  caption?: string;
  hashtags?: string[];
  images?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  qualityScores?: Record<string, number>;
  moderationResult?: Record<string, unknown> | null;
}
```

---

## Data Flow Complet

```
1. Operateur active le toggle "Review humaine" dans AdvancedParams
   -> setHumanReviewRequired(true)

2. Operateur clique "Generer"
   -> handleGenerate() envoie body { ..., humanReviewRequired: true }

3. MSW handler (ou backend) recoit le body
   -> Si humanReviewRequired === true, retourne MOCK_REVIEW_PAYLOAD (status: 'review')

4. handleGenerate() recoit status === 'review'
   -> simulateProgress() deroule la barre
   -> setReviewJobId(data.jobId)
   -> setReviewPayload(data.reviewPayload)
   -> setPhase('review')

5. Le ReviewPanel s'affiche avec le contenu FemiGlow mock
   -> L'operateur peut Approuver / Modifier / Rejeter

6. L'operateur approuve
   -> POST /jobs/{jobId}/review avec { decision: 'approved' }
   -> Handler retourne MOCK_GENERATION_RESULT (status: 'completed')
   -> setPhase('result')
```

---

## Accessibilite

- Le toggle est deja couvert par la spec P2 (role="switch", aria-checked)
- Le ReviewPanel existant a des labels et des structures accessibles
- Le mock payload inclut des textes significatifs pour les lecteurs d'ecran

---

## Edge Cases

| Cas                                                  | Comportement                                             |
|------------------------------------------------------|----------------------------------------------------------|
| Toggle active puis desactive avant generation         | body envoie `humanReviewRequired: false`, generation directe |
| Toggle active, generation echoue                      | Phase error comme d'habitude, toggle conserve sa valeur   |
| Toggle active, review approuvee puis regeneration     | Le toggle conserve sa valeur, la review se refait         |
| Toggle inactif, backend force la review (rare)        | Le client gere deja le cas (ligne 624)                    |
| Review avec decision 'edit_requested'                 | Le handler retourne un nouveau review payload (cycle)     |
| Review avec decision 'rejected'                       | Le handler retourne status completed (le rejet est final) |
| Mock payload avec images dont l'URL n'existe pas      | Les images affichent le placeholder (icone image)         |

---

## Fichiers Impactes

| Fichier | Modification |
|---------|-------------|
| `app/admin/content-studio-v2/ai-engine/create/page.tsx` | state `humanReviewRequired`, body POST enrichi |
| `test/msw/ai-engine-handlers.ts` | Handler POST /generate lit le body, nouveau `MOCK_REVIEW_PAYLOAD` |
| `app/api/admin/ai-engine/generate/route.ts` | Lire `humanReviewRequired` du body, passer au pipeline |
