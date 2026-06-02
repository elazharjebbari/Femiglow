# Glossaire — batterie de tests UI/opérateur OWBS

| Terme | Définition |
|---|---|
| **Opérateur** | Personne qui *gère* le système via l'admin (leads, supervision, flag). POV principal des modules F10–F14. |
| **Acheteuse** | Utilisatrice finale du parcours d'achat (wizard /kit + chat). POV des modules F01–F09. |
| **POV UI** | « Point of view UI » : on observe **uniquement** ce qui est perceptible/actionnable à l'écran (rôles ARIA, libellés, états visibles), jamais l'implémentation interne. |
| **RTL** | `@testing-library/react` — tests composant orientés DOM/accessibilité. |
| **MSW** | Mock Service Worker — interception réseau pour simuler latence/erreurs/désordre et observer la réaction UI. |
| **Playwright (PW)** | e2e navigateur réel sur build flag-ON (`:3100`). |
| **Scénario métier** | Parcours réaliste complet (ex. « acheteuse mobile 3G remplit, perd le réseau, ferme l'onglet, revient 1 h après »). |
| **Matrice de scénarios** | `scenarios.csv` par module : id, couche, given/when/then, priorité, risque, oracle. |
| **Oracle** | Le critère observable qui dit « réussi/échoué » (ex. « l'étape address est visible < 1,5 s »). |
| **Garde-fou (guard)** | Test qui empêche une régression précise de revenir (ex. honeypot rempli ⇒ submit bloqué). |
| **Flag** | `CHECKOUT_OPTIMISTIC_WIZARD_ENABLED` (serveur) + `NEXT_PUBLIC_…` (client). ON=optimiste, OFF=legacy. |
| **Parité legacy** | Garantie : flag OFF ⇒ comportement **identique** à l'existant (anti-régression). |
| **Zéro-perte** | Tout lead validé est persisté, même fermeture d'onglet (beacon → `/sync`). |
| **Dégradé (FR-11)** | État où la sync de fond échoue durablement ; l'UI le signale **discrètement** sans bloquer (`wizard-store.syncDegraded`). |
| **Reprise** | Ré-hydratation des envelopes non confirmées après reload (`hydrateFromMirror`). |
| **Wave (vague)** | Lot d'exécution de la batterie (cf. plan d'action global) : un sous-ensemble cohérent de modules. |
| **Boucle de correction** | Cycle bug→reproduction→fix→re-vérif→non-régression, piloté par le runbook. |
| **Gap** | Manque identifié (ex. **pas d'UI admin pour l'outbox**) → spécifié + testé (ou tracé comme dette). |
| **Testid** | `data-testid` stable utilisé comme ancre de sélection e2e/RTL (ex. `wizard-step-lead`, `chat-lead-submit`). |

### Ancres testid OWBS (référentiel)
`wizard-shell`, `wizard-step-cart`, `wizard-step-lead`, `wizard-lead-submit`,
`wizard-step-address`, `wizard-address-submit`, `wizard-address-error`,
`wizard-step-thankyou`, `wizard-resume-banner`, `wizard-resume-dismiss`,
`chat-lead-form`, `chat-lead-submit`, `chat-lead-offer`, `chat-lead-cta`.
