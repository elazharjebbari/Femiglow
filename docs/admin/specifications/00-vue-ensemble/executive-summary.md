# Executive summary

> **Pour qui ?** Sponsor, fondateur, DPO, partenaires techniques externes.
> Lecture : 5 minutes.

---

## 1. Objet

Doter FemiGlow d'une interface privée `/admin` permettant à la fondatrice
de :

1. Se **connecter** de manière sécurisée et souveraine.
2. **Consulter, qualifier et opérer** les leads issus du site
   (commandes en cours, demandes contact, intérêts B2B, abonnements
   newsletter).
3. **Transmettre automatiquement** chaque lead vers un serveur partenaire
   (CRM/ERP), avec retry, signature cryptographique et journalisation.

## 2. Architecture en une page

| Couche | Choix |
|---|---|
| Authentification | `iron-session` + Argon2id, admin unique en variables d'environnement |
| Persistance | Postgres managé **Neon** région `eu-central-1` + ORM Drizzle |
| Rendu admin | Next.js Server Components, route group `(admin)`, layout sobre |
| API admin | Route handlers `/api/admin/*` protégés par middleware |
| Webhook | Queue persistée en DB + Vercel Cron `* * * * *` + retry exponentiel 36 h |
| Sécurité | HMAC-SHA256, headers stricts, CSP, rate limit, audit trail |
| Observabilité | Sentry + logs structurés (`pino`), table `lead_events` |
| Tests | Lint, Vitest, **MSW** (mock HTTP), Playwright, jest-axe |

## 3. Périmètre v1

| Inclus | Exclus (v2+) |
|---|---|
| 1 administrateur unique | Multi-utilisateur, rôles |
| 4 sources de leads (contact, checkout, newsletter, B2B) | Import CSV externe |
| Stockage Postgres + audit trail | Data warehouse / BI |
| Webhook sortant signé HMAC | Webhooks entrants |
| Replay manuel d'une livraison | Replay batch automatique |
| Export CSV des leads | Export PDF, fiches imprimables |
| Compteurs simples (24 h, 30 j) | Funnels, attribution multi-touch |
| Email transactionnel | hors v1 (Resend déjà câblé en env mais non utilisé) |

## 4. Indicateurs de succès

| Critère | Cible v1 |
|---|---|
| Latence checkout publique | inchangée (p95 < 800 ms) |
| Taux de livraison webhook | ≥ 99,5 % sur 30 j |
| Couverture test (lignes) | ≥ 85 % sur `lib/auth`, `lib/webhooks`, `lib/db` |
| Score Lighthouse admin | Performance ≥ 90, Accessibilité ≥ 95 |
| Temps onboarding développeur | < 1 jour |
| Aucun lead perdu | 0 incident de perte sur 90 j |

## 5. Coûts et délais

| Poste | Estimation |
|---|---|
| Délai d'implémentation (1 dev senior) | 4 à 5 semaines |
| Vercel Pro | 240 $/an |
| Neon (Launch) | 0 à 228 $/an |
| Services externes additionnels | 0 € (aucun) |
| **TCO 12 mois** | **240 à 470 $** |

## 6. Risques majeurs

| Risque | Sévérité | Mitigation |
|---|---|---|
| Perte de credentials admin | élevée | rotation possible, procédure documentée |
| Indisponibilité partenaire | moyenne | retry 36 h, dashboard d'alertes |
| Incident sécurité (XSS, fuite session) | élevée | CSP stricte, cookies `httpOnly`+`sameSite=strict` |
| Bug sur INSERT lead | élevée | retry inline 3×, monitoring Sentry |
| Vercel Cron en panne | faible | fallback CLI manuel `pnpm webhook:tick` |

## 7. Conformité

- **RGPD** : base légale exécution du contrat (commande), intérêt
  légitime (contact), consentement explicite (newsletter).
- **Loi 09-08 marocaine** : déclaration simplifiée CNDP avant mise en
  prod.
- **Localisation** : 100 % UE (Vercel + Neon Frankfurt).
- **Aucun sous-traitant additionnel** introduit.

## 8. Décision attendue

Lancement de la phase d'**implémentation** sur la base de la
[`recommandation-finale.md`](../../recommandation-finale.md) et du présent
dossier de spécifications.

Le détail opérationnel (séquencement, tâches atomiques, critères
d'acceptation, MSW scenarios) est consolidé dans
[`../10-plan-action/`](../10-plan-action/).
