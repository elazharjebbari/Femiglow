# UI Flows -- Knowledge Edit

Ce document decrit les flux d'interaction utilisateur etape par etape pour chaque operation d'edition.

---

## 1. Flux : Modifier une collection

### 1.1 Scenario nominal

```
Etape 1 : L'admin navigue vers /admin/content-studio-v2/ai-engine/knowledge
          La page charge et affiche les collections.

Etape 2 : L'admin clique sur une collection pour l'expandre.
          Le panneau de detail s'ouvre, affichant les documents.

Etape 3 : L'admin clique sur le bouton "Modifier" (icone crayon)
          dans la zone d'actions en bas du panneau expand.

Etape 4 : La modale "Modifier la collection" s'ouvre.
          Les champs sont pre-remplis :
          - Slug : affiche en lecture seule (fond grise, non cliquable)
          - Nom : valeur actuelle de la collection
          - Description : valeur actuelle (vide si null)
          - Categorie : valeur actuelle selectionnee dans le menu

Etape 5 : L'admin modifie le nom : "Brand Guidelines FemiGlow (v2)"
          Le compteur de caracteres se met a jour : "35/200 caracteres"
          Le bouton "Enregistrer" devient actif (changement detecte).

Etape 6 : L'admin modifie la description.
          Le compteur se met a jour.

Etape 7 : L'admin clique "Enregistrer".

Etape 8 : Un spinner apparait dans le bouton "Enregistrer".
          Tous les champs sont desactives.
          Le bouton "Annuler" est desactive.

Etape 9 : La requete PATCH reussit (200 OK).
          La modale se ferme.
          Un bandeau vert s'affiche en haut de la page :
          "Collection 'Brand Guidelines FemiGlow (v2)' mise a jour"

Etape 10 : La liste des collections se rafraichit.
           Le nom de la collection est mis a jour dans la liste.
```

### 1.2 Scenario d'erreur

```
Etape 1-7 : Identiques au scenario nominal.

Etape 8 : La requete PATCH echoue (500 Internal Server Error).
          Le spinner disparait.
          Les champs redeviennent actifs.
          Un bandeau rouge s'affiche DANS la modale :
          "[!] Erreur : Internal server error"

Etape 9 : L'admin peut corriger et reessayer,
          ou cliquer "Annuler" pour fermer la modale.
```

### 1.3 Scenario : annulation avec modifications

```
Etape 1-5 : L'admin a modifie le nom.

Etape 6 : L'admin clique "Annuler" ou appuie sur Escape
          ou clique en dehors de la modale.

Etape 7 : Un dialogue natif du navigateur s'affiche :
          "Abandonner les modifications non sauvegardees ?"
          [OK] [Annuler]

Etape 8a : L'admin clique "OK".
           La modale se ferme.
           Aucune modification n'est enregistree.

Etape 8b : L'admin clique "Annuler".
           La modale reste ouverte avec les modifications en cours.
```

### 1.4 Scenario : aucune modification

```
Etape 1-4 : La modale est ouverte.

Etape 5 : L'admin ne modifie rien.
          Le bouton "Enregistrer" est desactive (grise).

Etape 6 : L'admin clique "Annuler" ou Escape.
          La modale se ferme immediatement (pas de confirmation,
          car isCollectionDirty = false).
```

---

## 2. Flux : Visualiser le contenu d'un document

### 2.1 Scenario nominal

```
Etape 1 : L'admin a expande une collection et voit la liste des documents.
          Chaque document affiche : [FileText] titre  [badge]  type  date  [Eye] [Pencil] [Trash]

Etape 2 : L'admin clique sur l'icone oeil (Eye) d'un document.

Etape 3 : La modale "Guide des ingredients japonais" s'ouvre.
          Pendant le chargement du contenu :
          - Le titre est affiche (connu depuis la liste)
          - Des Skeletons animes s'affichent a la place des metadonnees et du contenu

Etape 4 : Le GET /knowledge/{slug}/documents/{docId} retourne le document complet.
          Les Skeletons disparaissent et le contenu s'affiche :

          +----------------------------------------------------+
          | Type: text  |  Chunks: 15  |  Cree: 1 mai 2026    |
          | Modifie: 20 mai 2026                               |
          +----------------------------------------------------+
          |                                                    |
          | Le Tsubaki (Camellia japonica) est une huile       |
          | precieuse extraite des graines du camellia.         |
          | Utilisee depuis des siecles dans la beaute          |
          | japonaise...                                       |
          |                                        [scroll]    |
          +----------------------------------------------------+
          |                     [Modifier]  [Fermer]           |
          +----------------------------------------------------+

Etape 5 : L'admin lit le contenu (scrollable si > 400px).

Etape 6a : L'admin clique "Fermer" -> la modale se ferme.
Etape 6b : L'admin clique "Modifier" -> la modale de visualisation
           se ferme et la modale d'edition s'ouvre (voir flux 3).
```

### 2.2 Scenario d'erreur de chargement

```
Etape 1-3 : Identiques.

Etape 4 : Le GET echoue (404, 500, timeout).
          Les Skeletons sont remplaces par un message d'erreur :

          +----------------------------------------------------+
          |                   [!]                               |
          |     Erreur : Document introuvable                  |
          |             [Reessayer]                             |
          +----------------------------------------------------+

Etape 5a : L'admin clique "Reessayer" -> un nouveau GET est lance.
Etape 5b : L'admin ferme la modale.
```

### 2.3 Scenario : contenu vide

```
Etape 4 : Le document est charge mais contentText est null.
          A la place du contenu, un message s'affiche en italique :
          "Contenu non disponible"

          Cela peut arriver pour un document de type "url" dont le
          contenu a ete supprime, ou un ancien document sans contenu.
```

### 2.4 Scenario : document URL avec lien source

```
Etape 4 : Le document est charge avec sourceType="url" et sourceUrl="https://...".
          Dans les metadonnees, une ligne supplementaire s'affiche :
          "URL : https://example.com/article" (lien cliquable, ouvre dans un nouvel onglet)
```

---

## 3. Flux : Modifier un document (titre seul)

### 3.1 Scenario nominal

```
Etape 1 : L'admin clique sur l'icone crayon (Pencil) d'un document.

Etape 2 : La modale "Modifier le document" s'ouvre.
          Pendant le chargement :
          - Des Skeletons s'affichent pour le titre et le contenu

Etape 3 : Le GET /knowledge/{slug}/documents/{docId} retourne le document.
          Les champs sont pre-remplis :
          - Titre : "Guide des ingredients japonais"
          - Contenu : (texte complet dans un textarea redimensionnable)
          - Compteur : "3,256 caracteres"

Etape 4 : L'admin modifie UNIQUEMENT le titre :
          "Guide des ingredients japonais (Edition 2026)"
          Le compteur de titre se met a jour.

          IMPORTANT : Comme le contenu n'est PAS modifie,
          l'avertissement de re-chunking ne s'affiche PAS.

Etape 5 : L'admin clique "Enregistrer".
          Le bouton affiche "Enregistrement..." avec un spinner.
          Pas de dialogue de confirmation (pas de re-chunking).

Etape 6 : La requete PATCH est envoyee avec body = { title: "..." }.
          La reponse arrive rapidement (< 500ms) :
          { success: true, chunkCount: 15, reChunked: false }

Etape 7 : La modale se ferme.
          Un bandeau vert s'affiche : "Titre du document mis a jour"
          La liste des documents se rafraichit (nouveau titre visible).
```

---

## 4. Flux : Modifier un document (contenu avec re-chunking)

### 4.1 Scenario nominal complet

```
Etape 1 : L'admin clique sur l'icone crayon d'un document.

Etape 2-3 : La modale s'ouvre et le contenu est charge (identique au flux 3).

Etape 4 : L'admin modifie le contenu dans le textarea.
          Des qu'un caractere est modifie, un avertissement jaune s'affiche :

          +----------------------------------------------------+
          | [!] La modification du contenu entrainera la        |
          |     suppression des chunks existants et la          |
          |     generation de nouveaux embeddings. Cette        |
          |     operation peut prendre quelques secondes.       |
          +----------------------------------------------------+

Etape 5 : L'admin modifie aussi le titre (optionnel).

Etape 6 : L'admin clique "Enregistrer".

Etape 7 : Le dialogue de confirmation s'affiche :

          +----------------------------------------------------+
          | [!] Confirmer la re-indexation                      |
          |                                                    |
          | Les chunks existants seront supprimes et le         |
          | nouveau contenu sera re-decoupe et re-embedde.     |
          |                                                    |
          | Cette operation :                                   |
          | - Utilise l'API OpenAI (cout negligeable)           |
          | - Peut prendre 5-15 secondes                        |
          | - Est irreversible une fois confirmee               |
          |                                                    |
          |              [Annuler]  [Confirmer et re-indexer]   |
          +----------------------------------------------------+

Etape 8a : L'admin clique "Annuler".
           Retour au formulaire d'edition (les modifications sont conservees).

Etape 8b : L'admin clique "Confirmer et re-indexer".

Etape 9 : Le dialogue de confirmation se ferme.
          Le bouton "Enregistrer" affiche "Re-indexation en cours..." avec un spinner.
          Tous les champs sont desactives.

Etape 10 : La requete PATCH est envoyee avec body = { title: "...", content: "..." }.
           Le serveur :
           1. Supprime les anciens chunks
           2. Met a jour le document
           3. Re-decoupe le nouveau contenu
           4. Genere les embeddings via OpenAI
           5. Insere les nouveaux chunks
           6. Met a jour les compteurs

Etape 11 : La reponse arrive (3-15 secondes) :
           { success: true, chunkCount: 18, reChunked: true }

Etape 12 : La modale se ferme.
           Un bandeau vert s'affiche :
           "Document mis a jour avec 18 chunks re-generes"
           La liste se rafraichit : le nombre de chunks est mis a jour.
```

### 4.2 Scenario d'erreur OpenAI

```
Etape 1-9 : Identiques au scenario nominal.

Etape 10 : La requete PATCH echoue (500) :
           { error: "Update failed", detail: "OpenAI API rate limit exceeded" }

           IMPORTANT : Grace a la transaction, les anciens chunks
           sont preserves. Aucune donnee n'est perdue.

Etape 11 : Le spinner disparait.
           Un bandeau rouge s'affiche dans la modale :
           "[!] Erreur : OpenAI API rate limit exceeded"
           Les champs redeviennent actifs.

Etape 12 : L'admin peut :
           a) Attendre quelques secondes et reessayer
           b) Annuler l'edition (les modifications seront perdues)
```

### 4.3 Scenario : modification puis annulation du contenu

```
Etape 1-4 : L'admin a modifie le contenu (avertissement visible).

Etape 5 : L'admin decide de revenir en arriere et remet le contenu original.
          Si editDocContent === editDocOriginalContent :
          - L'avertissement de re-chunking disparait
          - Le bouton "Enregistrer" est desactive (aucun changement)
```

---

## 5. Flux : Transition visualisation vers edition

### 5.1 Scenario

```
Etape 1 : L'admin visualise un document (DocumentViewDialog ouvert).

Etape 2 : L'admin clique "Modifier" dans le footer de la modale.

Etape 3 : La modale de visualisation se ferme (setViewingDoc(null)).
          La modale d'edition s'ouvre (openEditDocument(slug, docId, collectionId)).

          OPTIMISATION : Si le contenu est deja en cache dans viewDocData,
          il est pre-rempli immediatement sans relancer le GET.
          (A implementer dans une version future. Pour l'instant,
          un nouveau GET est effectue.)

Etape 4 : Le formulaire d'edition s'affiche avec les donnees pre-remplies.
          L'admin peut modifier et sauvegarder normalement.
```

---

## 6. Flux : Navigation clavier

### 6.1 Ouverture et navigation dans la modale

```
1. L'admin navigue au bouton "Modifier" via Tab.
2. L'admin appuie sur Enter ou Space.
3. La modale s'ouvre. Le focus est place sur le premier champ editable (Nom).
4. Tab navigue dans l'ordre : Nom -> Description -> Categorie -> Annuler -> Enregistrer.
5. Shift+Tab navigue en sens inverse.
6. Escape ferme la modale (avec confirmation si dirty).
```

### 6.2 Soumission du formulaire

```
1. Le focus est sur le champ Nom.
2. L'admin appuie sur Enter : rien ne se passe (pas de soumission implicite
   car le formulaire n'est pas un <form> avec onSubmit).
3. L'admin navigue au bouton "Enregistrer" via Tab.
4. L'admin appuie sur Enter ou Space.
5. handleSaveCollection() est appele.
```

### 6.3 Textarea du contenu (document)

```
1. Le focus est sur le textarea.
2. Enter ajoute une nouvelle ligne (comportement normal du textarea).
3. Tab sort du textarea et va au bouton "Annuler".
4. Pour soumettre, l'admin doit Tab jusqu'au bouton "Enregistrer".
```

---

## 7. Flux : Cas limites

### 7.1 Double clic rapide sur "Enregistrer"

```
Protection : Le bouton est desactive (disabled={savingCol || savingDoc})
des que le premier clic declenche le handler. Le deuxieme clic est ignore.
```

### 7.2 Ouverture de deux modales simultanees

```
Protection : Les modales sont mutuellement exclusives.
- openEditCollection ferme viewingDoc et editingDoc
- openEditDocument ferme viewingDoc et editingCollection
- handleViewDocument ferme editingDoc et editingCollection

En pratique, l'utilisateur ne peut ouvrir qu'une seule modale a la fois
car les boutons declencheurs sont dans des zones separees de l'interface.
```

### 7.3 Modification concurrente

```
Scenario : Deux admins modifient la meme collection en meme temps.

Comportement actuel : "Last write wins" (la derniere PATCH ecrase la precedente).
Pas de detection de conflit (pas de version number ou ETag).

Mitigation : La probabilite est tres faible (utilisation mono-admin en pratique).
Si necessaire, un mecanisme d'optimistic locking pourra etre ajoute dans
une version future (via un champ `version` ou un ETag).
```

### 7.4 Perte de connexion pendant le re-chunking

```
Scenario : L'admin perd sa connexion internet pendant le PATCH du contenu.

Comportement :
1. La requete fetch echoue avec une erreur reseau.
2. Le message d'erreur s'affiche dans la modale : "Failed to fetch"
3. Le serveur a peut-etre recu la requete :
   a) Si la requete n'a pas atteint le serveur : aucun changement.
   b) Si la requete a atteint le serveur et la transaction a reussi :
      les donnees sont mises a jour cote serveur.
      Au prochain rechargement, l'admin verra les donnees mises a jour.
   c) Si la requete a atteint le serveur mais la transaction a echoue :
      rollback, aucun changement.
```

### 7.5 Document de type "url" -- edition du contenu

```
Scenario : L'admin edite un document de type "url".

Comportement : Le contenu est editable normalement (le contenu texte
extrait de l'URL est modifiable). L'URL source reste inchangee
(sourceUrl n'est pas modifiable). Cela permet de corriger le contenu
extrait automatiquement qui peut contenir des erreurs d'extraction.
```
