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

## 3. Brancher votre compte Stripe — deux chemins, un seul à choisir

### 3 bis. Le plus court : coller votre clé dans la console (`/admin` → Facturation)

Vous avez déjà un compte Stripe ? Un champ suffit. Le produit :

1. vérifie la clé contre `GET /v1/account` (un mauvais jeton échoue là, avant toute écriture) ;
2. lit **ce que votre compte a le droit d'encaisser** (`capabilities`) et n'active que ces rails —
   si le virement n'est pas approuvé chez Stripe, il n'est pas proposé au membre, et la console
   vous dit lequel manque, avec le lien ;
3. crée (ou retrouve) les trois produits et les six prix du catalogue, la configuration du portail
   client, et l'endpoint webhook — un endpoint **nouvellement créé** renvoie son secret de signature,
   ce qui est la seule raison pour laquelle le câblage tient en un champ ;
4. stocke les deux clés **chiffrées** (AES-256-GCM, clé dérivée de `AUTH_SECRET`) dans la table
   `settings`, et affiche `sk_live_…4242` — jamais la clé complète, nulle part.

Reconnecter le même compte ne duplique rien : les prix sont retrouvés par `lookup_key`, le portail
existant est réutilisé, et aucun second endpoint n'est ajouté tant qu'un secret est déjà connu.
`Déconnecter` efface les lignes locales **et** supprime l'endpoint chez Stripe.

Trois limites de ce chemin, dites à l'écran plutôt que cachées :

- **`AUTH_SECRET` est le coffre.** Le changer rend la connexion illisible : il faudra recoller la clé.
- **Un disque éphémère (l'offre gratuite Render) ne garde ni la base, ni donc la connexion** après un
  redéploiement : il faudra la recoller, ou préférer le chemin 3 ter, qui survit aux déploiements.
- **Ne diffusez pas votre base** : le fichier `data/velora.db` contient la connexion chiffrée ;
  un zip de sauvegarde n'est pas un artefact à publier.

> **Le catalogue est partagé.** Les deux chemins posent les mêmes `lookup_key`
> (`velora-<plan>-<cycle>`) sur les prix, donc brancher `/admin` puis plus tard passer par
> l'environnement ne crée pas un deuxième jeu de tarifs chez Stripe : le second retrouve le
> premier. C'est aussi ce qui rend la reconnexion sans danger — vérifié par le harnais, qui
> rejoue la connexion et exige `créés: 0, réutilisés: 6`.

### 3 ter. Le chemin environnement (recommandé dès que vous avez un disque persistant)

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
**votre** compte bancaire selon le calendrier réglé dans votre tableau de bord. Les délais ne sont
pas symétriques et c'est de la trésorerie, pas du détail : le **prélèvement SEPA met 6 jours ouvrés**
à rendre les fonds disponibles (Stripe a allongé ce délai en 2026 pour distinguer un échec de
prélèvement d'un litige), un **virement arrive quand votre banque le reçoit** — et la facture reste
`open` jusqu'à ce que Stripe le confirme (c'est l'événement `invoice.paid` qui active l'abonnement) ;
le délai de règlement des cartes est une caractéristique de votre compte, lisible dans
*Stripe → Soldes*, et le **premier versement d'un compte neuf est typiquement retenu 7 à 14 jours**.
Le §8 reprend ces chiffres avec leur source et les montants nets par tarif. Aucun argent ne transite par votre hébergeur, par la base de données, ni par le
navigateur de vos membres : aucune donnée de carte, aucun token, aucun IBAN n'est stocké ici —
les seules colonnes chez vous sont un montant, une devise, un numéro de facture, une date et un
lien vers la facture hébergée par Stripe.

Si un membre annule, la coupure est demandée chez Stripe (`DELETE /v1/subscriptions/{id}`,
`invoice_now`) puis reflétée localement ; l'état local n'est jamais la source de vérité du
contrat, c'est le miroir — et le webhook est la seule chose qui puisse l'écrire.

## 5. Ce que `npm run check:stripe` prouve, sans compte Stripe (76 contrôles)
Quatre regles de Stripe sont verifiees par le harnais parce qu'elles ont ete mesurees sur le
compte reel, pas devinees : `GET /v1/prices?lookup_keys[0]=` (il n'existe pas de route
`/v1/prices/lookup`), les vrais noms de capacites (`card_payments`, `sepa_debit_payments`, …) lus
sur `GET /v1/account/capabilities` et non sur l'objet compte, le profil du portail limite aux champs
documentes (`default_return_url`, `business_profile{headline, privacy_policy_url,
terms_of_service_url}`, `features` — pas de `subscription_update` sans produits), et l'interdiction
d'envoyer `invoice_creation` sur une session Checkout en mode `subscription`. Le mock refuse
desormais ce que Stripe refuse : une suite verte a de nouveau une signification.

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


## 5 bis. La signature du webhook se calcule sur la cle complete

`Stripe-Signature: t=<timestamp>,v1=<hex>` ou `v1` est un HMAC-SHA256 de `"<t>.<corps brut>"`
calcule **avec la valeur entiere du secret, `whsec_` compris**. Ce fichier enlevait le prefixe avant
de hasher — et le harnais faisait pareil, donc la suite restait verte. Resultat : toute livraison
reelle de Stripe aurait repondu `signature_invalid`, l'argent entre chez Stripe sans que l'adhesion
ne passe jamais a « payee », et rien a l'ecran ne le dirait. Verifie en installant le SDK officiel
(`stripe-node` 22.6.1) et en faisant tourner `webhooks.constructEvent` : la cle complete est
acceptee, la cle amputee est refusee. Le harnais livre desormais les evenements comme Stripe (prefixe
inclus) et refuse explicitement une signature calculee sur la cle amputee ; reinjecter le retrait du
prefixe fait tomber la suite de 76 a 68.
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

## 8. Ce que chaque paiement coûte vraiment (taux vérifiés le 6 septembre 2026)

Source : page tarifs publique de Stripe France, relue le jour où ce document a été écrit. Ce sont
les taux de **l'offre standard** ; un compte à volume important peut être en tarification
personnalisée ou IC+, auquel cas le seul chiffre qui compte est celui affiché dans
*Stripe → Paramètres → Tarifs*. Le produit, lui, n'invente aucun taux : il lit les capacités du
compte et ne vend que ce que Stripe a réellement approuvé.

| Ce que paie le client | Ce que Stripe prend |
| --- | --- |
| Carte standard EEE | 1,5 % + 0,25 € |
| Carte premium EEE (Visa Signature, World Mastercard — le cas le plus fréquent dans cette clientèle) | 2,8 % + 0,25 € |
| Carte britannique | 2,5 % + 0,25 € |
| Carte hors EEE | 3,15 % + 0,25 €, et + 2 % si conversion de devise |
| **Prélèvement SEPA** | **0,35 € par débit, sans pourcentage** |
| Virement (facture annuelle) | 0,4 % par facture payée (Invoicing) |
| Abonnement, quel que soit le moyen | + 0,7 % du volume (Billing) |
| Litige reçu | 20 € ; 20 € de plus pour le contester à la main (remboursés si gagné) ; Smart Disputes : 30 % du montant si gagné |
| Stripe Tax | 0,45 € par transaction via l'API, ou 0,5 % en no-code |

Sur les six tarifs du produit, net dans votre poche (hors TVA, donc à recalculer si Stripe Tax est
activé, car le pourcentage porte alors sur le total TTC) :

| Tarif | Brut | Carte standard | Carte premium | Prélèvement SEPA | Virement |
| --- | --- | --- | --- | --- | --- |
| 199 € / mois | 199 | 194,37 | 191,78 | **197,26** | — |
| 499 € / mois | 499 | 487,77 | 481,29 | **495,16** | — |
| 1 500 € / mois | 1 500 | 1 466,75 | 1 447,25 | **1 489,15** | — |
| 199 € annuel | 2 149,20 | 2 101,67 | 2 073,73 | **2 133,81** | 2 125,56 |
| 499 € annuel | 5 269,44 | 5 153,26 | 5 084,76 | **5 232,20** | 5 211,48 |
| 1 500 € annuel | 18 000 | 17 603,75 | 17 369,75 | **17 873,65** | 17 802,00 |

La lecture qui compte : **pousser le prélèvement SEPA plutôt que la carte premium économise
41,90 € par mois sur un abonné à 1 500 €**, soit 503 € par an et par foyer, et 296 € d'écart sur
une année à 18 000 €. Un prélèvement qui échoue remonte au produit en quelques jours par webhook,
et c'est ce déclencheur là qui alimente les relances et l'écran de reprise — pas une supposition.

Délais d'encaissement, eux aussi relus à la source : premier versement d'un compte neuf **7 à 14
jours après le premier paiement réel** (Stripe vérifie identité et activité), puis selon le
calendrier choisi ; **SEPA : 6 jours ouvrés** avant que les fonds soient disponibles. Un membre est
actif dans le produit dès le webhook, donc l'accès est livré avant que l'argent soit disponible — à
prévoir en trésorerie sur les abonnements annuels.
