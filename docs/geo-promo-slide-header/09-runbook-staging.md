# Runbook staging

Ce runbook doit etre execute depuis le worktree webhook.

```bash
cd /var/www/femiglow-leads-webhook-multi-step
```

## 1. Preflight

```bash
git status --short
git branch --show-current
```

Attendu:

- branche `worktree-webhook`;
- pas de changements inattendus hors chantier.

## 2. Verifier l'hebergement geo

Verifier si staging passe par Cloudflare:

```bash
curl -I https://staging.femiglow-maroc.com
```

Indices attendus si Cloudflare est actif:

- headers `cf-*`;
- proxy Cloudflare actif dans le DNS.

Si Cloudflare n'est pas actif:

- ne pas bloquer le developpement;
- utiliser headers simules en local/staging;
- planifier l'activation `Add visitor location headers` avant validation finale.

## 3. Activer Cloudflare visitor headers

Dans Cloudflare:

1. Ouvrir le domaine staging.
2. Aller dans Rules / Managed Transforms.
3. Activer `Add visitor location headers`.
4. Purger cache staging si necessaire.
5. Refaire un smoke HTTP.

## 4. Lancer tests unitaires

Commandes ciblees:

```bash
pnpm vitest run apps/web/src/lib/promo-slide-header
pnpm vitest run apps/web/src/components/promo
```

Adapter les chemins si la convention du repo differe.

## 5. Lancer Playwright

```bash
pnpm exec playwright test e2e/geo-promo-slide-header.spec.ts --project=chromium --workers=1
```

Verifier au minimum:

- desktop;
- mobile;
- `/kit` uniquement;
- checkout exclu;
- fermeture persistante;
- pas d'overflow.

## 6. Build

```bash
pnpm typecheck
pnpm build
```

Si une suite globale echoue pour une raison deja connue et non liee au chantier, conserver la preuve de la suite ciblee verte et documenter l'ecart.

## 7. Smoke API avec headers simules

Apres demarrage staging local ou service:

```bash
curl -s \
  -H "cf-ipcity: Casablanca" \
  -H "cf-region: Casablanca-Settat" \
  -H "cf-ipcountry: MA" \
  http://127.0.0.1:8011/api/promo/location
```

Attendu:

- `enabled=true` si la config admin publiee est active;
- message court contenant `Casablanca`, par exemple `Offre du 18 mai - Casablanca`;
- tags de reassurance presents;
- tag reduction present seulement si la promo kit est active;
- pas de headers bruts dans la reponse.

Fallback:

```bash
curl -s http://127.0.0.1:8011/api/promo/location
```

Attendu:

- message fallback Maroc ou `enabled=false` si desactive.

## 8. Smoke UI staging

Verifier:

- homepage;
- page kit;
- page produit ou marketing importante;
- mobile 375 px;
- desktop 1440 px;
- checkout sans bandeau.

Points de controle:

- aucun bandeau sur homepage et page produit hors `/kit`;
- sticky propre;
- aucun chevauchement;
- CTA fonctionnel;
- fermeture fonctionnelle;
- date courte;
- ville approximative ou fallback.
- tags visibles et scannables;
- reduction coherente avec `/kit`.

## 9. Rollback

Rollback sans code:

1. Desactiver `global-promo-slide-header` dans admin.
2. Publier la configuration admin.
3. Verifier que `/api/promo/location` renvoie `{ "enabled": false }`.

Le rollback produit ne doit pas demander de modification `.env`.

Rollback infra:

1. Desactiver Cloudflare `Add visitor location headers`.
2. Purger cache si necessaire.

Rollback code:

- revenir au commit precedent uniquement apres sauvegarde des changements du chantier;
- ne jamais faire de reset destructif sans accord explicite.

## 10. Validation finale

Le chantier est validable quand:

- tests ciblees verts;
- build vert;
- staging verifie;
- rollback teste;
- admin peut modifier contenu, style, tags et ordre sans redeploiement;
- admin ne peut pas saisir manuellement le pourcentage de reduction;
- aucun impact checkout observe.
