# 50.6 — Ergonomie admin (Heuristiques Nielsen appliquées)

## H1 — Visibilité de l'état du système

| Écran | Application |
|---|---|
| GTM list | Badge "ACTIVE" visible sur la version active, derniers events affichés |
| Wizard creation | Stepper en haut : "Étape 3/8 · Production" |
| Categorization | Compteur "8 events · 1 override" en haut de page |
| Providers analytics | Refresh indicator "Actualisation dans 22s" |
| Edit version | Diff summary "2 modifications détectées" avant submit |

## H2 — Correspondance système ↔ monde réel

- Vocabulaire métier : "Pixel ID", "Conversion Action Label", "Customer ID"
  (pas de jargon dev type "UUID" sauf dans tooltips)
- Icônes intuitives : 💾 save, 🗑 delete, ✏ edit, 👁 view
- Labels en français pour les admins FR
- Devises : `MAD` (Dirham marocain) par défaut, pas €/USD

## H3 — Contrôle et liberté

- Bouton "Annuler" présent sur tous les écrans non-finals
- Wizards : back navigation toujours possible
- Édition d'une version = clone (l'originale est intacte) → aucune perte
- Toasts de succès avec "Annuler" 5s
- Confirmation requise pour DELETE (avec checkbox "Je comprends")

## H4 — Cohérence et standards

- Tous les boutons primaires en `bg-stone-900` (sauf destructive en rose)
- Forms : labels au-dessus des inputs (cohérent avec admin existant)
- Tables : colonnes triables avec ↑↓ (pattern uniforme)
- Pagination : 25 lignes par défaut (cohérent avec /admin/leads, /admin/orders)
- URLs : `/admin/tracking/<section>/<id>` (pattern REST)

## H5 — Prévention des erreurs

- **Validation côté client AVANT submit** :
  - Pixel ID Meta : regex `^[0-9]{15,16}$`
  - GA4 ID : regex `^G-[A-Z0-9]{8,12}$`
  - Google Ads Customer ID : regex `^[0-9]{10}$`
  - Conversion Action Label : regex `^[A-Za-z0-9_-]{8,40}$`
- **Confirm typed** sur destructive actions :
  ```
  Tape "SUPPRIMER" pour confirmer la suppression de v2 :
  [SUPPRIMER______________]
  ```
- **Diff visuel** avant sauvegarde → l'admin voit ce qui change
- **Anti double-submit** : bouton disabled pendant request

## H6 — Reconnaissance plutôt que rappel

- **Pré-remplissage** systématique :
  - Wizard create : valeurs Providers ou template
  - Wizard edit : valeurs originales de la version
- **Recently used** : si l'admin a créé v3 hier, suggérer "Reprendre v3" en tête de liste
- **Tooltips** sur chaque champ technique : "GA4 Measurement ID — Trouvable dans Admin > Property > Data Streams"
- **Autocomplete** sur les Conversion Action Labels (récupérés depuis Google Ads API)

## H7 — Flexibilité et efficience

### Pour novices
- Wizards step-by-step
- Validation inline
- Templates "Minimal", "GA-only" pour démarrer vite

### Pour experts
- Raccourcis clavier :
  - `n` : nouvelle version (sur la page list)
  - `e` : edit (sur une ligne sélectionnée)
  - `/` : focus search
  - `Esc` : fermer modal
- Bulk actions : sélection multiple sur la liste pour exporter plusieurs versions
- Mode JSON brut : `Ctrl+J` ouvre l'éditeur JSON direct (pour power users)

## H8 — Design esthétique et minimaliste

- Une seule action primaire par écran
- Pas de chrome inutile (pas de sidebar dans les wizards)
- Texte concis : "Sauvegarder" pas "Sauvegarder les modifications"
- Pas de couleurs criardes : palette stone-* + accents emerald/rose
- White space généreux (`p-5`, `space-y-6`)

## H9 — Reconnaissance et récupération des erreurs

| Erreur | UX |
|---|---|
| Validation field | Border rouge + message sous champ + icon ⚠ |
| Network error | Toast rouge "Connexion perdue" + bouton "Réessayer" |
| 404 version | Page error avec lien "Retour à la liste" |
| 401 expired | Auto-redirect login |
| Server 500 | Toast "Une erreur est survenue" + bouton "Recharger" + référence d'erreur (ID pour support) |

## H10 — Aide et documentation

- Tooltips contextuels (◯ icon à côté de chaque champ technique)
- Doc inline : "Comment trouver mon Customer ID ?" (lien vers guide externe)
- Empty states éducatifs :
  ```
  Aucune version GTM créée.
  Commence par [+ Nouvelle version] pour configurer tes pixels.
  Tu peux aussi importer depuis un compte Google Tag Manager existant.
  ```
- Status badges expliqués au hover

## Ergonomie clavier (chat aussi)

L'ergonomie du chat (composer + send) est traitée en `ergonomie-chat.md`.

## Audit Lighthouse cible

- Performance : ≥ 85
- Accessibility : ≥ 95
- Best Practices : ≥ 95
- SEO : N/A (admin, no-index)
