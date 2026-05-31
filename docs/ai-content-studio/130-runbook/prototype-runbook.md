# Runbook prototype

## 1. Pré-requis staging

- `CONTENT_STUDIO_ENABLED=true`.
- `POSTIZ_BASE_URL` configuré.
- `POSTIZ_API_KEY` configuré côté serveur uniquement.
- `CONTENT_STUDIO_OPENAI_API_KEY` configuré côté serveur uniquement (optionnel, requis pour la génération texte OpenAI).
- `CONTENT_STUDIO_IMAGE_PROVIDER=mock` par défaut pour les tests sans solde.
- `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini` pour les brouillons réels basse consommation.
- `CONTENT_STUDIO_TEXT_MODEL=gpt-4o-mini` par défaut pour la génération de texte.
- `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS=500` plafond quotidien.
- `CRON_SECRET` configuré.
- Au moins un média FemiGlow prêt dans le media system si l'on teste le compartiment importé.

## 2. Mode image

| Mode | Variable | Usage | Coût |
| --- | --- | --- | --- |
| Mock | `CONTENT_STUDIO_IMAGE_PROVIDER=mock` | Smoke, dev, validation UI, pipeline média | 0 |
| OpenAI brouillon | `CONTENT_STUDIO_IMAGE_PROVIDER=openai` + `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini` | Vrai visuel basse consommation | Bas |
| OpenAI qualité | `CONTENT_STUDIO_IMAGE_PROVIDER=openai` + modèle image supérieur | Validation créative ponctuelle | Plus élevé |

Le mode mock passe par le même pipeline applicatif : génération, création `media`, job d'optimisation, variants, marquage `overrides.contentStudio.origin=ai_generated`, affichage dans le compartiment IA.

## 3. Mode texte

| Mode | Variable | Usage |
| --- | --- | --- |
| Fallback déterministe | `CONTENT_STUDIO_OPENAI_API_KEY` vide | Modèles de texte prédéfinis, sans appel API |
| OpenAI | `CONTENT_STUDIO_OPENAI_API_KEY` renseigné | Appel au modèle configuré dans `CONTENT_STUDIO_TEXT_MODEL` |

## 4. Smoke test studio sans coût

Depuis la racine du repo :

```bash
pnpm --filter @femiglow/web smoke:content-studio
```

Le script refuse d'exécuter un appel réel OpenAI si `CONTENT_STUDIO_IMAGE_PROVIDER` n'est pas `mock`.

Résultat attendu :

- `ok: true`.
- `provider: "mock"`.
- `mediaId` renseigné.
- `previewUrl` renseignée.
- le média apparaît dans le compartiment `Générés IA`.

## 5. Smoke test OpenAI basse consommation

À lancer seulement quand on veut valider un vrai rendu :

```bash
CONTENT_STUDIO_IMAGE_PROVIDER=openai pnpm --filter @femiglow/web smoke:content-studio -- --allow-openai
```

Contrôles avant lancement :

- vérifier que `CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini` ;
- garder `quality=low` dans le smoke ;
- ne pas lancer en boucle ;
- vérifier ensuite le média dans `/admin/content-studio`, compartiment `Générés IA`.

## 6. Smoke test Postiz

1. Appeler sync integrations depuis l'interface.
2. Vérifier au moins une integration Instagram ou Facebook active.
3. Créer une idée.
4. Générer les brouillons.
5. Générer ou choisir un média (compartiment Importé ou Généré IA).
6. Sauvegarder le média sur le brouillon.
7. Approuver.
8. Choisir une date cible.
9. Cliquer "Uploader + créer draft".
10. Vérifier `content_postiz_delivery`.
11. Vérifier le média dans `https://postiz.lumiereacademy.com/media`.

## 7. Smoke test automatisations

Ces commandes utilisent les endpoints cron staging. Le mode `dryRun` est non destructif : il ne crée pas de brouillon Postiz.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:8012/api/cron/content-studio/retry-deliveries?dryRun=true&limit=5"
```

Résultat attendu :

- `dryRun: true`.
- `candidates` liste les retries possibles ou reste vide.
- `retried: 0`.

Synchronisation Postiz :

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:8012/api/cron/content-studio/postiz-sync"
```

Résultat attendu :

- `integrations` contient les comptes Postiz visibles par la clé API.
- `tookMs` renseigné.

Imports statut/performance en mode non destructif :

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:8012/api/cron/content-studio/import-status?dryRun=true&limit=10"

curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:8012/api/cron/content-studio/import-performance?dryRun=true&limit=3"
```

Résultat attendu :

- `dryRun: true`.
- `candidates` contient les livraisons Postiz `sent` avec `postizPostId`, ou reste vide s'il n'y a rien à importer.
- `imported: 0`.

## 8. Tests automatisés

Les tests unitaires et contractuels couvrent :

- **Brand rules** (8 tests) : termes bloqués, emojis, exclamations, hashtags excessifs, scores, warnings commerciaux.
- **State machine** (14 tests) : transitions valides et invalides, assertions avec erreur.
- **Postiz payload** (9 tests) : construction Instagram/Facebook, sans image, tags personnalisés, carousel, date par défaut, parsing media uploadé.
- **Automation** (3 tests) : sélection retry, plafond tentatives, extraction date.
- **Schemas** (9 tests) : validation idée, draft, Postiz, génération visuelle, valeurs par défaut.
- **Image generation** (1 test) : mock sans coût OpenAI.

```bash
pnpm --filter @femiglow/web exec vitest run src/lib/content-studio --reporter=verbose
```

Résultat attendu : 44+ tests passés, 0 échoué.

## 9. Rollback

Si problème critique :

1. Désactiver `CONTENT_STUDIO_ENABLED`.
2. Remettre `CONTENT_STUDIO_IMAGE_PROVIDER=mock` si un provider réel pose problème.
3. Stopper les tests de génération.
4. Désactiver les appels cron Content Studio côté ordonnanceur.
5. Annuler les posts Postiz programmés depuis FemiGlow si nécessaire.
6. Exporter `content_postiz_delivery` et erreurs.
7. Conserver les tables ; ne pas dropper sans backup.

## 10. Diagnostic

| Symptôme | Vérifier |
| --- | --- |
| Le compartiment IA est vide | `CONTENT_STUDIO_IMAGE_PROVIDER`, smoke script, media `overrides.contentStudio.origin` |
| Génération IA échoue | clé OpenAI, modèle, provider, quota, réponse API |
| Génération coûte du solde en dev | `CONTENT_STUDIO_IMAGE_PROVIDER` doit être `mock` |
| Média créé mais sans preview | jobs `media_jobs`, worker `media-optimize`, storage local |
| Aucun compte social | Postiz API key, endpoint integrations, compte disabled |
| Upload Postiz échoue | URL media publique, Cloudinary/R2/proxy, taille fichier |
| Schedule échoue | payload settings `__type`, date UTC, `post_type` |
| Retry ne crée rien | lancer `retry-deliveries?dryRun=true`, vérifier que le dernier état par post/intégration est bien `failed` |
| Retry ignoré | `attemptCount >= maxAttempts`, livraison plus récente `sent`/`auth_failed`, post ou brouillon non approuvé |
| Import statut vide | vérifier que des livraisons `sent` ont un `postiz_post_id` |
| Import analytics échoue | vérifier que le post Postiz est publié et que son release id est disponible côté Postiz |
| Draft bloqué | `content_brand_review.violations` |
| Post publié mais non visible | Postiz logs, Meta app mode, token expiré, contraintes Instagram |

## 11. Commandes de vérification

```bash
pnpm --filter @femiglow/web exec tsc --noEmit
pnpm --filter @femiglow/web exec vitest run src/lib/content-studio src/lib/db/queries/media-jobs.test.ts
pnpm --filter @femiglow/web smoke:content-studio
pnpm --filter @femiglow/web build
```

## 12. Architecture des fichiers

```
src/lib/content-studio/
  auth.ts              # Feature flag CONTENT_STUDIO_ENABLED
  automation.ts        # Jobs cron : retry, import status, import performance, sync
  automation.test.ts   # 3 tests
  brand-rules.ts       # Règles déterministes de sécurité marque
  brand-rules.test.ts  # 8 tests
  generation.ts        # Service de génération texte (OpenAI + fallback)
  image-generation.ts  # Service de génération visuelle (OpenAI gpt-image-2 + mock)
  image-generation.test.ts  # 1 test
  postiz.ts            # Bridge Postiz : upload, draft, integrations, posts, analytics
  postiz.test.ts       # 9 tests
  repository.ts        # Dual-driver repository (Drizzle + mémoire)
  schemas.ts           # Validation Zod (idées, drafts, Postiz, visuel)
  service.ts           # Orchestration métier (create, generate, review, approve, media, visual)
  state-machine.ts     # Machine à états du contenu
  state-machine.test.ts  # 14 tests
  types.ts             # Types et constantes

src/app/api/admin/content-studio/
  ideas/                     # CRUD idées
  ideas/[id]/generate/       # Génération de brouillons
  drafts/                    # Liste brouillons
  drafts/[id]/               # Mise à jour brouillon
  drafts/[id]/review/        # Brand review
  drafts/[id]/approve/        # Approuver
  drafts/[id]/generate-visual/  # Génération visuelle IA
  posts/                     # Liste posts
  posts/[id]/postiz-draft/  # Création draft Postiz avec upload média
  postiz/integrations/sync/  # Sync intégrations Postiz
  media/                     # Média studio (compartiments importé/IA)
  automation/                # Jobs manuels (retry, import status/performance)

src/app/api/cron/content-studio/
  postiz-sync/               # Cron sync intégrations
  retry-deliveries/          # Cron retry livraisons échouées
  import-status/             # Cron import statuts Postiz
  import-performance/        # Cron import analytics Postiz

src/components/admin/content-studio/
  ContentStudioClient.tsx    # Composant principal avec sections visuelles
```