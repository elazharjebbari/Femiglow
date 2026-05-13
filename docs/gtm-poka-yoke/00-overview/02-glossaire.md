# Glossaire

| Terme | Définition |
|---|---|
| **Poka-Yoke** | Concept lean japonais : dispositif anti-erreur qui rend l'erreur impossible ou immédiatement visible. |
| **Bundle** | Paire cohérente (config GTM v_N, mapping vendors v_M) générée et exportée ensemble. |
| **bundleId** | Hash SHA-256 court (12 caractères hex) calculé sur le contenu du bundle. Injecté dans les 2 fichiers exportés. |
| **Container GTM** | L'unité de déploiement GTM, contient tags, triggers, variables. Identifié par `GTM-XXXXXX`. |
| **Sentinel ping** | Petit payload POST envoyé par GTM au backend FemiGlow au premier pageview de session, déclaré ses versions actives. |
| **Drift** | Écart détecté entre ce que l'admin pense être actif (config admin) et ce que GTM exécute réellement (config runtime). |
| **MTTD** | Mean Time To Detect — temps moyen entre survenue d'un drift et alerte affichée. |
| **Couche A** | Prévention pré-import (page validate-pair). |
| **Couche B** | Détection runtime (sentinel ping + dashboard). |
| **Couche C** | Filet de sécurité (bundleId partagé). |
| **Workspace GTM** | Branche de travail dans un Container GTM, mergé via Submit. |
| **Submit & Publish** | Action GTM qui rend un workspace actif en prod. |
| **dataLayer** | Tableau JavaScript global utilisé par GTM pour recevoir des events client. |
| **Tag Manifest** | Tag custom GTM (Couche C) qui lit `bundleId` côté config + côté mapping et flag un mismatch. |
| **Sync Status** | Page `/admin/tracking/gtm/sync-status` — source de vérité de l'état du tracking GTM. |
| **Validate Pair** | Page `/admin/tracking/gtm/validate-pair` — wizard de validation pré-import. |
| **Drift Severity** | `ok` / `warning` / `critical` selon la nature du drift détecté. |
