# Pipeline LangGraph — Description détaillée et éléments à tester

## Architecture du pipeline

```
START
  │
  ▼
parseBrief ──→ enrichKnowledge ──→ enrichTrends ──→ generateScript
  │                                                      │
  │                                    ┌─────────────────┤
  │                                    │ routeAfterScript │
  │                                    └────┬────┬────┬──┘
  │                                         │    │    │
  │                              video_flow │    │    │ caption_only
  │                                         │    │    │
  │                                         ▼    │    ▼
  │                              generateVideo   │  generateCaption ──→ compose
  │                                    │         │         ▲
  │                                    ▼         │         │
  │                            generateVoiceover │  ┌──────┘
  │                                    │         │  │
  │                                    ▼         │  │
  │                              generateMusic   │  │
  │                                    │         │  │
  │                                    ▼         │  │
  │                           generateSubtitles──┤  │
  │                                              │  │
  │                                 image_flow ──┘  │
  │                                         │      │
  │                                         ▼      │
  │                                  generateImages─┘
  │
  └──→ compose ──→ transcodeExport ──→ qualityCheck
                                            │
                                   ┌────────┤
                                   │ routeAfterQuality
                                   ├─ pass ──→ moderate
                                   ├─ retry ──→ generateScript (loop)
                                   └─ fail ──→ END
                                            │
                                   ┌────────┤
                                   │ routeAfterModeration
                                   ├─ safe ──→ reviewGate
                                   ├─ flagged ──→ generateScript
                                   └─ blocked ──→ END
                                            │
                                   ┌────────┤
                                   │ routeAfterHumanReview
                                   ├─ approved ──→ generateVariants ──→ END
                                   ├─ approved_direct ──→ END
                                   ├─ rejected ──→ generateScript
                                   └─ edit_requested ──→ generateScript
```

## Nœuds — État des tests

| Nœud | Tests existants | Tests manquants | Scénarios critiques non couverts |
|---|---|---|---|
| parseBrief | 8 ✅ | 0 | — |
| enrichKnowledge | 10 ✅ | RAG round-trip réel | pgvector query avec vrais embeddings |
| enrichTrends | 8 ✅ | 0 | — |
| generateScript | 15 ✅ | LLM réel | Appel OpenAI réel (coûteux) |
| generateCaption | 12 ✅ | LLM réel | Platform-specific output |
| generateImages | 10 ✅ | OpenAI Images réel | DALL-E appel réel |
| generateVideo | 8 ✅ | FFmpeg réel | Vidéo assemblée avec scènes |
| generateVoiceover | 8 ✅ | TTS réel | Audio avec voix française |
| generateMusic | 0 ❌ → **À CRÉER** | 6 tests | Mock silent track |
| generateSubtitles | 0 ❌ → **À CRÉER** | 6 tests | SRT timing |
| compose | 0 ❌ → **À CRÉER** | 8 tests | FFmpeg + Sharp composition |
| transcodeExport | 0 ❌ → **À CRÉER** | 6 tests | Platform presets |
| qualityCheck | 12 ✅ | 0 | — |
| moderate | 10 ✅ | 0 | — |
| humanReview | 8 ✅ | HITL interrupt réel | MemorySaver pause/resume |
| generateVariants | 8 ✅ | 0 | — |

## Routing — État des tests

| Fonction | Tests | Statut |
|---|---|---|
| routeAfterScript | 10 ✅ | Complet |
| routeAfterQuality | 6 ✅ | Complet |
| routeAfterModeration | 4 ✅ | Complet |
| routeAfterHumanReview | 4 ✅ | Complet |

## Scénarios d'intégration pipeline non testés

1. **Pipeline complet image** : parseBrief → enrich × 2 → script → images → caption → compose → transcode → quality → moderate → review → variants
2. **Pipeline complet vidéo** : ... → script → video → voiceover → music → subtitles → caption → compose → transcode → quality → moderate → review → variants
3. **Boucle quality retry** : quality score < 0.65 → regenerate script → re-run → pass
4. **Boucle moderation flagged** : content flaggé → regenerate → clean content → pass
5. **HITL interrupt/resume** : pipeline pause à reviewGate → opérateur approuve → pipeline reprend
