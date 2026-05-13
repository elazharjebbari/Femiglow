# 90.4 — Risques + mitigations

## Risques projet

### R1 — Drift `default-mapping.json` vs `event-mapping.ts`

**Probabilité** : Moyenne
**Impact** : Moyen
**Description** : Un dev modifie `event-mapping.ts` sans synchroniser `default-mapping.json` → le default DB devient obsolète. Conséquence : reset au default applique des mappings différents du code attendu.

**Mitigation** :
1. Test CI `pnpm tracking:check-default-mapping` obligatoire sur PR
2. Script `pnpm tracking:generate-default-mapping` qui régénère depuis le code
3. Documentation PR template avec checklist "default-mapping.json mis à jour ?"

**Indicateurs** :
- CI bloque le merge si drift
- 0 drift détecté sur les 30 derniers jours

### R2 — Version active corrompue

**Probabilité** : Moyenne
**Impact** : Élevé
**Description** : Admin sauvegarde une version avec mappings vides/invalides puis l'active → dispatcher cesse de dispatch pour les providers concernés → conversions perdues.

**Mitigation** :
1. Validation Zod stricte côté serveur (regex par provider)
2. Bouton "Tester avant publier" (dry-run dispatch)
3. Confirm modale obligatoire à l'activate avec récap des changements
4. Rollback 1 click au default
5. Monitoring conversion rate post-activate : alert si chute > 30% en 1h

**Indicateurs** :
- 0 incident "conversions à 0" lié aux mappings
- Bouton Test utilisé > 80% des fois avant activate

### R3 — Format GTM Container change (Google update)

**Probabilité** : Faible
**Impact** : Moyen
**Description** : Google change le schema de `containerVersion` (rare mais possible — ex : `exportFormatVersion: 3`).

**Mitigation** :
1. Test CI round-trip mensuel avec un container réel GTM
2. Alertes sur deprecation notices Google
3. Versioning du builder GTM (gtm-export.ts v1, v2, ...)
4. Tests d'import GTM en staging trimestriel

**Indicateurs** :
- Round-trip test passe sans erreur
- Pas de format unexpected dans les exports

### R4 — Concurrence édition (2 admins simultanément)

**Probabilité** : Faible
**Impact** : Faible
**Description** : 2 admins éditent la même version active en même temps. Avec D-001 immutable, chacun crée sa propre version dérivée → pas de conflit data, mais "qui active quoi" peut surprendre.

**Mitigation V1** :
1. UI affiche en haut de l'éditeur : "Vous éditez v3 (active). Sauvegarder créera v4 draft."
2. Le last activate wins, mais avec audit log clair
3. Auto-refresh de la liste toutes les 30s

**Mitigation V2** :
1. Optimistic locking (If-Match: updated_at)
2. Notification real-time "Sara édite cette version"
3. Lock UI explicite

**Indicateurs** :
- 0 conflit reporté en 30 jours

### R5 — Performance resolver dégradée

**Probabilité** : Moyenne
**Impact** : Moyen
**Description** : Le resolver est appelé pour CHAQUE event /api/track × CHAQUE provider. Si cache mal optimisé, latence /api/track explose.

**Mitigation** :
1. Cache in-memory TTL 30s par (event, provider)
2. Mémoïsation `store.getActive()` séparée (1 fetch DB par TTL)
3. Index GIN sur mappings JSONB pour query rapide
4. Test perf p99 < 5ms (CI benchmark)

**Indicateurs** :
- /api/track p95 inchangé (< 200ms)
- Cache hit rate > 95%

### R6 — Stockage JSONB explose

**Probabilité** : Faible
**Impact** : Faible
**Description** : Si on crée beaucoup de versions × beaucoup de mappings → table grossit.

**Mitigation** :
1. FIFO max 50 versions (configurable)
2. Soft-delete + purge automatique > 90 jours (V2 cron)
3. Index GIN compact pour JSONB

**Indicateurs** :
- Taille table < 100 MB sur 12 mois

## Risques techniques

### R7 — Migration DB échoue

**Probabilité** : Faible (idempotent)
**Impact** : Faible
**Description** : `pnpm db:migrate` plante.

**Mitigation** :
1. Migrations toutes IF NOT EXISTS / DO $$ EXCEPTION
2. Backup pré-migrate obligatoire (cf. runbook)
3. Test en staging d'abord
4. Rollback SQL prêt (DROP IF EXISTS)

### R8 — Resolver cache stale après activate

**Probabilité** : Faible
**Impact** : Moyen
**Description** : Admin active v4, mais le cache resolver garde v3 jusqu'à TTL expiré → dispatcher dispatche avec ancien mapping pendant 30s.

**Mitigation** :
1. `store.activate()` invalide explicitement le cache (`invalidateMappingCache()`)
2. Documentation UI "Cache invalidé dans 30s max"
3. Multi-instance (V2) : invalidation via Redis Pub/Sub

**Indicateurs** :
- 0 incident "ancien mapping utilisé après activate"

### R9 — Export GTM produit JSON invalide

**Probabilité** : Faible
**Impact** : Moyen
**Description** : Bug dans `gtm-export.ts` → fichier produit non importable.

**Mitigation** :
1. Test ULTIMATE round-trip (build + parse via schema strict)
2. Validation schema Zod côté serveur avant retour
3. Audit log avec sha256 (permet retrouver le fichier exact si bug)

## Risques organisationnels

### R10 — Marketing pas formé

**Probabilité** : Moyenne
**Impact** : Moyen
**Description** : Sara ne sait pas utiliser l'outil → demande au dev quand même.

**Mitigation** :
1. Documentation user-friendly (microcopy française complète)
2. Démo M3 avec Sara (30 min)
3. Tooltips explicites dans l'UI
4. Vidéo tuto 5 min (optionnel V1)

**Indicateurs** :
- Sara crée au moins 1 version sans aide en M3+

### R11 — Disponibilité dev pour reviews

**Probabilité** : Moyenne
**Impact** : Moyen
**Description** : Reviews PR peuvent bloquer si Tech Lead absent.

**Mitigation** :
1. Découpage en PRs petites (max 500 LOC chacune)
2. Documentation auto-suffisante (ce dossier)
3. Pair-programming sur les modules critiques (store, gtm-export)

## Plan de mitigation globale

Toutes les semaines :
- Standup avec stakeholders (15 min)
- Review du registre des risques
- Update du milestone tracker

À chaque milestone :
- Go/No-Go decision avec Tech Lead + Sara
- Documentation à jour
- Tests verts confirmés
