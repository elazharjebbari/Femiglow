# Wireframes — User-facing (chat visiteur)

> Wireframes basse fidélité ASCII pour valider la logique. Les maquettes haute fidélité vivent dans Figma (lien dans `00-vision/README.md`).

## Légende

```
[ Bouton ]      bouton actionnable
< Input >       champ texte
{ ... }         contenu dynamique
( ◯ )           radio / toggle
                ⤺ = scrollable
                ★ = élément critique conversion
```

## 1. Home — Chat fermé (Mobile 375×812)

```
┌──────────────────────────────────────┐
│           [≡]  FemiGlow      [🛒]    │ ← Navbar
├──────────────────────────────────────┤
│                                      │
│      ✨ La rituel féminin            │
│      qui change tout                 │
│                                      │
│      [ Découvrir le Pack → ]         │
│                                      │
│      [Image produit hero]            │
│                                      │
│                                      │
│      Témoignages                     │
│      ⤺ ⭐⭐⭐⭐⭐ Soukaina, Casa     │
│      ⤺ ⭐⭐⭐⭐⭐ Yasmine, Rabat    │
│                                      │
│                                      │
│                                      │
│                                ┌───┐ │
│                                │💬⁵│ │ ← Launcher
│                                └───┘ │ ★ pulse subtile
└──────────────────────────────────────┘
```

## 2. Chat ouvert — Greeting (Mobile)

```
┌──────────────────────────────────────┐
│  ████████ FemiGlow Assistant  [×]   │ ← Header gradient
│  ●  En ligne                         │ ← Status pill (success)
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Bonjour ! Je suis là pour    │   │ ← Greeting (canned)
│  │ vous accompagner dans votre  │   │
│  │ routine féminine. Comment    │   │
│  │ puis-je vous aider ?         │   │
│  └──────────────────────────────┘   │
│                                      │
│                                      │
│                                      │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ [💎 Voir le Pack] [📦 Livraison]    │ ← Pills ★
│ [💬 Témoignages] [🤔 Halal ?]        │
├──────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌──┐ │
│ │ Tapez votre message...     │ │📤│ │ ← Composer
│ └────────────────────────────┘ └──┘ │
│ Entrée: envoyer                      │
└──────────────────────────────────────┘
```

## 3. Conversation — User envoie + assistant streame (Mobile)

```
┌──────────────────────────────────────┐
│  ████████ FemiGlow Assistant  [×]   │
│  ●  En ligne                         │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Bonjour ! Comment puis-je... │   │
│  └──────────────────────────────┘   │
│                                      │
│            ┌──────────────────────┐ │
│            │ Le pack c'est combien│ │ ← User bubble (right)
│            └──────────────────────┘ │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Le Pack FemiGlow est à 199   │   │ ← Assistant LLM
│  │ dh au lieu de 390 dh. Il     │   │   stream en cours
│  │ contient 4 produits...▍      │   │ ★ caret blinking
│  └──────────────────────────────┘   │
│  🔧 Vérifications : prix, livraison │ ← Tool badge
│  📄 Sources (2)                      │
│                                      │
│  ⏳ ⏳ ⏳                              │ ← Plus de pills tant que streaming
├──────────────────────────────────────┤
│ ┌────────────────────────────┐ ┌──┐ │
│ │                            │ │📤│ │ Disabled (streaming)
│ └────────────────────────────┘ └──┘ │
└──────────────────────────────────────┘
```

## 4. Bulle canned avec CTA (Mobile)

```
┌──────────────────────────────────────┐
│            ┌──────────────────────┐ │
│            │ Combien coûte le pack│ │ ← User (via pill)
│            └──────────────────────┘ │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Le Pack FemiGlow est à       │   │ ← Canned bubble
│  │ 199 dh au lieu de 390 dh.    │   │   (background accent)
│  │ Livraison offerte dès 300dh. │   │
│  │                              │   │
│  │ [ Voir le Pack → ]           │   │ ← CTA inline ★
│  └──────────────────────────────┘   │
│                                      │
│  👍  👎                              │ ← Feedback (compact)
└──────────────────────────────────────┘
```

## 5. LeadForm offert mid-stream (purchase-intent) (Mobile)

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │ ... du coup je passe         │   │ ← Assistant LLM (done)
│  │ commande ?                   │   │
│  └──────────────────────────────┘   │
│                                      │
│  ╔══════════════════════════════╗   │
│  ║ 💌 Soyez rappelée            ║   │ ← LeadForm ★
│  ║                              ║   │
│  ║ Nom (optionnel)              ║   │
│  ║ < ________________________ > ║   │
│  ║                              ║   │
│  ║ Téléphone *                  ║   │
│  ║ < +212 6 __ __ __ __       > ║   │
│  ║                              ║   │
│  ║ Ville                        ║   │
│  ║ < ________________________ > ║   │
│  ║                              ║   │
│  ║ [   Être rappelée   ]        ║   │
│  ║                              ║   │
│  ║ En soumettant vous acceptez  ║   │
│  ║ notre politique de données.  ║   │
│  ╚══════════════════════════════╝   │
└──────────────────────────────────────┘
```

## 6. Service degraded (canned only) — Mobile

```
┌──────────────────────────────────────┐
│  ████████ FemiGlow Assistant  [×]   │
│  ●  Réponses pré-écrites              │ ← Status pill warning
├──────────────────────────────────────┤
│  ⚠ Notre assistant a une           │ ← Toast service level
│     difficulté technique.           │
│     Réponses préparées disponibles. │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Bonjour ! Pendant que notre  │   │ ← Canned message
│  │ assistant revient, voici les │   │
│  │ infos essentielles...        │   │
│  └──────────────────────────────┘   │
│                                      │
├──────────────────────────────────────┤
│ [💎 Pack 199dh] [📦 Livraison]      │ ← Pills uniquement
│ [💌 Être rappelée]                   │
├──────────────────────────────────────┤
│ Composer masqué ou simplifié         │ ← UX choice
└──────────────────────────────────────┘
```

## 7. Desktop — Chat ouvert (1280×800)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo]  FemiGlow         Boutique   Rituels   Avis   B2B          [🛒]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                              ┌────────────┐│
│                                                              │████████████││
│  [Contenu page : hero, produit, ...]                         │ FemiGlow ×││
│                                                              │ Assistant  ││
│                                                              │ ● En ligne ││
│                                                              ├────────────┤│
│                                                              │            ││
│                                                              │ Bonjour !  ││
│                                                              │ Comment... ││
│                                                              │            ││
│                                                              │            ││
│                                                              │            ││
│                                                              │            ││
│                                                              ├────────────┤│
│                                                              │ [Pack][Liv]││
│                                                              │ [💌 Conta] ││
│                                                              ├────────────┤│
│                                                              │ <Type..>📤││
│                                                              └────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Chat panel : `400×640`, `bottom-right` `24px`, `shadow.2xl`.

## 8. Mode RTL — Chat ouvert (Mobile, langue AR)

```
┌──────────────────────────────────────┐
│  [×]   FemiGlow Assistant ████████   │ ← Close à GAUCHE
│                          متصل  ●     │
├──────────────────────────────────────┤
│                                      │
│           ┌──────────────────────┐   │
│           │ مرحباً ! كيف يمكنني   │   │ ← Bulle à droite
│           │ مساعدتكم اليوم ؟     │   │
│           └──────────────────────┘   │
│                                      │
│  ┌──────────────────────┐            │
│  │ شحال تيكلف الباك ؟   │            │ ← User à gauche
│  └──────────────────────┘            │
│                                      │
├──────────────────────────────────────┤
│ [الباك 199 درهم 💎] [التوصيل 📦]    │ ← Pills RTL
├──────────────────────────────────────┤
│ ┌──┐ ┌────────────────────────────┐ │
│ │📤│ │ اكتبوا رسالتكم...           │ │ ← Send à GAUCHE
│ └──┘ └────────────────────────────┘ │ ← Texte RTL natif
└──────────────────────────────────────┘
```

## 9. Consent banner — Premier chargement (Mobile)

```
┌──────────────────────────────────────┐
│  ████████ FemiGlow Assistant  [×]   │
├──────────────────────────────────────┤
│                                      │
│  Nous utilisons votre conversation   │
│  pour vous répondre. Vos données     │
│  sont protégées (RGPD).              │
│                                      │
│  Voir notre politique               │
│                                      │
│  [   J'accepte   ]                   │
│                                      │
│  [ Discuter sans laisser de trace ]  │
│  (mode anonyme : pas de persist)     │
│                                      │
└──────────────────────────────────────┘
```

## 10. Erreur réseau (Mobile)

```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐   │
│  │ ⚠ Connexion interrompue.    │   │
│  │                              │   │
│  │ Vous pouvez réessayer        │   │
│  │ ou nous laisser vos          │   │
│  │ coordonnées pour vous        │   │
│  │ recontacter rapidement.      │   │
│  │                              │   │
│  │ [ Réessayer ]                │   │
│  │ [ Soyez rappelée → ]         │   │ ★
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

## Conventions à respecter (toutes maquettes)

- ★ = élément conversion-critical (test prioritaire en A/B).
- Tous les CTA inline ont contraste WCAG AA (testé).
- Touch target ≥ 44 px sur tous les boutons.
- Aucun lien externe sans `target="_blank"` + warning visuel.
- L'aire "safe-area-inset-bottom" iOS est respectée (composer ne passe pas sous home indicator).
