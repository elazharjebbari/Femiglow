# Micro-copy — Content Studio v2 Create

> Source de vérité pour tous les textes affichés à l'opérateur. Ton : direct, chaleureux, FR.

## Stepper

| Étape | Label | Description |
|-------|-------|-------------|
| frame | Cadrer | Pilier, objectif, intention |
| generate | Générer | 3 variantes IA |
| visual | Visuel | Image ou vidéo |
| validate | Valider | Aperçu et publication |

### Tooltips steps futurs
"Complétez l'étape {previous} pour continuer"

### Mock badge
"Mode mock — actions simulées"

## IntentionForm

| Élément | Texte |
|---------|-------|
| Eyebrow | Cadrage |
| Titre | Quelle intention ? |
| Section Format | FORMAT |
| Section Modèle | MODÈLE DE GÉNÉRATION |
| Section Pilier | PILIER |
| Section Objectif | OBJECTIF |
| Section Plateforme | PLATEFORME |
| Section Intention | INTENTION |
| Placeholder intention | "Présenter le rituel FemiGlow comme un geste lent du soir" |
| Bouton submit | Enregistrer l'idée |
| Helper bouton (loading) | Génération en cours… |
| Error generic | Une erreur est survenue, veuillez réessayer. |
| Error validation | Décrivez votre intention en 8 caractères minimum. |

### Format cards
| Format | Label | Description |
|--------|-------|-------------|
| post | Post | Image carrée ou 4:5 — flux principal |
| story | Story | 9:16 vertical — 24h |
| reel | Reel | Vidéo 9:16 — viralité |
| carousel | Carousel | Plusieurs images — éducatif |

## ModelPicker

| Élément | Texte |
|---------|-------|
| Trigger placeholder | Choisir un modèle… |
| Search placeholder | Chercher un modèle… |
| Section Recommandé | ⭐ Recommandé pour {format} |
| Section Autres | Autres modèles |
| Section Custom | + Ajouter un modèle custom |
| Tier fast badge | Rapide |
| Tier balanced badge | Équilibré |
| Tier premium badge | Premium |
| Source live | Live |
| Source cache | Cache |
| Source static | Statique |
| Empty state | Aucun modèle trouvé |

## VariantsCompare

| Élément | Texte |
|---------|-------|
| Title | {n} variantes |
| Toggle diff | Voir les différences |
| Bouton sélection | Choisir cette variante |
| Bouton sélectionnée | Sélectionnée |
| Bouton bloquée | Bloquée (violations) |
| Bouton rejet | Rejeter |
| Dialog rejet titre | Rejeter cette variante |
| Dialog rejet desc | Indiquez une raison (optionnel). |
| Dialog rejet placeholder | Pourquoi rejeter cette variante ? |
| Dialog confirm | Confirmer le rejet |
| Empty state | Lance la génération pour voir 3 variantes ici. |
| Badge modèle utilisé | Généré par {model} · {cost}¢ |

## MediaStudio

| Élément | Texte |
|---------|-------|
| Title | Visuel |
| Budget illimité | Budget illimité |
| Budget restant | {remaining}¢ / {total}¢ restants |
| Budget warning | Budget bientôt épuisé |
| Tab Bibliothèque | Bibliothèque |
| Tab Générer IA | Générer IA |
| Toggle Image | Image |
| Toggle Vidéo | Vidéo |
| Prompt label | Description du visuel |
| Prompt placeholder | Décrivez le visuel à générer (12 caractères minimum) |
| Size label | Format |
| Quality label | Qualité |
| Bouton générer | Générer un visuel IA |
| Loading | Génération… |
| Bouton décrocher | Décrocher |
| Estimator low | ≈ {seconds}s en général |
| Estimator longer | C'est plus long que d'habitude… |
| Estimator stuck | Probablement bloqué — vérifier les logs. |

## PreviewPane

| Élément | Texte |
|---------|-------|
| Empty state no draft | Décrivez votre intention pour démarrer |
| Empty state no media | Attachez un visuel pour activer la validation |
| Empty state no caption | Ajoutez une caption avant de valider |

## ApproveButton

| Élément | Texte |
|---------|-------|
| Label normal | Valider et préparer la publication |
| Loading | Validation… |
| Disabled no draft | Sélectionnez une variante |
| Disabled no media | Attachez un visuel |
| Disabled no caption | Ajoutez une caption |
| Disabled brand blocked | Brand review bloque la publication |
| Disabled already approved | Déjà validé |
| Toast success | Draft validé, prêt à publier. |
| Toast error generic | Erreur lors de la validation |

## PublishActionGroup

| Élément | Texte |
|---------|-------|
| Bouton principal | Publier |
| Hint disabled | Approuvez le draft pour activer la publication. |
| Option now label | Publier maintenant |
| Option now desc | Envoie immédiatement au provider. |
| Option schedule label | Programmer |
| Option schedule desc | Choisir une date / heure. |
| Option draft label | Brouillon Postiz |
| Option draft desc | Envoie au provider en mode review. |

### Dialog Publier maintenant
| Élément | Texte |
|---------|-------|
| Title | Publier maintenant ? |
| Description | Le post sera envoyé immédiatement au provider configuré. |
| Body warning | Vérifie l'aperçu une dernière fois. |
| Body mock | Mode mock — publication simulée, aucun appel réel. |
| Bouton cancel | Annuler |
| Bouton confirm | Confirmer |
| Toast success | Publication lancée |

### Dialog Programmer
| Élément | Texte |
|---------|-------|
| Title | Programmer la publication |
| Description | Choisis la date et l'heure de publication. |
| Label datetime | Date et heure |
| Timezone label | Fuseau : {tz} |
| Preset +1h | +1h |
| Preset demain | Demain 9h |
| Preset lundi | Lundi 14h |
| Bouton confirm | Programmer |
| Toast success | Publication programmée pour {date} |

### Dialog Brouillon Postiz
| Élément | Texte |
|---------|-------|
| Title | Envoyer en brouillon ? |
| Description | Le contenu sera disponible côté provider pour validation interne. |
| Body | Le draft sera créé côté provider, prêt à être publié manuellement. |
| Bouton confirm | Envoyer |
| Toast success | Brouillon envoyé au provider |
| Toast success avec link | Ouvrir dans Postiz |

## Erreurs (formatError mapping)

| Code | Message |
|------|---------|
| budget_exceeded | Budget IA quotidien atteint. |
| brand_review_blocked | Le contenu est bloqué par la revue brand. |
| no_media_attached | Aucun média attaché au draft. |
| no_account_connected | Aucun compte social connecté. |
| session_expired | Session expirée, veuillez vous reconnecter. |
| rate_limit_exceeded | Trop de requêtes, réessayez dans un instant. |
| provider_down | Provider indisponible. |
| version_conflict | Le draft a été modifié ailleurs. Rechargez la page. |
| min_lead_time | La date doit être au moins 5 minutes dans le futur. |

## AutosaveIndicator

| État | Texte |
|------|-------|
| idle | Sauvegardé |
| saving | Sauvegarde… |
| saved | Sauvegardé à {time} |
| error | Erreur — {message} |
| session_expired | Session expirée |
