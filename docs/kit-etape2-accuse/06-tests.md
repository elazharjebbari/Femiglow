# 06 — Tests

## 1. Résultats du 18/11/2026

| Série | Résultat |
|---|---|
| Vérification des types (`tsc --noEmit`) | Aucune erreur |
| Tests unitaires et de composants ajoutés | 44 réussis sur 44 (4 fichiers) |
| Tests du tunnel, du tracking et du registre (260 fichiers) | 2 931 réussis, 1 échec |
| Parcours mobile de bout en bout, nouveau | 7 réussis sur 7, dont /ar/kit |
| Parcours existants `kit-ma-ville` et `kit-bugs-graves` | 8 réussis sur 8 |
| Site réel après mise en ligne | Accusé affiché sur /kit et /ar/kit, absent avec `?ack=off` |

L'échec unique est `event-catalog.checkout.test.ts` (« lead_capture par défaut sur google_ga4 + meta + google_ads »). Il échoue de la même façon sur le code d'avant : il n'est pas lié à ce travail.

## 2. Ce que les tests couvrent

| Fichier | Vérifie |
|---|---|
| `src/lib/checkout/step2-ack.test.ts` | Part à 0 et à 100, `?ack=` dans les deux sens, tirage stable, répartition à 50 %, indépendance avec le test de l'étape 2 |
| `src/lib/checkout/kit-checkout-config.test.ts` | Valeur par défaut, bornes, champ du registre, coupe-circuit `CHECKOUT_STEP2_ACK=off` |
| `src/components/checkout/wizard/LeadAckNotice.test.tsx` | Carte, ligne repliée, numéro de gauche à droite |
| `src/components/checkout/wizard/steps/AddressStepV2.ack.test.tsx` | Arrivée, trois langues, numéro en `+212`, pas d'accusé si réglage coupé, si enregistrement en échec ou si numéro illisible, repli sans rebond, mesure sans donnée personnelle |
| `e2e/kit-etape2-accuse.spec.ts` | Fiche réellement en base quand la carte s'affiche, tout tient sur 390 × 844 et 360 × 640, repli au toucher, commande finie comme avant, retour sur la page, « Modifier » et nouveau numéro, `?ack=off`, arabe |

## 3. Lancer les tests

```bash
cd apps/web
npx tsc --noEmit -p .
npx vitest run src/lib/checkout/step2-ack.test.ts \
  src/lib/checkout/kit-checkout-config.test.ts \
  src/components/checkout/wizard/LeadAckNotice.test.tsx \
  src/components/checkout/wizard/steps/AddressStepV2.ack.test.tsx
```

Le parcours de bout en bout demande la base de test et une compilation locale : voir [08-runbook-agent.md](08-runbook-agent.md) §3.

## 4. Ce que les tests ne couvrent pas

| Point | Comment le vérifier |
|---|---|
| Clavier réel d'iPhone et d'Android | Sur un vrai téléphone : toucher « Votre ville », le champ et trois suggestions doivent rester visibles au-dessus du clavier |
| Navigateurs intégrés d'Instagram et de Facebook | Ouvrir une publicité, aller jusqu'à l'étape 2 |
| Justesse de l'arabe | Relecture native |
| Effet sur les commandes | `bash bin/deployer-accuse.sh mesurer`, à 3 et 7 jours |
| Effet sur les appels | Trello : décroché, confirmation, numéros faux |

## 5. Recette manuelle (5 minutes, sur téléphone)

1. Ouvrir `https://femiglow-maroc.com/kit` en navigation privée.
2. Prénom et **votre propre numéro**, puis « Continuer ».
3. La carte verte affiche le prénom et le numéro. Le relire.
4. Toucher « Votre ville » : la carte devient une ligne, le champ reste visible.
5. Choisir une ville : frais et délai apparaissent.
6. Quitter sans confirmer. Vérifier que la fiche arrive dans Trello après le délai d'abandon, puis l'archiver.
7. Refaire avec `/ar/kit`.
8. Refaire avec `/kit?ack=off` : aucun accusé.

Ne jamais saisir un numéro inventé sur le site réel : la fiche part au CRM et quelqu'un serait appelé.
