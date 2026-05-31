# BS05 — Admin publie un nouveau canned pair

## Contexte
L'opératrice marketing crée une suggestion pill pour la nouvelle promo. Vérifier que :
publication immédiate, versioning correct, visible côté visiteur en <10s, audit trail OK.

## Persona admin
- **Yasmine**, marketing FemiGlow, rôle "admin"
- Veut ajouter une pill "Cadeau gratuit cette semaine"

## Scénario Gherkin

```gherkin
Fonctionnalité: BS05 — Publication canned pair par admin

  Scénario: Admin publie + visiteur voit en <10s
    Étant donné que je suis admin authentifiée
    Et que je suis sur "/admin/chat/suggestions"

    Quand je clique sur "Nouveau canned pair"
    Et je remplis :
      | key            | promo-gift-week                                  |
      | page_pattern   | /kit                                            |
      | label_fr       | Cadeau gratuit cette semaine                    |
      | label_ar       | هدية مجانية هذا الأسبوع                          |
      | label_ar_ma    | Cadeau gratuit had simana                       |
      | scripted_reply | Achetez maintenant et recevez le sticker offert |
      | cta_label      | Découvrir                                       |
      | cta_url        | /kit#offre                                      |
    Et je clique sur "Publier"
    Alors la canned pair est sauvegardée en DB
    Et une version immutable est créée (chat_canned_pair_version)
    Et l'audit log indique "actor=yasmine action=publish"
    Et la cache des canned est invalidée

    Quand un visiteur ouvre "/kit" 5 secondes plus tard
    Alors la pill "Cadeau gratuit cette semaine" apparaît dans les suggestions
    Et le tap sur la pill insère un message user
    Et la réponse scripted est servie sans appel LLM (event chat_canned_served)

    Quand je modifie le label pour "PROMO BLACK FRIDAY"
    Et je clique sur "Publier"
    Alors une nouvelle version est créée
    Et l'ancienne version reste consultable dans l'historique
```

## Critères de validation

- DB `chat_canned_pair` row inséré avec status='published'
- DB `chat_canned_pair_version` row de snapshot
- Audit log entry
- Cache invalidation : prochain `GET /api/chat/canned-pair?page=/kit` retourne la nouvelle
- Visiteur Playwright voit la pill dans <10s

## Risques couverts
- F48 (CRUD canned)
- I3 (FAQ threshold connexe — vérifier que canned n'est pas affecté)

## Durée : ~40 s
