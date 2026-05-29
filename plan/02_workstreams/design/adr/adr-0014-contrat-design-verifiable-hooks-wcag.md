# ADR-0014 — Contrat de design vérifiable : hooks de sélection stables + WCAG AA verrouillé en CI

- Statut : **proposé** (conception ; aucun code applicatif modifié)
- Date : 2026-05-29
- Workstream : design
- Lié : BUG-029, BUG-055 (E2E faux sur libellé bouton vidéo) ; MISS-DESIGN-001/002 (contraste, hors registre Phase 1) ; recoupe BUG-007/BUG-021
- Principes : P1 (vérité = comportement réel), P7 (observabilité), P8 (maintenabilité)
- Tâches : ACT-DS-001, ACT-DS-002, ACT-DS-003

## Contexte

Deux specs E2E du parcours vidéo (BUG-029 major, BUG-055 minor) **échouent par timeout** parce qu'ils ciblent un **libellé textuel localisé** (`getByRole('button',{name:/Générer un visuel IA/i})`) alors que le bouton, en `kind=video`, affiche « Générer une vidéo IA » (`MediaStudio.tsx:240`, ternaire `kind === 'video'`). L'application est **correcte** ; le test est obsolète depuis l'introduction du libellé conditionnel. Conséquence : un rouge sur un parcours **fonctionnel** (probe : `kind=video durationMs=5000 reel-9x16.mp4 200 video/mp4 62 ko`), qui **masque les vrais signaux** — exactement la cause racine systémique #1 de l'audit (« l'outillage de test ne reflète pas le réel »).

En parallèle, l'audit d'axe a mesuré 3 paires de tokens `--cs-*` sous le seuil WCAG AA (texte muet 2.48/2.66:1, MockModeBadge 2.46:1), sans aucun garde-fou a11y dans la boucle.

Le point commun : **le contrat de design est implicite**. Les tests s'accrochent à des libellés volatils ; le contraste dépend de la discipline d'auteur. Rien n'empêche la régression.

## Décision

1. **Hooks de sélection stables, kind-aware, comme contrat de design.** Tout élément interactif structurant du parcours porte un attribut `data-cs-*` stable, indépendant de la locale et du `kind`. Les tests (RTL et Playwright) ciblent **ces hooks**, jamais un libellé localisé seul. Hooks normatifs (déjà présents pour la plupart) :
   - `data-cs-generate-button` (déclencheur de génération, `MediaStudio.tsx:238`) ;
   - `data-cs-kind` (valeur du type de média, `MediaStudio.tsx:432`) ;
   - `data-cs-video-badge`, `data-cs-video-duration` (badge VIDÉO·durée, `VideoPlayer.tsx:139/163`) ;
   - `data-cs-meta-kind`, `data-cs-meta-duration`, `data-cs-meta-dimensions`, `data-cs-meta-ratio` (bande de métadonnées) ;
   - `data-cs-model-source-badge` (état de source du modèle).
   L'**invariant** : libellé ⇔ icône ⇔ badge ⇔ durée dérivent **tous** du `kind` via une source unique ; un test du contrat vérifie cet invariant pour `kind ∈ {image,video}`.

2. **WCAG AA comme invariant CI.** Un test de contraste reproductible (luminance relative WCAG 2.1) s'exécute sur **toutes** les paires token×surface utilisées pour du texte, dans les **deux** thèmes, et **bloque** la CI si une paire de texte normal est < 4.5:1 (ou < 3:1 pour ≥ 14 px gras/large). La CI échoue sur l'**exit code** (P1), jamais sur une ligne de résumé.

## Conséquences

- BUG-029/055 sont corrigés **et** rendus non-régressables (ACT-DS-001 + ACT-DS-002).
- Tout changement futur de libellé/icône casse un test de contrat ciblé (rouge explicite), pas un parcours réel (vert préservé).
- Le contraste devient une propriété **vérifiée**, pas espérée ; l'avertissement de coût (MockModeBadge) redevient lisible.
- Coût : faible (les hooks existent ; le travail est de documenter le contrat et d'ajouter les gardes). Les nouveaux composants devront porter les hooks (convention documentée dans `design-system.md`).

## Alternatives écartées

- **Patcher la seule regex du spec** : corrige le symptôme, pas la cause ; la prochaine évolution de libellé re-casse. Rejeté.
- **Snapshots visuels** : coûteux, fragiles, ne capturent pas l'intention (kind). Complément possible plus tard, pas le contrat de base.
