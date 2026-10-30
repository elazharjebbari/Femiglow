# Déploiement des PR 1 (données) et 2 (résolveur + registre)

**Règle unique : la migration 0087 passe AVANT le code.**

Pourquoi : le schéma Drizzle déclare `media.blur_data_url`, donc **toutes** les requêtes `select()` sur `media` (pages, galerie, admin) lisent cette colonne. Un code déployé avant la migration renvoie `column "blur_data_url" does not exist` sur chaque image. À l'inverse, l'ancien code tourne sans problème sur le schéma migré (tables et colonne nullable additives) : migrer d'abord ne coûte rien.

`bin/deploy-prod.sh` **ne lance aucune migration** (ni `pnpm install`) : il faut la faire à la main, avant.

## Étapes (sur le serveur, dans l'ordre)

1. **Récupérer le code sans le servir.** Le site en ligne sert `.next` (déjà compilé), pas les sources : mettre à jour les fichiers ne change rien pour les visiteuses.
   ```bash
   cd /var/www/femiglow
   git fetch origin <branche>
   git merge --ff-only origin/<branche>
   ```
   Aucune dépendance n'est ajoutée par ces PR : pas de `pnpm install`.

2. **Vérifier le journal des migrations.**
   ```bash
   cd apps/web
   node scripts/_validate-migrations.mjs --strict   # doit afficher « All checks passed »
   ```

3. **Voir ce qui sera appliqué (lecture seule).**
   ```bash
   pnpm db:migrate-safe:plan    # = node --env-file=.env scripts/_migrate-safe.mjs --plan
   ```
   Attendu : `Pending: 1` et `→ 0087_component_media_sets`, rien d'autre. Si une autre migration apparaît, s'arrêter et comprendre pourquoi.

4. **Appliquer la migration.**
   ```bash
   pnpm db:migrate-safe         # = node --env-file=.env scripts/_migrate-safe.mjs
   ```
   - Une seule transaction (`BEGIN … COMMIT`) : en cas d'erreur, rien n'est appliqué.
   - `SET LOCAL lock_timeout = '3s'` en tête : si `ALTER TABLE media` ne peut pas obtenir son verrou en 3 s (requête longue en cours), la migration échoue proprement au lieu de bloquer le site. Relancer simplement l'étape 4 un peu plus tard.
   - Contrôle :
     ```bash
     psql "$DATABASE_URL" -c "\d component_media_sets" -c "SELECT count(*) FROM media WHERE blur_data_url IS NOT NULL"
     ```
     La table existe, le compte vaut 0 (le flou sera rempli par la PR 3).

5. **Déployer le code** (build hors ligne, bascule atomique, contrôle de santé, retour automatique si KO).
   ```bash
   sudo bash /var/www/femiglow/bin/deploy-prod.sh <branche>
   ```
   Le `git merge --ff-only` du script est alors sans effet (déjà fait à l'étape 1).

6. **Synchroniser le registre** pour écrire `metadata.mediaVariants` du composant `kit-hero-produit` (et le champ CMS `mediaVariantsEnabled`, sans effet tant que la PR d'affichage n'est pas livrée et que `HERO_MEDIA_VARIANTS` n'est pas à `on`) : via le bouton de synchronisation de l'admin composants (`syncComponentRegistry`).

7. **Vérifier.**
   - `/kit`, `/ar/kit`, `/` répondent 200 avec leurs images (aucune erreur `blur_data_url` dans `journalctl -u femiglow.service`).
   - Médiathèque admin : la liste et la suppression fonctionnent.
   - Rien ne change visuellement : la PR 2 n'est branchée sur aucune page (`HERO_MEDIA_VARIANTS` reste `off` ou absente).

## Retour arrière

- **Code** : `deploy-prod.sh` revient seul à `.next-prev` si le contrôle de santé échoue ; sinon redéployer le commit précédent. L'ancien code est compatible avec le schéma migré.
- **Base** : ne PAS annuler la migration (tables vides, colonne nullable, aucun impact). Si vraiment nécessaire, et seulement après retour du code :
  `DROP TABLE component_media_set_history, component_media_set_items, component_media_sets; ALTER TABLE media DROP COLUMN blur_data_url;` puis supprimer la ligne correspondante de `drizzle.__drizzle_migrations`.

## Ce qu'il ne faut pas faire

- Lancer `deploy-prod.sh` avant l'étape 4.
- Utiliser `drizzle-kit migrate` / `db:push` en prod : passer par `_migrate-safe` (hash, plan, transaction).
- Modifier `0087_component_media_sets.sql` une fois appliquée quelque part : son hash est enregistré, toute modification la ferait rejouer.
