# Vision — Pourquoi un Poka-Yoke GTM ?

## Le problème en une phrase

> Un import GTM mal exécuté est silencieux : aucune erreur visible, mais le tracking est cassé pendant des semaines avant qu'on s'en rende compte par les chiffres business.

## Le « tracking pourri silencieux » — modes d'échec réels

### Échec n°1 — Ordre d'import inversé
- L'admin importe le mapping vendors **avant** la config principale GTM.
- Les variables `{{FG Event Name}}` du mapping n'existent pas encore dans le workspace.
- Conséquence : tous les events sont fired avec `undefined` comme nom → poubelle des plateformes.
- **Détecté en moyenne** : 7 à 21 jours plus tard, par baisse anormale du ROAS.

### Échec n°2 — Container importé mais pas publié
- L'admin clique "Import" dans GTM, voit "Imported successfully", ferme l'onglet.
- Il oublie de cliquer "Submit & Publish".
- Conséquence : en prod, l'ancien container reste actif. Le nouveau mapping n'est nulle part.
- **Détecté en moyenne** : jamais, jusqu'à ce qu'on s'étonne que la modif "n'a rien changé".

### Échec n°3 — Versions désalignées
- Mapping v17 importé (attend la variable `{{FG Bundle Id}}` introduite en config v4).
- L'admin a oublié de mettre à jour la config (encore en v3).
- Conséquence : 50% des events fired correctement, 50% en erreur silencieuse.
- **Détecté en moyenne** : 3 à 10 jours, par anomalie sur events spécifiques.

### Échec n°4 — Mauvais workspace cible
- L'admin a 2 workspaces GTM (prod + staging).
- Il importe le mapping prod dans le workspace staging par erreur.
- Conséquence : staging mute le tracking prod si workspaces partagent triggers.
- **Détecté en moyenne** : variable, souvent par utilisateur final.

### Échec n°5 — Hotfix manuel oublié
- L'admin fait une modif "rapide" directement dans GTM (sans passer par l'admin FemiGlow).
- Conséquence : la source admin et GTM divergent à jamais. La prochaine régen écrase la modif.
- **Détecté en moyenne** : jamais, jusqu'à ce que la modif soit perdue à la prochaine régen.

## La valeur métier d'un Poka-Yoke

| Avant Poka-Yoke | Après Poka-Yoke |
|---|---|
| Tracking cassé silencieusement pendant 7-21j | Détection sous 1h post-import |
| Perte de signal d'attribution → CPA × 2 sur la fenêtre | Pas de perte (alerte immédiate) |
| Diagnostic post-mortem manuel (3-5j de tracking expert) | Cause identifiée par l'alerte elle-même |
| Confiance admin érodée ("je n'ose plus toucher GTM") | Admin sûr de pouvoir éditer en confiance |
| Re-tracking impossible (events perdus) | Détection avant que les pertes ne s'accumulent |

## Critères de succès

Le système est un succès si :

1. **MTTD (Mean Time To Detect)** < 2h après un import incorrect en prod.
2. **Faux positifs** < 1% (seuils correctement calibrés).
3. **Faux négatifs** < 0.1% (chaque échec réel produit au moins une alerte sur l'une des 3 couches).
4. **Adoption** : 100% des imports passent par la couche A (page validate-pair) après 4 semaines.
5. **Charge cognitive admin** : 0 (zéro) action requise quand tout va bien.

## Principes anti-pattern (ce qu'on évite explicitement)

- ❌ **Bloquer l'admin** par défaut → frustration, contournements
- ❌ **Alertes verbales floues** ("erreur tracking détectée") → ignorées
- ❌ **Logs noyés dans Sentry** → personne ne regarde
- ❌ **Email à chaque ping** → bruit, désensibilisation
- ❌ **Cron pull GTM API** → coûteux, fragile, droit IAM lourd

## Non-objectifs (hors scope explicite)

- Couvrir d'autres systèmes que GTM (Meta CAPI, GA4 server-side restent hors scope).
- Auto-correction (le Poka-Yoke alerte, ne corrige pas — c'est l'admin qui décide).
- Audit forensique long terme (la table sentinels garde 90 jours, le reste est agrégé).

## Lien avec les autres initiatives tracking

- **event-mappings** (déjà déployé) : fournit les mappings versionnés que ce système surveille.
- **tracking-improvement** (déployé) : a livré la robustesse côté dispatcher serveur. Ce système couvre la moitié client (GTM).
- **insights** (déployé) : reste indépendant — observe les events ; nous observons la **mécanique** qui les produit.
