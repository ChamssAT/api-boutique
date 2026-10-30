# api-boutique — corrigé de la Séance 1

API REST de produits (CRUD en mémoire) construite avec **Node.js**, **Express 5** et **Zod 4**.
Ce dépôt contient le code complet de l'atelier **et** les corrigés des exercices 1.A, 2.A, 2.B,
4.1, 4.2, 4.3 et 4.4.

> Le corrigé détaillé, expliqué pas à pas, se trouve dans **[CORRECTIONS.md](./CORRECTIONS.md)**.

---

## 1. Prérequis

- **Node.js 24 LTS** recommandé (le projet est aussi testé sur Node.js 22.23).
- npm 10 ou plus.
- Git.

```bash
node -v   # idéalement v24.x
npm -v
```

## 2. Installation et lancement

```bash
# 1. Installer les dépendances (versions exactes du package-lock.json)
npm ci

# 2. Créer le fichier de configuration local
cp .env.example .env

# 3. Démarrer en mode développement (redémarrage automatique)
npm run dev

# 4. Vérifier que l'API répond
curl http://localhost:3000/health
```

Réponse attendue :

```json
{ "status": "ok" }
```

## 3. Tests

```bash
npm test
```

Résultat attendu : **22 tests, 22 succès, 0 échec** (node:test, aucune dépendance de test).

```text
# tests 22
# pass 22
# fail 0
```

## 4. Architecture

```text
api-boutique/
├── src/
│   ├── config/
│   │   └── env.js                 # lit et valide process.env au démarrage
│   ├── routes/
│   │   └── products.routes.js     # URL + méthode → validation → contrôleur
│   ├── controllers/
│   │   └── products.controller.js # traduit HTTP ↔ métier (aucune règle métier)
│   ├── services/
│   │   └── products.service.js    # règles métier, stock, filtres, tri
│   ├── schemas/
│   │   └── product.schema.js      # contrats Zod (body, params, query)
│   ├── middlewares/
│   │   ├── validate.js            # validation centralisée
│   │   ├── logger.js              # une ligne de log par requête (exo 4.1)
│   │   └── error-handler.js       # 404 + format d'erreur unique
│   ├── utils/
│   │   └── app-error.js           # erreur typée (status + code stable)
│   ├── app.js                     # construit l'application (testable)
│   └── server.js                  # démarre le serveur + arrêt propre
├── test/
│   └── products.test.js           # 22 tests automatisés
├── exercices/
│   ├── ordre.js                   # corrigé 2.A (ordre de la boucle d'événements)
│   └── blocage.js                 # corrigé 2.B (handler qui bloque 5 s)
├── scripts/
│   └── attaques.sh                # corrigé 4.4 (attaques en ligne de commande)
├── requests.http                  # tests manuels avec REST Client
├── .env.example
├── .gitignore
├── .nvmrc
└── package.json
```

### Le parcours d'une requête

```text
Requête HTTP
   │
   ├─ 1. logger            (mesure la durée, logge à la fin)
   ├─ 2. helmet            (en-têtes de sécurité)
   ├─ 3. cors              (origines autorisées)
   ├─ 4. rateLimit         (100 req / 15 min / IP)
   ├─ 5. express.json      (limite 100 kb)
   ├─ 6. route + validate  (Zod : body, params, query)
   ├─ 7. contrôleur        (traduit HTTP ↔ métier)
   ├─ 8. service           (règles métier)
   │
   ├─ 9. notFound          (aucune route trouvée → 404)
   └─ 10. errorHandler     (toute erreur → format unique)
```

## 5. Endpoints

| Méthode  | URL                                  | Succès | Erreurs principales                  |
| -------- | ------------------------------------ | ------ | ------------------------------------ |
| `GET`    | `/health`                            | 200    | —                                    |
| `GET`    | `/api/v1/products`                   | 200    | 400 (query invalide)                 |
| `POST`   | `/api/v1/products`                   | 201    | 400 (body invalide)                  |
| `GET`    | `/api/v1/products/:id`               | 200    | 400 (id non UUID), 404               |
| `PATCH`  | `/api/v1/products/:id`               | 200    | 400, 404                             |
| `DELETE` | `/api/v1/products/:id`               | 204    | 400, 404                             |
| `POST`   | `/api/v1/products/:id/sales`         | 200    | 400, 404, 409 (stock insuffisant)    |

### Filtres de la liste (exercice 4.2)

```text
GET /api/v1/products?category=cereales&minPrice=10000&maxPrice=30000&sort=-price&page=1&limit=20
```

- `category` : `cereales`, `legumes`, `fruits` ou `boissons`.
- `minPrice` / `maxPrice` : entiers positifs en FCFA, avec `minPrice <= maxPrice`.
- `sort` : `price` (croissant) ou `-price` (décroissant).
- `page` : entier ≥ 1 (défaut 1).
- `limit` : entier entre 1 et 100 (défaut 20).

### Vente (exercice 4.3)

```text
POST /api/v1/products/:id/sales
Content-Type: application/json

{ "quantity": 3 }
```

- `200` : stock décrémenté, produit renvoyé.
- `409 INSUFFICIENT_STOCK` : quantité supérieure au stock, stock inchangé.
- `400 VALIDATION_ERROR` : quantité nulle, négative ou non entière.
- `404 PRODUCT_NOT_FOUND` : produit inconnu.

## 6. Sécurité déjà en place

- **Helmet** : en-têtes de sécurité, suppression de `X-Powered-By`.
- **CORS restreint** : uniquement les origines de `CORS_ORIGINS`.
- **Rate limiting** : 100 requêtes / 15 min / IP.
- **Limite de corps** : 100 kb (413 au-delà).
- **Validation stricte Zod** : body, params et query ; champs inconnus refusés.
- **Secrets hors du code** : `.env` ignoré par Git, `.env.example` commité.
- **Erreurs propres** : jamais de pile d'erreur dans la réponse HTTP.
- **UUID** : identifiants non devinables.

## 7. Variables d'environnement

| Variable       | Défaut                  | Rôle                                      |
| -------------- | ----------------------- | ----------------------------------------- |
| `NODE_ENV`     | `development`           | `development`, `test` ou `production`     |
| `PORT`         | `3000`                  | port HTTP                                 |
| `CORS_ORIGINS` | `http://localhost:5173` | origines autorisées, séparées par virgules |

## 8. Corrigés des exercices

| Exercice | Sujet                                   | Où regarder                                                        |
| -------- | --------------------------------------- | ------------------------------------------------------------------ |
| 1.A      | Concevoir les routes d'une livraison    | [CORRECTIONS.md § 1](./CORRECTIONS.md#1-exercice-1a)              |
| 2.A      | Ordre d'exécution de la boucle          | `exercices/ordre.js` + [CORRECTIONS.md § 2](./CORRECTIONS.md#2-exercice-2a) |
| 2.B      | Voir le blocage de la boucle            | `exercices/blocage.js` + [CORRECTIONS.md § 3](./CORRECTIONS.md#3-exercice-2b) |
| 4.1      | Middleware de journalisation            | `src/middlewares/logger.js`                                        |
| 4.2      | Filtres `minPrice`, `maxPrice`, `sort`  | `src/schemas/product.schema.js` + `src/services/products.service.js` |
| 4.3      | Vente et décrémentation du stock        | route `POST /:id/sales`                                            |
| 4.4      | Attaques puis réparations               | `scripts/attaques.sh` + [CORRECTIONS.md § 7](./CORRECTIONS.md#7-exercice-44) |

## 9. Notes

- Les données sont **en mémoire** (une `Map`) : elles disparaissent au redémarrage. C'est voulu
  pour la séance 1 ; PostgreSQL arrive à la séance 2.
- Le projet cible Node.js 24 LTS. Sur Node.js 22, `npm install` affiche un avertissement
  `EBADENGINE` mais tout fonctionne (les 22 tests passent).
- Le serveur écoute par défaut sur le port 3000. Si ce port est déjà pris, changez `PORT`
  dans `.env`.
