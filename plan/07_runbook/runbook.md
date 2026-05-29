# Runbook d'exécution — P0..P5

> Vérité = comportement vérifié en MOCK **et** LIVE (parité). Un test vert ne suffit pas.
> Boucle par action : **CORRECTION → RE-TEST → VÉRIFICATION INDÉPENDANTE adversariale**. GATE dur entre phases.

## Pré-requis globaux
```bash
cd /var/www/femiglow-staging && pnpm install
cp apps/web/.env.example apps/web/.env.local   # clés provider, DB Drizzle, MEDIA_DIR absolu
pnpm --filter web db:migrate                    # schéma Drizzle (audit_events, content_post, social_publish_job)
```
- DB E2E sur schéma Drizzle (ACT-DA-002). MSW `onUnhandledRequest:'error'` (ACT-ARC-004).
- Mode par défaut : **MOCK** partout (`SOCIAL_PUBLISHING_MODE=dry-run`).

## Boucle standard (chaque action)
1. **CORRECTION** : implémenter l'action ; commit isolé.
2. **RE-TEST** : `pnpm vitest run` (exit-code = vérité), `pnpm test:e2e`.
3. **VÉRIF INDÉP. adversariale** : test négatif (ex: requête non-mockée ⇒ rouge) ; preuve live (row + asset `curl -i …` ⇒ 200).

## Harnais de parité
```bash
pnpm test:parity:mock && pnpm test:parity:live   # même scénario, 2 modes, divergence = échec (ACT-ARC-005)
```

## Mode LIVE sûr
```bash
# 1) garde-fous AVANT activation : ACT-BE-022 (idempotence) + ACT-DA-004 (sync état) verts
# 2) puis seulement :
export SOCIAL_PUBLISHING_MODE=live   # Postiz réel
curl -fsS -X POST $APP/api/cron/tick # scheduler self-hosted gardé (ACT-BE-021)
```

## Fermer l'exit-1
`pnpm vitest run; echo $?` doit valoir 0 ; CI gate sur exit-code (ACT-DA-008). Test négatif unhandled-request prouvé rouge avant correction.

---
## Déroulé par phase

### P0 — Vérité & parité (G0 dur)
- Étapes : ACT-ARC-004 → DA-008 → DA-001/002 → DS-001/002 → ARC-005 → ARC-013 → BE-010 → ARC-008 → BE-020.
- **GATE G0** : vitest rouge ⇔ vrai défaut ; 2 E2E opérateur verts ; A/B/picker = même clé (`resolveProviderCredential`) ; image+texte OpenAI **live** (row `generation_run` + asset 200) ; `/postiz-draft` neutralisé.

### P1 — Moteur unique + 4 blockers (G1 dur)
- Ordre : ARC-001 → ARC-002 ; ARC-009 → ARC-006 → ARC-007 → BE-011 → BE-012 ; DA-003/BE-022 + DA-004 **AVANT** BE-021 live.
- **GATE G1** : image/vidéo/texte live via moteur unique ; `buildResult` expose composition/exports/thumbnails ; pas de double-post ni publi d'un post annulé.

### P2 — Honnêteté create + façade B→A (G2)
- BE-013/BE-017 → ARC-003 (inactive par défaut) ; UX-001..004 ; FE-001/002.
- **GATE G2** : aucun badge Live faux ; texte = vrai LLM ; modèle choisi = tracé ; `invokeEngine` existe, texte transite par A en mock.

### P3 — Robustesse (G3)
- BE-016/014/015/023 ; FE-006/008 ; UX-005..007 ; DS-003 ; DA-005.
- **GATE G3** : retry borné prouvé ; `dry_run` reflète l'adapter ; compte Postiz jamais deviné ; échecs dans `state.errors` lisibles.

### P4 — Compose réel (G4)
- BE-002/DA-007 (isolation tmpdir) → BE-030/031/034 ; FE-003/004/005/009 ; DS-004/005 ; UX-008.
- **GATE G4** : `ffprobe` prouve mux audio+sous-titres ; assets composés servis 200 ; aucune row/fichier hors tmpdir.

### P5 — Convergence finale (G5 sortie)
- ARC-012 (smoke bloquant CI) → ARC-010 (bascule flag, retrait B) → ARC-011 ; BE-003/004/032/033/035 ; FE-007 ; DS-006.
- **GATE G5** : smoke opérateur mock+live vert **bloquant CI** ; B délègue tout à A (réversible par flag) ; minors/info clos.

---
## DoD global (fin de programme)
G0→G5 tous franchis ; parité mock/live prouvée à chaque gate ; exit-code = vérité en CI ; moteur unique A actif par flag réversible ; aucune dette blocker restante.
