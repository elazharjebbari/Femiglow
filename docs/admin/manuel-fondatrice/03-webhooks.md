# 3. Configurer les webhooks

## C'est quoi, un webhook ?

Un **webhook** est un *câble* qu'on tend entre FemiGlow et un autre
outil (CRM, email, Slack, Notion, etc.). Quand un évènement se passe
chez nous (un nouveau lead, un changement de statut), le câble envoie
automatiquement une notification à l'outil destinataire.

Exemples :

- *« Quand un lead arrive, ajoute-le dans HubSpot. »*
- *« Quand une commande est passée, écris dans le canal Slack
  #ventes. »*

## Créer un endpoint

1. Va dans **Webhooks** → **Nouveau**.
2. Saisis l'**URL HTTPS** fournie par l'outil destinataire (HTTPS
   obligatoire — la console refuse les URL `http://` ou les IP
   privées).
3. Coche les **événements** à envoyer. Quatre choix possibles :
   - `lead.created` — nouveau lead
   - `lead.status_changed` — un lead change de statut
   - `lead.note_added` — une note interne a été ajoutée
   - `order.created` — une commande a été créée
4. (optionnel) Ajoute une **description** pour t'y retrouver plus tard
   (« HubSpot prod », « Slack #ventes »).
5. Clique sur **Créer l'endpoint**.

## Le secret HMAC

Au moment de la création, la console affiche **une seule fois** un
**secret** (chaîne base64 d'environ 44 caractères). Il sert à l'outil
destinataire pour vérifier que les notifications viennent bien de
FemiGlow et pas d'un tiers.

**Conserve-le immédiatement** dans 1Password ou directement dans
l'interface de configuration de l'outil destinataire. Si tu le perds,
tu peux **rotationner** le secret (voir plus bas).

## Tester un endpoint

Sur la liste des webhooks, clique sur **Tester** à côté d'un endpoint
pour envoyer une notification factice. Dans l'onglet **Deliveries**,
tu verras le résultat (200 OK, ou erreur).

## Rotationner le secret

Va dans le détail de l'endpoint → **Rotationner le secret**. La console
te montre un **nouveau** secret, **une seule fois**, et invalide
immédiatement l'ancien. Mets-le à jour dans l'outil destinataire.

## Désactiver / supprimer

- **Désactiver** : pause temporaire. L'endpoint reste mais ne reçoit
  plus rien jusqu'à réactivation.
- **Supprimer** : suppression douce (l'historique des deliveries reste
  visible, mais l'endpoint disparaît de la liste active).

## Capture écran (à venir)

> ![Création webhook](./screenshots/03-webhook-create.png)
> ![Liste deliveries](./screenshots/03-deliveries.png)
