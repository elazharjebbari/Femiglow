# État runtime réel — staging (gel 2026-05-29)

Relevé direct de `apps/web/.env` (valeurs **masquées** : on ne montre que présence + longueur) et du process PM2.

## Process

```
$ pm2 jlist
web   online   restarts=22
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/api/health
200
```

## Variables pilotant génération + publication

| Variable | État réel | Effet |
|---|---|---|
| `SOCIAL_PUBLISHING_MODE` | **vide / non défini** | → défaut `dry_run` : **publication simulée**, rien n'est posté |
| `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` | vide | aucun compte épinglé |
| `CONTENT_STUDIO_ENABLED` | `true` (4 chars) | Studio accessible |
| `CONTENT_STUDIO_IMAGE_PROVIDER` | `mock` (4 chars) | fallback legacy → SVG |
| `CONTENT_STUDIO_V2_MOCK_MODE` | **vide** (défaut zod `'false'`) | défaut env de mode = non-mock |
| **`OPENAI_API_KEY`** | **PRÉSENT** (`sk-`, 164 chars, valide) | ⚠️ **MAIS non mappé dans `env.ts`** : lu seulement via `process.env` (pipeline A), **invisible** au flux create (pipeline B) |
| `CONTENT_STUDIO_OPENAI_API_KEY` | **vide** | le flux create lit **uniquement** cette variable → gen OpenAI **impossible côté opérateur** |
| `CHAT_OPENAI_API_KEY` | **vide** | pas de fallback texte |
| `AI_ENGINE_OPENAI_API_KEY` | **vide** | (mais `engine-config.ts` retombe sur `process.env.OPENAI_API_KEY`) |
| `AI_ENGINE_HIGGSFIELD_API_KEY` | **présent** (67 chars) mais **sans `:`** | moitié `KEY_SECRET` manquante |
| `AI_ENGINE_HIGGSFIELD_API_SECRET` | **vide** | credential **incomplet** → gen Higgsfield throw |
| `POSTIZ_BASE_URL` | présent (33 chars) | Postiz self-hosted joignable |
| `POSTIZ_API_KEY` | présent (64 chars) | auth Postiz disponible |

## Conséquence directe (vérifiée)

> En l'état du gel, **toute génération en mode LIVE échoue côté flux create opérateur** (`HttpError invalid_state`) :
> - modèle OpenAI (`gpt-image-*`) → `CONTENT_STUDIO_OPENAI_API_KEY manquant` ;
> - modèle Higgsfield (`hf-*`) → `credential Higgsfield incomplet` ;
> - mode `live` sans modèle → `… CONTENT_STUDIO_OPENAI_API_KEY manquant`.
>
> **Seul le mode MOCK produit un résultat.** La **publication** est **simulée** par défaut (`dry_run`).

### Correction importante (vérifiée le 2026-05-29, auditeur principal)

L'affirmation initiale « aucune clé OpenAI » est **inexacte** : une clé **`OPENAI_API_KEY` valide est bien présente** dans le process (relevé `/proc/<pid>/environ`, `sk-`, 164 chars). Le blocage de la génération OpenAI côté opérateur ne vient **pas** d'une clé manquante mais d'un **split de variable d'environnement** :
- `image-generation.ts` / `generation.ts` (pipeline B, flux create) lisent **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) ;
- `OPENAI_API_KEY` **n'est même pas déclaré dans `src/lib/env.ts`** (ni schéma ni mapping runtime) → invisible à l'objet `env` typé ;
- seul `engine-config.ts:75` (pipeline A, AI-Engine) retombe sur `process.env.OPENAI_API_KEY`.

> **Implication action plan** : débloquer la génération image/texte LIVE de l'opérateur ne nécessite **pas** d'acheter une clé — il suffit d'ajouter `OPENAI_API_KEY` en fallback dans la chaîne de résolution du flux create (cf. `BUG-001`). C'est un correctif **bon marché** et à fort impact.

## Contradiction relevée (UI vs réalité)

```
$ curl -s -H "Cookie: <session>" "http://127.0.0.1:8012/api/admin/content-studio/models?role=image&format=post"
{"models":[{"id":"gpt-image-1",...,"source":"live"}, ...]}
```

Le sélecteur de modèles annonce `gpt-image-1` avec `source:"live"` **alors qu'aucune clé OpenAI n'est configurée** : l'opérateur se voit proposer des modèles « live » qui **échouent à l'usage**. Désynchronisation UI/réalité (cf. registre `create-ui-flow`).
