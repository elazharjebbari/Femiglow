# ADR-002 — Push (GTM → backend) plutôt que Pull (backend → GTM API)

**Statut** : Accepté
**Date** : 2026-05-13

## Contexte

Deux modèles possibles pour collecter l'état runtime de GTM :

### Option Pull
- Cron toutes les heures qui appelle l'API GTM pour lire le container actif.
- Compare avec l'état admin.
- Stocke les divergences.

### Option Push (retenue)
- Tag custom HTML GTM qui POST au backend FemiGlow au premier pageview d'une session.
- Payload léger : `{ mapping_v, config_v, bundleId, container_id, ts, ua_hash }`.
- Backend agrège.

## Décision

**Push.**

## Justification

| Critère | Push | Pull |
|---|---|---|
| Setup initial | Simple : un tag custom HTML | Lourd : OAuth GTM API + IAM + tokens |
| Permissions externes | Aucune (anonyme) | Compte Google + OAuth scope `tagmanager.readonly` |
| Latence détection | < 5 min (premier pageview) | Jusqu'à 1h (cron horaire) |
| Coût | 0 (utilise pageview existant) | Quota API GTM (1000 req/jour, restrictif) |
| Couverture | Détecte **ce qui est exécuté** (réalité) | Détecte **ce qui est configuré** (intention) |
| Mode "container non publié" | Détecté (pas de ping) | Pas détecté (l'API renverrait le workspace, pas le live) |
| Dépendance externe | Réseau utilisateur final | OAuth Google, peut casser sur révocation token |

## Conséquences

### Bénéfices
- **Mesure la réalité runtime**, pas la config théorique.
- Détecte le mode d'échec n°2 (Container importé mais pas publié) — le pull ne le détecterait pas.
- Pas de dépendance externe (OAuth, quotas API).

### Trade-offs
- Nécessite un trafic non-nul pour détecter (mitigé : site en prod = trafic continu).
- Le ping peut être bloqué par AdBlock côté client (mitigé : on échantillonne 1 sur N et on s'attend à 95%+ de couverture).

## Pas un trade-off — c'est complémentaire

On peut ajouter un cron Pull plus tard pour cross-checker. Mais le Push reste primary.

## Sécurité

- Endpoint `/api/track/sentinel` est public mais rate-limited (60 req/min/IP).
- Payload validé strict par Zod (rejet si format inattendu).
- Aucun PII collecté.
- CORS strict : `Origin` doit être le domaine FemiGlow.
