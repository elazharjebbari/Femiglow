# Direction artistique — Images FemiGlow

Dossier de référence pour générer **chaque image du site avec ChatGPT** (modèles
gpt-image-1.5 / GPT-Image-2). À lire avant toute session de génération.

## Navigation

| Fichier | Rôle |
|---|---|
| [01-charte-visuelle.md](01-charte-visuelle.md) | La charte FemiGlow traduite en consignes visuelles : palette, voix d'image, choses à bannir. Le filtre commun à toutes les images. |
| [02-guide-prompting.md](02-guide-prompting.md) | Bonnes pratiques de prompting pour ChatGPT image : structure, mots-clés impactants pour scène, lumière, cadrage, ambiance, exclusions. |
| [03-inventaire-images.md](03-inventaire-images.md) | Liste exhaustive des images du site avec, pour chacune, **un plan court (1-3 lignes)** disant ce qu'elle doit incarner dans son contexte. Pas de prompt détaillé — celui-ci se construit avec 01 + 02 + ce contexte. |

## Méthode recommandée

1. Ouvrir [01](01-charte-visuelle.md) — internaliser palette, voix, règles dures.
2. Lire [02](02-guide-prompting.md) — sept blocs du prompt, mots-clés, pièges.
3. Choisir l'image dans [03](03-inventaire-images.md) — récupérer son contexte.
4. Construire le prompt = charte (01) + structure (02) + intention (03).
5. Générer dans une **session ChatGPT dédiée** (la mémoire intra-session aide la cohérence ; on en ouvre une nouvelle quand on change de famille d'images).
6. Itérer par modifications **petites et explicites** (« change uniquement X, garde tout le reste identique »).

## Sources externes consultées

- [OpenAI — GPT Image 1.5 Prompting Guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide)
- [OpenAI — GPT Image Generation Models Prompting Guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
- [Prompting Guide — 4o Image Generation](https://www.promptingguide.ai/guides/4o-image-generation)
- [PixVerse — GPT Image 2 Review & Prompt Guide 2026](https://pixverse.ai/en/blog/gpt-image-2-review-and-prompt-guide)
