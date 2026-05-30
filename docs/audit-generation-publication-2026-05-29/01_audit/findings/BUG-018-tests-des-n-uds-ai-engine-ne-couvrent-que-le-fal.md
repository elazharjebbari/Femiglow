# BUG-018 — Tests des nœuds AI-Engine ne couvrent QUE le fallback (LLM mocké en rejet) — chemin LIVE jamais validé

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | copywriting |
| **Composant** | `src/lib/ai-engine/nodes/generate-script.test.ts, generate-caption.test.ts, generate-variants.test.ts` |
| **Mode mock** | `untested` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les tests valident que le nœud appelle le LLM, parse le JSON, valide le schema et calcule le coût (chemin LIVE), ET le fallback.

## État réel vérifié
Tous les mocks ChatOpenAI/Anthropic/Google sont `invoke: vi.fn().mockRejectedValue(new Error('No API key'))`. Donc seul le bloc catch (fallback) est exercé. Le parsing du JSON LLM, scriptOutputSchema.parse, l'estimation de coût et le response_format json_object ne sont jamais testés avec une réponse valide.

## Écart
La couverture verte donne une fausse assurance: la génération LIVE (réelle) n'est pas testée. Un bug de parsing/schema en prod passerait inaperçu. Illustre le décalage test<->réalité.

## Cause racine
Choix de mock systématiquement en échec; absence de cas de succès LLM mocké.

## Preuves
- generate-script.test.ts:20-34 ChatOpenAI/Anthropic/Google tous `invoke: vi.fn().mockRejectedValue(new Error('No API key'))`
- generate-variants.test.ts:21 `invoke: vi.fn().mockRejectedValue(new Error('No API key'))`; tous les it() testent 'fallback'
- /tmp/audit-vitest.json: numPassed=1695, numFailed=0, success=true MAIS VITEST_EXIT=1 (unhandled rejection dans video-generation.test.ts) — rapport vert masquant un échec process

## Reproduction
Lire les fichiers .test.ts: aucun mock LLM ne retourne un JSON valide; tous les it() vérifient les valeurs du fallbackScript/fallbackCaption/deterministicVariants.

## Piste de correction
Ajouter des cas où invoke résout un JSON conforme au schema (succès), un JSON tronqué (catch->fallback), un JSON hors-schema (ZodError->fallback), et vérifier costCents/usage_metadata. Idem pour generation.ts (qui a déjà ces cas via edge-cases.test.ts — les nœuds AI-Engine devraient les imiter).

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** generate-script.test.ts:22/28/34, generate-caption.test.ts:21, generate-variants.test.ts:21 -> tous les mocks ChatOpenAI/ChatAnthropic/ChatGoogleGenerativeAI sont `invoke: vi.fn().mockRejectedValue(new Error('No API key'))`. grep mockResolvedValue/mockResolvedValueOnce/mockReturnValue dans les 3 fichiers = 0. Tous les it() (verifies) testent uniquement le fallback (fallback script/caption/deterministic variants). Le chemin LIVE (JSON.parse du contenu LLM, scriptOutputSchema/captionOutputSchema/variantOutputSchema.parse, estimateCost via usage_metadata, response_format json_object) n'est JAMAIS exerce avec une reponse valide. Couverture verte = fausse assurance. Severite major justifiee (chemin reel non valide).
- **Contre-preuve / nuance :** Aucune. 0 mockResolvedValue dans les 3 fichiers; tous les titres it() concernent le fallback.

> Réf. registre : `bug-register.csv` ligne `BUG-018` · matrice : `gap-matrix.csv`.
