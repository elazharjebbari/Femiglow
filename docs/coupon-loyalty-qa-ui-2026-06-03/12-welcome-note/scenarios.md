# F12 — Scénarios (Gherkin FR)

Persona : **Yasmine** (visiteuse sur la landing `/kit`, bucket treatment). La note « geste d'accueil »
est présentationnelle : elle re-scénarise la remise en invitation de la maison, sans rouge ni urgence.

## Scénario F12-S1 — Yasmine découvre le geste d'accueil (happy)
Contexte: un coupon welcome_auto est actif, économie 90 MAD, prix final 199 MAD.
Étant donné que la note s'affiche
Quand Yasmine la lit
Alors le titre « Votre geste d'accueil est appliqué. » apparaît
Et « 90 MAD offerts » est visible
Et « Prix final aujourd'hui : 199 MAD » est affiché
Et la mention « Hors cumul. » est présente.

## Scénario F12-S2 — Mention de validité civile (edge / endsAt)
Contexte: la promo a une date de fin connue.
Étant donné endsAtLabel = « Valable jusqu'au 30 juin 2026 »
Quand la note s'affiche
Alors le texte « Valable jusqu'au 30 juin 2026 · Hors cumul. » est présent
Et aucun compte à rebours n'est affiché.

## Scénario F12-S3 — Charte respectée (edge / régression)
Contexte: la maison interdit le langage retail agressif.
Étant donné que la note est rendue
Quand on inspecte son contenu et son style
Alors aucun « % », « ! », emoji ou countdown n'est présent
Et le filet est sauge (pas de rouge retail).

## Scénario F12-S4 — Porte d'invitation repliée (edge / anti-friction)
Contexte: la note propose une porte « J'ai un code d'invitation ».
Étant donné que la note s'affiche au montage
Quand Yasmine ne l'a pas ouverte
Alors le champ de saisie reste replié (non mis en avant).

## Scénario F12-S5 — Affichage en arabe (edge / i18n RTL)
Contexte: Yasmine navigue en arabe.
Étant donné isArabic = true
Quand la note s'affiche
Alors elle est en dir="rtl"
Et le titre « لقد تم تطبيق هدية الترحيب الخاصة بك. » et la mention « غير قابل للجمع. » apparaissent.
