# ADR-0013 — Une source de vérité unique pour le mode mock/live (toggle = badge = route = effet réel)

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Workstream** : ui-ux (ACT-UX)
- **Findings liés** : `BUG-021`, `MISS-001`, `MISS-016`, `MISS-034`
- **Actions liées** : ACT-UX-005, ACT-UX-006
- **Décisions parentes** : ADR-0002 (vérité = comportement réel), ADR-0007 (convergence vers A)
- **Dépend de (autres workstreams)** : ACT-ARC-RESOLVE-CRED / T-005 (config env unifiée), ACT-BE T-201 (la route texte doit honorer le mode), backend `health` route (expose `mockMode`)

## Contexte

Le mode mock/live a aujourd'hui **trois sources de vérité divergentes** + un **angle mort texte** :

- **Toggle (cookie)** : `MediaStudio` rend `<GenerationModeToggle />` **sans** `envDefault`, donc le toggle prend `'mock'` par défaut (prop ligne 44) et **pose le cookie à `mock` au montage** (`persistMode(next)`), quelle que soit l'intention serveur (BUG-021).
- **Badge (`health.mockMode`)** : `StudioContext` lit `health.mockMode` (= `CONTENT_STUDIO_V2_MOCK_MODE`, souvent `false`) et **n'affiche pas** le `MockModeBadge` — alors que le toggle dit MOCK et que les générations partent en mock. Toggle et badge se contredisent (BUG-021).
- **Route default** : `generate-visual/route.ts` met `mode='mock'` **en dur** sans lire `CONTENT_STUDIO_V2_MOCK_MODE` (MISS-016) ; avant que le cookie soit posé (ou s'il est purgé), toute génération visuelle part en mock indépendamment de l'env. 3e source.
- **Angle mort texte** (MISS-001) : la route texte `ideas/[id]/generate/route.ts` **ne lit jamais** le cookie `cs_generation_mode` ; basculer le toggle ne change **rien** à la génération texte (toujours fallback déterministe) → contrôle UI **fantôme**.
- **Portée cookie** (MISS-034) : le cookie est posé `path=/` (tout le domaine) alors que le commentaire affirme « scoped to the admin path » — incohérence code/commentaire, surface élargie.

Conséquence opérateur : le mode affiché **n'est pas** le mode appliqué ; un opérateur croit générer en live et obtient du mock (ou l'inverse). C'est une violation directe de la parité mock/live (ADR-0002), gate de tout le plan.

## Décision

1. **Une seule source d'intention serveur : l'env `CONTENT_STUDIO_V2_MOCK_MODE`**, exposée par la route `health` (`health.mockMode`). Elle alimente le `envDefault` du toggle ET le défaut de **toutes** les routes de génération.
2. **Le toggle reçoit `envDefault` depuis `health.mockMode`.** `MediaStudio` passe `envDefault={mockMode ? 'mock' : 'live'}` au `GenerationModeToggle`. Le toggle ne pose plus un cookie `mock` en dur au montage ; il s'aligne sur l'env tant qu'aucun choix opérateur explicite n'a été fait.
3. **Le badge et le toggle lisent la même source.** `MockModeBadge` (via `StudioContext`) et `GenerationModeToggle` reflètent le **même** mode effectif (cookie opérateur s'il existe, sinon `health.mockMode`). Affichage = comportement.
4. **Les routes lisent le mode via le helper unique `readGenerationModeFromCookie(cookie, envDefault=CONTENT_STUDIO_V2_MOCK_MODE)`** — `generate-visual` **et** `ideas/[id]/generate` (texte). Plus de `mock` codé en dur dans une route (MISS-016). La route texte **honore** le cookie (MISS-001) : le générateur backend (T-201) consomme ce mode.
5. **Portée cookie cohérente avec l'intention.** Le scope du cookie est aligné sur le commentaire (admin) — décision portée par l'UI, à confirmer avec le backend qui lit le cookie ; au minimum, supprimer l'incohérence code/commentaire (MISS-034).

> **Note de séquençage** : tant que T-201 (texte réellement LLM + lecture du cookie côté route texte) n'est pas livré, le toggle reste **honnête pour le visuel** mais le **texte reste annoncé comme non-piloté par le mode** (libellé UI explicite : « le mode ne s'applique pas encore au texte »). On ne prétend pas piloter ce qu'on ne pilote pas. Le contrôle fantôme est soit câblé (avec T-201), soit explicitement désactivé/annoncé pour le texte — jamais laissé mensonger.

## Conséquences

- **Positif** : toggle, badge, défaut de route et effet réel **concordent** ; fin du contrôle fantôme texte ; parité mock/live restaurée pour le visuel immédiatement, pour le texte avec T-201.
- **Coût / dépendance** : la règle 4 (route texte honore le mode) dépend de T-201 (backend). La règle 1 dépend que `health` expose `mockMode` (déjà le cas).
- **Réversible** : pur câblage UI/lecture cookie ; aucun changement d'architecture moteur.

## Alternatives écartées

- *Faire du toggle la seule source (ignorer l'env)* : ne corrige pas la fenêtre « avant montage » (MISS-016) ni le défaut serveur ; l'env reste l'intention d'infra légitime.
- *Masquer le toggle tant que le texte n'est pas piloté* : prive l'opérateur du contrôle visuel qui, lui, fonctionne ; on préfère **annoncer le périmètre exact** du toggle.
