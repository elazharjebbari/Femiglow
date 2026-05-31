# 80.1 — Déploiement

## Pré-requis

- Code review passée (2 approvals)
- Tests CI verts (jest + e2e:legal)
- Test ultimate passé
- Juriste a validé les nouvelles pages (si content change)

## Étapes

### Phase 1 — Préparation (D-1)

1. **Merge dans `master`** après review.
2. **CI run** : vérifier que tous les checks passent.
3. **Migration DB** : revue par DBA si schéma change.

### Phase 2 — Déploiement (J)

1. **Backup DB**

   ```bash
   pg_dump $DATABASE_URL > /backups/pre-legal-$(date +%F).sql
   ```

2. **Run migrations**

   ```bash
   pnpm drizzle-kit migrate
   ```

   Migrations attendues : 0033-0040 (cf. `docs/legal-pages/20-data/migrations.csv`).

3. **Seed initial** (premier déploiement uniquement)

   ```bash
   pnpm tsx scripts/seed-legal.ts
   ```

   Crée :
   - 8 zones par défaut
   - 21 template vars (avec valeurs vides à remplir)
   - 9 pages en status `draft`
   - 17 placements

4. **Deploy code**

   ```bash
   git push production master
   # ou via Vercel UI
   ```

5. **Smoke tests post-deploy**

   ```bash
   pnpm test:e2e:smoke -- --grep legal
   ```

6. **Vérifications manuelles**

   - [ ] `/admin/legal` accessible (admin login OK)
   - [ ] `/legal/cgv` (si seedée et publiée) accessible
   - [ ] Footer affiche les liens légaux
   - [ ] Cookie banner contient les liens
   - [ ] `/sitemap.xml` n'inclut pas les noindex
   - [ ] `/robots.txt` correct

### Phase 3 — Configuration initiale (J+0)

L'admin remplit les variables :

1. `/admin/legal/template-vars`
2. Saisir :
   - `COMPANY_RC` : RC réel
   - `ICE` : ICE réel
   - `IF` : IF réel
   - `COMPANY_ADDRESS` : adresse réelle
   - `CONTACT_EMAIL` : email support réel
   - `CONTACT_PHONE` : téléphone réel
   - Tous les autres
3. Sauver

### Phase 4 — Première revue et publication (J+1 à J+7)

Pour chaque page (commencer par les critiques) :

1. Ouvrir `/admin/legal/[slug]/edit`
2. Relire le contenu (template préconfiguré)
3. Ajuster aux spécificités FemiGlow (si besoin)
4. Vérifier que les variables s'affichent correctement en preview
5. Exporter PDF pour le juriste (bouton "Export PDF")
6. **Attendre la validation juriste** (cf. `legal-review-process.md`)
7. Une fois OK : publier (workflow 4 yeux : Maya + CEO)

Pages prioritaires (à publier en premier) :
1. Mentions légales (★ obligatoire)
2. CGV (★ critique pour vente)
3. Politique de confidentialité (★ CNDP)
4. Politique de cookies (★ ePrivacy)
5. Politique de retours (★ Loi 31-08)
6. Politique de livraison
7. Sécurité produits (★ Loi 24-99)
8. CGU
9. FAQ (peut être publiée en dernier)

### Phase 5 — Activation cron (J+7)

Une fois les pages publiées :

```bash
# Vercel cron config
{
  "crons": [
    {
      "path": "/api/cron/legal-link-health",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Vérifier que la 1ère exécution réussit : `/admin/legal/health` doit afficher un snapshot daté.

### Phase 6 — Activation git sync (optionnel)

Si activée :

1. Créer une branche `legal-versions` orpheline :
   ```bash
   git checkout --orphan legal-versions
   git rm -rf .
   echo "# Legal versions backup" > README.md
   git add README.md
   git commit -m "Initial commit on legal-versions branch"
   git push -u origin legal-versions
   ```

2. Configurer la clé SSH dédiée sur le serveur :
   ```bash
   ssh-keygen -t ed25519 -f /etc/femiglow/.ssh/legal-sync_ed25519 -N ""
   # Ajouter la pubkey comme Deploy Key sur GitHub (write access)
   ```

3. Activer l'env :
   ```bash
   LEGAL_GIT_SYNC_ENABLED=true
   LEGAL_GIT_SYNC_KEY=/etc/femiglow/.ssh/legal-sync_ed25519
   LEGAL_GIT_SYNC_REPO=git@github.com:femiglow/web.git
   ```

4. Vérifier après prochaine publication : la branche `legal-versions` contient un nouveau commit avec le contenu MD.

## Variables d'environnement

```bash
# Obligatoires
DATABASE_URL=postgres://...
NEXT_PUBLIC_SITE_URL=https://femiglow.ma

# Optionnelles
LEGAL_GIT_SYNC_ENABLED=false  # true en prod éventuellement
LEGAL_GIT_SYNC_REPO=git@github.com:femiglow/web.git
LEGAL_GIT_SYNC_KEY=/etc/femiglow/.ssh/legal-sync_ed25519
LEGAL_LINK_HEALTH_TIMEOUT_MS=5000
LEGAL_PREVIEW_CACHE_SECONDS=3600
```

## Checklist post-deploy

- [ ] `pnpm tsx scripts/audit-legal.ts` retourne OK
- [ ] Toutes les pages critiques accessibles publiquement (avec robots: noindex)
- [ ] Footer principal contient ≥ 5 liens valides
- [ ] Cookie banner contient politique-cookies + confidentialité
- [ ] Checkout : checkbox consentement renvoie aux bonnes pages
- [ ] `axe` pass sur /legal/cgv + /admin/legal
- [ ] `lighthouse --only-categories=accessibility` ≥ 95
- [ ] Cron `legal-link-health` exécuté avec succès
- [ ] Métriques Sentry/PostHog OK (pas d'erreurs liées au module legal)

## Documentation utilisateur

Communiquer à Maya / équipe :
- Lien admin : `https://femiglow.ma/admin/legal`
- Procédure mise à jour : `content-update-workflow.md`
- Contact tech en cas de souci : tech@femiglow.ma
