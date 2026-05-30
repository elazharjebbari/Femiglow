# P03 — Stratégie Mock Mode

> **Contexte** : aujourd'hui le mock est par-provider (`CONTENT_STUDIO_IMAGE_PROVIDER=mock` pour image only). Pas de mock vidéo, pas de mock texte unifié, pas de mock publication. On doit unifier sans casser l'existant.

## Contraintes

1. Comportement déterministe en mock (reproductibilité tests)
2. Visibilité utilisateur (badge "Mode mock")
3. Backwards compatible (les flags existants continuent de marcher)
4. Switch facile en E2E
5. Pas de coût LLM en mock

## Option A — Env flag global `CONTENT_STUDIO_V2_MOCK_MODE`

Un seul boolean qui, quand true, force le mock partout :
- Text generation → fallback template (existant)
- Image generation → SVG mock (existant)
- Video generation → MP4 statique (nouveau)
- Publish jobs → completed instantanément en mock
- Badge UI "Mode mock" via API health (le frontend lit `/health` au mount)

### Forces
- Configuration minimale (1 var)
- Facile à activer en staging / E2E
- Pas de risque d'oubli partiel
- Migration progressive : on garde les flags existants comme overrides

### Faiblesses
- Tout-ou-rien (pas de mix texte real + image mock)
- Si mal configuré en prod, génération désactivée massive

### Pertinence
Optimal pour notre besoin opérateur + tests. Le mix par-provider reste possible via les flags existants quand mock global est OFF.

## Option B — Mock per route via query param `?mode=mock`

Le frontend ajoute `?mode=mock` aux requêtes API. Le backend route vers le service mock si présent.

### Forces
- Flexibilité par appel
- Pas besoin de redémarrer pour switcher
- Tests E2E peuvent tester real + mock dans la même session

### Faiblesses
- Attaque triviale (un utilisateur final pourrait passer `?mode=mock`)
- Couplage UI/API (le frontend doit toujours penser à ajouter)
- Pas de protection en prod (faut allowlist côté serveur)

### Pertinence
Trop intrusif côté code. Non.

## Option C — Header `X-Mock-Mode: true`

Identique à B mais via header. Whitelist côté serveur en fonction du host (staging vs prod).

### Forces
- Plus discret que query param
- Whitelistable par environnement

### Faiblesses
- Toujours du couplage
- Découplage utile pour quoi ? On veut un mode "tout staging mock" pas un mix
- Complexité d'audit

### Pertinence
Sur-engineering pour notre cas.

## Option D — Mock via header SEULEMENT pour les tests E2E + global env pour le reste

Combinaison :
- Env flag `CONTENT_STUDIO_V2_MOCK_MODE=true` en staging (mock global)
- Header `X-Test-Mode: e2e` pour overrides ponctuels dans Playwright (ex: tester échec budget en mock)

### Forces
- Production : flag respecté
- Tests : flexibilité via header

### Faiblesses
- Deux mécanismes coexistent (un peu plus complexe)

### Pertinence
Bon compromis pour des tests E2E avancés. À considérer comme évolution.

## Comparaison

| Critère | A — Env global | B — Query param | C — Header simple | D — Combo env+header |
|---------|----------------|------------------|-------------------|----------------------|
| Simplicité | 🟢 | 🟡 | 🟡 | 🟡 |
| Sécurité prod | 🟢 | 🔴 | 🟡 | 🟢 |
| Flexibilité tests | 🟡 | 🟢 | 🟢 | 🟢 |
| Couplage UI/API | 🟢 | 🔴 | 🟡 | 🟢 |
| Backwards compat | 🟢 | 🟢 | 🟢 | 🟢 |

## Recommandation finale

**Option A — Env flag global `CONTENT_STUDIO_V2_MOCK_MODE`**, avec porte ouverte à D ultérieurement.

### Détails

1. Nouvelle env `CONTENT_STUDIO_V2_MOCK_MODE=boolean` (défaut false)
2. Si true, force :
   - `generateForIdea()` → retourne template fallback déterministe
   - `generateStudioImage()` → retourne SVG mock (comme aujourd'hui)
   - `generateStudioVideo()` → retourne MP4 statique
   - `publish jobs` → complétés instantanément, status='published' (en staging)
3. Badge UI :
   - Affiché via réponse `GET /api/admin/content-studio/health` : `{ mockMode: boolean }`
   - Composant `MockModeBadge` rendu dans le Stepper et le PublishActionGroup
   - Variant "warning" jaune doux, icône Sparkles, label "Mode mock — actions simulées"

### Variables d'environnement

| Var | Effet quand mock=true | Fallback (mock=false) |
|-----|----------------------|------------------------|
| `CONTENT_STUDIO_V2_MOCK_MODE` | Force tout mock | Mode normal |
| `CONTENT_STUDIO_IMAGE_PROVIDER` | (ignoré) | Pilote image-only mock |
| `CONTENT_STUDIO_OPENAI_API_KEY` | (ignoré) | Active OpenAI texte |
| `CONTENT_STUDIO_VIDEO_PROVIDER` | (ignoré) | Pilote vidéo (mock par défaut) |

### Tests

- Unit : `vi.mock` env + assertions sur path code emprunté
- E2E : `process.env.CONTENT_STUDIO_V2_MOCK_MODE='true'` via Playwright global setup

### Sécurité

- Le flag est lu côté serveur uniquement (jamais exposé à l'utilisateur en prod)
- En prod, configuré à `false` par défaut ; le déploiement valide la valeur
- Le badge UI s'affiche depuis l'API health, pas depuis une var client

Voir `features/F09-mock-video-simulation/`, `features/F19-cross-cutting/` pour application.
