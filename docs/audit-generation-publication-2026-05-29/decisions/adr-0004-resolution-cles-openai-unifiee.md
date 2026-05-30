# ADR-0004 — Résolution unifiée des clés de provider (corriger le split d'env)

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Findings liés** : `BUG-001`, `BUG-006`, `BUG-007`, `BUG-009`

## Contexte

La génération LIVE côté opérateur est **bloquée non par une clé manquante mais par un split de variable d'environnement** :
- une clé **`OPENAI_API_KEY` valide est présente** dans le process (`sk-`, 164 chars) ;
- elle **n'est pas déclarée dans `src/lib/env.ts`** (ni schéma ni mapping) → invisible à l'objet `env` typé ;
- le flux create (`image-generation.ts`, `generation.ts`) lit **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) ;
- seul `engine-config.ts:75` (pipeline A) retombe sur `process.env.OPENAI_API_KEY` ;
- le **picker de modèles** utilise encore une **autre** source (`resolveApiKey`, chaîne `ENV_KEY_MAP`) → il affiche des modèles `live` que le générateur ne peut pas produire (désynchronisation UI/réalité).

Il existe donc **au moins trois chemins de résolution de clé divergents** pour le même provider.

## Décision

Centraliser la résolution des credentials de provider dans **une seule fonction** (ex. `resolveProviderCredential(provider)`) utilisée **identiquement** par : le générateur (flux B), le graphe (flux A), et le picker/discovery.

- Chaîne OpenAI unique et ordonnée : `CONTENT_STUDIO_OPENAI_API_KEY` → `AI_ENGINE_OPENAI_API_KEY` → `CHAT_OPENAI_API_KEY` → `OPENAI_API_KEY`.
- Déclarer **toutes** les variables consommées dans `env.ts` (y compris `OPENAI_API_KEY`) pour qu'elles soient typées/validées.
- Le picker n'annonce `live` que si **la même résolution** que le générateur retourne une clé **et** que le provider est réellement joignable (cf. ADR-0006 pour Higgsfield).

## Conséquences

- ✅ Débloque la génération image/texte LIVE de l'opérateur **sans achat de clé** (correctif bon marché, fort impact).
- ✅ Supprime la classe de bugs « le picker ment » et « pipeline A marche, B non ».
- ⚠️ Implique un test de parité « picker disponible ⇔ générateur capable » (cf. ADR-0003).
- ⚠️ Valider au boot que la clé résolue est non vide quand un modèle live est exposé.

## Alternatives écartées

- **Renseigner `CONTENT_STUDIO_OPENAI_API_KEY` à la main** : corrige le symptôme staging mais laisse 3 chemins divergents (le bug reviendra).
