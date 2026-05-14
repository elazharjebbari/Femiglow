# 09 — Ergonomie

L'utilisateur a explicitement demandé une **ergonomie maximale du chat et du gestionnaire admin**. Cette section couvre les deux surfaces :

1. **Admin manager** (le module tracking en lui-même) — wizard, expert, home, sync, history.
2. **Chat ergonomics** — l'admin tracking n'est pas séparé du chat support de FemiGlow ; les liens entre les deux sont documentés ici (notifications drift dans chat admin, raccourcis vers le tracking depuis chat, etc.).

## Fichiers

| Fichier | Sujet |
|---|---|
| [admin-manager.md](admin-manager.md) | Layout, navigation, modes, persistance d'état, raccourcis |
| [chat-ergonomics.md](chat-ergonomics.md) | Intégration tracking ↔ chat support, notifications inline |
| [accessibility.md](accessibility.md) | WCAG, ARIA, navigation clavier, screen readers |
| [keyboard-shortcuts.csv](keyboard-shortcuts.csv) | Liste exhaustive des raccourcis |

## Principes ergonomiques

### 1. Le **bon défaut** plutôt que la **bonne option**

À chaque champ, Amal trouve une valeur sensée par défaut. Elle n'a qu'à **valider** ou **corriger**, jamais à **inventer**.

Exemples :
- Pixel ID → auto-rempli depuis le dernier plan actif.
- Provider → tous ceux du plan précédent sont cochés.
- Events → preset standard FemiGlow (15 events) pré-chargé pour un nouveau plan.

### 2. La **friction proportionnelle au risque**

| Action | Friction |
|---|---|
| Modifier un champ optionnel | 0 (instant) |
| Sauver en brouillon | 0 (auto + visible) |
| Désactiver un event | 1 clic |
| Désactiver un provider | 1 clic + warning si events dépendants |
| Activer un plan | 2 clics (CTA + confirmation modal) |
| Archiver un plan | 3 clics (CTA + modal + saisie du nom) |

### 3. La **récupération** plutôt que la **prévention** invasive

- Pas de "Êtes-vous sûr ?" à chaque action.
- Pas de blocage si le champ a une valeur "louche" — warning visible, mais on laisse Amal continuer.
- Undo facile : revert sur champ modifié (1 clic), historique des versions (rollback en 2 clics).

### 4. **Sympathie + clarté**

Le ton FemiGlow reste chaleureux même dans l'admin :
- "Tout est bon ! ✓" plutôt que "Validation 0 errors".
- "Aucun problème détecté." plutôt que "Status: PASS".
- "Drift détecté il y a 2 minutes — pas de panique, voici quoi faire." plutôt que "ERR-3045 BUNDLE_HASH_MISMATCH".

### 5. **Cohérence inter-modules**

Les patterns (`StatusCard`, badges, toasts) sont **identiques** entre :
- Module tracking
- Module chat support (déjà existant)
- Module legal (existant)
- Modules futurs

Ce qui réduit la charge cognitive de basculement.

### 6. **Performance perçue**

| Action | Cible perçue |
|---|---|
| Click "Continuer" wizard | < 100ms (optimistic) |
| Saisie d'un champ | < 16ms (60fps) |
| Validation server | < 500ms p95 |
| Export JSON | < 200ms p95 |
| Activation plan | < 2s p95 |

Loading state visible dès 200ms (sinon flash gênant). Skeleton si > 500ms.
