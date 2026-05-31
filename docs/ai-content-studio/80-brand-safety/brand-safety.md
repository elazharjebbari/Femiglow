# Brand safety et fidélité FemiGlow

## Objectif

Empêcher que le studio produise du contenu générique, agressif, faux, non conforme ou visuellement infidèle.

## Règles éditoriales déterministes

### Bloquantes

- Promesse médicale ou thérapeutique.
- “Révolutionnaire”, “miracle”, “incroyable”, “wow”.
- Urgence artificielle : “vite”, “dernière chance”, “offre flash”.
- Réduction non validée : “promo”, “soldes”, “-50 %”.
- Claims non prouvés : “résultat garanti”, “ongles parfaits”.
- Ton anglais par défaut.
- Emoji.
- Exclamation.
- Mention produit incohérente avec catalogue.

### Warning

- CTA trop direct : “acheter maintenant”.
- Trop de hashtags.
- Caption trop longue pour story.
- Texte trop factuel pour B2C.
- Absence de preuve ou de contexte.

## Règles visuelles

### Bloquantes

- Packaging non fidèle.
- Main avec anomalies visibles.
- Visage plein cadre.
- Couleurs saturées ou néon.
- Nail art/vernis/semi-permanent montré comme promesse FemiGlow.
- Texte illisible sur image.
- Logo déformé.

### Warning

- Format croppe le produit.
- Fond trop sombre.
- Ambiance trop stock photo.
- Trop de beige/crème sans sauge ou encre.
- Produit absent alors que format conversion.

## Score

| Score | Décision |
| ---: | --- |
| 90-100 | Peut être approuvé |
| 75-89 | Relire, warnings |
| 60-74 | Reprendre avant approval |
| < 60 | Bloqué |

Le score final ne doit jamais masquer une violation bloquante : si une règle critique échoue, le draft est `blocked`.

## Prompt système de marque

Le prompt système doit être versionné et court. Il renvoie vers des règles structurées plutôt que de contenir toute la charte en texte libre.

Sources locales à injecter :

- `docs/preparation/01-marque-vision-voix.md`
- `docs/preparation/02-design-system.md`
- `docs/audit/04-charte-architecture.md`
- `docs/ai-content-studio/80-brand-safety/rules.yaml`

