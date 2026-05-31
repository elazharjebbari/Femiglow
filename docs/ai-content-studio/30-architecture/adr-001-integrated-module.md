# ADR-001 — Studio intégré à FemiGlow

## Statut

Accepté pour prototype.

## Contexte

Le besoin demande une production de contenu fidèle à la marque, connectée aux produits, médias, tracking, analytics et Postiz. FemiGlow possède déjà une base admin et data importante.

## Décision

Implémenter le studio dans `apps/web`, sous `/admin/content-studio`, avec services dans `src/lib/content-studio`.

## Conséquences positives

- Réutilisation immédiate des médias, produits, charte, audit et auth.
- Moins de latence produit.
- UX fondatrice unifiée.
- Debug centralisé.

## Conséquences négatives

- L’app principale grossit encore.
- Il faut être strict sur les boundaries internes.
- Les jobs IA peuvent être lourds : timeouts à encadrer.

## Garde-fous

- Feature flag.
- Services isolés.
- Tables dédiées.
- Providers abstraits.
- Aucun appel IA depuis client.

