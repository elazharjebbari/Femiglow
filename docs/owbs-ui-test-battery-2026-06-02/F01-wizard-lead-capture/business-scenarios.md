# F01 — Scénarios métier réalistes

> Parcours complets « comme la vraie vie », à jouer en Playwright (build flag-ON).
> Chaque scénario combine plusieurs fonctionnalités et a un **oracle métier**.

## BM-F01-1 — Salma, iPhone 3G, saisit pendant que ça rame
**Contexte :** réseau lent (route `/api/checkout/lead` bridée 6 s).
**Parcours :** ouvre /kit → wizard → saisit prénom + tel + consent → « Continuer ».
**Attendu :** l'étape adresse s'affiche **tout de suite** ; aucune roue qui tourne
bloquante ; aucune erreur. (Oracle : `wizard-step-address` < 1,5 s ; pas d'alerte.)
**Bug recherché :** gel de 6 s (flag non propagé), ou message d'erreur prématuré.

## BM-F01-2 — Yassine double-tape « Continuer » (impatient)
**Contexte :** Android, wifi correct.
**Parcours :** remplit → tape 2× rapidement sur « Continuer ».
**Attendu :** **une** seule progression, **un** seul lead créé (idempotence).
**Bug recherché :** deux leads / deux transitions / état incohérent.

## BM-F01-3 — Bot remplit le honeypot
**Parcours :** un script remplit aussi `website`.
**Attendu :** succès silencieux côté UI, **aucun** lead envoyé.
**Bug recherché :** un lead spam créé.

## BM-F01-4 — Salma se trompe puis corrige
**Parcours :** saisit « S » (1 lettre) → bouton reste verrouillé → corrige en « Salma »
→ tel incomplet → complète → consent → « Continuer ».
**Attendu :** le bouton se (dé)verrouille en temps réel ; transition fluide.
**Bug recherché :** bouton jamais actif (validation onChange cassée).

## BM-F01-5 — Acheteuse arabophone (AR/RTL)
**Parcours :** `/ar/kit`, layout RTL, saisit le téléphone en chiffres latins.
**Attendu :** champ lisible, séquence latine préservée, soumission OK, étape suivante annoncée.
**Bug recherché :** téléphone inversé/illisible, focus perdu, libellés non traduits.
