// =============================================================================
// test/products.test.js — tests automatisés avec node:test (zéro dépendance)
// -----------------------------------------------------------------------------
// On démarre l'application sur un port libre (listen(0)) : pas besoin d'un
// serveur déjà lancé, et les tests ne se marchent pas dessus.
//
// Lancement : npm test
// =============================================================================
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

let server;
let origin;
let base;

// -----------------------------------------------------------------------------
// Démarrage / arrêt du serveur de test
// -----------------------------------------------------------------------------
before(async () => {
  server = createApp().listen(0); // 0 = le système choisit un port libre
  await new Promise((resolve) => server.once('listening', resolve));

  origin = `http://localhost:${server.address().port}`;
  base = `${origin}/api/v1/products`;
});

after(async () => {
  // On ferme les connexions keep-alive de fetch, sinon close() peut attendre.
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((erreur) => (erreur ? reject(erreur) : resolve()));
  });
});

// -----------------------------------------------------------------------------
// Petits helpers pour éviter de répéter fetch + JSON.stringify
// -----------------------------------------------------------------------------
const request = (url, options = {}) => fetch(url, options);

const postJson = (url, body) =>
  request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const patchJson = (url, body) =>
  request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Produit valide de base ; chaque test peut surcharger un champ.
const produitValide = (overrides = {}) => ({
  name: 'Mil 50 kg',
  price: 22000,
  category: 'cereales',
  stock: 12,
  ...overrides,
});

// =============================================================================
// Création
// =============================================================================
test('crée un produit valide → 201 + Location + id UUID', async () => {
  const res = await postJson(base, produitValide());

  assert.equal(res.status, 201);
  assert.match(
    res.headers.get('location'),
    /^\/api\/v1\/products\/[0-9a-f-]{36}$/,
  );

  const { data } = await res.json();
  assert.match(data.id, /^[0-9a-f-]{36}$/);
  assert.equal(data.name, 'Mil 50 kg');
  assert.equal(data.stock, 12);
});

test('refuse un prix négatif → 400 VALIDATION_ERROR', async () => {
  const res = await postJson(base, produitValide({ price: -5 }));

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('refuse un champ inconnu (mass assignment) → 400', async () => {
  const res = await postJson(base, {
    ...produitValide({ name: 'Test' }),
    role: 'admin',
    id: 'id-impose-par-le-client',
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.some((d) => d.field === 'role'));
});

// =============================================================================
// Lecture
// =============================================================================
test('refuse un identifiant non UUID → 400', async () => {
  const res = await request(`${base}/123`);

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('produit inconnu (UUID valide) → 404 PRODUCT_NOT_FOUND', async () => {
  const res = await request(`${base}/00000000-0000-4000-8000-000000000000`);

  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'PRODUCT_NOT_FOUND');
});

// =============================================================================
// Exercice 4.2 — filtres, tri, pagination
// =============================================================================
test('filtre minPrice/maxPrice et trie par prix décroissant', async () => {
  // Prix très élevés et uniques pour ne pas être pollués par les autres tests.
  const prix = [9_000_001, 9_000_003, 9_000_002];

  for (const price of prix) {
    const res = await postJson(
      base,
      produitValide({ name: `Produit ${price}`, price, category: 'legumes' }),
    );
    assert.equal(res.status, 201);
  }

  const res = await request(
    `${base}?minPrice=9000001&maxPrice=9000003&sort=-price`,
  );

  assert.equal(res.status, 200);
  const { data, meta } = await res.json();

  assert.deepEqual(
    data.map((produit) => produit.price),
    [9_000_003, 9_000_002, 9_000_001],
  );
  assert.equal(meta.total, 3);
});

test('refuse minPrice non numérique → 400', async () => {
  const res = await request(`${base}?minPrice=abc`);

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('refuse minPrice > maxPrice → 400 avec message explicite', async () => {
  const res = await request(`${base}?minPrice=50000&maxPrice=10000`);

  assert.equal(res.status, 400);
  const body = await res.json();

  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(
    body.error.details.some((d) => d.message.includes('minPrice')),
    'le détail doit pointer sur minPrice',
  );
});

test('refuse un paramètre vide (?minPrice=) → 400', async () => {
  const res = await request(`${base}?minPrice=`);

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

// =============================================================================
// Exercice 4.3 — vente et décrémentation du stock
// =============================================================================
test('vente valide → 200 et stock décrémenté', async () => {
  const creation = await postJson(
    base,
    produitValide({ name: 'Bouteille de gaz 12 kg', stock: 5 }),
  );
  const { data: produit } = await creation.json();

  const res = await postJson(`${base}/${produit.id}/sales`, { quantity: 3 });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.stock, 2);

  // On vérifie aussi que la valeur est bien persistée.
  const relu = await (await request(`${base}/${produit.id}`)).json();
  assert.equal(relu.data.stock, 2);
});

test('vente supérieure au stock → 409 INSUFFICIENT_STOCK, stock inchangé', async () => {
  const creation = await postJson(
    base,
    produitValide({ name: 'Sac de riz 25 kg', stock: 2 }),
  );
  const { data: produit } = await creation.json();

  const res = await postJson(`${base}/${produit.id}/sales`, { quantity: 3 });

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(body.error.details.available, 2);

  const relu = await (await request(`${base}/${produit.id}`)).json();
  assert.equal(relu.data.stock, 2); // aucune vente partielle
});

test('vente avec quantité 0 ou négative → 400', async () => {
  const creation = await postJson(base, produitValide({ name: 'Huile 5 L' }));
  const { data: produit } = await creation.json();

  for (const quantity of [0, -1]) {
    const res = await postJson(`${base}/${produit.id}/sales`, { quantity });
    assert.equal(res.status, 400, `quantity=${quantity} doit être refusée`);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
  }
});

test('vente avec quantité non entière → 400', async () => {
  const creation = await postJson(base, produitValide({ name: 'Sucre 1 kg' }));
  const { data: produit } = await creation.json();

  const res = await postJson(`${base}/${produit.id}/sales`, { quantity: 1.5 });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('vente sur un produit inconnu → 404', async () => {
  const res = await postJson(
    `${base}/00000000-0000-4000-8000-000000000000/sales`,
    { quantity: 1 },
  );

  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'PRODUCT_NOT_FOUND');
});

// =============================================================================
// Mise à jour et suppression
// =============================================================================
test('met à jour partiellement un produit (PATCH) → 200', async () => {
  const creation = await postJson(
    base,
    produitValide({ name: 'Café 500 g', price: 3000 }),
  );
  const { data: produit } = await creation.json();

  const res = await patchJson(`${base}/${produit.id}`, { price: 3500 });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.price, 3500);
  assert.equal(body.data.name, 'Café 500 g'); // le reste n'a pas bougé
});

test('supprime un produit → 204 puis 404', async () => {
  const creation = await postJson(
    base,
    produitValide({ name: 'Thé vert 250 g' }),
  );
  const { data: produit } = await creation.json();

  const suppression = await request(`${base}/${produit.id}`, {
    method: 'DELETE',
  });

  assert.equal(suppression.status, 204);
  assert.equal(await suppression.text(), ''); // 204 = pas de corps

  const relecture = await request(`${base}/${produit.id}`);
  assert.equal(relecture.status, 404);
});

// =============================================================================
// Exercice 4.4 — sécurité
// =============================================================================
test('JSON cassé → 400 INVALID_JSON', async () => {
  const res = await request(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ "name": "oubli d\'accolade"',
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});

test('corps géant (> 100 kb) → 413 PAYLOAD_TOO_LARGE', async () => {
  const res = await postJson(
    base,
    produitValide({ name: 'a'.repeat(200_000) }),
  );

  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('Helmet supprime l’en-tête X-Powered-By', async () => {
  const res = await request(`${origin}/health`);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('une 500 ne fuit jamais la pile d’erreur', async () => {
  // Petite application isolée : on teste le gestionnaire d'erreurs sans
  // ajouter une route "boom" dans le vrai code de production.
  const boomApp = express();
  boomApp.get('/boom', () => {
    throw new Error('boom secret interne');
  });
  boomApp.use(errorHandler);

  const boomServer = boomApp.listen(0);
  await new Promise((resolve) => boomServer.once('listening', resolve));

  const originalError = console.error;
  console.error = () => {}; // on coupe la trace dans la sortie des tests

  try {
    const res = await fetch(
      `http://localhost:${boomServer.address().port}/boom`,
    );

    assert.equal(res.status, 500);
    const body = await res.json();

    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.equal(body.error.message, 'Une erreur interne est survenue');
    assert.ok(!JSON.stringify(body).includes('boom secret interne'));
    assert.equal(body.error.stack, undefined);
  } finally {
    console.error = originalError;
    boomServer.closeAllConnections?.();
    await new Promise((resolve) => boomServer.close(resolve));
  }
});

test('route inconnue → 404 ROUTE_NOT_FOUND', async () => {
  const res = await request(`${origin}/api/v1/inconnu`);

  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'ROUTE_NOT_FOUND');
});

// =============================================================================
// Exercice 4.1 — le logger écrit exactement une ligne
// =============================================================================
test('le logger écrit une ligne par requête', async () => {
  const lignes = [];
  const originalLog = console.log;
  console.log = (...args) => lignes.push(args.join(' '));

  try {
    await request(`${base}?limit=1`);
    // On laisse l'événement "finish" se propager avant de vérifier.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = originalLog;
  }

  assert.equal(lignes.length, 1);
  assert.match(
    lignes[0],
    /^GET \/api\/v1\/products\?limit=1 200 \d+\.\dms$/,
  );
});
