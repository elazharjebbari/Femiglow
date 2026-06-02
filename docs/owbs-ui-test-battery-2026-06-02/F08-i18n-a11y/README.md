# F08 — i18n (FR/AR/EN), RTL & accessibilité du parcours optimiste

**Surface :** `WizardShell` + steps + `LeadFormBubble`. **Public :** acheteuse
(dont arabophone + lecteurs d'écran). **Pourquoi critique :** le comportement
optimiste change le **timing** des annonces (l'étape change sans réseau) → risque
a11y (changement non annoncé) et i18n (libellés/RTL).

## 1. Fonctionnement optimal
- Tous les textes du parcours sont traduits FR/AR/EN ; le layout AR est **RTL**.
- Le **téléphone** reste une séquence **latine** lisible même en AR/RTL.
- Au changement d'étape (optimiste), un **lecteur d'écran** est informé (région `aria-live`/focus déplacé) — l'étape `address` est **annoncée**.
- `axe` ne remonte **0 violation** sur chaque étape, FR comme AR.

## 2. Points à vérifier (tous angles)
### i18n
- `/fr/kit`, `/ar/kit`, `/en/kit` : libellés du wizard + chat traduits ; messages d'erreur traduits.
- Aucune clé de traduction brute affichée.
### RTL
- `dir="rtl"` sur le conteneur AR ; alignement champs/boutons cohérent ; champ téléphone non inversé.
### a11y
- Rôles/labels sur tous les champs ; `aria-invalid` + message lié sur erreur.
- **Annonce du changement d'étape** (transition optimiste) — `aria-live` ou focus sur le titre de l'étape.
- Navigation clavier complète (Tab order logique, submit atteignable).
- Contraste suffisant (design tokens).

## 3. Oracle principal
> Sur `/ar/kit`, le parcours optimiste se fait en RTL avec libellés AR, le téléphone
> reste latin lisible, et `axe` = 0 violation sur lead/address ; le changement
> d'étape est perceptible au lecteur d'écran.

## 4. Plans : [`scenarios.csv`](scenarios.csv) · [`test-plan.md`](test-plan.md)
