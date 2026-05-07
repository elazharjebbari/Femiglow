# Voix rédactionnelle — admin

> L'admin parle la même langue que le site public : sobre, féminine,
> précise, sans jargon. Même privée, l'interface honore la marque.

---

## Principes

1. **Phrases complètes**. Pas de "Save" mais "Enregistrer."
2. **Tutoiement banni, vouvoiement aussi**. On parle des choses,
   pas à l'utilisatrice : "Statut mis à jour" plutôt que "Vous avez mis
   à jour le statut".
3. **Ponctuation soignée**. Espaces insécables avant `: ; ! ?` (déjà
   géré côté Tailwind via `prose` ou typographie custom).
4. **Capitalisation française**. Pas de Title Case anglo-saxon. "Gérer
   les leads" et non "Gérer Les Leads".
5. **Féminin par défaut** quand pertinent : "administratrice",
   "fondatrice".
6. **Pas d'émojis** dans les libellés.
7. **Pas de superlatifs marketing** ("génial", "super", "fantastique").

## Lexique imposé

| Concept | Utiliser | Bannir |
|---|---|---|
| Lead | "lead" (mot accepté en marketing) | "prospect", "contact" (ambigu) |
| Endpoint webhook | "webhook" ou "destination webhook" | "URL de callback" |
| Livraison | "livraison" | "envoi", "delivery" |
| Statut | "statut" | "état" (réservé technique) |
| Mot de passe | "mot de passe" | "password" |
| Connexion | "connexion" | "login" (sauf contexte technique) |
| Tableau de bord | "tableau de bord" | "dashboard" (à éviter en UI) |
| Brouillon | "brouillon" | "draft" |
| Rejouer | "rejouer une livraison" | "retry", "replay" |

## Microcopy par contexte

### Boutons

| Action | Libellé |
|---|---|
| Soumettre formulaire login | "Se connecter" |
| Quitter session | "Se déconnecter" |
| Enregistrer modifications | "Enregistrer" |
| Annuler | "Annuler" |
| Confirmer suppression | "Supprimer définitivement" |
| Ajouter une note | "Ajouter une note" |
| Rejouer une livraison | "Rejouer la livraison" |
| Exporter CSV | "Exporter en CSV" |
| Activer / désactiver | "Activer" / "Désactiver" |
| Copier le secret | "Copier" |
| Générer un secret | "Générer un secret" |

### Confirmations destructives

```
Titre :       Supprimer ce lead ?
Description : Cette action est irréversible. Le lead et son historique
              seront effacés définitivement.
Confirmer :   Supprimer définitivement
Annuler :     Annuler
```

```
Titre :       Désactiver ce webhook ?
Description : Aucun lead ne sera transmis vers cette destination tant
              qu'elle est désactivée. Les livraisons en cours iront à
              leur terme.
Confirmer :   Désactiver
Annuler :     Annuler
```

### Toasts de succès

| Contexte | Message |
|---|---|
| Login réussi | "Bienvenue." |
| Statut changé | "Statut mis à jour." |
| Note ajoutée | "Note ajoutée." |
| Webhook créé | "Destination webhook enregistrée." |
| Webhook activé | "Destination activée." |
| Livraison rejouée | "Livraison reprogrammée." |
| Export CSV | "Export prêt au téléchargement." |

### Toasts d'erreur

| Contexte | Message |
|---|---|
| Erreur générique | "Une erreur est survenue. Réessayez dans un instant." |
| Session expirée | "Session expirée. Connectez-vous à nouveau." |
| Champ invalide | "Vérifiez les informations saisies." |
| Réseau indisponible | "La connexion semble interrompue." |
| Permission refusée | "Action non autorisée." |

### États vides

| Contexte | Message |
|---|---|
| Aucun lead | "Aucun lead pour le moment. Les soumissions du site apparaîtront ici." |
| Aucun webhook | "Aucune destination configurée. Ajoutez une URL pour transmettre les leads." |
| Aucun résultat de filtre | "Aucun résultat ne correspond à ces filtres." |
| Aucune livraison | "Aucune livraison à afficher." |

### Aide contextuelle

| Champ | Aide |
|---|---|
| URL endpoint webhook | "Adresse complète, en HTTPS, du serveur partenaire." |
| Secret webhook | "Clé partagée pour signer chaque livraison. Conservez-la précieusement." |
| Filtre webhook | "Restreindre aux leads d'un type spécifique. Vide = tous les leads." |
| Email admin | "Adresse de connexion à l'espace administration." |
| Mot de passe | "12 caractères minimum." |

## Typographie textuelle

- Apostrophe typographique « ' » (`U+2019`) au lieu de l'ASCII `'`.
- Guillemets « ... » (`U+00AB`, `U+00BB`) pour les citations.
- Tirets cadratins « — » (`U+2014`) pour les incises.
- Points de suspension « … » (`U+2026`) caractère unique.

```
Mauvais : "L'admin n'est pas connectée..."
Bon     : « L'admin n'est pas connectée… »
```

## Internationalisation

V1 : français uniquement. Pas de système de i18n.
Si l'i18n devient nécessaire (v2), utiliser `next-intl` et migrer tous
les libellés vers `messages/fr.json`.
