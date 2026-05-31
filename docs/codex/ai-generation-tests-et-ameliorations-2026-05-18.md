# AI Generation - Tests executes et ameliorations deduites

Date: 2026-05-18  
Environnement: staging, `/var/www/femiglow-staging`

## Portee

Cette passe cible uniquement la partie AI generation du Content Studio:

- generation texte depuis une idee;
- generation de brief et de brouillons;
- revue brand-safety locale;
- generation visuelle;
- media `ai_generated`;
- journalisation `generation_runs`;
- integration Postiz en lecture seule.

## Resultats des tests

| Zone | Test execute | Resultat | Commentaire |
| --- | --- | --- | --- |
| State machine | `vitest` cible Content Studio | OK | Ajout du cas `idea -> generated`. |
| MSW/API simulees | `src/test/msw/content-studio-handlers.test.ts` | OK | Generation, variation, approve, reject, Postiz draft simules. |
| Image generation mock | `image-generation.test.ts` | OK | Generation PNG mock sans cout OpenAI. |
| Smoke backend reel | `pnpm --dir apps/web smoke:content-studio` | OK apres correction | Cree idee, genere drafts fallback, genere media IA mock, verifie le compartiment IA. |
| UI Playwright cible | `--grep "genere des brouillons"` | OK | Cree idee, genere 3 drafts, genere un visuel mock depuis l'UI. |
| UI Playwright complete Content Studio | `e2e/content-studio.spec.ts --project=chromium` | OK | 21 tests passes. |
| Build | `pnpm --dir apps/web build` | OK avec warnings existants | Warnings Handlebars et dynamic server usage hors AI generation. |
| Typecheck | `pnpm --dir apps/web typecheck` | OK | Relance seul apres build. |
| Postiz integrations | test lecture seule `syncPostizIntegrations()` | OK | 4 integrations detectees, sans creation de publication. |
| OpenAI texte reel | smoke reel avec `CONTENT_STUDIO_OPENAI_API_KEY` injectee depuis la cle OpenAI staging | OK | Generation de brief/drafts via OpenAI. |
| OpenAI image reel | smoke reel avec `CONTENT_STUDIO_IMAGE_PROVIDER=openai` | OK | Media `ai_generated` cree et optimise avec `gpt-image-1-mini`. |
| Postiz draft reel sans media | creation draft Postiz sur integration Instagram | OK apres correction | Delivery `sent`, sans publication automatique. |
| Postiz draft reel avec media IA | retry sur post approuve avec media IA | OK | Delivery `sent`, upload media puis creation draft Postiz. |

## Bug trouve et corrige

Le smoke backend a revele un blocage fonctionnel:

- `generateIdeaDrafts()` creait bien le brief et les drafts;
- puis la route echouait sur `Transition Content Studio invalide: idea -> generated`;
- cause: la state machine autorisait `idea -> brief`, mais l'API actuelle fait `idea -> generated` en une seule action.

Correction appliquee:

- `idea -> generated` est maintenant une transition autorisee;
- le test de state machine couvre explicitement ce chemin;
- un test Playwright couvre le flux UI complet jusqu'au media IA mock.

## Ce qui reste non teste

| Zone | Statut | Raison |
| --- | --- | --- |
| Publication sociale reelle | Non teste | Hors scope staging sans confirmation explicite, car cela cree un effet externe. |
| Retry OpenAI/Postiz | Non teste | Pas encore de mecanisme robuste de retry/backoff a valider. |
| Concurrence multi-admin | Non teste | Pas encore de verrou metier/idempotency sur la generation par idee/draft. |

## Tests reels executes ensuite

Les tests reels ont ete lances apres confirmation utilisateur, avec effets externes limites a la creation de drafts Postiz, sans publication automatique.

| Test reel | Resultat | Evidence |
| --- | --- | --- |
| OpenAI texte + image | OK | `provider=openai`, `model=gpt-image-1-mini`, media `me_vr9gw4sspazskqdt`. |
| Postiz avec media IA | Premier essai KO puis retry OK | Premier essai: upload source media 503. L'URL media repondait ensuite HTTP 200; retry Postiz OK, delivery `cpd_4goixt26hghusql1` en `sent`. |
| Postiz sans media | KO puis OK apres correction payload | Postiz exige `image` comme tableau meme vide. Correction: `image: []`; delivery `cpd_xumnabrl52h5wo11` en `sent`. |

Bug corrige pendant ces tests reels:

- `buildPostizDraftPayload()` omettait `image` quand aucun media n'etait fourni.
- Postiz repondait `400` avec `posts.0.value.0.image must be an array`.
- Le payload envoie maintenant `image: []` pour les drafts texte seul.

Point a ameliorer:

- `postizPostId` reste `null` sur les deliveries `sent`; il faut adapter `extractPostizPostId()` a la forme exacte de reponse Postiz pour faciliter l'audit admin.
- L'upload media peut echouer si la route media staging repond transitoirement 503; ajouter retry/backoff sur `fetch_source_media`.

## Ameliorations UI/UX deduites

1. Ajouter un panneau "Statut de generation" visible dans le Pipeline: provider utilise, modele, statut, cout, erreur, date.
2. Afficher clairement quand le texte est genere en `fallback` et non par OpenAI.
3. Ajouter un bouton "Relancer la generation" depuis un `generation_run` echoue.
4. Ajouter un etat de progression explicite pour les actions longues: generation texte, generation visuelle, upload Postiz.
5. Afficher la raison du blocage brand-safety directement sur le draft, pas seulement via erreur API.
6. Ajouter une comparaison lisible des 3 variantes: score, angle, CTA, hashtags, risque marque.
7. Afficher un badge "Mock staging" sur les visuels generes quand le provider image est mock.
8. Ajouter une confirmation avant toute action Postiz qui cree un objet externe.
9. Ajouter un onglet ou filtre "Runs" pour auditer les generations par campagne/idee/draft.
10. Ajouter un bouton "copier prompt final" pour debug editorial.

## Ameliorations systeme deduites

1. Introduire une file de jobs pour les generations longues au lieu de routes HTTP longues.
2. Ajouter idempotency/verrouillage sur `/ideas/:id/generate` et `/drafts/:id/generate-visual`.
3. Ajouter retry avec backoff et statut `queued/running/succeeded/failed/retried`.
4. Stocker le prompt final texte et image dans `generation_runs` avec version explicite.
5. Ajouter tests contractuels OpenAI/Postiz opt-in, desactives par defaut.
6. Ajouter une commande smoke separee:
   - `smoke:content-studio:mock`;
   - `smoke:content-studio:openai`;
   - `smoke:content-studio:postiz-readonly`;
   - `smoke:content-studio:postiz-draft`.
7. Corriger la stabilite systemd staging: pendant cette passe, le service officiel a ete observe en `inactive (dead)` apres des stops externes, donc les tests UI ont ete termines avec un `next start` temporaire.
8. Corriger les warnings de build hors AI generation pour reduire le bruit CI.
9. Ajouter une retention/nettoyage des donnees de test Content Studio creees par smoke/Playwright.
10. Ajouter un budget journalier par provider et par action, visible dans l'UI.

## Decision

Le pipeline AI generation mock/fallback est maintenant valide sur staging. La prochaine validation a forte valeur est un mode opt-in, controle et documente, pour tester OpenAI reel et Postiz draft reel sans publier automatiquement.
