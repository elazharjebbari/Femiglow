# Personas

## Persona 1 — Amal, Marketing Manager (primaire)

| | |
|---|---|
| **Rôle** | Responsable acquisition FemiGlow Maroc |
| **Expérience tracking** | Comprend GA4 et Meta Pixel dans les grandes lignes. Sait lire un dashboard, configure des audiences. **Pas développeuse.** |
| **Outils familiers** | Google Analytics UI, Meta Ads Manager, Google Sheets, Notion |
| **Fréquence usage admin tracking** | 1–2 fois par mois en routine, +1 fois par campagne |
| **Objectifs principaux** | Mettre à jour Pixel ID, ajouter une nouvelle conversion, créer un plan staging pour tester un changement |
| **Frustrations actuelles** | "Je ne sais pas si j'ai fait toutes les étapes" / "Je télécharge 2 JSON et je ne comprends pas la différence" / "Le drift est rouge, je ne sais pas quoi faire" |
| **Citation** | "Je veux mettre un nouveau Pixel et que ça marche, pas comprendre la structure de GTM." |

### Besoins clés
- Pré-remplissage automatique des champs (elle a saisi le Pixel ID il y a 3 mois, elle ne se souvient plus).
- Confirmation visuelle "tout va bien" avant publish.
- Indicateur clair quand le tracking est désynchronisé.
- Possibilité de revenir en arrière sans tout casser.

### Anti-besoins
- Modales d'éducation longues à chaque action.
- Champs techniques (`exportFormatVersion`, `containerId` GTM).
- Vocabulaire produit ("event mapping versions", "drift hysteresis").

---

## Persona 2 — Younes, Dev Frontend (secondaire)

| | |
|---|---|
| **Rôle** | Dev fullstack FemiGlow, gère le code + les déploiements |
| **Expérience tracking** | Bonne. A déjà débugué un cas où Meta Pixel ne firait pas. Lit des JSON. Sait inspecter le dataLayer. |
| **Outils familiers** | Chrome DevTools, GTM Tag Assistant, GitHub, Slack |
| **Fréquence usage admin tracking** | Rare (1×/mois max). Plutôt en debug. |
| **Objectifs principaux** | Comprendre pourquoi un event ne part pas, ajouter un nouvel event dans le code + le tracker, valider qu'un changement ne casse rien |
| **Citation** | "J'ai besoin de voir le JSON exporté, le mapping résolu, et de tester un event sans publier." |

### Besoins clés
- Mode expert avec preview JSON live.
- Diff entre 2 versions de plan.
- Test runner d'événements (debug mode sans envoi réel).
- Logs accessibles.
- Schéma Zod accessible pour intégration code.

### Anti-besoins
- Wizard linéaire (trop lent pour son flow).
- Confirmations multiples ("êtes-vous vraiment sûr ?").
- Pré-remplissage forcé (il veut taper vite).

---

## Persona 3 — Aïcha, CMO / Direction (tertiaire)

| | |
|---|---|
| **Rôle** | Direction marketing, valide les changements stratégiques |
| **Expérience tracking** | Limitée. Comprend le retour ROI mais pas les détails techniques. |
| **Fréquence usage admin tracking** | Très rare. Consulte uniquement. |
| **Objectifs principaux** | Vérifier que le tracking est OK avant une campagne paid, comprendre un incident |
| **Citation** | "Je veux juste savoir : est-ce que les conversions Google Ads remontent bien ?" |

### Besoins clés
- Vue lecture-seule simple.
- Statut global "OK / À surveiller / Problème" sans détails techniques.
- Historique : qui a changé quoi quand.

### Anti-besoins
- Tout ce qui n'est pas binaire / résumé.

---

## Stratégie produit

| Persona | UI prioritaire | UX optimisée pour |
|---|---|---|
| Amal | Wizard (`?mode=wizard`) | Onboarding & maintenance routinière |
| Younes | Expert (`?mode=expert`) | Debug & changes fréquents |
| Aïcha | Dashboard home + sync page | Lecture / supervision |

**90% des sessions** sont attendues sur le wizard (Amal). Le mode expert est secondaire mais essentiel.
