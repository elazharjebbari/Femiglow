# BUG-014 — Mismatch d'enum 'tone': l'UI AI-Engine propose des tons (empowering/authentic/urgent) rejetés par parse-brief → génération vidéo échoue AVANT tout node audio

| | |
|---|---|
| **Sévérité** | `critical` |
| **Domaine** | voix-off |
| **Composant** | `src/app/admin/content-studio-v2/ai-engine/create/page.tsx (TONES), src/app/api/admin/ai-engine/generate/route.ts (generateRequestFlat), src/lib/ai-engine/nodes/parse-brief.ts` |
| **Mode mock** | `broken` |
| **Mode live** | `broken` |
| **Verdict vérification** | `confirmed` (confiance: high) |

## État supposé (code + tests)
Les tons offerts dans l'UI sont acceptés par le moteur; la génération aboutit.

## État réel vérifié
Confirme. Desync d'enum sur 3 sources (UI, DTO route flat non contraint, parse-brief). empowering/authentic/urgent -> ZodError dans parseBrief -> status:failed avant tout node media. Identique mock/live.

## Écart
3 des 6 tons de l'UI cassent toute la génération (y compris audio) instantanément. L'opérateur qui choisit le ton 'Empowering' (1er proposé après le placeholder) obtient un échec.

## Cause racine
Désynchronisation des enums entre l'UI, le DTO d'entrée et la validation interne parse-brief; le DTO route flat ne valide pas le ton et laisse passer des valeurs invalides en aval.

## Preuves
- Probe POST {tone:'empowering', format:reel}: status:failed, errors[0].message contient 'invalid_enum_value ... received empowering ... options [professional,casual,playful,luxurious,educational,inspiring]'
- page.tsx:85-93 TONES inclut empowering/authentic/urgent
- parse-brief.ts:9 z.enum(['professional','casual','playful','luxurious','educational','inspiring'])
- generate/route.ts:34-50 generateRequestFlat: tone z.string().min(1) (non contraint)
- Probe de contrôle tone=inspiring -> status:completed (confirme que c'est bien le ton qui casse)

## Reproduction
1. Cookie admin. 2. POST /api/admin/ai-engine/generate avec tone:'empowering'. 3. Observer status:failed + invalid_enum_value sur 'tone'.

## Piste de correction
Aligner les trois sources: mapper les tons UI (empowering->inspiring, authentic->casual, urgent->...) dans normalizeRequest, OU élargir l'enum parse-brief, OU restreindre les options UI aux valeurs supportées. Idéalement valider le ton dès la route avec un message clair.

## Vérification adversariale
- **Verdict :** confirmed (confiance high)
- **Analyse :** Reproduit par double probe. POST {tone:'empowering', format:reel, MOCK} -> status:failed, errors[0]=invalid_enum_value received 'empowering' options [professional,casual,playful,luxurious,educational,inspiring] path ['tone']. Controle {tone:'inspiring'} -> status:completed. page.tsx:85-93 TONES inclut empowering/authentic/urgent (empowering 1er selectionnable). parse-brief.ts:9 z.enum sans ces 3. Create page envoie FLAT (page.tsx:660-664) -> generateRequestFlat (route.ts:39 tone non contraint) laisse passer -> ZodError au node parseBrief AVANT generate-video/voiceover/music/subtitles.
- **Contre-preuve / nuance :** Probe empowering->failed/invalid_enum_value; inspiring->completed. Note: le schema NESTE generateRequestSchema (route.ts:19) inclut empowering/authentic/urgent dans son enum tone, mais le create page envoie du FLAT et la valeur arrive intacte a parse-brief.ts:9 qui la rejette — crash inevitable quelle que soit la branche DTO.

> Réf. registre : `bug-register.csv` ligne `BUG-014` · matrice : `gap-matrix.csv`.
