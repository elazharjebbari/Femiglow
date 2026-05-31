# Procédure de rollback

> Objectif : revenir à un état sain **en secondes**, sans perte de données, sans déploiement.

## 1. Niveaux de rollback (du plus léger au plus lourd)

| Niveau | Déclencheur | Action | Effet |
|---|---|---|---|
| **N1 — Flag off** | régression visuelle/UX en prod | désactiver `localeSwitcherV2` | Retour au switcher **V1** (reload). Instantané, sans deploy. |
| **N2 — Désactiver le nudge** | nudge mal perçu / faux positifs | config admin `nudge.enabled=false` (ou flag) | Plus de perle ; switcher intact. |
| **N3 — Forcer le voile** | bug View Transitions sur un navigateur | config/flag `transition.forceVeil=true` | Fondu framer partout (cross-browser). |
| **N4 — Revert code** | bug profond | `git revert` du/des commits du lot | Retour code, deploy. |

## 2. Garanties

- **Aucune donnée détruite** : la table `i18n_locale_config` n'est jamais supprimée au rollback ; flag off = on ignore la V2, pas la config.
- **Pas de migration descendante risquée** : la migration `i18n_locale_config` est **additive** (nouvelle table). Rien à défaire côté data pour N1–N3.
- **SEO intact** : les URLs localisées et `hreflang` ne dépendent pas du flag.

## 3. Procédure N1 (cas courant)
```text
1. Désactiver le flag localeSwitcherV2 (panneau de flags / env).
2. Vérifier : le switcher V1 (dropdown endonyme + reload) fonctionne.
3. Vérifier scanners i18n = 0 (aucun impact).
4. Consigner l'incident + cause dans le journal.
5. Reprendre la boucle de correction hors-prod (test-loop.md).
```

## 4. Vérification post-rollback
- Bascule FR/AR/EN fonctionnelle (même si V1 = reload).
- `/admin/i18n` reste accessible (lecture) ; pas d'écran cassé.
- Aucune erreur 500 sur les pages publiques.
- Télémétrie : arrêt propre des events V2 (pas d'erreurs).

## 5. Critères de ré-activation
- Cause racine corrigée + test négatif ajouté (couvre la régression).
- Batterie L7 verte + `coverage-matrix.csv` complet.
- Validation visuelle (runbook §E).
