# ADR-0010 — Résolution absolue de `MEDIA_DIR` + isolation du stockage des tests

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Workstream** : backend (ACT-BE)
- **Findings liés** : `MISS-004`, `MISS-024`, `MISS-032`, en appui de `BUG-031` (pollution test)
- **Actions liées** : ACT-BE-002, ACT-BE-003 (caches), ACT-BE-004
- **Décisions parentes** : ADR-0002 (vérité), ADR-0003 (parité mock/live)

## Contexte

Les 6 nodes média (`generate-voiceover.ts:13`, `generate-music.ts:13`, `generate-video.ts:16`, `compose.ts:15`, `transcode-export.ts:15`, `generate-subtitles.ts:8`) calculent tous :

```
MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine')
```

Deux défauts liés :

1. **Pollution du stockage de prod par les tests** (BUG-031) : les tests écrivent dans le **même** répertoire que le runtime ; **977 fichiers stubs de 10-14 octets** (« mock-image ») polluent `.media-storage/ai-engine`. Si un `assetId`/`url` de stub a été persisté en table `media` lors d'un test job-lifecycle non isolé, un média de 10 octets pourrait être **servi à la place d'un vrai visuel** (corruption silencieuse, MISS-004).
2. **Couplage implicite au `cwd`** (MISS-024/032) : `../../` ne résout correctement que lancé depuis `apps/web`. Tout changement de `cwd` (script, worker, cron, build standalone) casse **silencieusement** le chemin de stockage **et** de service média.

## Décision

1. **`MEDIA_DIR` résolu via une racine absolue** injectée par configuration/env (jamais `join(process.cwd(), '../../')`). Une seule source de vérité partagée par les 6 nodes.
2. **Isolation totale du stockage en test** : `vitest` écrit dans un `tmpdir` dédié, jamais dans `.media-storage` runtime. Vérifié par diff before/after de `vitest run`.
3. **Purge des stubs** : auditer la table `media` pour références < 100 octets, purger les ~977 stubs jpg, garantir qu'aucune row `media` ne pointe vers un fichier non valide.

## Conséquences

- ✅ Le runtime média est déterministe quel que soit le `cwd` de lancement (prod PM2, cron, worker).
- ✅ Les tests ne polluent plus la prod ; un stub de 10 octets ne peut plus être servi comme média réel.
- ✅ Pré-condition des tests d'intégration média réels (compose/transcode, ACT-BE-031) qui exigent un stockage isolé et propre.
- ⚠️ Nécessite de déclarer/documenter la racine média absolue dans la config d'environnement (runbook).

## Alternatives écartées

- **Garder le chemin relatif + n'isoler que les tests** : laisse le couplage `cwd` runtime (MISS-024/032) intact ; le bug réapparaît au premier changement de `cwd` (build standalone, worker dédié).
- **Purge ponctuelle sans isolation** : les tests re-polluent immédiatement le stockage.
