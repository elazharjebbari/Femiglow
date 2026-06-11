# BS03 — Conversion darija : Salam → commande

## Contexte
La capacité du chat à converser **en darija** est critique pour le marché MA. BS03 valide
le parcours complet en darija, du premier message en darija jusqu'à la capture lead.

## Persona
- **Souad**, 26 ans, Tanger
- Parle darija au quotidien, comprend FR mais préfère répondre en darija
- Mobile

## Scénario Gherkin

```gherkin
Fonctionnalité: BS03 — Conversion en darija

  Scénario: Visiteuse darija reçoit réponse darija et lead
    Étant donné locale par défaut "fr-MA" (système ne sait pas encore)
    Quand j'ouvre le widget
    Et je tape "Salam labas khoya, bshhal had le kit ?"
    Alors le détecteur de langue identifie "ar-MA" via heuristique darija
    Et la session.language est mise à jour à "ar-MA"
    Et la réponse arrive en darija (mots clés: wakha, daba, kit, drhem)
    Et le panel direction change à "rtl"

    Quand je tape "Bzaf ghali, kayn promo ?"
    Alors je reçois une réponse darija qui mentionne le prix promo

    Quand je tape "Khouya brit nshri"
    Alors un lead-form-offer apparaît avec copy en darija
    Et le placeholder firstName est "smitek" (au lieu de "Prénom")
    Et le bouton submit dit "Aji"

    Quand je remplis "Souad" + "0612345678"
    Alors le lead est créé avec language="ar-MA"
```

## Critères de validation

- `detectLanguage("Salam labas khoya...") === 'ar-MA'`
- `session.language` updated `ar-MA` après 1er message
- Panel `dir="rtl"`, `lang="ar-MA"`
- Réponse contient ≥3 mots darija (depuis liste keywords)
- LeadFormBubble copy en darija
- DB `chat_lead.language === 'ar-MA'`

## Risques couverts
- F53 (multilingue cohérence)
- F03 (language detect heuristique darija)

## Variantes
- Visiteur qui démarre en arabe classique → reste en `ar` (pas darija)
- Visiteur qui mix darija + français → respect choix darija

## Durée : ~25 s
