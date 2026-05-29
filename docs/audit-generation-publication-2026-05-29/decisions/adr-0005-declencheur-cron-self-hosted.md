# ADR-0005 — Déclencheur cron réel pour la publication programmée (staging self-hosted)

- **Statut** : Proposé
- **Date** : 2026-05-29
- **Findings liés** : `BUG-003`

## Contexte

La **publication programmée ne s'exécute jamais** :
- la route `/api/cron/content-studio/social-publish-scheduler` existe mais **n'est pas dans `apps/web/vercel.json`** (les crons listés ne l'incluent pas) et **n'est référencée par aucun fan-out** (`/api/cron/tick` ne l'appelle pas) ;
- de plus, **staging tourne en self-hosted (PM2 + LiteSpeed)**, donc les **crons Vercel ne s'exécutent pas du tout** dans cet environnement (double jeopardy).

Conséquence opérateur : un post « planifié » reste indéfiniment en attente ; aucune publication différée n'a lieu.

## Décision

1. **Déclencheur cron réel et explicite** pour tous les jobs `content-studio` en self-hosted : un scheduler système (cron OS / PM2 `cron_restart` dédié / systemd timer) qui appelle les routes cron avec le `CRON_SECRET`, **ou** un worker long-running interne. Ne pas dépendre des crons Vercel en staging/prod self-hosted.
2. **Enregistrer `social-publish-scheduler`** (et auditer les 7 crons `content-studio`) dans le manifeste cron effectif de l'environnement cible, avec fréquence documentée.
3. **Observabilité** : chaque exécution émet un `social_publish_event` (heartbeat + résultat) ; une alerte si aucun tick scheduler depuis N minutes (cf. axe `debogabilite`).
4. **Test de bout en bout** : un parcours « planifier à T+1min → attendre → vérifier publication » en mode mock (et live draft) — DoD mesurable.

## Conséquences

- ✅ La publication différée fonctionne réellement et est observable.
- ✅ Découplage de l'hypothèse « Vercel » erronée pour l'environnement réel.
- ⚠️ Nécessite un mécanisme d'ordonnancement au niveau infra (doc runbook).
- ⚠️ Idempotence/locking requis pour éviter double-publication si plusieurs ticks se chevauchent.

## Alternatives écartées

- **Ajouter l'entrée dans `vercel.json`** : sans effet en self-hosted ; ne corrige pas la cause réelle.
