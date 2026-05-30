# Runbook d'exécution — Batterie de tests AI Engine

## Prérequis

```bash
cd /var/www/femiglow-staging/apps/web

# 1. Service actif
systemctl is-active femiglow-staging.service  # doit retourner "active"

# 2. DB migrée
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM ai_engine_knowledge_collection;"  # doit retourner >= 9

# 3. Auth Playwright valide
node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('.auth/admin.json','utf8'));console.log(d.cookies.length > 0 ? 'OK' : 'EXPIRED')"

# 4. Si auth expirée, régénérer :
SECRET=$(grep '^ADMIN_SESSION_PASSWORD=' .env | cut -d= -f2)
NOW_MS=$(node -e "console.log(Date.now())")
EXPIRES_MS=$(node -e "console.log(Date.now() + 28800000)")
COOKIE=$(node -e "require('iron-session').sealData({adminId:'u_onfftcndxdne5c36',email:'admin@femiglow-maroc.com',issuedAt:$NOW_MS,expiresAt:$EXPIRES_MS},{password:'$SECRET',ttl:28800}).then(t=>console.log(t))")
node -e "require('fs').writeFileSync('.auth/admin.json',JSON.stringify({cookies:[{name:'femiglow_admin_session',value:'$COOKIE',domain:'127.0.0.1',path:'/',expires:-1,httpOnly:true,secure:false,sameSite:'Lax'},{name:'fg_consent',value:'all',domain:'127.0.0.1',path:'/',expires:-1,httpOnly:false,secure:false,sameSite:'Lax'}],origins:[{origin:'http://127.0.0.1:8012',localStorage:[{name:'fg_consent_chosen',value:'1'}]}]}))"
```

## Exécution séquentielle

### Étape 1 — Tests unitaires Vitest

```bash
# Lancer tous les tests AI Engine
node_modules/.bin/vitest run src/lib/ai-engine --reporter=verbose

# Vérifier : 0 échecs
# Si échecs → corriger le code, re-lancer

# Lancer avec couverture
node_modules/.bin/vitest run src/lib/ai-engine --coverage --reporter=verbose

# Vérifier : couverture ≥ 80% lignes
```

**Critère de passage** : 100% des tests verts, couverture ≥ 80%

### Étape 2 — Tests RTL composants

```bash
# Lancer les tests composants AI Engine
node_modules/.bin/vitest run src/components/admin/content-studio-v2/ai-engine --reporter=verbose
node_modules/.bin/vitest run src/app/admin/content-studio-v2/ai-engine --reporter=verbose

# Vérifier : 0 échecs
```

**Critère de passage** : 100% des tests verts

### Étape 3 — Tests MSW contract

```bash
# Lancer les tests contract API
node_modules/.bin/vitest run src/test/msw/ai-engine --reporter=verbose

# Vérifier : chaque handler MSW produit des réponses conformes au schéma Zod
```

**Critère de passage** : 100% des tests verts, aucun mismatch handler/route

### Étape 4 — Tests E2E Playwright pages

```bash
# Lancer les tests E2E AI Engine
npx playwright test e2e/content-studio-v2/ai-engine --reporter=list --timeout=120000

# Vérifier : 0 échecs, 0 flaky
```

**Critère de passage** : 100% passants, durée < 3min

### Étape 5 — Scénarios métier E2E

```bash
# Lancer les scénarios métier (serial, ordre important)
npx playwright test e2e/content-studio-v2/ai-engine-scenario --reporter=list --timeout=180000

# Vérifier : le golden path passe de bout en bout
```

**Critère de passage** : Golden path 100% vert

### Étape 6 — Rapport final

```bash
# Générer le rapport
node_modules/.bin/vitest run src/lib/ai-engine --reporter=json --outputFile=test-results/ai-engine-vitest.json
npx playwright test e2e/content-studio-v2/ai-engine --reporter=json --output=test-results/ai-engine-playwright.json

# Résumé
echo "=== RAPPORT FINAL ==="
echo "Vitest:" && cat test-results/ai-engine-vitest.json | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{d[\"numPassedTests\"]}/{d[\"numTotalTests\"]} passed')"
echo "Playwright:" && cat test-results/ai-engine-playwright.json | python3 -c "import sys,json;d=json.load(sys.stdin);s=d.get('stats',{});print(f'{s.get(\"expected\",0)}/{s.get(\"expected\",0)+s.get(\"unexpected\",0)} passed')"
```

## Boucle de correction

```
1. Lancer la batterie complète
2. Si échec(s) :
   a. Identifier le test en erreur
   b. Lire le message d'erreur
   c. Déterminer si c'est un bug dans le code ou dans le test
   d. Corriger
   e. Re-lancer UNIQUEMENT le test corrigé pour vérifier
   f. Re-lancer la batterie complète pour vérifier la non-régression
3. Si 100% vert → commit les tests
4. Si nouveau code ajouté → revenir à l'étape 1
```

## Checklist de validation finale

- [ ] Tous les tests Vitest passent (≥250 tests)
- [ ] Tous les tests RTL passent (≥150 tests)
- [ ] Tous les tests MSW contract passent (≥80 tests)
- [ ] Tous les tests Playwright passent (≥120 tests)
- [ ] Couverture ≥ 80% lignes
- [ ] Aucun test flaky (2 runs consécutifs identiques)
- [ ] Golden path E2E passe
- [ ] Temps total < 8 min
- [ ] Rapport JSON généré
