# 07 — Plan d'action

État au 18/11/2026, 12:00 UTC.

| # | Étape | État | Détail |
|---|---|---|---|
| 1 | Audit du code et de l'écran | Fait | [01-audit.md](01-audit.md) |
| 2 | Pistes, maquettes, choix | Fait | [02-propositions.md](02-propositions.md), maquettes |
| 3 | Développement | Fait | Commit `a0751f5e` |
| 4 | Tests unitaires et de bout en bout | Fait | [06-tests.md](06-tests.md) |
| 5 | Script de mise en ligne | Fait | `bin/deployer-accuse.sh`, commit `ca14ea3b` |
| 6 | Compilation de production sur le Mac | Fait | `_gl4GNVax-rar7iu7pV2k` |
| 7 | Mise en ligne | Faite le 18/11/2026 à 11:50 UTC | Essai sur le port 8019 réussi, bascule, version précédente `f6jtv7ge9qw3xXa2lLxsF` gardée dans `.next-prev` |
| 8 | Contrôle du site réel | Fait | Accusé affiché sur /kit et /ar/kit, absent avec `?ack=off`, aucun envoi pendant le contrôle |
| 9 | Recette sur un vrai téléphone | **À faire** | [06-tests.md](06-tests.md) §5 |
| 10 | Vérifier le réglage « abandon étape 1 » | Fait | Actif en production, délai de 5 minutes (journal du service, 18/11). Reste à confirmer que l'équipe appelle bien ces fiches |
| 11 | Relecture de l'arabe | **À faire** | [05-textes.md](05-textes.md) |
| 12 | Synchroniser le registre des composants dans l'admin | **À faire** | Fait apparaître le champ « Part des visiteuses… ». Sans cela, 100 % par défaut |
| 13 | Point de départ chiffré | **À faire** | `bash bin/deployer-accuse.sh mesurer` (lecture de la base refusée à l'agent) |
| 14 | Bilan à 3 jours | 21/11/2026 | Seuil d'alerte : [03-proposition-retenue.md](03-proposition-retenue.md) §7 |
| 15 | Bilan à 7 jours et décision | 25/11/2026 | Garder, ajuster le texte ou couper |
| 16 | Prévenir l'équipe d'appel | **À faire** | Ouvrir par « vous avez laissé votre numéro sur FemiGlow » |

## Suites possibles, hors de ce lot

| Idée | Intérêt | Condition |
|---|---|---|
| Suivi en trois temps sur l'écran de remerciement | Dit la suite à celles qui terminent | Après le bilan |
| Message WhatsApp ou SMS « nous vous appelons depuis le … » | Montre le numéro qui appellera | Numéro d'appel stable |
| Version darija sur /ar/kit | Colle aux publicités | Relecture native |
| Bannière « Bon retour » qui apparaît pendant la première saisie de l'étape 1 | Défaut existant | À corriger à part |

## Retour arrière, du plus léger au plus lourd

| Moyen | Délai | Commande |
|---|---|---|
| Part à 0 dans l'admin | Immédiat après publication | Champ `step2AckSharePct` du composant `kit-checkout` |
| Coupe-circuit serveur | Un redémarrage | `CHECKOUT_STEP2_ACK=off` dans `apps/web/.env`, puis `systemctl restart femiglow` |
| Version précédente | Environ 20 secondes | `bash bin/deployer-accuse.sh annuler` |
