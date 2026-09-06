# Trafic payant — atteindre des familles riches sans se faire arnaquer

Ce document est un plan d'achat de trafic pour VELORA. Il sépare strictement ce qui est
**mesuré** (benchmarks 2026 cités, prix du produit pris dans le catalogue de code, arithmetic
applicable) de ce qui est **à vérifier chez vous** (volumes de requêtes, cartes tarifaires des
éditeurs, prix réel de vos enchères).

## 0. Avant de dépenser un euro — trois conditions bloquantes

1. **Le site doit être en ligne avec la version actuelle.** `render.yaml` est prêt, la copie
   française est prête, mais le dépôt GitHub n'a pas reçu les commits (aucune identité de poussée
   dans cet environnement). Sans cela, vous payez pour une page sans langues.
   → `GH_TOKEN=… RENDER_API_KEY=… bash scripts/publish.sh`
2. **Le paiement doit être réel.** Tant que `STRIPE_SECRET_KEY` est absent, l'écran d'adhésion
   annonce honnêtement « démonstration, aucun paiement ». Du trafic payant qui aboutit là
   est de l'argent brûlé à prouver que le produit plaît — utile, mais ne vendez pas encore.
   Sinon, remplacez l'objectif par « demande d'accès » (le formulaire existe, il journalise
   la provenance : colonne « Heard of us » de la console).
3. **Un prix d'entrée à 199 € existe** (`src/lib/utils/format.ts` : PRIVATE 19 900,
   PRIORITY 49 900, PRIVATE OFFICE 150 000 en centimes, mensuel). Sans offre à ce niveau,
   aucun canal payant ne compense un cycle de vente de plusieurs mois.

## 1. L'économie unitaire (à partir du catalogue, pas d'hypothèses)

| plan | mensuel | annuel | contribution brute à 80 % de marge | LTV à 3 % de désabonnement mensuel | CAC à ne pas dépasser (payback 12 mois) |
| --- | --- | --- | --- | --- | --- |
| PRIVATE | 199 € | 1 990 € | 1 910 € | ≈ 6 600 € | **≈ 1 900 €** |
| PRIORITY | 499 € | 4 990 € | 4 790 € | ≈ 16 500 € | **≈ 4 800 €** |
| PRIVATE OFFICE | 1 500 € | 15 000 € | 14 400 € | ≈ 49 500 € | **≈ 14 400 €** |

*(3 % de désabonnement mensuel = hypothèse de secteur, pas une mesure : remplacez-la par votre
churn réel au troisième mois. La conclusion tient tant que le churn reste sous 6 %/mois : un
abonné PRIORITY finance environ 9 à 10 clics LinkedIn.)*

Le seul chiffre qui pilote les enchères est donc le **coût par compte signé**, pas le coût par
curieux : cible ≤ 1 500 € par compte PRIORITY et au-delà, ≤ 600 € par compte PRIVATE.

## 2. Benchmark mesurés 2026 (sources en fin de document)

| canal | CPC | coût par prospect (formulaire) | conversion page d'atterrissage | lecture pour VELORA |
| --- | --- | --- | --- | --- |
| LinkedIn — services financiers | 6,84 $ (moyenne) ; 9–15 $ en fourchette haute | 94–175 $ | 3 % (page) / 6 % (formulaire intégré) | **le canal principal** |
| LinkedIn — France & Benelux | 5,20 $ | 88 $ | 6,3 % en formulaire | votre zone de prix la plus douce avec l'allemand/la Suisse un peu plus chers |
| LinkedIn — DACH | 5,74 $ | 93 $ | 6,1 % | correct, mais exige de l'allemand (le vôtre est à 10 %) |
| Google Ads — gestion de patrimoine | 18,84 $ (médiane) ; 15–45 $ termes généraux ; 35–80 $ termes à intention riche | 284 $ par acquisition | 3,2 % | **cher mais le seul endroit où la demande est explicite** |
| Meta (Facebook/Instagram) | 1,50–1,72 $ | 85–200 $ | 1,5–3 % en B2B | bon pour la notoriété, pas pour la signature |
| Moyenne Google Ads tous secteurs | 5,26 $ | 70 $ | 7,5 % | rappele à quel point « finance » est un secteur taxé |

Deux chiffres qui tranchent l'allocation : le coût par **compte-client idéal** mesuré sur LinkedIn
est de 257 $ contre 560 $ sur Google Search, et le ROAS B2B agrégé (66 millions de sessions,
Dreamdata) donne 121 % LinkedIn / 67 % Google / 51 % Meta.

## 3. Le vrai problème : on n'achète pas « les riches »

Les plateformes ont retiré le ciblage par patrimoine. Ni Meta ni Google ne permettent de viser
« patrimoine > 5 M€ » ; Meta restreint en plus les annonces financières (ciblage d'âge/revenu
interdit dans plusieurs pays, dont la France). Les audiences « intérêts luxe » sont exactement
l'endroit où l'argent fuit : beaucoup de clics, zéro décideur.

Ce qui fonctionne, dans l'ordre :

**a) LinkedIn — ciblage du rôle, pas de la richesse.** Vous n'achetez pas le riche, vous achetez
son personnel, qui a intérêt à vous recommander. Public :
- intitulés : *Principal / Managing Director / CIO* + industries « Investment Management »,
  « Banking & Capital Markets », « Family Office » ; et l'intendant : *Estate / Household
  Manager, Family Office Administrator, Private Banker, Trust & Estate Officer* ;
- taille d'entreprise 1–200 (les family offices et bureaux privés ne sont pas des « 500+ ») ;
- zones : France, Belgique, Suisse romande, Luxembourg, Monaco/Alpes-Maritimes, Londres,
  Dubaï ; langue de l'annonce en français pour la première, en anglais pour les autres ;
- exclusions : étudiants, « job seekers », secteurs concurrents (cabinets d'asset management
  qui achètent autre chose que du service).
Format : un seul message sponsorisé carrousel + un **formulaire de prospect intégré** (le
formulaire LinkedIn convertit 2× mieux qu'une page externe : 6 % contre 3 %). Budget de test :
45 € / jour pendant 21 jours.

**b) Google Search — intention explicite, en correspondance exacte uniquement.**
Termes achetés (groupe par intention, un groupe = une page d'atterrissage) :
- `family office software`, `private office software`, `household management software`
- `multi-property household management`, `estate manager software`, `family office operations`
- termes de bascule : `alternative to <concurrent>`, `concurrent + pricing`
- **liste de négatifs de départ** : `job`, `salary`, `formation`, `cours`, `gratuit`, `open source`,
  `stage`, `avocat`, `recrutement`, `prix immobilier`, `conciergerie airbnb` — le diffuseur par
  défaut (« correspondance large ») vous fera payer 19 $ le clic d'un étudiant.
CPC attendu 15–45 $, donc 30 clics par mois pour 450 € : c'est un canal à **petit volume et gros
loyer**, à lancer seulement quand les pages existent en français *et* que le paiement fonctionne.

**c) Les endroits où ce public lit vraiment — achat direct, sans algorithme.**
C'est là que le luxe se vend, et ce n'est pas « payant » au sens CPC : c'est du placement.
À chiffrer par devis (je n'ai pas leurs tarifs, ne vous donnez pas de faux chiffres) :
*Robb Report*, *Monetay*, *Campden Wealth / Family Office Association*, *Wealth Management*,
*Private Banker International*, le supplément *How To Spend It* du FT, les newsletters
Bloomberg Wealth ; et les salons/associations d'intendants (IFBO, Family Office Association,
Ubs/Stephens-type cercles) pour un exposé de 12 minutes plutôt qu'un stand.
Objectif d'un euro dépensé ici : **trois rendez-vous personnalisés**, pas mille clics.

**d) Retargeting sobre.** Audience LinkedIn Matched Audiences sur les visiteurs du site
(identifiants hachés, consentement d'abord) avec un angle distinct : « vous avez vu le
produit, voici la conversation ». 8–10 € / jour, plafonné à 4 impressions par semaine et par
personne — le public visé déteste l'insistance, c'est un paramètre de marque, pas seulement
de confort.

**e) Ce que je déconseille explicitement.** Meta/Instagram « audiences patrimoine », les
courtiers en trafic qui promettent des « leads investisseurs haut de gamme », les placements
programmatiques sur les sites d'actualité généralistes, les listes achetées de « HNW individuals »
(illégal à exploiter commercialement en France sans consentement, et de toute façon faux à 40 %).
Sur un panier à 499 € par mois, un seul mois de ces listes coûte plus qu'il ne rapporte.

## 4. Trois mois, 4 500 € au total — le calendrier exact

| mois | budget | allocation | ce qu'on achète réellement | ce qui décide |
| --- | --- | --- | --- | --- |
| 1 | 1 200 € | 100 % LinkedIn | 45 €/j, carrousel + formulaire, France/Londres | ≥ 12 formulaires et CTR ≥ 0,45 % |
| 2 | 1 500 € | 1 050 € LinkedIn / 450 € retargeting | on garde l'angle gagnant, on coupe l'autre | coût par prospect ≤ 120 € |
| 3 | 1 800 € | 900 € LinkedIn / 450 € Search / 450 € un placement éditorial | premier test d'intention explicite + un devis éditeur | coût par compte signé ≤ 1 500 € |

Coupe-feu, écrit à l'avance pour ne pas négocier avec soi-même : une annonce sous 0,35 % de CTR
après 1 000 impressions est arrêtée ; un canal au-delà de 240 € le prospect au jour 45 est arrêté ;
aucune enchère n'augmente tant que le formulaire de demande d'accès n'a pas converti dix fois.

Résultat attendu avec les taux mesurés ci-dessus (à prendre comme ordre de grandeur, pas comme
promesse) : 1 200 € de LinkedIn à 5,20 $ le clic ≈ 215 clics ≈ 12 prospects ≈ 3 à 5 conversations
≈ **0 à 2 comptes signés le premier mois** — soit 0 à 1 000 € de revenu récurrent, payback au
deuxième ou troisième mois. Si les trois premiers mois ne signent aucun compte, le problème n'est
pas le média : c'est le prix, la preuve, ou la page.

## 5. Le texte — prêt à coller

Annonce LinkedIn (FR, 150 caractères max, une idée, pas d'adjectif décoratif) :

> Six résidences, un personnel de onze personnes, trois avions cette saison. Le carnet est
> déjà dans votre tableur — l'historique, lui, n'y est pas. VELORA garde la mémoire du bureau
> privé. Demandez un accès.

Annonce LinkedIn (EN) :

> Eleven staff, six residences, three movements a week. The spreadsheet holds the calendar.
> It does not hold the history, the budgets or who owes what next. VELORA does. Request access.

Angle Google (titre / description / chemin) :

> Logiciel de bureau privé · VELORA — Les résidences, le personnel, les trajets et les budgets
> dans un seul carnet. Essai de 14 jours sur le plan annuel.
> velora.app/family-office

Règles de page d'atterrissage (elles font 2 à 3 fois le coût par prospect, plus que n'importe
quel réglage d'enchère) : une seule page par intention, le prix visible, une capture d'écran
réelle du produit, le mot « démonstration » sur les fonctions sans clé, un seul bouton
« demander un accès », aucun formulaire de rappel téléphonique — ce public ne laisse pas son
numéro à un inconnu, il écrit une phrase dans un champ libre.

## 6. Mesurer sans outil payant

Schéma d'URL à respecter à la lettre, sinon les chiffres ne se recoupent pas :

```
https://velora.app/membership?utm_source=linkedin&utm_medium=paid&utm_campaign=family-office-principal&utm_content=carousel-memoire
https://velora.app/?utm_source=google&utm_medium=cpc&utm_campaign=family-office-software&utm_content=famille-exacte
```

Ce qui est déjà mesurable dans le produit : le formulaire de demande d'accès enregistre
l'origine (colonne `referrer`, visible dans Console → Demandes d'accès), et l'export JSON du
compte emporte tout. Ce qui manque et que je peux ajouter sur demande (environ une demi-journée) :
trois colonnes `utm_source / utm_medium / utm_campaign` figées à l'inscription, la colonne en
console, un filtre par campagne, et un contrôle automatique de plus dans la suite.
Ne branchez pas Google Analytics tant que le bandeau de consentement ne pose pas un choix réel :
sur ce public, un cookie de traçage mal annoncé coûte plus qu'il ne rapporte.

## 7. Conformité — trois lignes qui vous évitent un mois de travail

- Aucune promesse de rendement, aucune allusion à la gestion de fortune : le produit organise,
  il ne conseille pas (la page « Établissement » et l'avertissement légal le disent déjà — ne
  les contradisez pas dans une annonce).
- En France, la prospection par courriel d'adresses non obtenues est interdite : le formulaire
  ne promet que ce que le produit fait, et le message de suivi part vers ceux qui l'ont rempli.
- Les publicités financières sur Meta sont restreintes par pays : si un refus arrive, ne
  reformulez pas pour contourner le filtre — passez sur LinkedIn, votre audience y est déjà.

## Sources (chiffres 2026, vérifiés ce jour)

- digitalapplied.com — LinkedIn Ads Benchmarks 2026 : CPC services financiers 6,84 $, CPL moyen
  94 $, CPM 42,10 $ ; France & Benelux CPC 5,20 $ / CPL 88 $ / formulaire 6,3 % ; DACH 5,74 $.
- foundrycro.com — CPC 9–15 $ services financiers, coût par compte-client idéal 257 $ LinkedIn
  contre 560 $ Google ; ROAS B2B 121 / 67 / 51 % (Dreamdata, 66 M sessions) ; conversion page 3 %.
- webtonic.io — Wealth Management Google Ads Statistics 2026 : CPC médian 18,84 $, CTR 2,64 %,
  conversion 3,2 %, coût par acquisition 284 $ ; termes à intention 35–80 $ ; DACH et NY > 40 $.
- percuity.ai / adlibrary.com / benly.ai — fourchettes LinkedIn 2026 (CPC 5,50–8,50 $, CPM
  30–50 $, CPL 75–175 $, Message Ads 0,81 $ par envoi) ; cohérent avec les deux sources above.
- admanage.ai — moyenne Google Ads tous secteurs 5,26 $ le clic, 70,11 $ le prospect.

Non vérifié, à demander : taux de recherche réels des termes Google (Keyword Planner de votre
compte, pas un article), les cartes tarifaires des éditeurs cités, et les taux de conversion de
votre propre page — trois chiffres qui remplacent toutes les moyennes ci-dessus dès le jour 15.
