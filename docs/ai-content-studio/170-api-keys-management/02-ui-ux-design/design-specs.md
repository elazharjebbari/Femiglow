# Specifications UI/UX - Gestion des Cles API

> Module : 170 - API Keys Management
> Design system : Content Studio v2 (palette ivory/terracotta)
> Date : 2026-05-25

---

## 1. Contexte de design

### 1.1 Page parente

La gestion des cles API s'integre dans la page de configuration existante :
```
/admin/content-studio-v2/ai-engine/config
```

Cette page utilise deja un systeme d'onglets (`providers`, `workflows`, `prompts`). Le nouvel onglet `api-keys` s'insere en 4e position avec l'icone `Key` de lucide-react.

### 1.2 Principes de design

1. **Coherence** : meme structure visuelle que les onglets existants (cartes, formulaires inline, badges)
2. **Securite visuelle** : les cles sont masquees par defaut, l'utilisateur ne voit que le minimum necessaire
3. **Feedback immediat** : chaque action (test, sauvegarde, suppression) fournit un retour visuel instantane
4. **Prevention d'erreur** : validation avant sauvegarde, confirmation avant suppression

---

## 2. Maquettes ASCII

### 2.1 Vue de l'onglet "Cles API" - Etat avec cles configurees

```
+--------------------------------------------------------------------------+
| < AI Engine                                                              |
|   Configuration                                                         |
|   Gerez les fournisseurs IA, les workflows et les cles API.             |
|                                                                    [...] |
+--------------------------------------------------------------------------+
| [Fournisseurs (5)] [Workflows (3)] [Prompts (8)] [Cles API (3)]         |
|                                                   ^^^^^^^^^^            |
+--------------------------------------------------------------------------+
|                                                                          |
|  +---[ Ajouter une cle ]--------------------------------------------+   |
|                                                                          |
|  +-------------------------------------------------------------------+   |
|  | === (vert)                                                        |   |
|  | [O] OpenAI                                    [Valide] (vert)     |   |
|  |     sk-proj-...AbCd          [Base de donnees]                    |   |
|  |                                                                   |   |
|  |     Derniere validation : il y a 2h                               |   |
|  |     Configuree le 2026-05-20                                      |   |
|  |                                                [Tester] [Editer]  |   |
|  +-------------------------------------------------------------------+   |
|                                                                          |
|  +-------------------------------------------------------------------+   |
|  | === (vert)                                                        |   |
|  | [A] Anthropic                                 [Valide] (vert)     |   |
|  |     sk-ant-...XyZw           [Env var]                            |   |
|  |                                                                   |   |
|  |     Derniere validation : il y a 1j                               |   |
|  |     Source : AI_ENGINE_ANTHROPIC_API_KEY                          |   |
|  |                                                [Tester]           |   |
|  +-------------------------------------------------------------------+   |
|                                                                          |
|  +-------------------------------------------------------------------+   |
|  | === (jaune)                                                       |   |
|  | [G] Google AI (Gemini)                        [Non testee] (gris) |   |
|  |     AIza...1234              [Base de donnees]                    |   |
|  |                                                                   |   |
|  |     Jamais testee                                                 |   |
|  |     Configuree le 2026-05-22                                      |   |
|  |                                                [Tester] [Editer]  |   |
|  +-------------------------------------------------------------------+   |
|                                                                          |
|  +-------------------------------------------------------------------+   |
|  | === (gris)                                                        |   |
|  | [E] ElevenLabs                                [Non configuree]    |   |
|  |     Aucune cle configuree                                         |   |
|  |                                                                   |   |
|  |     Ajoutez une cle pour activer ce fournisseur                   |   |
|  |                                                [Configurer]       |   |
|  +-------------------------------------------------------------------+   |
|                                                                          |
|  +-------------------------------------------------------------------+   |
|  | === (vert)                                                        |   |
|  | [L] Ollama (local)                            [Valide] (vert)     |   |
|  |     http://localhost:11434   [Env var]                            |   |
|  |                                                                   |   |
|  |     Derniere validation : il y a 30min                            |   |
|  |     Source : AI_ENGINE_OLLAMA_BASE_URL                            |   |
|  |                                                [Tester]           |   |
|  +-------------------------------------------------------------------+   |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 2.2 Formulaire d'ajout de cle (inline)

```
+--------------------------------------------------------------------------+
|  +-------------------------------------------------------------------+   |
|  | Ajouter une cle API                                               |   |
|  |                                                                   |   |
|  | FOURNISSEUR               CLE API                                 |   |
|  | [v ElevenLabs       ]     [****************************] [oeil]   |   |
|  |                                                                   |   |
|  | LABEL (OPTIONNEL)                                                 |   |
|  | [Compte production                                     ]          |   |
|  |                                                                   |   |
|  | [i] La cle sera testee avant sauvegarde.                          |   |
|  |     Chiffrement AES-256-GCM.                                      |   |
|  |                                                                   |   |
|  |                              [Annuler]  [Sauvegarder et tester]   |   |
|  +-------------------------------------------------------------------+   |
```

### 2.3 Formulaire d'edition (inline dans la carte)

```
+--------------------------------------------------------------------------+
|  +-------------------------------------------------------------------+   |
|  | === (vert)                                                        |   |
|  | [O] OpenAI                                    [Valide] (vert)     |   |
|  |     sk-proj-...AbCd          [Base de donnees]                    |   |
|  +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +   |
|  | Mettre a jour la cle API                                          |   |
|  |                                                                   |   |
|  | NOUVELLE CLE API                                                  |   |
|  | [****************************] [oeil]                             |   |
|  | Doit commencer par "sk-"                                          |   |
|  |                                                                   |   |
|  | LABEL (OPTIONNEL)                                                 |   |
|  | [Compte production                                     ]          |   |
|  |                                                                   |   |
|  |                              [Annuler]  [Sauvegarder et tester]   |   |
|  +-------------------------------------------------------------------+   |
```

### 2.4 Dialog de suppression

```
+----------------------------------------------+
|  Supprimer la cle API ?                      |
|                                              |
|  Vous allez supprimer la cle API pour        |
|  OpenAI stockee en base de donnees.          |
|                                              |
|  [i] La variable d'environnement             |
|  AI_ENGINE_OPENAI_API_KEY prendra            |
|  le relais si configuree.                    |
|                                              |
|         [Annuler]    [Supprimer] (rouge)      |
+----------------------------------------------+
```

### 2.5 Etat de test en cours

```
|  +-------------------------------------------------------------------+   |
|  | === (vert)                                                        |   |
|  | [O] OpenAI                              [Test en cours...] (spin) |   |
|  |     sk-proj-...AbCd          [Base de donnees]                    |   |
|  |                                                                   |   |
|  |     Verification de la connectivite...                            |   |
|  |     [=====>                                             ]         |   |
|  |                                                                   |   |
|  +-------------------------------------------------------------------+   |
```

### 2.6 Resultat de test - Succes

```
|  +-------------------------------------------------------------------+   |
|  |  [check vert] Cle valide - 12 modeles disponibles (245ms)         |   |
|  +-------------------------------------------------------------------+   |
```

### 2.7 Resultat de test - Echec

```
|  +-------------------------------------------------------------------+   |
|  |  [! rouge] Cle invalide : La cle API a ete revoquee ou est       |   |
|  |            expiree. Veuillez la remplacer.                        |   |
|  +-------------------------------------------------------------------+   |
```

### 2.8 Etat vide (aucune cle)

```
+--------------------------------------------------------------------------+
|                                                                          |
|                      +------------------+                                |
|                      |    [icone Key]   |                                |
|                      +------------------+                                |
|                                                                          |
|                   Aucune cle API configuree                              |
|                                                                          |
|        Ajoutez vos cles API pour activer les fournisseurs IA.            |
|        Les cles sont chiffrees et securisees (AES-256-GCM).              |
|                                                                          |
|                      [+ Ajouter une cle]                                 |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## 3. Palette de couleurs et tokens

### 3.1 Couleurs des statuts

| Statut | Couleur | Token CSS | Utilisation |
|--------|---------|-----------|-------------|
| Cle valide | Vert | `var(--cs-success)` | Barre de statut, badge, icone |
| Cle invalide | Rouge | `var(--cs-danger)` | Barre de statut, badge, icone |
| Non testee | Gris | `var(--cs-fg-muted)` | Barre de statut, badge |
| Non configuree | Gris clair | `var(--cs-border)` | Barre de statut, badge |
| Test en cours | Terracotta | `var(--cs-accent)` | Spinner, texte |

### 3.2 Couleurs des sources

| Source | Couleur badge | Token CSS |
|--------|--------------|-----------|
| Base de donnees | Terracotta | `var(--cs-accent)` |
| Variable d'env | Gris | `var(--cs-fg-muted)` |
| Non configuree | Jaune | `var(--cs-warning)` |

### 3.3 Typographie

| Element | Font | Taille | Poids |
|---------|------|--------|-------|
| Nom du fournisseur | `var(--cs-font-display)` | `var(--cs-text-base)` | 500 |
| Cle masquee | `var(--cs-font-mono)` | `var(--cs-text-sm)` | 500 |
| Labels de champs | `var(--cs-font-display)` | `var(--cs-text-xs)` | 600 |
| Messages d'info | `var(--cs-font-body)` | `var(--cs-text-xs)` | 400 |
| Dates | `var(--cs-font-body)` | `var(--cs-text-xs)` | 400 |

---

## 4. Etats interactifs

### 4.1 Carte de cle API

| Etat | Apparence |
|------|-----------|
| Par defaut | Fond `var(--cs-bg-elevated)`, bordure `var(--cs-border-hair)` |
| Hover | Ombre `var(--cs-shadow-md)` |
| Focus (clavier) | Outline `2px solid var(--cs-accent)` |
| Desactive (non configure) | Opacite 0.55 |

### 4.2 Bouton "Tester"

| Etat | Apparence |
|------|-----------|
| Par defaut | Ghost button, icone `RefreshCw` |
| Hover | Fond `var(--cs-bg-sunken)` |
| Loading | Icone `Loader2` en rotation, texte "Test en cours..." |
| Succes | Flash vert momentane (1.5s) |
| Echec | Flash rouge momentane (1.5s) |
| Desactive (non configure) | Opacite 0.4, cursor not-allowed |

### 4.3 Input de cle API

| Etat | Apparence |
|------|-----------|
| Vide | Placeholder gris "Entrer la cle API..." |
| Focus | Bordure `var(--cs-accent)`, glow subtil |
| Erreur | Bordure `var(--cs-danger)`, message d'erreur rouge sous le champ |
| Rempli (masque) | Texte type=password (points) |
| Rempli (visible) | Texte type=text (cle visible temporairement) |

### 4.4 Toggle de visibilite (bouton oeil)

| Etat | Icone | Comportement |
|------|-------|-------------|
| Masque | `EyeOff` | Cle affichee en points |
| Visible | `Eye` | Cle affichee en clair, auto-masquage apres 5s |

---

## 5. Animations et transitions

### 5.1 Ouverture du formulaire

- Slide-down avec `var(--cs-motion-base)` (200ms)
- Fade-in simultane
- Focus automatique sur le premier champ

### 5.2 Feedback de test

- Apparition du resultat avec slide-down + fade-in
- Badge de statut avec transition de couleur `var(--cs-motion-fast)` (150ms)

### 5.3 Suppression d'une carte

- Slide-up avec fade-out (200ms)
- Reflow de la grille avec animation

### 5.4 Spinner de test

- Utilisation de la classe `.cs-spin` existante (rotation 0.8s lineaire infinie)

---

## 6. Responsive

### 6.1 Desktop (>= 1024px)

- Grille de cartes : `repeat(auto-fill, minmax(320px, 1fr))`
- Formulaire : pleine largeur avec 2 colonnes pour les champs courts

### 6.2 Tablet (768px - 1023px)

- Grille de cartes : 1 colonne
- Formulaire : 1 colonne

### 6.3 Mobile (< 768px)

- Grille de cartes : 1 colonne
- Boutons d'action empiles verticalement
- Formulaire : 1 colonne, champs pleine largeur

---

## 7. Micro-interactions

### 7.1 Copie de la cle masquee

Pas de bouton de copie : les cles masquees ne sont pas copiables (securite).

### 7.2 Saisie de la cle

- Validation en temps reel du format (prefixe attendu par fournisseur)
- Message d'aide contextuel sous le champ :
  - OpenAI : "Doit commencer par sk-"
  - Anthropic : "Doit commencer par sk-ant-"
  - Google : "Doit commencer par AIza"
  - ElevenLabs : "Minimum 10 caracteres"
  - Ollama : "URL de base (ex: http://localhost:11434)"

### 7.3 Toast de confirmation

Les toasts utilisent la bibliotheque `sonner` (deja integree) :
- Succes : "Cle API pour {provider} configuree avec succes"
- Erreur : "Erreur : {message}"
- Suppression : "Cle API pour {provider} supprimee"

---

## 8. Contenu textuel (copy)

### 8.1 Labels de l'onglet

| Element | Texte FR |
|---------|----------|
| Titre de l'onglet | "Cles API" |
| Titre de la section | "Gestion des cles API" |
| Sous-titre | "Configurez les cles d'acces aux fournisseurs IA. Les cles sont chiffrees en AES-256-GCM." |
| Bouton ajouter | "Ajouter une cle" |
| Bouton tester | "Tester" |
| Bouton editer | "Editer" |
| Bouton supprimer | "Supprimer" |
| Bouton configurer | "Configurer" |
| Bouton sauvegarder | "Sauvegarder et tester" |
| Bouton annuler | "Annuler" |

### 8.2 Messages de statut

| Statut | Texte |
|--------|-------|
| Valide | "Valide" |
| Invalide | "Invalide" |
| Non testee | "Non testee" |
| Non configuree | "Non configuree" |
| Test en cours | "Test en cours..." |
| Source DB | "Base de donnees" |
| Source env | "Variable d'env" |

### 8.3 Messages d'erreur

| Contexte | Texte |
|----------|-------|
| Cle trop courte | "La cle semble trop courte" |
| Prefixe invalide OpenAI | "La cle OpenAI doit commencer par \"sk-\"" |
| Prefixe invalide Anthropic | "La cle Anthropic doit commencer par \"sk-ant-\"" |
| Prefixe invalide Google | "La cle Google AI doit commencer par \"AIza\"" |
| Test echoue - 401 | "Cle API invalide ou expiree" |
| Test echoue - 403 | "Cle API sans les permissions necessaires" |
| Test echoue - 429 | "Limite de taux atteinte, reessayez plus tard" |
| Test echoue - timeout | "Le fournisseur ne repond pas (timeout 10s)" |
| Test echoue - reseau | "Impossible de contacter le fournisseur" |
| Rate limit | "Trop de tests. Reessayez dans {n} secondes." |
| Erreur serveur | "Erreur serveur. Veuillez reessayer." |

### 8.4 Messages de confirmation

| Action | Titre | Corps |
|--------|-------|-------|
| Suppression | "Supprimer la cle API ?" | "Vous allez supprimer la cle API pour {provider} stockee en base de donnees." |
| Suppression (fallback dispo) | (meme) | + "La variable d'environnement {envVar} prendra le relais." |
| Suppression (pas de fallback) | (meme) | + "Aucune variable d'environnement n'est configuree. Le fournisseur sera desactive." |
