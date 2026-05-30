# Micro-copy — Social Publishing

## Boutons publish

| Élément | Texte |
|---------|-------|
| Dropdown trigger | Publier (avec aria-label="Options de publication") |
| Menuitem 1 | Publier maintenant |
| Menuitem 1 desc | Envoie immédiatement au provider. |
| Menuitem 2 | Programmer |
| Menuitem 2 desc | Choisir une date / heure. |
| Menuitem 3 | Brouillon Postiz |
| Menuitem 3 desc | Envoie au provider en mode review. |

## Dialogs

### Dialog publish-now
- Title : Publier maintenant ?
- Description : Le post sera envoyé immédiatement au provider configuré.
- Warning body : Vérifie l'aperçu une dernière fois. Cette action ne peut pas être annulée une fois le contenu publié côté plateforme.
- Mock body addition : Mode mock — publication simulée, aucun appel réel.
- Confirm : Confirmer
- Cancel : Annuler

### Dialog schedule
- Title : Programmer la publication
- Description : Choisis la date et l'heure de publication.
- Preset +1h : +1h
- Preset Demain 9h : Demain 9h
- Preset Lundi 14h : Lundi 14h
- Tz label : Fuseau : {tz}
- Confirm : Programmer
- Cancel : Annuler

### Dialog draft
- Title : Envoyer en brouillon ?
- Description : Le contenu sera disponible côté provider pour validation interne.
- Body : Le draft sera créé côté provider, prêt à être publié manuellement.
- Confirm : Envoyer
- Cancel : Annuler

### Dialog cancel
- Title : Annuler la publication ?
- Body : Le post programmé sera annulé. Cette action est irréversible.
- Confirm : Confirmer l'annulation (variant=danger)
- Cancel : Garder programmé

## Toasts

| Action | Success | Error fallback |
|--------|---------|----------------|
| publish-now | Publication lancée | Publication : {mapped} |
| publish-now mock | Publication lancée (mock) | idem |
| schedule | Publication programmée pour {date} | Programmation : {mapped} |
| draft | Brouillon envoyé au provider | Brouillon : {mapped} |
| cancel | Publication annulée | Annulation : {mapped} |
| reschedule | Horaire mis à jour | Re-programmation : {mapped} |
| retry | Reprise demandée | Reprise : {mapped} |
| job-cancel | Job annulé | Annulation job : {mapped} |
| sync | {N} comptes synchronisés | Sync : {mapped} |

## JobQueue

| Element | Text |
|---------|------|
| Title | Jobs récents |
| Empty | Aucun job récent. Lancez une publication pour voir l'activité ici. |
| Retry | Retry |
| Cancel | Annuler |
| View | Voir le post |
| Attempt label | Tentative {n} |

## AccountHealthCard

| Element | Text |
|---------|------|
| Title | Comptes sociaux |
| Sync button | Synchroniser |
| Empty | Aucun compte connecté. Connectez Instagram/Facebook via Postiz. |
| Status active | Actif |
| Status disabled | Désactivé |
| Status token_expired | Compte expiré |
| Status permission_missing | Permission manquante |
| Reconnect link | Reconnecter |

## Confirm preview tags

| Tag | Format |
|-----|--------|
| platform | 📱 {platform name} |
| format | · {format} |
| mock | · Mode mock |
