# 50.6 — Wireframe : footer & zones légales

## Footer principal (desktop)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│    FemiGlow                                                          │
│    Cosmétiques nourrissants pour la femme marocaine moderne.        │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Boutique           Nous suivre        Aide              Légal       │
│  ──────             ──────────         ────              ─────       │
│  Rituels            Instagram          Livraison         Mentions    │
│  Sérums             TikTok             Retours           CGV         │
│  Crèmes             Pinterest          FAQ               Conf.       │
│  Tous produits      Newsletter         Contact           Cookies     │
│                                                          Retours     │
│                                                          Sécurité    │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  © 2026 FemiGlow · RC 123456 · ICE 002000000123456                  │
│  Mentions légales · CGV · Confidentialité · Cookies                 │
│                                                                      │
│  Paiements sécurisés : 💳 Visa · Mastercard · CMI                   │
│  Livraison : 📦 DHL Maroc · Amana · CTM                              │
└──────────────────────────────────────────────────────────────────────┘
```

## Zones et placements

### Zone `footer-main` (colonne "Légal")

Liens listés verticalement, max 6 (sinon scroll trop long).

Liens par défaut :
1. Mentions légales
2. CGV
3. Politique de confidentialité
4. Politique de cookies
5. Politique de retours
6. Sécurité produits

### Zone `footer-bottom-bar` (ligne en bas)

Liens horizontaux, séparés par ·.
Max 5 liens (responsive).

Liens par défaut :
1. Mentions légales
2. CGV
3. Politique de confidentialité
4. Politique de cookies

### Zone `cookie-banner-links` (bannière cookies)

```
┌──────────────────────────────────────────────────────────┐
│ 🍪 Cookies                                                │
│                                                          │
│ FemiGlow utilise des cookies pour améliorer votre       │
│ navigation, mesurer l'audience, et personnaliser         │
│ l'expérience.                                            │
│                                                          │
│ Plus d'infos : Politique cookies · Confidentialité       │
│                                                          │
│ [Personnaliser]  [Tout refuser]   [Tout accepter ✓]     │
└──────────────────────────────────────────────────────────┘
```

Liens dans la bannière :
- Politique cookies
- Politique de confidentialité

### Zone `checkout-consent`

```
┌─────────────────────────────────────────────────────────┐
│ ☐ J'accepte les CGV et la Politique de confidentialité │
│   FemiGlow.                                             │
│                                                         │
│ ☐ Je souhaite recevoir la newsletter (facultatif)       │
└─────────────────────────────────────────────────────────┘
```

Liens inline dans le texte :
- CGV → `/legal/conditions-generales-de-vente`
- Politique de confidentialité → `/legal/politique-confidentialite`

### Zone `checkout-confirmation`

Texte de remerciement + liens utiles :

```
✓ Merci pour votre commande !

Vous pouvez consulter :
→ Politique de livraison (délais, suivi)
→ Politique de retours (rétractation)
→ FAQ service client
```

### Zone `mobile-menu`

Menu hamburger, section "Légal" à la fin :

```
☰ Menu

Rituels
Sérums
Crèmes
Promotions

—————

Mon compte
Mes commandes

—————

Aide & Contact
FAQ

—————

ℹ Légal
Mentions légales
CGV
Confidentialité
Cookies
Retours

—————

🇲🇦 ar | fr
```

### Zone `user-account-sidebar`

Sidebar dans `/account` :

```
👤 Maya

→ Mes commandes
→ Mes adresses
→ Mes préférences
→ Sécurité du compte

—————

Aide
→ FAQ
→ Contacter le support

Légal
→ Politique de confidentialité
→ Politique de cookies
→ Mes droits CNDP
```

### Zone `my-orders-help` (page Mes commandes)

Bloc d'aide en bas :

```
Besoin d'aide ?
→ Politique de retours
→ Politique de livraison
→ FAQ service client
→ Contactez-nous
```

## Responsive

### Footer principal mobile

```
┌──────────────────────┐
│ FemiGlow             │
│ Cosmétiques pour…    │
│                      │
│ ▸ Boutique           │
│ ▸ Nous suivre        │
│ ▸ Aide               │
│ ▼ Légal              │
│   Mentions légales   │
│   CGV                │
│   Confidentialité    │
│   Cookies            │
│   Retours            │
│   Sécurité           │
│                      │
│ © 2026 FemiGlow      │
│ Mentions · CGV · Cf. │
└──────────────────────┘
```

Sections accordion sur mobile.

## Style

```css
footer.legal-links a {
  color: theme(colors.stone.500);
  text-decoration: none;
  font-size: 14px;
  font-family: Inter;
  line-height: 1.5;
}
footer.legal-links a:hover {
  color: theme(colors.stone.700);
  text-decoration: underline;
}
footer.legal-links a:focus-visible {
  outline: 2px solid theme(colors.rose.500);
  outline-offset: 2px;
  border-radius: 2px;
}
```

## Health checks visuels

Si un lien est cassé (vérifié par cron `legal_link_health_snapshot`), l'admin voit :

```
┌──────────────────────────────────────────────────┐
│ ⚠ Liens cassés détectés (cron)                   │
│                                                  │
│ Footer principal :                               │
│   ✗ "Politique de cookies" → 404                │
│      Causé par : slug renommé sans redirect     │
│      [Corriger automatiquement] [Voir détail]   │
│                                                  │
│ Mobile menu :                                    │
│   ⚠ "FAQ" → page archivée                       │
│      [Re-publier la page] [Supprimer du menu]   │
└──────────────────────────────────────────────────┘
```

Côté public, **le lien cassé n'est PAS affiché** : la zone l'exclut automatiquement.
