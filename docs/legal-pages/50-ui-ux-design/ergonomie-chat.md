# 50.8 — Ergonomie chat : sujets légaux

## Contexte

L'assistant virtuel FemiGlow peut être sollicité sur des sujets légaux :
- "Comment je retourne un produit ?"
- "Mes données sont-elles protégées ?"
- "Quelles sont les CGV ?"
- "Vous livrez en France ?"

L'objectif : donner une **réponse utile** sans :
1. Donner un conseil juridique
2. Contredire les pages officielles
3. Sur-promettre / sous-promettre

## Principes

### 1. Citer plutôt que paraphraser

L'assistant ne re-rédige PAS les CGV. Il **cite** ou **renvoie**.

✅ « Selon notre politique de retours, vous avez 7 jours pour vous rétracter. Voir le détail ici : /legal/politique-retours »

❌ « En général vous pouvez retourner sous quelques jours. »

### 2. Toujours renvoyer la source

Chaque réponse à connotation légale **DOIT** se terminer par un lien vers la page concernée.

```
Pour le détail complet :
→ Politique de retours et remboursements (/legal/politique-retours)
```

### 3. Disclaimer sur sujets médicaux/juridiques

Si question médicale :
```
Je peux te recommander des produits adaptés à ton type de peau, mais
pour tout symptôme ou allergie, il est important de consulter un
dermatologue.
```

Si question juridique technique (cas complexe) :
```
Pour cette situation particulière, je te conseille de contacter notre
service client à hello@femiglow.ma. Une humaine pourra t'accompagner
avec précision.
```

### 4. Pas de promesse hors contexte

L'assistant **ne décide pas** de :
- Faire un geste commercial
- Confirmer un remboursement
- Annuler une commande
- Accepter un retour hors délai

Toutes ces actions = renvoi vers humain.

## Mapping intentions → réponses

| Intention | Réponse type | Sources liées |
|---|---|---|
| "Je veux retourner un produit" | Étapes + délai + procédure | /legal/politique-retours |
| "Combien de temps pour le remboursement ?" | "Sous 14 jours après réception du retour" | /legal/politique-retours |
| "Comment vous gérez mes données ?" | Résumé bref + lien | /legal/politique-confidentialite |
| "Vous vendez à mes données ?" | "Non, jamais" + lien | /legal/politique-confidentialite |
| "Mes cookies ?" | Réglage du consentement | /legal/politique-cookies + bouton "Paramètres cookies" |
| "Vos CGV ?" | Résumé + lien | /legal/conditions-generales-de-vente |
| "Vous livrez où ?" | Zone + délais | /legal/politique-livraison |
| "Allergique à X, je peux utiliser ?" | Vérifier INCI + conseil patch test + lien | /legal/securite-produits |
| "Produit non reçu" | Vérifier suivi + délais + escalade | Renvoi service client |

## Architecture technique

```typescript
// Au niveau du system prompt de l'assistant :
const LEGAL_INSTRUCTIONS = `
Tu réponds à des questions sur FemiGlow. Pour les sujets légaux :

1. CITE la politique concernée (texte court, max 1-2 phrases)
2. PROPOSE un lien vers la page complète
3. INVITE à contacter le support si le cas est complexe

Pour les sujets MÉDICAUX :
- Tu n'es PAS un professionnel de santé
- Renvoie systématiquement vers un médecin
- N'analyse pas de symptômes

Pour les sujets JURIDIQUES complexes :
- Tu n'es PAS juriste
- Renvoie vers hello@femiglow.ma

TOUS les liens dans tes réponses doivent être des slugs réels et
publiés. La liste actuelle :

- /legal/mentions-legales
- /legal/conditions-generales-de-vente
- /legal/conditions-generales-utilisation
- /legal/politique-confidentialite
- /legal/politique-cookies
- /legal/politique-retours
- /legal/politique-livraison
- /legal/securite-produits
- /legal/faq

Si tu mentionnes un autre slug, c'est probablement une hallucination.
Préfère ne rien linker que de linker faux.
`;
```

## Validation des réponses

L'API du chat valide automatiquement :
```typescript
function validateLegalLinks(response: string) {
  const links = extractMarkdownLinks(response);
  const legalLinks = links.filter(l => l.href.startsWith('/legal/'));
  for (const link of legalLinks) {
    const slug = link.href.replace('/legal/', '');
    if (!PUBLISHED_LEGAL_SLUGS.has(slug)) {
      // Strip the link, keep just the text
      response = response.replace(link.raw, link.text);
      logHallucination(slug, response);
    }
  }
  return response;
}
```

## Tonalité

- Tutoiement (charte FemiGlow chat)
- Chaleureux mais pro
- Pas de "🙏" excessif
- Émojis : 1 max par réponse, contextuel

Exemples :

✅ « Pour ton retour, tu as 7 jours à partir de la réception. Tu peux nous envoyer un email à hello@femiglow.ma avec ton numéro de commande, et on s'occupe du reste. Détails : /legal/politique-retours »

❌ « Bonjour ! 😊 Excellente question ! 🙏 Pour les retours, nous avons une politique très généreuse… »

## Cas d'escalade

Si l'utilisateur exprime :
- Frustration explicite ("c'est inadmissible", "scandaleux")
- Demande juridique précise ("je vais porter plainte")
- Problème santé ("j'ai une réaction allergique forte")
- Demande sortant du cadre cosmétique

→ Réponse automatique :

```
Je comprends ta préoccupation. Pour cette situation, le mieux est de
contacter directement notre équipe : hello@femiglow.ma ou
+212 6XX XX XX XX. Une personne va te répondre rapidement.

[Bouton : Envoyer un email]
```

## Logs et conformité

- Les messages chat sont conservés selon la politique de confidentialité
- Sur sujet légal : tag automatique dans les logs (`category: legal`)
- Revue trimestrielle des conversations "legal" pour ajustement du prompt

## Tests à mener

| Test | Méthode |
|---|---|
| Hallucinations de slugs | Battery de 50 prompts → 0 lien cassé |
| Disclaimer médical présent | Battery 20 prompts médicaux → 100% disclaimer |
| Latence ajout disclaimer | < 500ms ajouté au flow |
| Satisfaction utilisateur | Like/dislike post-message |
| Escalation correcte | Battery 10 prompts frustrés → 100% propose contact |
