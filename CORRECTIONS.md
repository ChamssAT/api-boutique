# Séance 1 — Corrigé des exercices

**Introduction au Backend : HTTP, Node.js & première API Express**

---

> **Petite note avant de commencer.**
> J'ai écrit ce document comme je parle en cours : tutoiement, phrases courtes, et
> deux ou trois petites fautes de prononciation volontaires (« sa » au lieu de « ça »,
> « au temps » au lieu de « autant », « comme même »...). C'est fait exprès pour que
> sa reste vivant et pas coincé. **Le code, lui, est propre, commenté et testé** :
> `npm test` passe 22/22. Si tu recopies un truc, recopie le code, pas mes fautes 😄.

---

## Sommaire

1. [Exercice 1.A — Concevoir sans coder](#1-exercice-1a--concevoir-sans-coder)
2. [Exercice 2.A — Ordre d'affichage](#2-exercice-2a--ordre-daffichage)
3. [Exercice 2.B — Voir le blocage](#3-exercice-2b--voir-le-blocage)
4. [Exercice 4.1 — Middleware de journalisation](#4-exercice-41--middleware-de-journalisation)
5. [Exercice 4.2 — Route de recherche](#5-exercice-42--route-de-recherche)
6. [Exercice 4.3 — Décrémenter le stock](#6-exercice-43--décrémenter-le-stock)
7. [Exercice 4.4 — Sécurité : casser puis réparer](#7-exercice-44--sécurité--casser-puis-réparer)
8. [Quiz de sortie — réponses](#8-quiz-de-sortie--réponses)
9. [Checklist de code review](#9-checklist-de-code-review)
10. [Les pièges que j'ai corrigés](#10-les-pièges-que-jai-corrigés)
11. [Pour la séance 2](#11-pour-la-séance-2)

---

## 1. Exercice 1.A — Concevoir sans coder

**Énoncé :** application de livraison de gaz domestique. Écrire la table des routes
(méthode, URL, code de succès, code d'erreur principal) pour :

- lister les dépôts ;
- voir un dépôt ;
- commander une bouteille ;
- annuler une commande ;
- voir mes commandes.

### La table corrigée

| Méthode  | URL                     | Succès | Erreur principale                        | Rôle                          |
| -------- | ----------------------- | ------ | ---------------------------------------- | ----------------------------- |
| `GET`    | `/api/v1/depots`        | `200`  | `500` (bug serveur)                      | Lister les dépôts             |
| `GET`    | `/api/v1/depots/:id`    | `200`  | `404 DEPOT_NOT_FOUND`                    | Voir un dépôt                 |
| `POST`   | `/api/v1/orders`        | `201`  | `400` (corps invalide), `409` (rupture)  | Commander une bouteille       |
| `PATCH`  | `/api/v1/orders/:id`    | `200`  | `404`, `409 ORDER_ALREADY_CANCELLED`     | Annuler une commande          |
| `GET`    | `/api/v1/me/orders`     | `200`  | `401 UNAUTHORIZED`                       | Voir mes commandes            |

### Pourquoi ces choix ?

**1. Pas de verbe dans les URL.**
On écrit `/orders`, pas `/commanderBouteille` ni `/getDepots`. C'est la méthode HTTP
qui porte l'action : `GET` pour lire, `POST` pour créer, `PATCH` pour modifier,
`DELETE` pour supprimer.

**2. Des noms au pluriel.**
`/depots`, `/orders`. Une collection se nomme au pluriel ; un élément se retrouve
avec son identifiant : `/depots/:id`.

**3. `201` pour la création.**
`POST /orders` crée une ressource : on renvoie `201 Created` **et** un en-tête
`Location: /api/v1/orders/42` qui pointe vers la commande créée. `200` serait
toléré par certains, mais `201` est le code prévu par HTTP.

**4. L'annulation, c'est un changement d'état, pas une suppression.**
D'accord, on pourrait faire `DELETE /orders/:id`. Mais dans une vraie boutique, on
garde l'historique : une commande annulée reste une commande. Donc on fait plutôt :

```http
PATCH /api/v1/orders/42
Content-Type: application/json

{ "status": "cancelled" }
```

Réponse `200` avec la commande mise à jour.

**5. `409` et pas `404` pour une annulation impossible.**
La commande existe (donc pas `404`). Mais son état ne permet pas l'annulation :
elle est déjà livrée ou déjà annulée. C'est un **conflit d'état** → `409 Conflict`.
C'est exactement le critère de réussite de l'exercice.

**6. `401` pour « mes commandes ».**
`/me/orders` suppose un utilisateur authentifié. Sans token valide → `401
UNAUTHORIZED`. Si l'utilisateur est connecté mais demande la commande de quelqu'un
d'autre → `403 FORBIDDEN`.

**7. Un format d'erreur unique.**
Toutes les erreurs de l'API doivent ressembler à ça :

```json
{
  "error": {
    "code": "ORDER_ALREADY_CANCELLED",
    "message": "Cette commande est déjà annulée"
  }
}
```

Le frontend se base sur `error.code`, jamais sur le texte du message. Comme sa, si
demain on traduit les messages en anglais ou en haoussa, rien ne casse côté client.

### Exemple de corps pour la commande

```json
{
  "depotId": "3f1c9e2a-...",
  "productId": "bouteille-12kg",
  "quantity": 2
}
```

Le serveur revérifie **tout** : le dépôt existe, la bouteille est en stock, la
quantité est un entier positif, et surtout **le prix est recalculé côté serveur**.
On ne fait jamais confiance au prix envoyé par le navigateur.

---

## 2. Exercice 2.A — Ordre d'affichage

**Énoncé :** sans exécuter, prédire l'ordre des lignes, puis vérifier avec
`node ordre.js`.

### Réponse : `1, 5, 4, 3, 2`

```text
1. début
5. fin
4. nextTick
3. promesse
2. timeout
```

### Le code corrigé et commenté

```js
// exercices/ordre.js
// But : comprendre l'ordre dans lequel Node vide ses files d'exécution.

// 1) Tout ce qui est synchrone passe en premier.
console.log('1. début');

// 2) Un timer, même avec 0 ms, passe APRÈS les microtâches.
setTimeout(() => console.log('2. timeout'), 0);

// 3) Une promesse déjà résolue place son .then dans la file des microtâches.
Promise.resolve().then(() => console.log('3. promesse'));

// 4) process.nextTick : file spéciale, vidée AVANT les microtâches.
process.nextTick(() => console.log('4. nextTick'));

// 5) Toujours synchrone : exécuté avant de regarder les timers et les promesses.
console.log('5. fin');
```

> L'ordre d'écriture dans le fichier ne change rien au résultat : c'est la **file**
> qui décide, pas la ligne de code. Tu peux déplacer le `setTimeout` en bas, sa
> donnera toujours `1, 5, 4, 3, 2`.

### Pourquoi cet ordre ?

Node.js a une boucle d'événements avec plusieurs files :

1. **Le code synchrone** : tout ce qui n'est pas dans un callback. Il s'exécute
   jusqu'au bout, sans interruption. D'où `1` puis `5`.
2. **`process.nextTick`** : une file à part, vidée en priorité, avant les promesses.
   D'où `4` avant `3`.
3. **Les microtâches** (promesses) : les `.then`, `await`, `queueMicrotask`.
   D'où `3`.
4. **Les timers** (`setTimeout`, `setInterval`) : au tour suivant de la boucle.
   D'où `2`, même avec un délai de `0`.

**À retenir :** `setTimeout(..., 0)` ne veut pas dire « tout de suite ». Une promesse
déjà résolue passe toujours avant un timer. C'est pour sa que dans du code async,
`await` peut sembler passer « avant » un `setTimeout(0)`.

**Petite nuance :** `process.nextTick` passe avant les promesses, mais si tu mets un
`nextTick` **dans** un `nextTick`, il repasse encore avant les promesses. C'est une
file qui se vide complètement avant de passer à la suite. À ne pas abuser : trop de
`nextTick` peut affamer les timers et les I/O.

---

## 3. Exercice 2.B — Voir le blocage

**Énoncé :** deux terminaux, `curl localhost:3000/lent` puis tout de suite
`curl localhost:3000/`. Constater que la route « rapide » attend 5 secondes.

### Le code corrigé et commenté

```js
// exercices/blocage.js
// But : prouver qu'un seul handler bloquant bloque TOUTE l'API.

import http from 'node:http';

http
  .createServer((req, res) => {
    if (req.url === '/lent') {
      const fin = Date.now() + 5000;

      // Boucle de calcul synchrone : le thread JavaScript tourne à vide
      // pendant 5 secondes. Il ne peut répondre à AUCUNE autre requête.
      while (Date.now() < fin) {
        // on tourne à vide exprès
      }

      return res.end('fini\n');
    }

    // Route "rapide" : elle devrait répondre tout de suite...
    res.end('rapide\n');
  })
  .listen(3000, () => console.log('http://localhost:3000'));
```

### Le test

```bash
# Terminal 1
node exercices/blocage.js

# Terminal 2 : lance la requête lente
time curl localhost:3000/lent

# Terminal 3 : juste après, lance la rapide
time curl localhost:3000/
```

Résultat : la route `/` répond en **~5 secondes** alors qu'elle n'a aucun calcul.
Elle est coincée derrière `/lent`.

### Pourquoi ?

Node.js n'a **qu'un seul thread JavaScript**. La boucle `while` ne rend jamais la
main : pas d'`await`, pas de callback, rien. Donc libuv ne peut pas traiter les
autres requêtes, même si le réseau, lui, est prêt.

### Ce qu'il ne faut jamais faire dans un handler

| À éviter                                  | Pourquoi                                      | À la place                                      |
| ----------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `while` de calcul lourd                   | bloque tout                                   | worker thread, file de job, pagination          |
| `fs.readFileSync`                         | bloque le disque                              | `fs/promises` (`await readFile`)                |
| `bcrypt.hashSync`                         | bloque le CPU                                 | `await bcrypt.hash`                             |
| `JSON.parse` d'un fichier géant           | bloque le CPU et la mémoire                   | streaming, parser au fil de l'eau               |
| Regex mal écrite (ReDoS)                  | peut exploser en temps exponentiel            | regex simple, limiter la taille d'entrée        |

**Conclusion :** un seul handler bloquant ralentit **tous** les utilisateurs. C'est
pour sa que la règle « ne jamais bloquer la boucle » est la première règle de
performance en Node.js.

---

## 4. Exercice 4.1 — Middleware de journalisation

**Énoncé :** créer `src/middlewares/logger.js` qui affiche, pour chaque requête :
méthode, URL, code de statut et durée en millisecondes.

**Critère :** exactement une ligne par appel, avec le bon code (y compris 400 et 404).

### Le code corrigé et commenté

```js
// src/middlewares/logger.js

export function requestLogger(req, res, next) {
  // On mesure le temps au tout début.
  const start = performance.now();

  // Le code de statut n'est connu qu'À LA FIN de la réponse.
  // "finish" est émis quand la réponse a été entièrement envoyée au client.
  res.on('finish', () => {
    const duree = (performance.now() - start).toFixed(1);

    // Une seule ligne par requête.
    // En production : remplacer console.log par un logger JSON (Pino).
    // Et ne jamais logger mot de passe, token ou téléphone en clair.
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duree}ms`,
    );
  });

  // On rend la main tout de suite : la requête continue son chemin.
  next();
}
```

### Où le brancher ?

Dans `src/app.js`, **tout en haut** de `createApp()`, avant Helmet :

```js
export function createApp() {
  const app = express();

  // 1. Le logger voit TOUTES les requêtes, même celles rejetées plus bas.
  app.use(requestLogger);

  // 2. Puis la sécurité.
  app.use(helmet());

  // ... le reste
}
```

Pourquoi avant Helmet ? Pour logger aussi les requêtes que Helmet ou le rate
limiter vont rejeter. Si tu le mets après, tu rates justement les 429 et certaines
erreurs — donc les attaques.

### Vérification

```text
GET /api/v1/products 200 4.2ms
POST /api/v1/products 400 2.4ms
GET /api/v1/products/123 400 1.8ms
GET /api/v1/inconnu 404 1.2ms
```

**Une ligne, un appel.** Si tu vois deux lignes, c'est que le middleware est monté
deux fois (par exemple dans `app.js` **et** dans un routeur). Si tu vois zéro ligne,
c'est que `next()` manque : le middleware bloque la requête.

**En production :** `console.log` ne suffit pas. On utilise un logger structuré
(Pino, Winston) qui écrit du JSON, pour pouvoir filtrer par `statusCode`, alerter
sur les 500, et corréler avec un `requestId`. Et on **masque** les données sensibles.

---

## 5. Exercice 4.2 — Route de recherche

**Énoncé :** ajouter à `GET /api/v1/products` :

- `minPrice` et `maxPrice` (FCFA) ;
- un tri `sort` qui accepte `price` ou `-price`.

**Critères :**

- `?minPrice=10000&maxPrice=30000&sort=-price` → produits dans l'intervalle, du plus
  cher au moins cher ;
- `?minPrice=abc` → `400 VALIDATION_ERROR` ;
- `?minPrice=50000&maxPrice=10000` → `400` avec un message explicite.

### 1. Le schéma Zod corrigé et commenté

```js
// src/schemas/product.schema.js

// Dans une query string, tout arrive en texte ("10000", "abc", "").
// On accepte uniquement des chiffres :
//   "abc" -> 400
//   ""    -> 400
//   "1.5" -> 400
//   "10"  -> 10
const optionalPositiveInt = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Nombre entier positif attendu')
  .transform(Number)
  .optional(); // doit rester en dernier : paramètre absent -> undefined

export const listQuerySchema = z
  .object({
    category: z.enum(CATEGORIES).optional(),

    // Filtres de prix.
    minPrice: optionalPositiveInt,
    maxPrice: optionalPositiveInt,

    // Tri : "price" = croissant, "-price" = décroissant.
    sort: z.enum(['price', '-price']).optional(),

    // Pagination.
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  // Règle transversale : min <= max.
  // .refine() valide l'objet complet, pas un champ isolé.
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    {
      message: 'minPrice doit être inférieur ou égal à maxPrice',
      path: ['minPrice'], // le détail pointera sur le bon champ
    },
  );
```

### 2. Le service corrigé et commenté

```js
// src/services/products.service.js

export function list({ category, minPrice, maxPrice, sort, page, limit }) {
  // Copie : on ne trie pas la Map d'origine.
  let items = [...products.values()];

  // --- Filtres ---
  if (category) {
    items = items.filter((produit) => produit.category === category);
  }

  // Attention : 0 est une valeur valide, donc on teste "!== undefined",
  // et pas "if (minPrice)".
  if (minPrice !== undefined) {
    items = items.filter((produit) => produit.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    items = items.filter((produit) => produit.price <= maxPrice);
  }

  // --- Tri AVANT la pagination ---
  // Si on pagine d'abord, on trie seulement la page : résultat faux.
  if (sort === 'price') {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === '-price') {
    items.sort((a, b) => b.price - a.price);
  }

  // --- Pagination ---
  const total = items.length;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return { data, meta: { total, page, limit } };
}
```

### 3. Les routes

```js
// src/routes/products.routes.js

// On valide la query avant d'appeler le contrôleur.
router.get('/', validate(listQuerySchema, 'query'), ctrl.list);
```

Le contrôleur reste tout petit :

```js
// src/controllers/products.controller.js

// Aucune règle métier ici : le service fait le filtrage et le tri.
export const list = (req, res) => res.json(service.list(req.validated.query));
```

### 4. Vérifications

**Cas nominal :**

```http
GET /api/v1/products?minPrice=10000&maxPrice=30000&sort=-price
```

```json
{
  "data": [
    { "id": "...", "name": "Mil 50 kg", "price": 22000, "category": "cereales", "stock": 12 },
    { "id": "...", "name": "Riz 25 kg", "price": 17500, "category": "cereales", "stock": 4 }
  ],
  "meta": { "total": 2, "page": 1, "limit": 20 }
}
```

**Prix non numérique :**

```http
GET /api/v1/products?minPrice=abc
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides",
    "details": [
      { "field": "minPrice", "message": "Nombre entier positif attendu" }
    ]
  }
}
```

**Intervalle incohérent :**

```http
GET /api/v1/products?minPrice=50000&maxPrice=10000
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides",
    "details": [
      {
        "field": "minPrice",
        "message": "minPrice doit être inférieur ou égal à maxPrice"
      }
    ]
  }
}
```

**Pourquoi le tri est dans le service et pas dans le contrôleur ?**
Parce que c'est une règle métier : « comment on présente les produits ». Le
contrôleur ne doit pas savoir qu'on trie par prix. Demain, si on trie par
popularité ou par date, on modifie le service, pas la couche HTTP.

---

## 6. Exercice 4.3 — Décrémenter le stock

**Énoncé :** créer `POST /api/v1/products/:id/sales` avec le corps
`{ "quantity": 3 }`. La vente décrémente le stock et renvoie le produit mis à jour.

**Critères :**

- vente valide → `200`, stock diminué ;
- quantité > stock → `409 INSUFFICIENT_STOCK`, stock inchangé ;
- quantité ≤ 0 ou non entière → `400` ;
- produit inconnu → `404`.

### 1. Le schéma de la vente

```js
// src/schemas/product.schema.js

// Entier strictement positif : 0, -2, 1.5 et "3" sont refusés (400).
export const saleSchema = z.strictObject({
  quantity: z.number().int().positive().max(1_000_000),
});
```

### 2. La route

```js
// src/routes/products.routes.js

// POST car on crée une vente. "sales" est un nom, pas un verbe.
// byId valide l'UUID AVANT de valider le corps.
router.post('/:id/sales', byId, validate(saleSchema), ctrl.sell);
```

### 3. Le contrôleur

```js
// src/controllers/products.controller.js

// Le contrôleur ne vérifie PAS le stock : il délègue au service.
export const sell = (req, res) =>
  res.json({
    data: service.sell(req.validated.params.id, req.validated.body.quantity),
  });
```

### 4. Le service — la règle métier

```js
// src/services/products.service.js

export function sell(id, quantity) {
  // getById lève une 404 si le produit n'existe pas.
  const produit = getById(id);

  // Règle métier : on ne vend pas plus que le stock disponible.
  if (quantity > produit.stock) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Stock insuffisant : il reste ${produit.stock} unité(s)`,
      { available: produit.stock, requested: quantity },
    );
  }

  // On décrémente et on met à jour la date.
  const misAJour = {
    ...produit,
    stock: produit.stock - quantity,
    updatedAt: new Date().toISOString(),
  };

  products.set(id, misAJour);
  return misAJour;
}
```

### 5. Vérifications

| Scénario                              | Requête                                      | Réponse attendue                              |
| ------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Vente valide (stock 5, quantité 3)    | `POST /products/:id/sales` `{ "quantity": 3 }` | `200`, `data.stock = 2`                       |
| Quantité > stock (stock 2, quantité 3) | idem                                         | `409 INSUFFICIENT_STOCK`, stock toujours `2`  |
| Quantité 0                            | `{ "quantity": 0 }`                          | `400 VALIDATION_ERROR`                        |
| Quantité négative                     | `{ "quantity": -1 }`                         | `400 VALIDATION_ERROR`                        |
| Quantité non entière                  | `{ "quantity": 1.5 }`                        | `400 VALIDATION_ERROR`                        |
| Produit inconnu                       | UUID valide mais absent                      | `404 PRODUCT_NOT_FOUND`                       |

Exemple de réponse `200` :

```json
{
  "data": {
    "id": "9f2c...",
    "name": "Bouteille de gaz 12 kg",
    "price": 15000,
    "category": "boissons",
    "stock": 2,
    "createdAt": "2026-10-30T09:00:00.000Z",
    "updatedAt": "2026-10-30T09:05:00.000Z"
  }
}
```

Exemple de réponse `409` :

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock insuffisant : il reste 2 unité(s)",
    "details": { "available": 2, "requested": 3 }
  }
}
```

### 6. Pourquoi `409` et pas `400` ?

La requête est **bien formée** : `quantity: 3` est un entier positif valide. Ce
n'est pas la forme qui pose problème, c'est **l'état de la ressource** : le stock
est à 2. HTTP a un code exprès pour sa : `409 Conflict` = « la requête entre en
conflit avec l'état actuel de la ressource ». `400` voudrait dire « ta requête est
mal écrite », ce qui n'est pas le cas.

Règle simple :

- `400` = le client s'est trompé dans la forme ;
- `404` = la ressource n'existe pas ;
- `409` = la ressource existe, mais son état refuse l'opération.

### 7. Et si deux ventes arrivent en même temps ?

En mémoire, sur un seul thread, le service est synchrone : deux ventes ne peuvent
pas s'exécuter « en même temps ». Mais dès qu'on passe à PostgreSQL, deux requêtes
peuvent lire le même stock avant que l'une des deux écrive. Résultat : du stock
négatif.

Deux solutions côté base :

```sql
-- 1) UPDATE conditionnel atomique
UPDATE products
SET stock = stock - $1
WHERE id = $2 AND stock >= $1;
-- Si 0 ligne modifiée -> 409 INSUFFICIENT_STOCK
```

```sql
-- 2) Verrou explicite dans une transaction
BEGIN;
SELECT stock FROM products WHERE id = $1 FOR UPDATE;
-- vérifier, puis UPDATE
COMMIT;
```

C'est exactement le sujet des transactions à la séance 2.

---

## 7. Exercice 4.4 — Sécurité : casser puis réparer

**Énoncé :** en binôme, l'un attaque l'API de l'autre avec quatre requêtes et note
le code reçu. Tout autre résultat que celui attendu est un bug à corriger.

### Le tableau corrigé

| Attaque                | Requête                                                  | Résultat attendu                              | Résultat obtenu | Correctif en place                                   |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------- | --------------- | ---------------------------------------------------- |
| Mass assignment        | `POST` avec `"id"`, `"createdAt"` ou `"role"` en plus     | `400`                                         | `400`           | `z.strictObject` refuse les champs inconnus          |
| Corps géant            | `POST` avec un `name` de 200 000 caractères              | `413`                                         | `413`           | `express.json({ limit: '100kb' })`                   |
| Fuite d'informations   | Provoquer une `500` (`throw new Error('boom')`)          | Message générique, aucune pile                | `500` générique | `errorHandler` ne renvoie jamais `err.stack`         |
| Force brute            | 101 requêtes en moins de 15 min                          | `429` à partir de la 101ᵉ                     | `429`           | `express-rate-limit` : 100 / 15 min                  |

### 1. Mass assignment

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Attaque",
  "price": 100,
  "category": "fruits",
  "stock": 1,
  "role": "admin",
  "id": "id-impose"
}
```

Réponse :

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Données invalides",
    "details": [
      { "field": "role", "message": "Champ non autorisé" },
      { "field": "id", "message": "Champ non autorisé" }
    ]
  }
}
```

**Pourquoi c'est dangereux :** si on faisait `z.object()` sans strict, Zod
ignorerait `role` silencieusement. Si on faisait `products.set({ ...req.body })`
sans validation, le client pourrait imposer son propre `id` ou un rôle admin. Le
`strictObject` transforme cette tentative en erreur visible.

### 2. Corps géant

```bash
# 200 000 caractères = ~200 ko, au-dessus de la limite de 100 ko.
# On écrit le corps dans un fichier : un argument de 200 ko peut dépasser
# la limite ARG_MAX du shell ("Liste d'arguments trop longue").
{
  printf '{"name":"'
  head -c 200000 /dev/zero | tr '\0' 'a'
  printf '","price":100,"category":"fruits","stock":1}'
} > /tmp/corps-geant.json

curl -i -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/corps-geant.json
```

Réponse :

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Corps trop volumineux"
  }
}
```

**Pourquoi c'est dangereux :** sans limite, un attaquant envoie 100 Mo de JSON et
fait exploser la mémoire du serveur (déni de service). `express.json` coupe avant
même de parser.

### 3. Fuite d'informations

Pour tester, ajoute **temporairement** dans un handler :

```js
// ATTENTION : ligne de test à retirer après !
throw new Error('boom');
```

Puis :

```bash
curl -i http://localhost:3000/api/v1/products/00000000-0000-4000-8000-000000000000
```

Réponse attendue :

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Une erreur interne est survenue"
  }
}
```

La pile complète (`at ... /src/services/...`) doit apparaître **dans le terminal
du serveur**, jamais dans la réponse HTTP. Une pile d'erreur révèle les chemins de
fichiers, les versions, parfois des secrets.

**Dans les tests**, on vérifie sa sans toucher au code de production : on crée une
petite application Express isolée avec une route qui jette, et on branche
`errorHandler` dessus. C'est le test « une 500 ne fuit jamais la pile d'erreur ».

### 4. Force brute / rate limiting

```bash
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/products
done | sort | uniq -c
```

Résultat attendu (boucle lancée seule, sans appel avant) :

```text
    100 200
      5 429
```

Les chiffres exacts peuvent varier : le rate limiter compte **toutes** les requêtes
de l'IP sur 15 minutes, y compris celles que tu as faites avant (tests manuels,
`/health`, mass assignment...). Donc si tu as déjà fait 5 requêtes, le `429` tombe
vers la 96ᵉ de la boucle. Ce qui compte, c'est : **200 au début, 429 à la fin, et
pas de 500**.

**Pourquoi c'est dangereux :** sans limite, un attaquant teste des milliers de
mots de passe ou sature le serveur. Le rate limiting ne remplace pas un vrai
système d'authentification (JWT, semaine 7), mais il ralentit l'attaque.

### 5. En-tête `X-Powered-By`

```bash
curl -I http://localhost:3000/health
```

Aucune ligne `X-Powered-By` ne doit apparaître. Helmet le supprime par défaut. Cet
en-tête dit au monde « ce serveur tourne sur Express », ce qui aide un attaquant à
chercher des vulnérabilités connues.

### 6. Le script tout-en-un

```bash
# Terminal 1
npm run dev

# Terminal 2
./scripts/attaques.sh
```

Le script rejoue les attaques et affiche le code HTTP obtenu pour chacune. Il est
commenté, tu peux le lire ligne par ligne dans `scripts/attaques.sh`.

---

## 8. Quiz de sortie — réponses

| #   | Question                                                              | Réponse attendue                                                                                      |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Pourquoi revérifier côté serveur un prix déjà validé dans React ?      | Le client est modifiable (DevTools, requête forgée). On ne lui fait jamais confiance.                  |
| 2   | Quel code après un `POST` de création réussi, et quel en-tête ?        | `201 Created` + `Location: /api/v1/products/:id`.                                                     |
| 3   | Différence entre `401` et `403` ?                                      | `401` : pas authentifié (token absent/invalide). `403` : authentifié mais pas autorisé.                |
| 4   | Quelles méthodes sont idempotentes ?                                   | `GET`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`. `POST` ne l'est pas.                                       |
| 5   | Que se passe-t-il si un handler fait un calcul synchrone de 5 s ?      | Toute l'API est bloquée 5 s pour tous les utilisateurs (un seul thread JS).                            |
| 6   | Pourquoi séparer `app.js` et `server.js` ?                             | Pour tester l'application sans ouvrir un port fixe (`listen(0)`), et garder le démarrage à un seul endroit. |
| 7   | Qu'apporte Express 5 pour les fonctions async ?                        | Une promesse rejetée est transmise automatiquement au gestionnaire d'erreurs (plus de `try/catch` partout). |
| 8   | Citez deux protections contre les attaques de la chaîne npm.           | `package-lock.json` + `npm ci`, `npm audit`, vérifier le nom exact du paquet, `--ignore-scripts`.     |

**Score :** 6/8 minimum pour valider la séance. Les questions 3, 4 et 7 sont celles
qui tombent le plus souvent en entretien.

---

## 9. Checklist de code review

À cocher sur le dépôt avant de dire « c'est fini » :

- [x] `.env` absent du dépôt, `.env.example` présent
- [x] Aucune logique métier dans les routes ni les contrôleurs
- [x] Toutes les entrées (`body`, `params`, `query`) passent par un schéma Zod
- [x] Codes de statut corrects : `201` création, `204` suppression, `404`, `409`, `400`
- [x] Une erreur `500` ne renvoie aucune pile d'erreur au client
- [x] Helmet, CORS restreint, limite de corps et rate limiting actifs
- [x] `npm test` passe et `package-lock.json` est commité
- [x] `npm audit --omit=dev` ne remonte aucune vulnérabilité haute ou critique
- [x] Commits lisibles au format conventionnel (`feat:`, `fix:`, `test:`...)

Vérification rapide :

```bash
npm test
npm audit --omit=dev
git status --short
git log --oneline -5
```

---

## 10. Les pièges que j'ai corrigés

Par rapport au code du support, j'ai fait quelques ajustements. Ils sont petits,
mais ils évitent des bugs vicieux en production.

### 10.1 `?minPrice=` vide devenait `0`

Avec `z.coerce.number()`, une chaîne vide `""` est convertie en `0`. Donc
`?minPrice=` passait la validation et filtrait à partir de 0, au lieu de renvoyer
une erreur. J'ai remplacé par un helper qui accepte uniquement des chiffres :

```js
const optionalPositiveInt = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Nombre entier positif attendu')
  .transform(Number)
  .optional();
```

Résultat : `?minPrice=` → `400`, `?minPrice=abc` → `400`, `?minPrice=10` → `10`.

### 10.2 Les champs inconnus n'étaient pas bien détaillés

En Zod 4, une erreur `unrecognized_keys` a un `path` vide et une liste `keys`. Le
code du support renvoyait donc `field: "body"` au lieu du nom du champ refusé. J'ai
éclaté la liste pour avoir une entrée par champ :

```js
if (issue.code === 'unrecognized_keys') {
  return issue.keys.map((key) => ({
    field: key,
    message: 'Champ non autorisé',
  }));
}
```

Résultat : le frontend peut afficher « le champ `role` n'est pas autorisé » au bon
endroit.

### 10.3 Le tri doit passer avant la pagination

Si on pagine d'abord (`slice`) et qu'on trie ensuite, on trie seulement la page
courante. Le résultat est faux dès la page 2. Dans le service, l'ordre est :
filtres → tri → pagination.

### 10.4 Les tests pouvaient rester bloqués à la fin

`fetch` garde des connexions keep-alive ouvertes. `server.close()` attend alors
que ces connexions se ferment, et le test peut traîner. J'ai ajouté :

```js
after(async () => {
  server.closeAllConnections?.(); // ferme les connexions keep-alive
  await new Promise((resolve, reject) => {
    server.close((erreur) => (erreur ? reject(erreur) : resolve()));
  });
});
```

### 10.5 `req.query` est en lecture seule en Express 5

Impossible de faire `req.query.page = 2` : Express 5 renvoie un getter. D'où le
`req.validated` dans le middleware de validation. C'est aussi pour sa qu'on ne
réécrit jamais `req.query` directement.

### 10.6 Le rate limiter compte aussi `/health` et les tests manuels

Ce n'est pas un bug, mais il faut le savoir quand on lit le résultat de la boucle
de 105 requêtes : le `429` peut arriver avant la 101ᵉ si tu as déjà fait des
appels. Pour un test propre, redémarre l'API (le compteur en mémoire repart à
zéro) ou attends la fin de la fenêtre de 15 minutes.

### 10.7 `PATCH {}` est accepté

Aujourd'hui, un `PATCH` avec un corps vide renvoie `200` sans rien modifier. C'est
toléré, mais si tu veux être plus strict, ajoute :

```js
export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ à modifier est requis',
  });
```

Je ne l'ai pas mis par défaut pour rester proche de l'énoncé, mais c'est une
amélioration facile.

### 10.8 Node.js 24 vs Node.js 22

Le support cible Node.js 24 LTS. Ma machine de test tourne sur Node.js 22.23 :
`npm install` affiche un avertissement `EBADENGINE`, mais les 22 tests passent.
Si tu es sur Node.js 24, tu n'auras même pas l'avertissement. Utilise `fnm` ou
`nvm` et le fichier `.nvmrc` pour être aligné avec le reste de l'équipe.

---

## 11. Pour la séance 2

Le devoir complet est dans le support. Les trois choses à retenir :

1. **Finir les exercices 4.2 et 4.3 avec un test par critère** — c'est déjà fait
   ici, sers-toi des tests comme modèle.
2. **Ajouter une ressource `categories`** en respectant exactement la même
   architecture : `routes` → `controller` → `service` → `schema`.
3. **Installer PostgreSQL** (ou une base gratuite sur Neon/Supabase) : on remplace
   la `Map` en mémoire. Les routes ne changent pas, seul le service change.

Quand tu brancheras PostgreSQL, garde en tête les deux points de la section 6.7 :

- la vente doit être **atomique** (`UPDATE ... WHERE stock >= $1` ou transaction
  avec `FOR UPDATE`) ;
- les erreurs de base doivent être traduites en `AppError` (par exemple une
  violation de contrainte unique → `409 CONFLICT`).

Et surtout : **on ne met jamais la logique SQL dans le contrôleur**. Le service
reste le seul endroit qui connaît les règles métier.

---

## Bonus — lancer le projet en 30 secondes

```bash
npm ci
cp .env.example .env
npm run dev
```

Puis, dans un autre terminal :

```bash
curl http://localhost:3000/health
npm test
```

Si `npm test` affiche `# pass 22` et `# fail 0`, tout est bon. Bon courage pour la
suite, et n'oublie pas : **on ne fait jamais confiance au client** 😉
