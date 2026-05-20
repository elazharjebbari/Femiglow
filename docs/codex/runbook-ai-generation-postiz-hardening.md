# Runbook AI generation / Postiz hardening

Date: 2026-05-19
Environnement: staging uniquement.

## Préconditions

- Travailler depuis `/var/www/femiglow-staging`.
- Ne pas afficher les secrets en clair.
- Vérifier que les variables nécessaires existent: `POSTIZ_BASE_URL`, `POSTIZ_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `OPENAI_API_KEY` ou `CONTENT_STUDIO_OPENAI_API_KEY`.

## Commandes de validation

### 1. Tests unitaires et MSW ciblés

```bash
pnpm --dir apps/web exec vitest run src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/state-machine.test.ts src/test/msw/content-studio-handlers.test.ts
```

### 2. Typecheck

```bash
pnpm --dir apps/web typecheck
```

### 3. Build staging

```bash
pnpm --dir apps/web build
```

### 4. Permissions build Next.js

```bash
chmod -R a+rwX apps/web/.next
```

### 5. Redémarrage staging

```bash
systemctl restart femiglow-staging.service
systemctl status femiglow-staging.service
```

### 6. Smoke HTTP admin

```bash
curl -s -I http://127.0.0.1:8012/admin/content-studio
```

Résultat attendu: redirection `307` vers la page de login si la session admin n'est pas présente.

## Test réel Postiz contrôlé

Utiliser un post approuvé existant et une intégration Postiz staging. Ce test crée un brouillon côté Postiz, pas une publication immédiate.

```bash
cd apps/web
node --env-file=.env ../../node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs -e "import('./src/lib/content-studio/service.ts').then(async (svc)=>{ const result=await svc.createDraftInPostiz({ postId:'POST_ID_APPROUVE', integrationId:'INTEGRATION_ID', actorId:null, tags:[{value:'staging-test',label:'staging-test'}] }); console.log(JSON.stringify({ delivery:{ id:result.delivery.id, status:result.delivery.status, postizPostId:result.delivery.postizPostId, lastError:result.delivery.lastError }, postStatus:result.post.status }, null, 2)); }).catch((err)=>{ console.error(JSON.stringify({ name:err?.name, message:err?.message, details:err?.details ?? null }, null, 2)); process.exit(1); });"
```

## Diagnostic incident

- `Upload média Postiz échoué: HTTP 5xx`: vérifier l'URL média publique staging et relancer, le retry couvre déjà les erreurs transitoires.
- `auth_failed`: vérifier `POSTIZ_API_KEY` côté staging.
- `postizPostId = null` avec `status = sent`: inspecter la réponse Postiz stockée dans la delivery; ajouter la nouvelle forme JSON à `extractPostizPostId` si Postiz a changé son contrat.
- Build OK mais assets 404: redémarrer le service staging puis vérifier le process actif.

## Rollback

- Revenir au commit précédent si le build ou le typecheck échoue et que la cause n'est pas isolée.
- Ne pas supprimer les deliveries échouées: elles servent de preuve d'exploitation et de diagnostic.
