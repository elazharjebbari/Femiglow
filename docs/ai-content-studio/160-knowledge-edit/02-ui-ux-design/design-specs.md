# Specifications UI/UX -- Knowledge Edit

**Design System** : Content Studio v2 (CS v2)  
**Palette** : Ivory (#FDFAF7) + Terracotta (#C75B39)  
**Composants** : Primitives CS v2 (Button, Input, Badge, Dialog, Skeleton)

---

## 1. Choix d'interaction : Modale vs Inline

### 1.1 Analyse comparative

| Critere | Inline (dans la page) | Modale (dialog overlay) |
|---------|----------------------|------------------------|
| Contexte visuel | L'utilisateur voit la liste en arriere-plan | Focus isole sur l'edition |
| Complexite | Forte (gestion de l'espace, scroll, conflits d'etat) | Moderee (composant Dialog existant) |
| Accessibilite | Difficile (focus management dans une liste) | Excellente (focus trap natif du Dialog) |
| Coherence | Inconsistant avec les formulaires existants | Coherent avec le pattern de creation de collection |
| Mobile | Problematique (espace reduit) | Adapte (plein ecran sur mobile) |

### 1.2 Decision

**Modales** pour toutes les operations d'edition. Raisons :

1. Le composant `Dialog` est deja disponible dans les primitives CS v2
2. L'edition necessite un espace consequent (textarea pour le contenu)
3. Le focus trap et la gestion du clavier sont geres nativement
4. Coherence avec les patterns UX du Content Studio

---

## 2. Points d'entree dans l'UI

### 2.1 Bouton d'edition de collection

Position : A droite du bouton "Supprimer la collection" dans le panneau expand d'une collection.

```
+----------------------------------------------------------------+
|  [+] Ajouter un document               [Pencil] Modifier  [X] Supprimer la collection  |
+----------------------------------------------------------------+
```

- Icone : `Pencil` (lucide-react), 12px
- Style : `Button variant="ghost" size="sm"`
- Couleur : `var(--cs-fg-secondary)`, hover `var(--cs-accent)`
- Label : "Modifier"

### 2.2 Boutons sur les lignes de document

Position : A droite de chaque ligne de document, avant le bouton de suppression existant.

```
+--------------------------------------------------------------------------+
|  [FileText] Guide Tsubaki Oil   [15 chunks]  text  25 mai  [Eye] [Pencil] [Trash]  |
+--------------------------------------------------------------------------+
```

- Bouton "Voir" : icone `Eye`, 13px, meme style que le bouton Trash existant
- Bouton "Modifier" : icone `Pencil`, 13px, meme style
- Espacement : `gap: 4px` entre les boutons d'action

---

## 3. CollectionEditDialog -- Modale d'edition de collection

### 3.1 Mockup ASCII

```
+---------------------------------------------------------------+
|                                                               |
|  Modifier la collection                                [X]   |
|  ─────────────────────────────────────────────────────        |
|                                                               |
|  Slug (lecture seule)                                         |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ brand-femiglow                                       │     |
|  └─────────────────────────────────────────────────────┘     |
|                                                               |
|  Nom *                                                        |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ Brand Guidelines FemiGlow                            │     |
|  └─────────────────────────────────────────────────────┘     |
|  0/200 caracteres                                             |
|                                                               |
|  Description                                                  |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ Identite de marque, ton editorial, vocabulaire,      │     |
|  │ interdits                                            │     |
|  └─────────────────────────────────────────────────────┘     |
|  0/500 caracteres                                             |
|                                                               |
|  Categorie *                                                  |
|  ┌───────────────────────────────────────── [v] ───────┐     |
|  │ Marque                                               │     |
|  └─────────────────────────────────────────────────────┘     |
|                                                               |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ [!] Erreur : Le nom ne peut pas etre vide            │     |
|  └─────────────────────────────────────────────────────┘     |
|                                                               |
|                              [Annuler]  [Enregistrer]         |
|                                                               |
+---------------------------------------------------------------+
```

### 3.2 Etats visuels

| Etat | Description | Comportement visuel |
|------|-------------|-------------------|
| **Par defaut** | Formulaire pre-rempli | Champs editables, bouton "Enregistrer" actif |
| **Aucun changement** | Aucun champ modifie | Bouton "Enregistrer" desactive (grise) |
| **Validation en erreur** | Nom vide | Bordure rouge sur le champ, message sous le champ |
| **Chargement** | Requete PATCH en cours | Spinner dans le bouton "Enregistrer", champs desactives |
| **Erreur serveur** | Reponse 4xx/5xx | Bandeau d'erreur rouge dans la modale |
| **Succes** | 200 OK | Modale fermee, toast de succes |

### 3.3 Specifications du champ Slug (lecture seule)

```css
/* Style du champ slug en lecture seule */
background: var(--cs-bg-sunken);    /* Fond gris clair */
color: var(--cs-fg-muted);          /* Texte grise */
cursor: not-allowed;
border: 1px solid var(--cs-border); /* Bordure standard */
font-family: var(--cs-font-mono);   /* Police monospace */
opacity: 0.7;
```

---

## 4. DocumentViewDialog -- Modale de visualisation

### 4.1 Mockup ASCII

```
+---------------------------------------------------------------+
|                                                               |
|  Guide des ingredients japonais                        [X]   |
|  ─────────────────────────────────────────────────────        |
|                                                               |
|  ┌──────────────────────────────────────────────────┐        |
|  │ Type: text        Chunks: 15       Cree: 1 mai   │        |
|  │ Modifie: 20 mai                                   │        |
|  └──────────────────────────────────────────────────┘        |
|                                                               |
|  Contenu                                                      |
|  ┌──────────────────────────────────────────────────┐        |
|  │ Le Tsubaki (Camellia japonica) est une huile      │        |
|  │ precieuse extraite des graines du camellia.       │        |
|  │ Utilisee depuis des siecles dans la beaute        │        |
|  │ japonaise, elle nourrit et protege les cheveux    │        |
|  │ et la peau.                                        │        |
|  │                                                    │        |
|  │ Proprietes :                                       │        |
|  │ - Riche en acide oleique (85%)                     │        |
|  │ - Penetre rapidement sans residus gras             │        |
|  │ - Protection UV naturelle                          │        |
|  │ ...                                                │ scroll |
|  └──────────────────────────────────────────────────┘        |
|                                                               |
|                         [Modifier]  [Fermer]                  |
|                                                               |
+---------------------------------------------------------------+
```

### 4.2 Etats visuels

| Etat | Description | Comportement |
|------|-------------|-------------|
| **Chargement** | GET en cours | Skeleton animee a la place du contenu |
| **Charge** | Contenu disponible | Affichage du texte dans un bloc scrollable |
| **Erreur** | GET echoue | Message d'erreur avec bouton "Reessayer" |
| **Contenu vide** | contentText = null | Message "Contenu non disponible" |

### 4.3 Bloc de metadonnees

```css
/* Style du bloc de metadonnees */
background: var(--cs-bg-sunken);
border-radius: var(--cs-radius-sm);
padding: 12px 16px;
font-size: var(--cs-text-xs);
color: var(--cs-fg-secondary);
display: grid;
grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
gap: 8px;
```

### 4.4 Bloc de contenu

```css
/* Style du textarea en lecture seule */
background: var(--cs-bg-elevated);
border: 1px solid var(--cs-border);
border-radius: var(--cs-radius-sm);
padding: 16px;
font-family: var(--cs-font-body);
font-size: var(--cs-text-sm);
line-height: 1.6;
color: var(--cs-fg-primary);
max-height: 400px;
overflow-y: auto;
white-space: pre-wrap;
word-break: break-word;
```

---

## 5. DocumentEditDialog -- Modale d'edition de document

### 5.1 Mockup ASCII

```
+---------------------------------------------------------------+
|                                                               |
|  Modifier le document                                  [X]   |
|  ─────────────────────────────────────────────────────        |
|                                                               |
|  Titre *                                                      |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ Guide des ingredients japonais                       │     |
|  └─────────────────────────────────────────────────────┘     |
|  0/500 caracteres                                             |
|                                                               |
|  Contenu *                                                    |
|  ┌─────────────────────────────────────────────────────┐     |
|  │ Le Tsubaki (Camellia japonica) est une huile        │     |
|  │ precieuse extraite des graines du camellia.         │     |
|  │ Utilisee depuis des siecles dans la beaute          │     |
|  │ japonaise, elle nourrit et protege les cheveux      │     |
|  │ et la peau.                                          │     |
|  │                                                      │     |
|  │ Proprietes :                                         │     |
|  │ - Riche en acide oleique (85%)                       │     |
|  │ - Penetre rapidement sans residus gras               │     |
|  │                                                      │  |  |
|  └─────────────────────────────────────────────────────┘     |
|  3,256 caracteres                                             |
|                                                               |
|  ┌──────────────────────────────────────────────────────┐    |
|  │ [!] La modification du contenu entrainera un         │    |
|  │     re-decoupage et un re-embedding des chunks.      │    |
|  │     Chunks actuels : 15                              │    |
|  └──────────────────────────────────────────────────────┘    |
|                                                               |
|                              [Annuler]  [Enregistrer]         |
|                                                               |
+---------------------------------------------------------------+
```

### 5.2 Etats visuels detailles

| Etat | Description | Comportement |
|------|-------------|-------------|
| **Chargement initial** | Chargement du contenu via GET | Skeleton sur les champs, boutons desactives |
| **Pret a editer** | Formulaire pre-rempli | Champs editables |
| **Titre seul modifie** | Contenu inchange | Pas d'avertissement re-embedding, bouton "Enregistrer" actif |
| **Contenu modifie** | Texte different de l'original | Avertissement re-embedding visible (fond ambre) |
| **Soumission** | PATCH en cours | Spinner "Re-indexation en cours..." si re-chunk, "Enregistrement..." sinon |
| **Erreur** | Reponse negative | Bandeau d'erreur rouge, formulaire reste ouvert |
| **Succes** | 200 OK | Modale fermee, toast de succes |

### 5.3 Avertissement de re-chunking

Visible uniquement si le contenu a ete modifie (`editDocContent !== editDocOriginalContent`) :

```css
/* Style de l'avertissement */
background: var(--cs-warning-bg);    /* Fond ambre clair */
border: 1px solid var(--cs-warning);
border-radius: var(--cs-radius-sm);
padding: 12px 16px;
display: flex;
align-items: flex-start;
gap: 10px;
font-size: var(--cs-text-xs);
color: var(--cs-fg-primary);
```

Texte de l'avertissement :

> La modification du contenu entrainera la suppression des {N} chunks existants et la generation de nouveaux embeddings. Cette operation peut prendre quelques secondes selon la taille du contenu.

---

## 6. ConfirmReChunkDialog -- Dialogue de confirmation

### 6.1 Mockup ASCII

```
+--------------------------------------------------+
|                                                  |
|  [!] Confirmer la re-indexation                  |
|  ────────────────────────────────────────        |
|                                                  |
|  Les 15 chunks existants seront supprimes        |
|  et le nouveau contenu sera re-decoupe et        |
|  re-embedde.                                     |
|                                                  |
|  Cette operation :                               |
|  - Utilise l'API OpenAI (cout negligeable)       |
|  - Peut prendre 5-15 secondes                    |
|  - Est irreversible une fois confirmee           |
|                                                  |
|            [Annuler]  [Confirmer et re-indexer]   |
|                                                  |
+--------------------------------------------------+
```

### 6.2 Style

- Taille de la modale : compacte (max-width: 480px)
- Icone `AlertCircle` en ambre, taille 20px
- Bouton "Confirmer et re-indexer" : style primaire (terracotta)
- Bouton "Annuler" : style ghost

---

## 7. Etats de chargement

### 7.1 Skeleton pour le contenu du document

Lors du chargement du contenu dans DocumentViewDialog ou DocumentEditDialog :

```
+---------------------------------------------------------------+
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   (titre)        |
|  ─────────────────────────────────────────────────────        |
|  ░░░░░░░░░░   ░░░░░░░░   ░░░░░░░░   ░░░░░  (metadonnees)   |
|                                                               |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░          |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                 |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                              |
|  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                |
|                                                               |
+---------------------------------------------------------------+
```

Le composant `Skeleton` existant est utilise avec les props :

```typescript
<Skeleton height={20} width="60%" />     // Titre
<Skeleton height={14} width="100%" />    // Ligne de contenu
<Skeleton height={14} width="85%" />     // Ligne de contenu
<Skeleton height={14} width="92%" />     // Ligne de contenu
// ... 5-8 lignes de skeleton
```

### 7.2 Spinner dans les boutons

Le composant `Button` existant supporte la prop `loading` :

```typescript
<Button loading={savingCol}>Enregistrer</Button>
// Affiche un spinner Loader2 a la place de l'icone
```

Pour le re-chunking, le texte du bouton change pendant le chargement :

```typescript
<Button loading={savingDoc}>
  {savingDoc
    ? (isDocumentContentDirty ? 'Re-indexation en cours...' : 'Enregistrement...')
    : 'Enregistrer'
  }
</Button>
```

---

## 8. Etats d'erreur

### 8.1 Erreur dans une modale

```
+---------------------------------------------------------------+
|  ...                                                          |
|  ┌──────────────────────────────────────────────────────┐    |
|  │ [!] Erreur : Le nom de la collection est deja        │    |
|  │     utilise par une autre collection                  │    |
|  └──────────────────────────────────────────────────────┘    |
|                                                               |
|                              [Annuler]  [Enregistrer]         |
+---------------------------------------------------------------+
```

Style du bandeau d'erreur :

```css
background: var(--cs-danger-bg);
border-radius: var(--cs-radius-sm);
padding: 8px 12px;
display: flex;
align-items: center;
gap: 8px;
font-size: var(--cs-text-xs);
color: var(--cs-danger);
```

### 8.2 Toast de succes

Le toast de succes est gere par le state `ingestSuccess` existant, affiche en haut de la page :

```
+---------------------------------------------------------------+
| [Check] Collection "Brand Guidelines FemiGlow" mise a jour    |
+---------------------------------------------------------------+
```

---

## 9. Accessibilite

### 9.1 ARIA

| Element | Attribut ARIA | Valeur |
|---------|--------------|--------|
| Modale | `role` | `dialog` |
| Modale | `aria-modal` | `true` |
| Modale | `aria-labelledby` | ID du titre de la modale |
| Champ en erreur | `aria-invalid` | `true` |
| Champ en erreur | `aria-describedby` | ID du message d'erreur |
| Bouton chargement | `aria-busy` | `true` |
| Champ slug (readonly) | `aria-readonly` | `true` |
| Champ slug (readonly) | `aria-label` | "Slug de la collection (non modifiable)" |
| Bouton Modifier (collection) | `aria-label` | "Modifier la collection {nom}" |
| Bouton Voir (document) | `aria-label` | "Voir le contenu de {titre}" |
| Bouton Modifier (document) | `aria-label` | "Modifier le document {titre}" |
| Compteur de caracteres | `aria-live` | `polite` |

### 9.2 Navigation clavier

| Touche | Action |
|--------|--------|
| `Tab` | Navigation entre les champs du formulaire |
| `Shift+Tab` | Navigation inverse |
| `Enter` | Soumission du formulaire (sauf dans le textarea) |
| `Escape` | Fermeture de la modale (avec confirmation si dirty) |
| `Space` | Activation des boutons |

### 9.3 Contraste

Les tokens CS v2 respectent un ratio de contraste minimal de 4.5:1 (WCAG AA) :

| Element | Couleur texte | Couleur fond | Ratio |
|---------|--------------|-------------|-------|
| Label | `var(--cs-fg-primary)` | `var(--cs-bg-elevated)` | 7.2:1 |
| Placeholder | `var(--cs-fg-muted)` | `var(--cs-bg-elevated)` | 4.8:1 |
| Erreur | `var(--cs-danger)` | `var(--cs-danger-bg)` | 5.1:1 |
| Slug readonly | `var(--cs-fg-muted)` | `var(--cs-bg-sunken)` | 4.6:1 |

---

## 10. Animations et transitions

### 10.1 Ouverture/fermeture de modale

Le composant `Dialog` utilise les tokens d'animation CS v2 :

```css
/* Ouverture */
animation: cs-dialog-in var(--cs-motion-normal) var(--cs-easing);

@keyframes cs-dialog-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Overlay */
animation: cs-overlay-in var(--cs-motion-fast) linear;

@keyframes cs-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### 10.2 Hover sur les boutons d'action (oeil, crayon)

```css
transition: all var(--cs-motion-fast) var(--cs-easing);

/* Hover */
background: var(--cs-accent-bg);
color: var(--cs-accent);
```

---

## 11. Tokens CSS utilises

| Token | Valeur | Utilisation |
|-------|--------|-------------|
| `--cs-bg-elevated` | `#FFFFFF` | Fond des modales et champs |
| `--cs-bg-sunken` | `#F5F0EB` | Fond du champ slug readonly |
| `--cs-bg-base` | `#FDFAF7` (ivory) | Fond de page |
| `--cs-accent` | `#C75B39` (terracotta) | Boutons primaires, liens |
| `--cs-accent-bg` | `rgba(199,91,57,0.08)` | Hover boutons ghost |
| `--cs-danger` | `#D93025` | Erreurs |
| `--cs-danger-bg` | `rgba(217,48,37,0.06)` | Fond des erreurs |
| `--cs-warning` | `#E8A317` | Avertissements |
| `--cs-warning-bg` | `rgba(232,163,23,0.08)` | Fond de l'avertissement re-chunk |
| `--cs-success` | `#2E7D32` | Messages de succes |
| `--cs-success-bg` | `rgba(46,125,50,0.06)` | Fond du toast succes |
| `--cs-border` | `#E2DCD4` | Bordures des champs |
| `--cs-border-hair` | `#EDE8E1` | Bordures fines |
| `--cs-fg-primary` | `#1A1714` | Texte principal |
| `--cs-fg-secondary` | `#6B6560` | Texte secondaire |
| `--cs-fg-muted` | `#9E9790` | Texte desactive |
| `--cs-radius-sm` | `6px` | Coins des champs |
| `--cs-radius-md` | `10px` | Coins des cartes/modales |
| `--cs-shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | Ombre des cartes |
| `--cs-text-xs` | `0.75rem` | Labels, compteurs |
| `--cs-text-sm` | `0.875rem` | Contenu principal |
| `--cs-text-2xl` | `1.5rem` | Titres de modale |
| `--cs-font-display` | `'DM Serif Display', serif` | Titres |
| `--cs-font-body` | `'DM Sans', sans-serif` | Corps de texte |
| `--cs-font-mono` | `'JetBrains Mono', monospace` | Slug, code |
| `--cs-motion-fast` | `150ms` | Transitions courtes |
| `--cs-motion-normal` | `250ms` | Transitions modales |
| `--cs-easing` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Courbe d'animation |
