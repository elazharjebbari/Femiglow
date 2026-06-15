# 13 — Runbook gate 3 : test de publication live contrôlé (Postiz, `publishMode:'draft'`)

Dernier gate ouvert de la Phase 4 (doc 11 §B.3). Objectif : prouver UNE FOIS,
de bout en bout, que le pipeline atteint un vrai Postiz et y crée un **draft**
(jamais une publication) — sur un **compte dédié au test, jamais un compte
client**.

> ⚠️ Ce runbook ne s'exécute qu'avec la décision explicite du propriétaire et
> les credentials d'un compte de test. Rien ici n'est automatisé : chaque
> étape est manuelle et réversible.

## ⚠️ État du Postiz actuel (vérifié 2026-06-15)

Le Postiz (`postiz.lumiereacademy.com`) est de nouveau **opérationnel** (API
200) après la réparation infra du 2026-06-11/15. MAIS les comptes connectés
sont **tous des comptes réels / clients** : « Ahmed El Azhar Jebbari »,
« Chaplin Crêpes » (`crepes_chaplin_creperie`), « Lumière Academy », etc.
**AUCUN compte de test dédié.** Le test live ne peut donc PAS démarrer en
l'état : publier (même un draft) doit viser un compte créé pour l'occasion,
jamais l'un de ceux-ci. Première action obligatoire du jour J : connecter un
compte Instagram de test dans Postiz, puis forcer
`SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` dessus.

## Pré-requis (à fournir par le propriétaire)

1. Un **compte social de test connecté dans Postiz** (compte Instagram créé
   pour l'occasion), OU un workspace Postiz dédié. Jamais `femiglow` ni un
   compte client (cf. liste ci-dessus).
2. `POSTIZ_BASE_URL` + `POSTIZ_API_KEY` du workspace ciblé (les valeurs staging
   actuelles dans `.env` pointent sur le Postiz existant — vérifier qu'elles
   ciblent bien le bon workspace avant de passer live).

## Garde-fous codés (vérifiés le 2026-06-11 sur l'arbre mergé)

- `SOCIAL_PUBLISHING_MODE` (env.ts:156) : défaut `dry_run`. Tant qu'il ne vaut
  pas `live`, `executeJob` REFUSE tout compte non-`dry_run`
  (admin-service.ts:548-556, kill-switch P1-2).
- `publishMode:'draft'` est honoré par l'adapter Postiz indépendamment du
  reste (postiz.ts:276-279 : « Explicit publishMode always wins ») → le post
  arrive dans Postiz en brouillon, RIEN ne part vers le réseau social.
- `resolveDefaultAccount` ne retombe jamais silencieusement sur un compte réel
  (P1-2) ; `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` permet de FORCER le compte
  de test.

## Procédure (jour J, ~30 min)

1. **Préparation** (réversible, app toujours en dry_run) :
   - `POST /api/admin/social/accounts/sync` (session admin) → importe les
     comptes du workspace Postiz dans `social_account`. Noter l'`id` du compte
     de test (`SELECT id, provider, platform, name FROM social_account WHERE provider='postiz';`).
   - Dans `.env` : `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID=<id du compte de test>`.
2. **Bascule live** (la SEULE étape sensible) :
   - `.env` : `SOCIAL_PUBLISHING_MODE=live` puis `systemctl restart femiglow-staging`.
   - Vérifier `NRestarts=0` + health 200.
3. **Le test** : depuis `/admin/content-studio-v2/create`, dérouler
   idée → variante → média → Approuver → **Publier (brouillon Postiz)**
   (le chemin `publishMode:'draft'`, admin-service.ts:318). PAS « Publier
   maintenant ».
4. **Vérifications** :
   - `social_publish_job` : 1 job `succeeded`, `delivery.remoteId` renseigné ;
   - UI Postiz du workspace de test : le draft existe, contenu+média corrects ;
   - le réseau social : RIEN n'est parti (c'est un draft Postiz).
5. **Retour arrière IMMÉDIAT** (même si tout est vert) :
   - `.env` : `SOCIAL_PUBLISHING_MODE=dry_run` (ou supprimer la ligne) +
     restart + health 200. Le staging ne reste JAMAIS en live.
   - Effacer le draft dans Postiz si souhaité.
6. Consigner le résultat ici (date, id du job, remoteId, captures) → gate 3
   fermé.

## Échecs possibles et lecture

| Symptôme | Cause probable |
|---|---|
| job `failed` avec `kill-switch` dans le message | `SOCIAL_PUBLISHING_MODE` n'a pas été rechargé (restart manquant) |
| 401/403 Postiz | `POSTIZ_API_KEY` du mauvais workspace |
| job `succeeded` mais pas de draft visible | mauvais compte (`remote_id`) — vérifier `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` |
| rien ne se passe | le scheduler n'a pas de timer (décision 2026-06-10 : déclenchement manuel) — `POST /api/cron/content-studio/social-publish-scheduler` avec `Authorization: Bearer $CRON_SECRET` |
