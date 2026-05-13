# Ticket templates

> Templates standards pour Linear. Copy-paste prêt. Permet une consistance et facilite revue, estimation, livraison.

## Template — Feature

```markdown
## Contexte
[Pourquoi cette feature ? Quel job-to-be-done ? Référence vers doc dossier-chat-v2/.]

## User story
En tant que [persona], je veux [action], afin de [bénéfice].

## Spec technique
[Lien vers spec dans `docs/dossier-chat-v2/` ou détail inline si court.]

## Acceptance criteria
- [ ] Critère 1 (testable)
- [ ] Critère 2
- [ ] Critère 3

## Cas couverts
- [ ] Happy path FR
- [ ] Happy path AR
- [ ] Happy path AR-MA (darija)
- [ ] Erreur réseau
- [ ] Erreur validation
- [ ] Mobile + Desktop

## Out of scope
- [Liste claire pour éviter scope creep.]

## Dépendances
- Bloquée par : #CHAT-XYZ
- Bloque : #CHAT-ABC

## Tests
- [ ] Unit tests (citer fichiers)
- [ ] Integration tests
- [ ] E2E (si user-facing)

## DoD
Voir [definition-of-done.md](./definition-of-done.md#feature).

## Métriques impactées
- KPI N1 / N2 / N3 mentionnés
- Event analytics à ajouter (cf. event-taxonomy.csv)

## Notes design
- Lien Figma (si applicable)
- Wireframe ASCII (si applicable)
```

### Exemple — Ticket Feature

```markdown
## Contexte
La détection d'intention doit fonctionner en 3 niveaux : regex (fast path), embedding (fallback rapide), LLM mini (fallback lent et coûteux). C'est la base de tout le pipeline retrieval.

## User story
En tant qu'orchestrator backend, je veux détecter l'intent d'un message user avec accuracy 85%+, afin de router le bon mécanisme (RAG, tools, canned).

## Spec technique
Voir [03-backend/intent-detection.md](../docs/dossier-chat-v2/03-backend/intent-detection.md).

## Acceptance criteria
- [ ] `detectIntent(text, language)` retourne `{intent, confidence, source}`.
- [ ] Source possible : `regex` | `embedding` | `llm-mini`.
- [ ] Latence p50 < 200ms si regex hit.
- [ ] Accuracy ≥ 85% sur dataset 50 examples × 3 langues.
- [ ] LLM mini cost < 0.0001 USD/call mesuré.

## Cas couverts
- [ ] "C'est combien le pack ?" → pricing (regex)
- [ ] "Wach 7alal ?" → ingredient (regex)
- [ ] "Je voudrais savoir si je peux acheter" → purchase-intent (embedding)
- [ ] "Bonjour comment ça va ?" → greeting (regex)
- [ ] Question floue → misc (embedding ou LLM mini)

## Out of scope
- Multi-intent dans un seul message (handle dans V6).
- Confidence calibration dynamique (V6).

## Dépendances
- Bloquée par : #CHAT-003 (tables intent_centroid)
- Bloque : #CHAT-009 (retrieval routing)

## Tests
- [ ] Unit `lib/chat/services/__tests__/intent-detection.test.ts`
- [ ] Matrix : 50 examples × 3 langues
- [ ] Property-based : fuzz inputs ne crash pas

## DoD
Voir definition-of-done.md#feature.

## Métriques impactées
- N3.1 Intent detection accuracy
- Event `intent_detected`
```

## Template — Bug

```markdown
## Description
[Que se passe-t-il ? Que devrait-il se passer ?]

## Étapes pour reproduire
1. ...
2. ...
3. ...

## Environnement
- Branche: ...
- Browser / device: ...
- Lang session: fr | ar | ar-MA
- Audience: all | b2c | b2b

## Logs / captures
[Sentry link, screenshot, network HAR, etc.]

## Hypothèses cause
- [ ] Hypothèse 1
- [ ] Hypothèse 2

## Acceptance criteria
- [ ] Bug ne se reproduit plus.
- [ ] Test ajouté qui aurait détecté le bug.
- [ ] Regression note dans CHANGELOG si user-facing.

## Severity
- [ ] P0 (prod down) | P1 (feature broken) | P2 (UX dégradée) | P3 (cosmétique)
```

## Template — Tech debt

```markdown
## Contexte
[Quel code/architecture pose problème et pourquoi.]

## Impact si non traité
- [ ] Maintenance ralentie
- [ ] Risque qualité
- [ ] Risque perf
- [ ] Risque sécurité
- [ ] Bloque future feature

## Proposition
[Comment refactorer/améliorer.]

## Acceptance criteria
- [ ] Refactor effectué.
- [ ] Aucune régression fonctionnelle (tests verts).
- [ ] Code coverage maintenu ou amélioré.
- [ ] Doc mise à jour.

## Effort estimé
[Petite, Moyenne, Grande.]
```

## Template — Spike (recherche, prototype)

```markdown
## Question
[Quelle décision technique cette spike doit éclairer ?]

## Timebox
[Max N jours. Si dépassé, on stoppe et on revient avec ce qu'on a.]

## Approches à explorer
1. ...
2. ...
3. ...

## Critères de décision
- Performance
- Coût
- Maintenabilité
- Compatibilité

## Livrables
- [ ] Document de recommandation (1-2 pages).
- [ ] Prototype code (branch `spike/...`, jamais mergé).
- [ ] Tableau comparatif des options.
- [ ] Recommandation pour ADR si applicable.
```

## Template — Doc

```markdown
## Contexte
[Quelle documentation manque, pour qui, pour quel usage.]

## Lecteurs cibles
- [ ] Devs internes
- [ ] PO / business
- [ ] Care / content
- [ ] Externes (clients, partenaires)

## Structure proposée
- Section 1: ...
- Section 2: ...
- Section 3: ...

## Acceptance criteria
- [ ] Doc publiée (Notion ou repo `docs/`).
- [ ] Revue par 1 lecteur cible.
- [ ] Linkée depuis README/Notion hub.
```

## Conventions de titre

- **Feature** : `feat(chat): description` (ex. `feat(chat): cascade intent detection`).
- **Bug** : `fix(chat): description` (ex. `fix(chat): SSE leaks on unmount`).
- **Tech debt** : `refactor(chat): description`.
- **Doc** : `docs(chat): description`.
- **Test** : `test(chat): description`.

## Labels (Linear)

- `area/backend`, `area/frontend`, `area/admin`, `area/data`, `area/ops`.
- `wave/v5`, `wave/v6`, `wave/v7`.
- `type/feature`, `type/bug`, `type/tech-debt`, `type/spike`, `type/doc`.
- `priority/P0` à `priority/P3`.
- `effort/XS` (1pt) à `effort/XL` (13pt).
- `blocker` si bloquant.

## Workflow Linear

```
Backlog → Todo → In Progress → In Review → QA → Done
```

- **Backlog** : ticket pas encore planifié dans un sprint.
- **Todo** : planifié dans sprint courant.
- **In Progress** : dev en cours.
- **In Review** : PR ouverte, attend code review.
- **QA** : merged, attend validation manuelle (UX, Care).
- **Done** : tout DoD satisfait, en prod (ou prêt à ship).

Pas plus de **2 tickets In Progress** par dev simultanément.
