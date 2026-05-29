# ADR-0011 — Registre de modèles routables + résolution de credentials unifiée + traçabilité du modèle intentionnel

- **Statut** : Proposé (workstream DATA)
- **Date** : 2026-05-29
- **Findings liés** : `BUG-028` (modèles non routables), `MISS-003` (résolution de clé divergente), `BUG-056` (modèle non tracé en mock)
- **Actions** : ACT-DA-006 (registre + credentials), ACT-DA-005 (modèle intentionnel) ; consommé par ACT-BE-010, ACT-BE-013/014, FRONTEND (picker)

## Contexte

Trois défauts de **donnée de référence** autour des modèles de génération :

1. **Modèles non routables proposés** (`BUG-028`) : le `ModelPicker` (allowCustom=true) propose des id de discovery Higgsfield (`flux_2`, `flux_kontext`, `seedream_v5_lite`, `nano_banana_2`…) et autorise des id custom. `image-generation.ts:31-39` ne route que les préfixes `mock-/hf-/gpt-image-/dall-e-` → un id non reconnu tombe sur le défaut OpenAI (clé vide) → **409** en live. Modèle sélectionnable mais non générable.
2. **Résolution de clé divergente** (`MISS-003`) : l'AI-Engine résout via `resolveApiKey()` (DB chiffrée + `ENV_KEY_MAP` incluant `OPENAI_API_KEY`) ; le flux create lit directement `env.CONTENT_STUDIO_OPENAI_API_KEY`. Une clé stockée en DB via l'AI-Engine est **invisible** au flux create. Le picker peut afficher des modèles utilisables via une clé que le générateur ne lira jamais.
3. **Modèle intentionnel non tracé** (`BUG-056`) : en mock, `content_generation_run` enregistre `mock-low-cost-image` en dur (`image-generation.ts:247`), écrasant le modèle choisi (`gpt-image-1-mini`) → audit/coût faussés.

## Décision

1. **Registre de modèles** (donnée de référence, source unique) : par id → `{ provider, role (image|video|text), routable: bool, keyRef }`.
   - Le picker ne propose **que** des id `routable=true`.
   - Un id non routable (ou custom non déclaré) ⇒ **erreur métier explicite** (« modèle non supporté »), **jamais** un fallback OpenAI silencieux.
   - Forme initiale : **code/config typé** (réversible, testable, sans migration). Table `model_registry` optionnelle si gouvernance dynamique requise (migration additive réversible).
2. **Résolution de credentials unique** : `resolveProviderCredential(keyRef)` → DB chiffrée puis `ENV_KEY_MAP`, **partagée par A, B et le picker**. Une clé en DB (`saveApiKey`) **doit** être lisible par le flux create. (Aligné avec ADR-0004.)
3. **Traçabilité du modèle intentionnel** : le `content_generation_run` porte le modèle **choisi** distinct du modèle **exécuté**.
   - **Option A (recommandée)** : colonnes additives nullables `intended_model` + `estimated_cost_cents` (migration réversible, requêtable pour audit/coût).
   - **Option B** : `input_json.intendedModel` (sans migration).
   - En mock, `estimated_cost_cents` reflète le coût du modèle intentionnel (simulation réaliste).

## Conséquences

- ✅ Le badge « Live » du picker devient honnête : proposable ⇔ générable (`BUG-028`).
- ✅ Une clé unique lue par A, B et le picker (`MISS-003`) — fin de la divergence.
- ✅ Audit/coût fidèles, mock inclus (`BUG-056`).
- ✅ Registre en code = zéro migration au départ ; traçabilité = migration additive réversible.
- ⚠️ Le registre doit rester synchronisé avec la discovery provider (sinon un nouveau modèle réel apparaît `routable=false`). Process de mise à jour à définir.

## Alternatives écartées

- **Garder allowCustom + routing par préfixe** : laisse des modèles non routables sélectionnables (`BUG-028`).
- **Deux mécanismes de résolution de clé** (statu quo) : conserve l'invisibilité DB↔create (`MISS-003`).
- **Ne tracer que le modèle exécuté** : laisse l'audit/coût faux en mock (`BUG-056`).
