# Definition of Done — FemiGlow Content Studio v2 / AI Engine

> Baseline : `docs/audit-generation-publication-2026-05-29/`. Conforme aux principes P1–P5 (`00_overview/guiding-principles.md`) et ADR-0002/0003/0005/0006/0007.

## DoD GLOBALE

Le systeme est **100 % fonctionnel** uniquement si **chaque parcours operateur est prouve bout-en-bout par un test oriente operateur qui passe A L'IDENTIQUE en MOCK ET en LIVE**. Tant qu'un chemin n'est pas prouve dans les deux modes, il est **casse par defaut**.

Invariants non negociables :
- **Verite = comportement reel** : un test vert ne prouve qu'un effet backend observable (asset servi `200` octets valides, row `generation_run`, job date en base, permalien conforme). CI gate sur le **code de sortie** du process, jamais la ligne de resume.
- **Parite mock/live** : memes scenarios, drapeau unique `MODE=mock|live` ; MSW `onUnhandledRequest:'error'`, handlers calques sur les specs reelles ; detecteur de divergence (schema zod partage) rouge si la forme mock != live.
- **Garde-fou publication (P3, gate dur)** : activation live du scheduler bloquee tant que idempotence (ACT-BE-022/ACT-DA-003) + sync d'etat (ACT-DA-004) non prouvees. `dry_run` par defaut.
- **Resolution credentials unique** (ACT-ARC-013) : picker = generateur = graphe.
- **Sous-DoD credential externe** : si `KEY_SECRET` Higgsfield/ElevenLabs absent, le sous-DoD « contrat async + auth conforme prouves en mock fidele » est livrable ; la verif live (`bloque_credential`) se declenche a la fourniture du credential et ne bloque jamais la valeur OpenAI live.

La preuve d'acceptation par critere est dans `acceptance-criteria.csv` (commande/chemin operateur, statut mock + live, scenario de parite lie aux 34 scenarios de `mock-live-parity.csv`).

## DoD par phase (tiers de priorite)

- **Phase P0 — Verite & deblocage** (ARC-004/005/013/008, BE-001/010/020, DA-001/002/008, DS-001/002) : harnais honnete (exit-code, MSW global, contract-tests), resolution credentials unifiee, OpenAI image+texte live debloque, anti-fuite `/postiz-draft`, schema test `audit_events` reel. *Done quand* : suite verte ⇔ exit 0 ; image live `200` cost>0 ; aucun draft Postiz reel cree en mock/live.
- **Phase P1 — Pipelines & flux** (ARC-001/002/006/007/009, BE-011/012/021/022/030, DA-003/004/006, FE-006) : GenerationResult complet, pont A→B persiste les assets, file de jobs async + Higgsfield async, scheduler branche (mock/staging) garde par idempotence+sync, compte Postiz explicite. *Done quand* : reel mock+live produit des assets visibles en bibliotheque ; scheduler execute en dry_run.
- **Phase P2 — Convergence & alignement UI** (ARC-003, BE-013/017/023/031/035, FE-001/002, UX-001..004) : facade `invokeEngine`, texte LLM reel, picker honnete, modele honore/persiste. *Done quand* : badge Live ⇔ generabilite ; toggle mode a un effet reel.
- **Phase P3 — Robustesse & a11y** (BE-014/015/016, DA-005, DS-003, FE-008, UX-005..007) : variation reelle, fallbacks audibles, erreurs typees UI, WCAG AA. *Done quand* : aucun completed silencieux ; messages serveur preserves.
- **Phase P4 — Livrables avances** (BE-024/030/031/032/034, DS-004/005, FE-003/004/005/007/009) : voix-off/musique/montage exposes a l'operateur, uploads robustes. *Done quand* : pipeline complet atteignable depuis `/create`.
- **Phase P5 — Convergence finale & dette** (ARC-010/011/012, BE-002/003/004/033/035, DA-007, DS-006) : bascule par flag, gate smoke operateur mock+live bloquant en CI, retrait du double-moteur. *Done quand* : gate de parite vert sur les deux modes.

Chaque phase est *Done* seulement si **tous** ses criteres de `acceptance-criteria.csv` portent `statut_mock=pret` ET `statut_live=pret` (ou `bloque_credential`/`bloque_gate` justifie par le sous-DoD).
