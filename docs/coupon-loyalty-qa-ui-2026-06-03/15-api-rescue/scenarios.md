# Scénarios F15 — `POST /api/coupons/rescue`

## Scénario F15-S1 — Yasmine reçoit l'offre de sauvetage (happy treatment)
Contexte: Yasmine survole la sortie de page sans avoir converti ; une promo rescue est active à 0 % de holdout.
Étant donné un coupon `rescue` actif avec `holdoutPct = 0`
Et un cookie `fg_session_id=sess-1`
Quand le client envoie `POST /api/coupons/rescue` après le signal d'exit-intent
Alors la réponse est `200` avec `body.show === true`
Et un événement `exposed/treatment` est journalisé pour ce coupon.

## Scénario F15-S2 — Visiteur en groupe contrôle (edge holdout)
Contexte: la promo rescue tourne à 100 % de holdout (mesure pure).
Étant donné un coupon `rescue` actif avec `holdoutPct = 100`
Et un cookie `fg_session_id=sess-control`
Quand `POST /api/coupons/rescue` est appelé
Alors `body.show === false` (pas d'offre affichée)
Mais un événement `exposed/holdout` EST journalisé (le contrôle compte pour le dénominateur d'incrémentalité).

## Scénario F15-S3 — Aucune promo rescue active (edge vide)
Contexte: aucune campagne de sauvetage n'est en ligne.
Étant donné un `memoryStore` sans coupon rescue actif
Quand `POST /api/coupons/rescue` est appelé
Alors `body.show === false`
Et aucun événement n'est journalisé.

## Scénario F15-S4 — Panne de journalisation silencieuse (edge best-effort)
Contexte: la base d'events est momentanément indisponible.
Étant donné un coupon rescue actif `holdoutPct = 0`
Et `recordCouponEvent` qui lève une exception
Quand `POST /api/coupons/rescue` est appelé
Alors la réponse reste `200` avec `body.show === true` (le log raté ne bloque jamais l'offre).

## Scénario F15-S5 — Erreur interne invisible pour le visiteur (edge catch global)
Contexte: une exception survient dans la résolution du contexte/moteur.
Étant donné `resolveRescueCoupon` qui jette
Quand `POST /api/coupons/rescue` est appelé
Alors la réponse est `200` avec `body.show === false`
Et aucune erreur (4xx/5xx) n'est exposée au visiteur.
