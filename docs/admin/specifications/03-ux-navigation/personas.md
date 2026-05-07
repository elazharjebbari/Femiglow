# Personas

## P1 — La fondatrice (utilisatrice principale, unique)

| Trait | Valeur |
|---|---|
| Prénom (placeholder) | Aïcha |
| Rôle | Fondatrice & opératrice FemiGlow |
| Lieu | Casablanca |
| Outils habituels | MacBook Air, Safari, iPhone |
| Compétences techniques | bonnes (sait lire un email, utiliser Notion, comprendre un statut HTTP) |
| Aisance avec les chiffres | très bonne (a piloté un budget marque) |
| Disponibilité admin | matinée, ~30 min/jour |
| Objectifs |
| - Voir d'un coup d'œil les nouveaux leads ce matin | |
| - Qualifier rapidement les commandes en cours | |
| - Vérifier qu'aucun lead n'a "raté" sa transmission CRM | |
| - Annoter un lead pour mémoire (suivi commercial) | |
| Frustrations à éviter |
| - Re-saisir un mot de passe à chaque visite | |
| - Cliquer 5 fois pour qualifier un lead | |
| - Ne pas savoir si une livraison webhook a échoué | |
| - Outil qui "ressemble à du Material" et trahit la marque | |
| Citation type | "Je veux ouvrir l'onglet, voir les nouveaux leads, et passer à autre chose." |

## P2 — Développeur de maintenance (occasionnel)

| Trait | Valeur |
|---|---|
| Rôle | Développeur prestataire externe ou successeur |
| Fréquence d'usage | mensuelle (tests d'intégration, mise à jour endpoint) |
| Compétences techniques | élevées (lit le code source) |
| Objectifs |
| - Ajouter un endpoint de test pour valider une intégration | |
| - Désactiver temporairement un endpoint qui pose problème | |
| - Rejouer manuellement N livraisons après reprise du partenaire | |
| - Inspecter les logs Sentry corrélés à un lead | |
| Frustrations à éviter |
| - Devoir SSH vers un serveur pour faire un retry | |
| - URLs admin non-bookmarkables | |
| - Documentation technique inexistante | |

## P3 — Partenaire CRM (consommateur du webhook, indirect)

| Trait | Valeur |
|---|---|
| Rôle | Système tiers recevant les payloads |
| Interaction | aucune avec l'UI admin ; reçoit les POST signés |
| Attentes |
| - Payload conforme au format imposé | |
| - Header `X-FemiGlow-Signature` vérifiable | |
| - Header `Idempotency-Key` pour dédupliquer | |
| - Retries identifiables (même `Idempotency-Key`) | |
| - URL stable, pas de breaking changes | |

## P4 — DPO / Auditeur (consultatif)

| Trait | Valeur |
|---|---|
| Rôle | Audit conformité RGPD / CNDP |
| Fréquence | annuelle ou sur incident |
| Attentes |
| - Registre des traitements à jour | |
| - Possibilité d'extraire / supprimer les leads d'une personne | |
| - Audit trail des accès admin | |
| - Rétention paramétrable et documentée | |

---

## Implications design

- **Optimiser P1** : parcours admin → tâche réalisée < 90 secondes
  pour les actions courantes.
- **Servir P2** : URLs canoniques, codes HTTP propres, doc en repo,
  pas de magie.
- **Respecter P3** : contrats stables, signatures vérifiables, doc
  partenaire produit (`docs/partner/webhook-contract.md` futur).
- **Anticiper P4** : audit trail dès v1, documentation conformité
  prête (cf. [`../07-securite/rgpd-loi-09-08.md`](../07-securite/rgpd-loi-09-08.md)).
