# Empty states — catalog

| État | Texte | Illustration | CTA |
|---|---|---|---|
| Aucun plan créé (page liste) | "Aucun plan de tracking encore créé." | Tableau vide stylisé | `+ Créer mon premier plan` |
| Aucun plan actif (home) | "Aucun plan n'est actif. Activez une version pour commencer le tracking." | Drapeau marocain en filigrane | `Voir les plans en brouillon` |
| Aucun event activé (step 3) | "Aucun événement activé. Activez-en au moins un pour configurer le tracking." | Liste vide | `Activer le preset standard` |
| Aucun provider activé (step 1) | "Sélectionnez au moins un outil à tracker." | Cases vides | (pas de CTA, blocking) |
| Aucun env profile (step 4) | (jamais — au moins production est requis) | — | — |
| Aucune erreur validation (step 5) | "Validation réussie. Aucun problème détecté." | Coche verte | `Activer maintenant` |
| Aucune version dans l'historique | "Vous êtes sur la première version de votre plan." | Timeline vide | (info only) |
| Aucun ping reçu (sync page) | "Aucun ping reçu du client web. Avez-vous bien importé le JSON dans GTM ?" | Téléphone barré | `Re-télécharger le JSON` |
| Drift OK | "Tout est synchronisé." | Coche stylisée | (info only) |
| Recherche sans résultat (matrice) | "Aucun événement trouvé pour « {query} »." | Loupe | `Effacer la recherche` |

## Règles d'écriture

- **Phrase courte**, formulation positive autant que possible.
- **Toujours proposer une action** (CTA) sauf cas info-only.
- **Pas de jargon** ("Aucun mapping configuré" → préférer "Aucun événement activé").
- **Pas de double négation** ("Aucun élément non-configuré n'est manquant" 😱).
