# Fonctionnalités du prototype

## Modules fonctionnels

### 1. Bibliothèque d’idées

Permet de capturer des intentions éditoriales avant génération.

Champs clés :

- pilier : rituel, produit, preuve, journal, maison, réassurance, saison, coulisses ;
- objectif : notoriété, considération, conversion, réassurance, fidélisation ;
- canal cible : Instagram, Facebook ;
- format cible : post, story, reel, carousel ;
- source : manuel, produit, article, média, campagne ;
- statut : idea, briefed, generated, rejected.

### 2. Générateur de brief

Transforme une idée en brief structuré :

- angle narratif ;
- promesse autorisée ;
- preuve à utiliser ;
- interdits ;
- asset recommandé ;
- CTA ;
- hashtags ;
- UTM ;
- contraintes plateforme.

### 3. Générateur de contenu

Génère :

- caption courte ;
- caption longue ;
- première ligne hook ;
- alt text ;
- hashtags ;
- story frames ;
- carousel slides ;
- variante plus sensorielle ;
- variante plus factuelle ;
- variante conversion douce.

### 4. Atelier visuel

Prototype minimal :

- choisir un média existant ;
- associer une image générée ou proposée ;
- créer une fiche de direction artistique ;
- générer des prompts image contrôlés ;
- stocker les résultats comme médias FemiGlow ;
- imposer format : 4:5 post, 9:16 story/reel, 1:1 fallback.

### 5. Brand safety

Chaque draft reçoit :

- score lexical ;
- score promesse ;
- score ton ;
- score visuel ;
- score conformité plateforme ;
- statut : pass, warning, blocked.

### 6. Review humaine

Actions :

- éditer texte ;
- remplacer média ;
- demander variation ;
- approuver ;
- rejeter avec raison ;
- programmer ;
- annuler programmation.

### 7. Calendrier

Vues :

- semaine ;
- mois ;
- pipeline par statut ;
- filtres par canal, pilier, campagne, format.

### 8. Bridge Postiz

Actions :

- sync integrations ;
- upload media ;
- create draft/schedule/now ;
- stocker IDs Postiz ;
- lire posts ;
- lire analytics si disponibles ;
- marquer erreurs et retry.

### 9. Feedback loop

V0 :

- notes manuelles ;
- tags gagnant/perdant ;
- clics UTM côté FemiGlow ;
- comparaison par pilier/format.

V1 :

- import analytics Postiz ;
- résumé hebdomadaire IA ;
- recommandations de prochains angles.

## Non-fonctionnel

| Exigence | Cible |
| --- | --- |
| Robustesse | Queue + retry + idempotency sur appels Postiz |
| Sécurité | API keys en env, jamais exposées client |
| Maintenabilité | Services séparés : generation, brand-review, postiz-bridge, scheduler |
| Évolutivité | Providers IA interchangeables |
| Debug | Logs structurés + audit events + state machine |
| Modulaire | Feature flag `aiContentStudioEnabled` |
| Interopérable | Media, products, tracking, analytics, Postiz |

