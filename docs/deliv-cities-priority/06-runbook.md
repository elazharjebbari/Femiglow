# Runbook — Exécution du développement Villes优先

## Pré-requis

- Branch `worktree-priority-cities` créée et checkoutée
- DB accessible (Neon PostgreSQL)
- `pnpm install` à jour

## Exécution pas-à-pas

### Étape 1 — Données : migration SQL + données statiques

```bash
# 1.1 Créer la migration
cd apps/web
pnpm drizzle-kit generate  # génère 0054_priority_cities.sql

# 1.2 Éditer la migration pour y mettre les UPDATE de position
# (voir 02-schema-api.md section 1)

# 1.3 Ajouter les 2 villes manquantes aux données statiques
# Éditer src/lib/checkout/data/moroccan-cities.ts :
# - Ajouter Bouskoura-Ville Verte
# - Ajouter Dar Bouaza
# - Ajouter le champ position à l'interface MoroccanCity
# - Ajouter PRIORITY_POSITIONS
# - Modifier searchCities() pour trier par position

# 1.4 Lancer les tests
pnpm vitest run src/lib/checkout/data/moroccan-cities.test.ts

# 1.5 Appliquer la migration en dev
pnpm db:migrate
```

### Étape 2 — Backend : query + API endpoint

```bash
# 2.1 Ajouter updateDeliveryCityPositions() dans queries
# Éditer src/lib/db/queries/delivery-cities.ts

# 2.2 Ajouter la Zod schema dans schemas
# Éditer src/lib/checkout/delivery/schemas.ts

# 2.3 Créer l'endpoint PATCH /positions
# Créer src/app/api/admin/delivery-cities/positions/route.ts

# 2.4 Lancer les tests
pnpm vitest run src/lib/db/queries/delivery-cities.test.ts
pnpm vitest run src/app/api/admin/delivery-cities/positions/route.test.ts
```

### Étape 3 — Admin UI : panneau villes优先

```bash
# 3.1 Installer @dnd-kit/core et @dnd-kit/sortable si pas déjà présent
pnpm add @dnd-kit/core @dnd-kit/sortable

# 3.2 Créer PriorityCitiesPanel
# Créer src/components/admin/settings/PriorityCitiesPanel.tsx

# 3.3 Modifier DeliveryCitiesEditor pour ajouter l'onglet
# Éditer src/components/admin/settings/DeliveryCitiesEditor.tsx

# 3.4 Ajouter le badge position dans la table catalogue
# Éditer DeliveryCitiesEditor.tsx (colonne Position)

# 3.5 Vérifier visuellement en dev
pnpm dev
# Aller sur /admin/settings/delivery-cities
# Vérifier l'onglet « Villes优先 »
```

### Étape 4 — Frontend : autocomplete avec villes优先

```bash
# 4.1 Modifier CityAutocomplete pour afficher le label de groupe
# Éditer src/components/checkout/wizard/components/CityAutocomplete.tsx

# 4.2 Modifier le hook useDeliveryCities pour ajuster la limite
# Éditer src/lib/checkout/delivery/use-delivery-cities.ts

# 4.3 Modifier searchCities() pour trier par position (query vide)
# Déjà fait en étape 1.3

# 4.4 Vérifier l'autocomplete en dev
pnpm dev
# Aller sur /kit, scroll jusqu'au wizard, cliquer sur le champ ville
# Vérifier que les villes优先 apparaissent en tête
```

### Étape 5 — Tests

```bash
# 5.1 Tests unitaires
pnpm vitest run src/lib/checkout/data/moroccan-cities.test.ts
pnpm vitest run src/lib/db/queries/delivery-cities.test.ts
pnpm vitest run src/app/api/admin/delivery-cities/positions/route.test.ts
pnpm vitest run src/components/admin/settings/PriorityCitiesPanel.test.tsx

# 5.2 Tests e2e
pnpm exec playwright test e2e/delivery-cities-priority.spec.ts

# 5.3 Lint + typecheck
pnpm lint
pnpm typecheck
```

### Étape 6 — Déploiement

```bash
# 6.1 Committer les changements
git add -A
git commit -m "feat(delivery-cities): villes prioritaires à l'affichage + admin UI"

# 6.2 Build
NODE_OPTIONS=--max-old-space-size=8192 pnpm build

# 6.3 Restart
sudo systemctl restart femiglow.service

# 6.4 Smoke tests
curl -s https://femiglow-maroc.com/api/health | jq .
curl -s 'https://femiglow-maroc.com/api/delivery-cities/search?limit=13' | jq '.items[:3] | .[].nameFr'
# Devrait afficher: "Casablanca", "Marrakech", "Tanger"

# 6.5 Configurer les positions优先 via l'admin
# Aller sur /admin/settings/delivery-cities
# Onglet « Villes优先 »
# Vérifier les 13 villes sont en place
# Réordonner si nécessaire
```

## Rollback

Si le déploiement pose problème :

```bash
# Revenir au commit précédent
git reset --hard HEAD~1

# Reconstruire
NODE_OPTIONS=--max-old-space-size=8192 pnpm build

# Restart
sudo systemctl restart femiglow.service

# Les positions en DB restent (0 par défaut), l'autocomplete revient au tri alpha
```

## Vérification post-déploiement

1. **Autocomplete** : Focus sur le champ ville → les 13 villes优先 apparaissent en tête
2. **Recherche** : Taper "cas" → Casablanca en premier
3. **Admin** : Onglet « Villes优先 » visible, drag & drop fonctionnel
4. **Non-régression** : Les autres villes sont toujours trouvées par recherche
5. **Mobile** : L'autocomplete fonctionne sur iOS Safari sans zoom auto