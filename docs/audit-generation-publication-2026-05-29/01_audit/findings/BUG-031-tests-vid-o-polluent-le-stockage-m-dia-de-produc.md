# BUG-031 — Tests vidéo polluent le stockage média de PRODUCTION avec des stubs texte (mock de writeFile/sharp inopérant)

| | |
|---|---|
| **Sévérité** | `major` |
| **Domaine** | generation-video |
| **Composant** | `src/lib/ai-engine/nodes/compose.ts:15 + compose.test.ts / transcode-export.test.ts (paths relatifs vers .media-storage réel)` |
| **Mode mock** | `broken` |
| **Mode live** | `n/a` |
| **Verdict vérification** | `adjusted` (confiance: high) |

## État supposé (code + tests)
Les tests des nodes (compose, transcode-export) mockent sharp et writeFile et n'écrivent rien sur le vrai disque.

## État réel vérifié
Des stubs texte reels (10o 'mock-image') sont ecrits dans .media-storage/ai-engine de PROD pendant vitest (dates 18:33:17 = run audit). La cause n'est PAS compose.test.ts/transcode-export.test.ts (qui mockent tous deux writeFile correctement) mais les tests qui exercent le graphe/nodes SANS mocker node:fs/promises: orchestrator.test.ts (runGeneration), generate-images.test.ts (generateImagesNode), job-lifecycle.test.ts, db-transaction.test.ts, concurrent.test.ts, security.test.ts. MEDIA_DIR = join(process.cwd(),'../../.media-storage/ai-engine') (compose.ts:15, generate-video.ts:16) pointe vers le stockage prod partage, sans isolation tmpdir.

## Écart
Des artefacts de test corrompent le stockage média réel (977 jpg majoritairement stubs). Risque: un composed-*.jpg de 10 octets pourrait être servi comme média si référencé. Pollution + bruit d'audit.

## Cause racine
MEDIA_DIR relatif partagé entre tests et runtime; mock writeFile partiel non garanti; absence d'isolation (tmpdir) dans les tests de nodes.

## Preuves
- xxd composed-00cf03c1-...jpg → 'mock-image' (10 octets)
- xxd composed-job-comp-1-...jpg → 'composed image' (14 octets)
- xxd export-instagram-post-...jpg → 'mock-image'
- ls --time-style → export/composed jpg datés 18:33:17, vitest Start at 18:32:40 (audit-vitest.log)
- compose.test.ts:34 → toBuffer: vi.fn().mockResolvedValue(Buffer.from('composed image')); transcode-export.test.ts:25 → readFile mock Buffer.from('mock image data')
- compose.ts:15 → const MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine')

## Reproduction
1) rm /tmp/m; pnpm vitest run src/lib/ai-engine/nodes/compose.test.ts. 2) ls -la .media-storage/ai-engine | grep composed → nouveaux fichiers 10-14 octets apparaissent.

## Piste de correction
Rendre MEDIA_DIR configurable (env) et pointer vers os.tmpdir() en test, ou mocker complètement node:fs/promises sans spread d'actual pour writeFile/mkdir. Nettoyer les stubs existants du stockage prod.

## Vérification adversariale
- **Verdict :** adjusted (confiance high)
- **Analyse :** Le PHENOMENE est reel et grave: des fichiers reels 'mock-image' (10 octets) dates 2026-05-29 18:33:17 existent dans le stockage prod .media-storage/ai-engine (composed-*.jpg, export-instagram-post-*.jpg), exactement pendant le run vitest (Start 18:32:40 +78s). MAIS la cause-racine / composant attribues sont FAUX. L'auditeur accuse compose.test.ts ET transcode-export.test.ts de ne pas intercepter writeFile — verifie: les DEUX mockent explicitement node:fs/promises avec writeFile: vi.fn().mockResolvedValue(undefined) (compose.test.ts:19-28, transcode-export.test.ts:19-24), donc ils N'ECRIVENT PAS sur disque. Les VRAIS pollueurs sont les tests qui exercent le graphe/nodes SANS aucun mock fs: orchestrator.test.ts (runGeneration, 0 mock fs/sharp/ffmpeg), generate-images.test.ts (generateImagesNode, 0 mock), job-lifecycle.test.ts, db-transaction.test.ts, concurrent.test.ts, security.test.ts. Le contenu 'mock-image' provient de sharp mocke (pipeline-real.test.ts:61 / budget-guard.test.ts:56 Buffer.from('mock-image')) mais ces deux-la mockent writeFile — c'est donc un test SANS mock fs important ces nodes (orchestrator/generate-images) qui ecrit reellement. Severite major maintenue, mais composant et rootCause corriges.
- **Contre-preuve / nuance :** ls --time-style=full-iso: composed-*/export-* dates 2026-05-29 18:33:17 (= run vitest). head -c30: 'mock-image' (10b). compose.test.ts:24 writeFile: vi.fn().mockResolvedValue(undefined) (MOCKE). transcode-export.test.ts:24 idem. orchestrator.test.ts: grep node:fs/promises = 0 (PAS de mock), importe runGeneration (graphe complet). generate-images.test.ts: 0 mock fs, exerce generateImagesNode. job-lifecycle/db-transaction/concurrent/security.test.ts: 0 mock fs.

> Réf. registre : `bug-register.csv` ligne `BUG-031` · matrice : `gap-matrix.csv`.
