# 50.11 — Microcopy clé

## Principes

- **Court** : moins de 8 mots quand possible
- **Direct** : verbe d'action + objet
- **Localisé** : français Maroc (familier mais pro)
- **Cohérent** : même verbe pour même action partout

## Boutons admin

| Action | Texte | Tooltip (si utile) |
|---|---|---|
| Sauver draft | `Enregistrer` | "Cmd+S — Reste en brouillon" |
| Soumettre review | `Soumettre à revue` | "Demande validation avant publication" |
| Publier | `Publier` | "Création version immutable + commit git" |
| Annuler | `Annuler` | (no tooltip) |
| Modifier | `Modifier` | (no tooltip) |
| Supprimer | `Supprimer` | "Soft-delete — restorable" |
| Archiver | `Archiver` | "Retire du site, restorable" |
| Restaurer version | `Restaurer cette version` | "Crée un draft avec ce contenu" |
| Voir aperçu | `Aperçu public` | "Ouvre dans un nouvel onglet" |
| Voir diff | `Voir les changements` | (no tooltip) |
| Tout accepter | `Tout accepter` | (cookies) |
| Tout refuser | `Tout refuser` | (cookies) |
| Personnaliser | `Personnaliser` | (cookies) |

## Boutons publics

| Action | Texte |
|---|---|
| Retour | `← Retour` |
| Lire la suite | `Lire la suite` |
| Voir tout | `Voir tout` |
| Voir plus | `Voir plus` |
| Page d'accueil | `Retour à l'accueil` |
| Contact | `Nous contacter` |
| Politique de retours | `Politique de retours et remboursements` |
| Footer link minimal | `Mentions` (espace contraint) |
| Footer link full | `Mentions légales` |

## États

### Statuts

| Backend | Affichage |
|---|---|
| `draft` | `Brouillon` |
| `review` | `En revue` |
| `published` | `Publiée` |
| `archived` | `Archivée` |

### Loading

| Contexte | Texte |
|---|---|
| Chargement page | `Chargement…` |
| Sauvegarde | `Enregistrement…` |
| Publication | `Publication en cours…` |
| Recherche | `Recherche…` |

### Auto-save

| État | Texte |
|---|---|
| Saved | `💾 Enregistré il y a {{time}}` |
| Saving | `💾 Enregistrement…` |
| Error | `⚠ Échec — retry automatique` |
| Critical | `✗ Erreur — votre travail n'est PAS perdu` |

## Toasts

### Success

| Action | Toast |
|---|---|
| Save | `✓ Page sauvegardée` |
| Publish | `✓ Page publiée — version {{v}}` |
| Submit review | `✓ Soumise à revue` |
| Archive | `✓ Page archivée` |
| Var updated | `✓ Variable mise à jour` |
| Placement added | `✓ Placement ajouté` |
| Restore | `✓ Version restaurée (brouillon)` |

### Warning

| Cause | Toast |
|---|---|
| Save offline | `⚠ Hors ligne — sauvegarde locale` |
| Missing var | `⚠ Variables manquantes` |
| Broken link | `⚠ {{n}} liens cassés détectés` |
| Conflict | `⚠ Autre éditeur — recharger ?` |

### Error

| Cause | Toast |
|---|---|
| Network | `✗ Erreur réseau — réessayer` |
| Permission | `✗ Action non autorisée` |
| Validation | `✗ Vérifie les champs marqués` |
| Server | `✗ Erreur serveur — support si persistant` |

### Info

| Cause | Toast |
|---|---|
| Auto-save off | `ℹ Auto-save désactivé pendant la revue` |
| Cache invalidated | `ℹ Cache rafraîchi — pages à re-publier (5)` |

## Confirmations

### Publication

```
Titre : Publier la version {{v + 1}} ?

Body  : Cette action est définitive. Une version immutable sera
        créée et un commit git sera enregistré sur la branche
        legal-versions.

Checklist :
- ☐ J'ai relu intégralement
- ☐ Toutes les variables sont remplies
- ☐ Les liens internes ont été testés
- ☐ La date est correcte

Tapez "PUBLIER" pour confirmer :
[___________________]

Buttons : [Annuler]  [🚀 Publier v{{v + 1}}]
```

### Archive

```
Titre : Archiver "{{title}}" ?

Body  : La page ne sera plus visible sur le site. Les liens dans
        le footer et autres zones seront retirés automatiquement.
        Vous pourrez restaurer cette page à tout moment.

Tapez "ARCHIVER" pour confirmer :
[___________________]

Buttons : [Annuler]  [Archiver]
```

### Dépublier

```
Titre : Dépublier la page ?

Body  : La page redeviendra un brouillon non visible publiquement.
        À utiliser uniquement en cas de problème critique
        détecté en production.

Tapez "DÉPUBLIER" pour confirmer :
[___________________]

Buttons : [Annuler]  [Dépublier]
```

## Empty states

### Pas de pages

```
🪶
Aucune page légale.
Le seeder devrait avoir initialisé les pages standard.

[Lancer le seeder]
```

### Pas de placements pour une zone

```
🔗
Aucune page dans cette zone.

[+ Ajouter une page]
```

### Pas d'historique

```
📜
Aucune version publiée.
L'historique apparaîtra ici dès la première publication.
```

## Erreurs publiques

### Page 404

```
404
Cette page n'existe pas ou a été déplacée.

Voici nos pages utiles :
→ Mentions légales
→ Politique de retours
→ FAQ service client

[Retour à l'accueil]
```

### Page 410 (Gone)

```
Page archivée
Cette page n'est plus en ligne.

→ Voir nos politiques actuelles
→ Mentions légales
```

### Cookie banner

```
🍪 Cookies

FemiGlow utilise des cookies pour améliorer votre navigation,
mesurer l'audience et personnaliser l'expérience.

Plus d'infos : Politique cookies · Confidentialité

[Personnaliser]  [Tout refuser]   [Tout accepter ✓]
```

### Checkbox consentement checkout

```
☐ J'accepte les [CGV] et la [Politique de confidentialité] FemiGlow.
☐ Je souhaite recevoir la newsletter (facultatif).
```

## Disclaimers

### Patch test

```
⚠ Avant utilisation : nous recommandons un patch test 24-48h
   au creux du coude. [Détail]
```

### Conseils IA

```
ℹ Les conseils de l'assistant sont cosmétiques, pas médicaux.
   En cas de doute, consultez un dermatologue.
```

### Variable manquante (admin)

```
⚠ Variable {{COMPANY_RC}} non remplie.
   Cette variable est obligatoire pour publier.
   [Remplir maintenant]
```

## Mots à éviter

| ❌ Éviter | ✅ Préférer |
|---|---|
| Cliquez ici | (texte d'ancrage descriptif) |
| Le site | FemiGlow / Le Site (avec majuscule) |
| Nos utilisateurs | Vous |
| L'acheteur | Vous |
| Promesse | Engagement |
| Garanti à vie | Garantie légale 2 ans |
| Sans condition | (préciser les conditions) |
| Données privées | Données personnelles |
| Conflit | Litige |
| Plainte | Réclamation |
