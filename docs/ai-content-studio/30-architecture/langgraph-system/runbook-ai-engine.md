# Runbook AI Engine — Opérations et maintenance

## 1. Pré-requis staging

| Variable | Valeur requise | Description |
|---|---|---|
| `AI_ENGINE_ENABLED` | `true` | Active le module |
| `AI_ENGINE_DEFAULT_TEXT_PROVIDER` | `openai` | Provider texte |
| `AI_ENGINE_DEFAULT_TEXT_MODEL` | `gpt-4o-mini` | Modèle texte |
| `AI_ENGINE_DEFAULT_IMAGE_PROVIDER` | `openai` ou `mock` | Provider images |
| `AI_ENGINE_DAILY_BUDGET_CENTS` | `1000` | Budget quotidien (10 MAD) |
| `AI_ENGINE_MAX_BUDGET_PER_JOB_CENTS` | `100` | Budget max par job (1 MAD) |
| `AI_ENGINE_QUALITY_THRESHOLD` | `0.7` | Seuil qualité (0-1) |
| `AI_ENGINE_HUMAN_REVIEW_REQUIRED` | `true` ou `false` | HITL obligatoire |
| `OPENAI_API_KEY` | Renseigné | Clé API OpenAI (fallback) |

## 2. Vérification du système

```bash
# Health check
curl -s http://127.0.0.1:8012/api/admin/ai-engine/health | python3 -m json.tool

# Vérifier les providers
curl -s http://127.0.0.1:8012/api/admin/ai-engine/health | python3 -c "
import sys,json; d=json.load(sys.stdin)
for k,v in d['providers'].items():
    print(f\"{'✅' if v.get('configured') else '❌'} {k}: {v['provider']}\")"

# Vérifier la Knowledge Base
psql "$DATABASE_URL" -c "SELECT slug, document_count, chunk_count FROM ai_engine_knowledge_collection ORDER BY slug;"

# Vérifier les tables AI Engine
psql "$DATABASE_URL" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'ai_engine_%' ORDER BY 1;"
```

## 3. Smoke test sans coût

```bash
# Génération avec fallback déterministe (pas d'API key nécessaire)
AI_ENGINE_DEFAULT_IMAGE_PROVIDER=mock curl -s -X POST http://127.0.0.1:8012/api/admin/ai-engine/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" \
  -d '{"platform":"instagram","format":"post","contentType":"produit","briefInput":{"objective":"engagement","keyMessage":"Test smoke"}}'
```

Résultat attendu : `status: "completed"`, `caption` non vide, `qualityScores.average >= 0.6`.

## 4. Smoke test avec OpenAI

```bash
curl -s -X POST http://127.0.0.1:8012/api/admin/ai-engine/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" \
  -d '{
    "platform":"instagram",
    "format":"carousel",
    "contentType":"produit",
    "briefInput":{
      "objective":"conversion",
      "tone":"luxurious",
      "keyMessage":"Découvrez le kit FemiGlow — le rituel japonais pour des ongles naturellement lumineux",
      "productFocus":"Kit de soin FemiGlow"
    }
  }'
```

Résultat attendu : script (5 scènes), caption (>300 chars), hashtags (8+), images (3+), qualité ≥0.85.

## 5. Smoke test Reel vidéo

```bash
curl -s -X POST http://127.0.0.1:8012/api/admin/ai-engine/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" \
  -d '{
    "platform":"instagram",
    "format":"reel",
    "contentType":"rituel",
    "briefInput":{
      "objective":"awareness",
      "keyMessage":"Le secret des Japonaises pour des ongles parfaits",
      "productFocus":"Kit FemiGlow"
    }
  }'
```

Résultat attendu : script.voiceoverRequired=true, script.musicRequired=true, videos[0] présent.

## 6. Vérification du bridge Content Studio

Après une génération réussie, vérifier que les records sont créés :

```sql
SELECT ci.id, ci.prompt, ci.status, ci.source_type, cd.caption, cd.score_total
FROM content_idea ci
JOIN content_brief cb ON cb.idea_id = ci.id
JOIN content_draft cd ON cd.brief_id = cb.id
WHERE ci.source_type = 'ai-engine'
ORDER BY ci.created_at DESC
LIMIT 5;
```

## 7. Générer/Régénérer les embeddings Knowledge Base

```bash
curl -s -X POST http://127.0.0.1:8012/api/admin/ai-engine/knowledge/embed \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" \
  --max-time 300
```

Ou via l'UI : `/admin/content-studio-v2/ai-engine/knowledge` → "Générer les embeddings"

## 8. Vérification des tendances

```bash
curl -s "http://127.0.0.1:8012/api/admin/ai-engine/trends?minScore=0.4&limit=10" \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" | python3 -m json.tool
```

## 9. Publication Postiz

```bash
# Lister les intégrations disponibles
curl -s http://127.0.0.1:8012/api/admin/ai-engine/integrations \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE"

# Publier un draft
curl -s -X POST http://127.0.0.1:8012/api/admin/ai-engine/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: femiglow_admin_session=$SESSION_COOKIE" \
  -d '{"draftId":"cd_xxx","mode":"schedule","scheduledAt":"2026-05-26T10:00:00Z"}'
```

## 10. Tests

```bash
# Tests unitaires AI Engine (70 tests)
cd /var/www/femiglow-staging/apps/web
node_modules/.bin/vitest run src/lib/ai-engine --reporter=verbose

# Tests E2E Playwright
npx playwright test e2e/content-studio-v2/ai-engine --reporter=list
```

## 11. Build et déploiement

```bash
cd /var/www/femiglow-staging/apps/web
NODE_ENV=production npx next build
chown -R nodeapp:nodeapp .next
fuser -k 8012/tcp 2>/dev/null; sleep 1
systemctl start femiglow-staging.service
```

## 12. Troubleshooting

| Symptôme | Cause probable | Action |
|---|---|---|
| Health check ❌ text provider | API key manquante | Vérifier `OPENAI_API_KEY` dans .env |
| Génération timeout | Pipeline trop long | Vérifier les logs : `journalctl -u femiglow-staging -f \| grep ai-engine` |
| Quality score < 0.65 → retry loop | Threshold trop haut pour le contenu fallback | Baisser `AI_ENGINE_QUALITY_THRESHOLD` ou améliorer les prompts |
| Bridge ❌ | Erreur DB dans content_generation_run | Vérifier les logs bridge : `grep -i bridge` dans journalctl |
| Embeddings échouent | API key OpenAI manquante ou quota dépassé | Vérifier la clé et le budget OpenAI |
| Service ne démarre pas | Port 8012 occupé | `fuser -k 8012/tcp` puis restart |
| Build échoue | Erreur TS dans les nouveaux fichiers | `npx tsc --noEmit` pour identifier |

## 13. Métriques à surveiller

| Métrique | Seuil alerte | Action |
|---|---|---|
| Taux de succès < 90% | Alerte | Vérifier les logs d'erreur, provider health |
| Coût quotidien > 80% du budget | Warning | Réduire la fréquence ou augmenter le budget |
| Latence P95 > 60s | Warning | Vérifier le provider vidéo/image |
| Score qualité moyen < 0.7 | Warning | Ajuster les prompts, enrichir la knowledge base |
| Knowledge chunks = 0 | Critique | Lancer POST /knowledge/embed |
