# BUG-037 — Mode LIVE Postiz jamais exercé end-to-end (upload média + POST /posts + extraction releaseURL non vérifiés en réel)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | publication-postiz |
| **Composant** | `src/lib/social-publishing/adapters/postiz.ts + src/lib/content-studio/postiz.ts (uploadPostizMediaFromUrl, createPostizDraft)` |
| **Mode mock** | `n/a` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
En mode live (SOCIAL_PUBLISHING_MODE=live), resolveDefaultAccount choisit un compte Postiz, l'adapter upload le média via POST /api/public/v1/upload (multipart), crée le post via POST /api/public/v1/posts, et extrait remoteId + permalink (releaseURL). Publication réelle sur Instagram.

## État réel vérifié
Le CONTRAT de lecture est prouvé correct: GET /api/public/v1/integrations sur l'instance réelle (postiz.lumiereacademy.com) avec header 'authorization: <clé brute>' renvoie HTTP 200 + 4 comptes IG réels. Mais AUCUNE publication live n'a été exercée: SOCIAL_PUBLISHING_MODE est dry_run en staging, et la sécurité interdit de publier en live (vrais comptes clients). Donc upload multipart, POST /posts avec type/now/schedule/draft, et extraction releaseURL/permalink restent non vérifiés en conditions réelles.

## Écart
Tous les tests adapters/postiz (34 verts) injectent des mocks (uploadMedia/createDraft) — ils ne touchent jamais l'API réelle. La chaîne live complète (média HTTPS public -> Postiz upload -> draft -> Instagram) n'a jamais été observée fonctionner.

## Cause racine
Par conception sécuritaire (dry_run par défaut + comptes clients réels). Principe directeur: non vérifié dans les deux modes = cassé par défaut pour le live.

## Preuves
- Probe read-only: curl -H 'authorization: <KEY>' https://postiz.lumiereacademy.com/api/public/v1/integrations => HTTP 200, count=4 (instagram: AlFenna Beauty, Lumière Academy, Chaplin Crêpes, Ahmed El Azhar Jebbari)
- /proc/3603360/environ: SOCIAL_PUBLISHING_MODE non défini => env.ts:120 défaut 'dry_run'; POSTIZ_BASE_URL + POSTIZ_API_KEY présents
- GET /api/admin/content-studio/publish-jobs: 11 jobs, by provider {dry_run:11}, ZÉRO postiz => le chemin live n'a jamais produit de job
- src/lib/social-publishing/adapters/postiz.ts:50-54 — deps injectables (uploadMedia/createDraft/fetchAnalytics) systématiquement mockées en test
- Contrat type 'draft' valide côté Postiz: /root/.agents/skills/postiz/FEATURES.md:213 type:'now'|'schedule'|'draft'|'update'

## Reproduction
Non exécutable sans risque: il faudrait poser SOCIAL_PUBLISHING_MODE=live et POSTer publish-now/draft-on-provider sur un compte Postiz réel, ce qui publierait sur un vrai compte client Instagram (interdit). Vérification possible uniquement sur un compte Postiz de test dédié.

## Piste de correction
Créer une intégration Postiz de TEST (compte jetable) et exercer la chaîne complète une fois en CI/staging avec un média HTTPS public réel. Vérifier le shape exact de la réponse upload (id/path) et de POST /posts (releaseURL/id) car parsePostizUploadedMedia et extractPostizPostId/extractPermalink reposent sur des hypothèses de clés.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Le contrat d'ÉCRITURE live (upload multipart /api/public/v1/upload + POST /api/public/v1/posts + extraction releaseURL/id) n'a jamais été exercé en réel. Vérifié: SOCIAL_PUBLISHING_MODE non défini dans /proc/<web pid>/environ => défaut dry_run (env.ts:120). Probe publish-jobs: by provider {dry_run:12}, ZÉRO postiz => aucun job live n'a jamais été produit. postiz.ts crée bien de vraies requêtes HTTP (createPostizDraft -> POST baseUrl/api/public/v1/posts:249; uploadPostizMediaFromUrl -> POST /api/public/v1/upload:226) avec authorization=clé brute, donc le code EXISTE mais reste non observé fonctionnel. Conforme au principe: non vérifié en live = cassé par défaut.
- **Contre-preuve / nuance :** Aucune contre-preuve trouvée. POSTIZ_BASE_URL=https://postiz.lumiereacademy.com et POSTIZ_API_KEY présents dans /proc/3603311/environ. parsePostizUploadedMedia (postiz.ts:167) et extractPostizPostId (181) reposent sur des hypothèses de clés (id/path, releaseURL/release_url/permalink/url) non confirmées par un POST réel.

> Réf. registre : `bug-register.csv` ligne `BUG-037` · matrice : `gap-matrix.csv`.
