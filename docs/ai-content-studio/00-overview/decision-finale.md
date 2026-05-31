# Décision finale stabilisée

## Nom de travail

**FemiGlow Content Studio**

## Produit retenu

Un module admin intégré à FemiGlow qui orchestre :

- stratégie éditoriale,
- génération IA texte/image,
- contrôle de marque,
- validation humaine,
- calendrier,
- export Postiz,
- feedback de performance.

Le prototype est **un studio de préparation et validation**, pas un robot de publication autonome.

## Architecture retenue

| Sujet | Décision |
| --- | --- |
| Hébergement | Intégré dans `apps/web` |
| Base | Tables Drizzle dans la DB FemiGlow |
| Publication | Postiz API publique |
| IA texte | Provider abstrait via service interne ; OpenAI en premier |
| IA image | Provider abstrait ; OpenAI GPT Image en premier, Flux/Runway plus tard |
| Médias | Réutilisation du module media FemiGlow |
| UI | Nouvelle section `/admin/content-studio` |
| Validation | Workflow humain obligatoire |
| Sécurité | RBAC ressource `content-studio` + audit trail |
| Automatisation | Jobs contrôlés, pas de publication automatique v0 |

## Workflow de référence

```txt
Idea
  -> Brief
  -> AI Draft
  -> Brand Review
  -> Human Edit
  -> Approved
  -> Scheduled via Postiz
  -> Published
  -> Performance Snapshot
  -> Learning Note
```

## Pourquoi cette approche

Elle maximise la valeur immédiate sans fragiliser la marque :

- l’IA accélère l’idéation et la production ;
- la fondatrice garde la décision éditoriale ;
- Postiz porte les contraintes réseaux sociaux ;
- la DB FemiGlow garde l’historique, les scores, les prompts, les assets et les décisions ;
- la solution reste compatible avec les modules existants : media, products, tracking, analytics, email, chat, admin-config.

