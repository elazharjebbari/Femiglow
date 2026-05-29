# BUG-045 — Mock dry-run et fixtures Postiz divergent de l'API Postiz réelle (formats/permalinks fictifs)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | test-mock-infrastructure |
| **Composant** | `src/lib/social-publishing/adapters/dry-run.ts + src/test/fixtures/social-publishing/index.ts` |
| **Mode mock** | `works` |
| **Mode live** | `untested` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Le mode dry_run (défaut, SOCIAL_PUBLISHING_MODE non défini) simule la publication ; les tests dry-run sont censés représenter le comportement Postiz.

## État réel vérifié
DryRunSocialPublishingAdapter renvoie des permalinks 'https://social.example.test/<platform>/draft/<remoteId>' et un remoteId déterministe (sha256), shapes qui n'existent pas chez Postiz. Les fixtures postiz* (postizPostsNowSuccess.status='SENT', permalink instagram.com/p/abc123) sont écrites à la main, jamais validées contre la vraie réponse Postiz. Aucun test ne confronte dry-run vs PostizSocialPublishingAdapter (parité).

## Écart
Les tests valident que le dry-run renvoie ce que le dry-run renvoie ; ils ne garantissent pas que la bascule live (Postiz) produira un comportement compatible. Le passage dry_run→live n'a aucun filet de parité.

## Cause racine
Pas de contract test Postiz ; fixtures inventées. La sécurité interdit (à raison) de publier en live, mais aucune doublure fidèle (MSW calqué sur l'OpenAPI Postiz) ne comble le vide.

## Preuves
- dry-run.ts:46-48 permalink 'https://social.example.test/.../draft/<remoteId>' (host fictif)
- dry-run.ts:141-143 deterministicRemoteId sha256 → 'dry_<hex18>' (pas un id Postiz)
- fixtures/index.ts:257-273 postizPostsNowSuccess/{Draft} écrits à la main, status 'SENT'/'DRAFT'
- .env: SOCIAL_PUBLISHING_MODE=<NOT DEFINED> → dry_run ; POSTIZ_BASE_URL/POSTIZ_API_KEY présents (live dispo mais interdit de tester)
- grep parity: aucun harnais (matches dans service.ts/hero-fields = mot 'parité' en commentaire seulement)

## Reproduction
Lire dry-run.ts publish() + fixtures postiz* ; chercher un test confrontant DryRun et Postiz adapters → inexistant.

## Piste de correction
Capturer une vraie réponse Postiz (sandbox) et en faire un MSW handler partagé ; ajouter un test de parité asservissant DryRun et Postiz au même contrat (statuts, permalink shape, codes d'erreur).

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Confirme: dry-run.ts:47-48 permalink 'https://social.example.test/.../draft/<remoteId>' (host fictif), l.142 deterministicRemoteId 'dry_<sha256[18]>' (pas un id Postiz). fixtures/index.ts:259-272 postizPostsNowSuccess status:'SENT' permalink 'instagram.com/p/abc123' ecrits a la main. Aucun test de parite DryRun vs Postiz (grep parity/parite/both-adapters = vide). Pas de contract test postiz (ls postiz*.test.ts = absent). SOCIAL_PUBLISHING_MODE non defini => dry_run par defaut, POSTIZ_* presents => bascule live possible sans filet de parite. Le passage dry_run->live n a aucun garde-fou de contrat.
- **Contre-preuve / nuance :** Nuance attenuante (pas refutante): le handler MSW postiz-handlers.ts cible le VRAI endpoint Postiz /api/public/v1/posts avec state:'DRAFT', donc une partie de l infra est plus fidele que ne le laisse entendre le finding; et l adapter postiz.ts utilise un extractPermalink generique (releaseURL/release_url/permalink/url) plutot que de presumer instagram.com. Mais aucun test ne confronte les deux adapters: le gap de parite reste entier.

> Réf. registre : `bug-register.csv` ligne `BUG-045` · matrice : `gap-matrix.csv`.
