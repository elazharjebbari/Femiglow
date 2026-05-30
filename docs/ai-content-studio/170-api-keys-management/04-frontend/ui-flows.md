# Flux UI - Gestion des Cles API

> Module : 170 - API Keys Management
> Date : 2026-05-25

---

## 1. Flux 1 : Ajouter une cle API

### 1.1 Pre-conditions
- L'administrateur est connecte (session iron-session valide)
- L'onglet "Cles API" est selectionne
- La liste des cles est chargee
- Au moins un fournisseur n'a pas de cle en base de donnees

### 1.2 Etapes

| Etape | Action utilisateur | Reaction UI | Etat |
|-------|-------------------|-------------|------|
| 1 | Clique "Ajouter une cle" | Formulaire slide-down au-dessus de la grille | `showApiKeyForm=true, mode='create'` |
| 2 | Selectionne le fournisseur dans le dropdown | Placeholder de la cle et hint changent | `selectedProvider='openai'` |
| 3 | Colle ou saisit la cle API | Validation en temps reel du format (prefixe) | `apiKey='sk-proj-...'` |
| 4 | (Optionnel) Saisit un label | Champ texte simple | `label='Production'` |
| 5 | (Si Ollama) Saisit l'URL de base | Champ texte avec validation URL | `baseUrl='http://...'` |
| 6 | Clique "Sauvegarder et tester" | Bouton passe en loading. Barre de progression | `saving=true` |
| 7a | (Succes) Reponse 200 | Toast vert "Cle configuree avec succes". Formulaire ferme. Grille rechargee. | `showApiKeyForm=false` |
| 7b | (Echec validation) Reponse 422 | Toast rouge "Cle invalide : ...". Formulaire reste ouvert. | `saving=false` |
| 7c | (Echec serveur) Reponse 500 | Toast rouge "Erreur serveur". Formulaire reste ouvert. | `saving=false` |

### 1.3 Post-conditions
- La cle est chiffree et stockee en base
- La carte du fournisseur passe de "Non configuree" a "Valide" (si test OK) ou "Non testee" (si skipValidation)
- L'audit log contient une entree `api_key.created`
- Le cache de resolution des cles est invalide pour ce fournisseur

---

## 2. Flux 2 : Editer une cle API existante

### 2.1 Pre-conditions
- Le fournisseur a une cle en base de donnees (`source === 'database'`)

### 2.2 Etapes

| Etape | Action utilisateur | Reaction UI | Etat |
|-------|-------------------|-------------|------|
| 1 | Clique "Editer" sur la carte | Formulaire s'affiche. Provider pre-selectionne et desactive. | `showApiKeyForm=true, mode='edit'` |
| 2 | Saisit la **nouvelle** cle API | L'ancienne cle n'est pas affichee. Placeholder "Entrer la nouvelle cle..." | `apiKey='sk-proj-new...'` |
| 3 | (Optionnel) Modifie le label | Pre-rempli avec le label existant | `label='Nouveau label'` |
| 4 | Clique "Sauvegarder et tester" | Bouton loading | `saving=true` |
| 5a | (Succes) | Toast vert. Formulaire ferme. Ancienne cle desactivee, nouvelle active. | `showApiKeyForm=false` |
| 5b | (Echec) | Toast rouge. Ancienne cle reste active. | `saving=false` |

### 2.3 Post-conditions
- L'ancienne cle est marquee `is_active = false` en base
- La nouvelle cle est inseree avec `is_active = true`
- L'audit log contient une entree `api_key.updated` (avec les deux maskedKeys)
- Le cache est invalide

---

## 3. Flux 3 : Supprimer une cle API

### 3.1 Pre-conditions
- Le fournisseur a une cle en base de donnees (`source === 'database'`)

### 3.2 Etapes

| Etape | Action utilisateur | Reaction UI | Etat |
|-------|-------------------|-------------|------|
| 1 | Clique "Supprimer" sur la carte | Dialog de confirmation | - |
| 2a | Confirme ("Supprimer") | Loading sur le bouton. Requete DELETE. | `deletingApiKeyId=id` |
| 2b | Annule ("Annuler") | Dialog ferme. Aucune action. | - |
| 3a | (Succes, fallback dispo) | Toast "Cle supprimee. Variable d'env {name} active." | `deletingApiKeyId=null` |
| 3b | (Succes, pas de fallback) | Toast "Cle supprimee. Fournisseur desactive." | `deletingApiKeyId=null` |
| 3c | (Echec) | Toast rouge d'erreur | `deletingApiKeyId=null` |

### 3.3 Post-conditions
- La cle est supprimee de la base
- La carte passe a `source: 'env'` (si fallback) ou `source: 'none'`
- L'audit log contient une entree `api_key.deleted`
- Le cache est invalide

---

## 4. Flux 4 : Tester une cle API

### 4.1 Pre-conditions
- Le fournisseur a une cle configuree (`source !== 'none'`)

### 4.2 Etapes

| Etape | Action utilisateur | Reaction UI | Etat |
|-------|-------------------|-------------|------|
| 1 | Clique "Tester" sur la carte | Bouton passe en spin. Badge "Test en cours..." | `testingApiKeyProvider=type` |
| 2 | (Attente ~0.2-10s) | Spinner continue. Progress bar optionnelle. | - |
| 3a | (Succes) | Badge passe a "Valide" (vert). Info "12 modeles, 245ms". | `testingApiKeyProvider=null` |
| 3b | (Echec - cle invalide) | Badge passe a "Invalide" (rouge). Message d'erreur. | `testingApiKeyProvider=null` |
| 3c | (Echec - timeout) | Badge "Invalide". Message "Le fournisseur ne repond pas". | `testingApiKeyProvider=null` |
| 3d | (Echec - rate limit) | Toast "Trop de tests. Reessayez dans 1 min." | `testingApiKeyProvider=null` |

### 4.3 Post-conditions
- Le `lastTestedAt` et `lastTestResult` sont mis a jour en base (si cle DB)
- L'audit log contient une entree `api_key.tested`
- La carte affiche le nouveau statut et la date du test

---

## 5. Flux 5 : Voir le statut des cles

### 5.1 Pre-conditions
- L'administrateur est connecte

### 5.2 Etapes

| Etape | Action utilisateur | Reaction UI |
|-------|-------------------|-------------|
| 1 | Clique sur l'onglet "Cles API" | Squelettes de chargement (5 cartes) |
| 2 | (Attente ~100-200ms) | Grille de 5 cartes s'affiche |
| 3 | Lecture des cartes | Chaque carte affiche : nom, cle masquee, source, statut, dates |

### 5.3 Informations affichees par carte

| Information | Format | Exemple |
|-------------|--------|---------|
| Nom du fournisseur | Texte gras | "OpenAI" |
| Label | Texte sous le nom | "Compte production" |
| Cle masquee | Font mono, fond gris | `sk-proj-...AbCd` |
| Source | Badge colore | "Base de donnees" ou "Env var" |
| Statut du test | Badge + icone | "Valide" (vert) |
| Derniere validation | Texte gris | "Teste il y a 2h" |
| Date de configuration | Texte gris | "Configure il y a 5j" |
| Nom env var (si source=env) | Texte mono | "AI_ENGINE_OPENAI_API_KEY" |

---

## 6. Flux 6 : Toggle de visibilite dans le formulaire

### 6.1 Etapes

| Etape | Action | Reaction |
|-------|--------|----------|
| 1 | Clique sur l'icone oeil | Input passe de `type=password` a `type=text` |
| 2 | La cle est visible | Timer de 5 secondes demarre |
| 3a | (Apres 5s) | Input repasse automatiquement a `type=password` |
| 3b | (Clic sur l'icone avant 5s) | Masquage immediat, timer annule |

---

## 7. Flux 7 : Navigation clavier

### 7.1 Depuis l'onglet

| Touche | Contexte | Action |
|--------|----------|--------|
| Tab | Barre d'onglets | Navigue entre les onglets |
| Enter | Onglet "Cles API" selectionne | Active l'onglet |
| Tab | Dans l'onglet | Navigue entre les cartes et boutons |
| Enter | Bouton "Ajouter" | Ouvre le formulaire |
| Enter | Bouton "Tester" | Lance le test |
| Enter | Bouton "Editer" | Ouvre le formulaire d'edition |
| Escape | Formulaire ouvert | Ferme le formulaire |
| Enter | Bouton "Sauvegarder" | Soumet le formulaire |

---

## 8. Gestion des etats transitoires

### 8.1 Squelette de chargement

Pendant le chargement des cles, 5 cartes squelettes sont affichees :

```typescript
if (loadingKeys) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
    }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
          minHeight: 180,
          animation: 'cs-shimmer 1.5s infinite',
          backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          backgroundSize: '200% 100%',
        }} />
      ))}
    </div>
  );
}
```

### 8.2 Etat vide

Si aucun fournisseur n'est configure (tous les 5 en `source: 'none'`) :

```typescript
const allUnconfigured = apiKeys.every(k => k.source === 'none');

if (allUnconfigured) {
  return (
    <EmptyState
      icon={<Key size={24} />}
      title="Aucune cle API configuree"
      description="Ajoutez vos cles API pour activer les fournisseurs IA. Les cles sont chiffrees et securisees (AES-256-GCM)."
      cta={
        <Button variant="primary" size="md" leftIcon={<Plus size={14} />} onClick={() => { setShowApiKeyForm(true); setApiKeyFormMode('create'); }}>
          Ajouter une cle
        </Button>
      }
    />
  );
}
```

### 8.3 Transition entre etats

Toutes les transitions visuelles (changement de statut, ouverture de formulaire, apparition de toast) utilisent la duree `var(--cs-motion-base)` (200ms) avec la fonction de timing `var(--cs-easing)` pour la coherence avec le reste de l'interface.
