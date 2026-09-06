# Velora — démarrer en 4 commandes

## 1. Sur votre machine

```bash
npm ci
npm run db:reset      # schéma + jeu de démonstration
npm run build
AUTH_SECRET="$(openssl rand -base64 48)" npm start   # http://localhost:3000
```

Sous Windows, remplacez la ligne `AUTH_SECRET=…` par : `$env:AUTH_SECRET="une-longue-chaine-aleatoire"; npm start`
(ou créez un `.env.local` avec `AUTH_SECRET=…` ; `npm run dev` n'en a pas besoin).

## 2. Comptes de démonstration

| rôle | courriel | passe |
| --- | --- | --- |
| mandant (owner) | `alexander@velora.private` | `Velora2026!` |
| co-mandant | `henrik@sund-familyoffice.li` | `Velora2026!` |
| console | `admin@velora.private` | `VeloraAdmin2026!` |

Vous pouvez aussi créer un compte depuis `/register` : tout le parcours est fonctionnel
(hors paiement, tant que Stripe n'est pas branché).

> Un passe de compte doit faire **12 caractères ou plus** — les passes de démo en font 11 :
> ils fonctionnent à la connexion, mais pas si vous essayez de remettre exactement celui-là
> en changeant votre passe. À corriger dans `db/demo-data.mjs` si vous voulez l'aligner.

## 3. Ce qui marche sans rien brancher

Authentification et sessions, profil et réglages, langues, résidences, personnel, véhicules,
déplacements, réservations, tâches et alertes, dépenses, documents (téléversement,
téléchargement, suppression), notes partagées, notifications, export JSON du compte entier,
suppression de compte, console d'administration. Contrôle automatique : `npm run smoke`
(48 vérifications) et `npm run check` (types + règles de codage).

Chaque membre ne voit que ses propres données ; les mots de passe sont hachés ; aucune clé
dans le navigateur ; les routes sensibles exigent l'en-tête `Origin`.

## 4. Ce qui attend une clé (rien n'est simulé comme réussi)

| service | variable | comportement sans clé |
| --- | --- | --- |
| Stripe (abonnements) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 6 × `STRIPE_PRICE_<PLAN>_<CYCLE>`, `VELORA_PAYMENT_METHODS` | écran d'adhésion explicite « démonstration », aucun faux paiement — le plus court est **`/admin` → Facturation** : collez votre clé secrète, le produit crée produits, prix, portail et webhook chez vous — voir **`docs/paiements.md`** (carte, virement, prélèvement, et `node scripts/stripe-setup.mjs` pour la variante environnement) |
| IA (brouillons de notes, priorisation) | `VELORA_AI_KEY` (et `VELORA_AI_PROVIDER`, `VELORA_AI_MODEL`) | réponses marquées démonstration |
| Courriel (invitations, notes du matin) | `VELORA_SMTP_*` | journalisé dans la sortie du serveur |
| Cartes (fonds cartographiques) | `NEXT_PUBLIC_MAPBOX_TOKEN` | planches de coordonnées, sans tuiles |

## 5. En ligne (Render) — configuration déjà dans le dépôt

1. Dépot GitHub → Render → **Blueprint** : `render.yaml` est lu tel quel — région `frankfurt`,
   build `npm ci && npm run build`, départ `npm start`, commande de pré-déploiement
   `node scripts/prepare-runtime.mjs` (idempotente, exécutée à chaque déploiement),
   vérification de santé `/api/health`, données en `./data` (et `VELORA_DB_PATH=/opt/render/project/src/data/velora.db`).
2. `AUTH_SECRET` est généré par Render. Le blueprint déclare un disque de 1 Go monté sur
   `/opt/render/project/src/data` (`velora-data`), mais **l'offre gratuite refuse les disques**
   (réponse mesurée : HTTP 402 sur `POST /v1/disks`) : en gratuit, la base se repeuple à chaque
   redémarrage — les comptes créés après coup et les fichiers téléversés sont perdus.
   Pour de vrai : offre `starter` (le disque est alors accepté) ou Postgres gérée (README § Architecture).
   Un service avec disque ne se met pas à l'échelle : un seul processus possède le fichier SQLite.
3. Premier administrateur — API Render (service déjà créé : `srv-daehm9dbedkc73daja0g`) :

   ```bash
   KEY="<clé d'API Render>"
   SVC=srv-daehm9dbedkc73daja0g
   ID=$(curl -s -X POST "https://api.render.com/v1/services/$SVC/jobs" \
     -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"startCommand":"node scripts/db-cli.mjs promote votre@domaine.com","planId":"free"}' \
     | sed -n 's/.*"id":"\(job-[^"]*\)".*/\1/p')
   sleep 45 && curl -s "https://api.render.com/v1/services/$SVC/jobs/$ID" -H "Authorization: Bearer $KEY"
   ```

   (le compte doit déjà exister — inscription normale, ou `node scripts/db-cli.mjs create-user` ;
   puis `render.yaml` peut fixer `VELORA_ADMIN_EMAILS` pour la console)

## 6. Traduction

Par défaut le site suit la langue du navigateur, puis se règle par compte (menu de langue
en haut à droite ou Réglages → Langue) et se mémorise dans un cookie avant même la connexion.
Français, allemand, italien, espagnol sont fournis ; l'arabe et le japonais sont possibles
au niveau formats (écriture à prévoir).

```bash
npm run i18n:coverage    # taux par langue
npm run i18n:missing fr  # lignes manquantes, prêtes à coller
```

Un texte absent d'un dictionnaire s'affiche en anglais : jamais de trou, jamais de code.
