# Paiements — carte, virement, prélèvement : ce qui est branché, ce qui reste à vous

Ce produit ne simule jamais un encaissement. Tout ce document sépare **ce qui est codé et
vérifié ici** de **ce qui exige votre compte Stripe**, parce qu'un marchand qui croit encaisser
pendant qu'il enregistre des brouillons perd des clients deux fois.

## 1. Ce qui est en place dans le code

| moyen de paiement | parcours | renouvellement | proposé sur |
| --- | --- | --- | --- |
| **Carte** (Visa, Mastercard, Amex) | Stripe Checkout | automatique | mensuel et annuel |
| **Prélèvement SEPA** (zone euro) | mandat signé au premier Checkout | automatique | mensuel et annuel |
| **Prélèvement ACH** (États-Unis), **BACS** (Royaume-Uni) | idem | automatique | mensuel et annuel |
| **iDEAL** (Pays-Bas), **Bancontact** (Belgique) | réauthentification à chaque période | oui, avec relance | mensuel et annuel |
| **BLIK**, **Swish** | un seul paiement à la fois | non | **annuel seulement** |
| **Virement bancaire** | facture hébergée par Stripe, avec les coordonnées à utiliser | non — une nouvelle facture à chaque échéance | **annuel seulement** |

La colonne « renouvellement » est la raison pour laquelle le virement est interdit sur le plan
mensuel : un virement est émis par le payeur, donc personne ne peut le redéclencher. Vendre un
abonnement mensuel payé par virement produirait une coupure silencieuse chaque mois. Le produit
refuse ce mélange à l'inscription (message explicite côté membre, et un contrôle le vérifie).

Le choix s'affiche sur l'écran d'adhésion : un sélecteur « Carte · Stripe Checkout / Virement
(facture, 14 jours) », qui n'apparaît que si le virement est activé par vous, et qui se retire de
lui-même quand le membre passe au mensuel.

## 2. Ce que j'ai changé sous le capot (et pourquoi ce n'était pas cosmétique)

1. **Le SDK `stripe` n'est plus nécessaire.** L'intention était une « dépendance optionnelle »
   et se vengeait en 501 sur le webhook, et en erreur de build sur un `import('stripe')` littéral.
   À la place : `src/lib/billing/stripe-api.ts`, un client `fetch` qui parle le vrai protocole
   (corps `x-www-form-urlencoded`, notation `a[b][0]`, en-tête `Idempotency-Key`, `Stripe-Version`
   optionnel). Une dépendance de moins, un mode de panne de moins.
2. **Signature du webhook vérifiée sans dépendance** : HMAC-SHA256 sur `"<t>.<corps>"`, comparaison
   en temps constant, **fenêtre de tolérance de cinq minutes** (une capture vieille d'une semaine
   reste une signature valide — c'est ce qui la rend dangereuse), et **une seule application par
   identifiant d'événement** : Stripe retente la livraison pendant trois jours, et un membre qui
   reçoit deux fois la même facture appelle le support.
3. **Un vrai défaut trouvé en écrivant le contrôle** : la facture payée était rattachée à
   l'identifiant d'abonnement *de Stripe* au lieu du nôtre — une contrainte de clé étrangère qui
   faisait échouer l'écriture et **perdait la facture payée du relevé du membre**. Corrigé
   (résolution de la ligne locale avant insertion) et verrouillé par un contrôle.
4. **Aucun état « payé » écrit par le navigateur** : le `?status=success` du retour de Stripe reste
   une politesse ; seul l'événement signé fait passer le plan en `active`. Tant que l'argent n'est
   pas confirmé, l'abonnement est `incomplete` et la facture `open`.
5. **Le client Stripe est créé une fois** (clé d'idempotence = identifiant du membre), et le
   portail réutilise l'identifiant appris du webhook — pas de doublons de clients dans votre
   Stripe après trois essais de facturation.
6. **Un nom de rail mal orthographié dans la configuration est signalé**, pas ignoré
   (`unknownMethods` dans l'état de facturation, visible à la console).

## 3. Brancher votre compte Stripe — quatre étapes, aucune donnée de carte chez vous

```bash
# 1. Créer le compte et activer les rails (ça, aucune API ne le fait : ce sont des
#    conditions que VOUS acceptez)  → dashboard.stripe.com → Settings → Payment methods
#    Cartes : par défaut. Virement / SEPA / ACH : « Enable » un par un.

# 2. Préparer produits, prix, portail et webhook en une commande, depuis le dépôt :
STRIPE_SECRET_KEY=*** node scripts/stripe-setup.mjs --domain https://votre-domaine
#    → 3 produits, 6 prix (les montants viennent du catalogue du code : ils ne peuvent
#      pas diverger), une config de portail client, un webhook sur /api/billing/webhook,
#      et il imprime les lignes d'environnement à coller — la clé que vous lui donnez
#      n'est jamais réécrite ni stockée.

# 3. Coller dans Render (Environment) :
#    STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, les 6 STRIPE_PRICE_*,
#    VELORA_PAYMENT_METHODS=card,sepa_debit,bank_transfer

# 4. Vérifier :
curl -s https://votre-domaine/api/health          # billing.provider doit dire "stripe"
node scripts/stripe-check.mjs                      # rejoue tout le parcours
```

Le mode est **affiché, pas deviné** : un clé `sk_test_` annonce « test », `sk_live_` annonce
« live », et l'écran d'adhésion le dit au membre. Aucun écran ne peut dire « payé » si la clé est
de test — c'est écrit dans le composant, pas dans un commentaire.

## 4. Comment l'argent arrive chez vous

Stripe encaisse sur le solde de **votre** compte (le compte connecté à la clé), puis verse sur
**votre** compte bancaire selon le calendrier de votre plan Stripe — en France, cartes : généralement
J+1 à J+2 ouvrés ; SEPA : idem ; **virement : quand votre banque le reçoit**, et la facture reste
`open` jusqu'à ce que Stripe le confirme (c'est l'événement `invoice.paid` qui active
l'abonnement). Aucun argent ne transite par votre hébergeur, par la base de données, ni par le
navigateur de vos membres : aucune donnée de carte, aucun token, aucun IBAN n'est stocké ici —
les seules colonnes chez vous sont un montant, une devise, un numéro de facture, une date et un
lien vers la facture hébergée par Stripe.

Si un membre annule, la coupure est demandée chez Stripe (`DELETE /v1/subscriptions/{id}`,
`invoice_now`) puis reflétée localement ; l'état local n'est jamais la source de vérité du
contrat, c'est le miroir — et le webhook est la seule chose qui puisse l'écrire.

## 5. Ce que `npm run check:stripe` prouve, sans compte Stripe

Un serveur local parle le protocole de Stripe (mêmes corps de requête, mêmes en-têtes), une
deuxième instance de l'application démarre dessus avec des clés de test, et 35 contrôles exécutent
les deux parcours :

- la Checkout demandée contient exactement les rails activés, le bon intervalle (`month`/`year`),
  l'identifiant du membre dans les métadonnées, et une clé d'idempotence ;
- **rien n'est marqué payé avant Stripe** — après le Checkout, le plan payant n'est pas attribué ;
- l'événement signé active l'abonnement ; le **rejeu du même événement est ignoré** ; un **corps
  modifié est refusé** et le plan ne bouge pas ; une **signature d'il y a une heure est refusée** ;
  un événement signé avec **une autre clé secrète est refusé** ; un corps **non signé est refusé** ;
- le virement : facture `send_invoice`, délai de 14 jours, `payment_behavior=default_incomplete`,
  abonnement `incomplete`, facture `open` visible par le membre, puis `invoice.paid` → `active` +
  trace payée au bon abonnement local ;
- un **virement mensuel est refusé avec une raison lisible** ;
- le portail s'ouvre et réutilise le client appris du webhook ;
- et le mode test/live + les rails inconnus sont rapportés à l'écran.

Le script d'installation, lui, est vérifié contre le même bouchon : 11 appels, trois produits, six
prix aux montants exacts du catalogue (199,00 € ; 2 149,20 € ; 499,00 € ; 5 269,44 € ; 1 500,00 € ;
18 000,00 €), portail, webhook, et aucune clé renvoyée.

## 6. Ce qui reste honnêtement non vérifiable ici

- **Un vrai débit.** Sans votre clé live, aucun euro n'a bougé dans aucun test — le harnais prouve
  le protocole et les états, pas l'acquéreur.
- Les **délais de versement** exacts, qui dépendent de votre dossier Stripe (ancienneté, secteur,
  pays) : à lire dans Dashboard → Balances, pas dans ce fichier.
- **La TVA.** Si vous facturez en Europe, regardez Stripe Tax (Dashboard → Tax) *avant* la première
  facture : le produit émet un numéro de facture Stripe, il ne calcule aucune taxe.
- Les **conditions** du virement et du prélèvement : c'est un contrat entre vous et Stripe ; le
  bouton « Enable » est dans votre tableau de bord et aucun jeton ne peut le cliquer pour vous.
- Le **remboursement** : non implémenté volontairement (un « Rembourser » dans un produit qui
  n'a pas encore encaissé un seul euro est un bouton qui ment). Quand le premier client important
  paiera par virement, on ajoutera l'écran `Refund` branché sur l'API — une demi-journée.

## 7. Sans clé, que se passe-t-il ?

Le produit tourne : l'adhésion s'enregistre dans la base locale, l'écran annonce « aucune clé de
paiement branchée, aucun prélèvement », la facture est créée `open` et marquée « démonstration,
impayée ». C'est exactement ce que la suite de 48 contrôles valide en continu, et c'est ce qui fait
qu'on ne peut pas confondre une démo avec de l'argent.
