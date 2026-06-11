# F03 — Scénarios (Gherkin FR)

Persona : **Karim**, opérateur qui veut savoir si une promo apporte vraiment des ventes incrémentales.

## Scénario F03-S1 — Karim consulte l'uplift d'une promo qui marche (happy)
Contexte: le coupon cpn_1 a un upliftAbsolute de 0.05 et un groupe de contrôle (noControl=false).
Étant donné que Karim voit la ligne du coupon avec un bouton « Stats »
Quand il clique sur « Stats »
Alors un GET /api/admin/coupons/cpn_1/stats est émis
Et un libellé apparaît affichant « uplift: 5.0 pts »
Et ce libellé ne contient ni symbole pourcent ni point d'exclamation.

## Scénario F03-S2 — Pas de groupe de contrôle (edge noControl)
Contexte: le coupon a été lancé sans holdout, upliftAbsolute est null et noControl=true.
Étant donné que Karim clique sur « Stats »
Quand la réponse arrive
Alors le libellé affiche « uplift: — (pas de contrôle) »
Et Karim comprend que l'incrémentalité n'est pas mesurable.

## Scénario F03-S3 — Stats indisponibles côté serveur (edge échec silencieux)
Contexte: la route stats renvoie 500.
Étant donné que Karim clique sur « Stats »
Quand la réponse est en erreur
Alors aucun libellé d'uplift n'apparaît sur la ligne
Et aucune alerte n'est affichée (le chargement des stats est silencieux en cas d'échec).

## Scénario F03-S4 — Promo qui a dégradé la conversion (edge uplift négatif)
Contexte: upliftAbsolute = -0.02.
Étant donné que Karim clique sur « Stats »
Alors le libellé affiche « uplift: -2.0 pts »
Et le signe négatif l'alerte que la promo a sous-performé le contrôle.
