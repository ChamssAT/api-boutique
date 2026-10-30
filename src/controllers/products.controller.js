// =============================================================================
// src/controllers/products.controller.js — la couche HTTP
// -----------------------------------------------------------------------------
// Un contrôleur fait UNE chose : traduire une requête HTTP en appel métier,
// puis traduire le résultat en réponse HTTP.
//
// Interdit ici : les règles métier (stock suffisant, calcul de prix, droits).
// Elles vivent dans le service. Le contrôleur reste mince et lisible.
// =============================================================================
import * as service from '../services/products.service.js';

// GET /api/v1/products
export const list = (req, res) => res.json(service.list(req.validated.query));

// GET /api/v1/products/:id
export const getOne = (req, res) =>
  res.json({ data: service.getById(req.validated.params.id) });

// POST /api/v1/products
export const create = (req, res) => {
  const produit = service.create(req.validated.body);

  // 201 Created + en-tête Location qui pointe vers la ressource créée.
  res
    .status(201)
    .location(`/api/v1/products/${produit.id}`)
    .json({ data: produit });
};

// PATCH /api/v1/products/:id
export const update = (req, res) =>
  res.json({
    data: service.update(req.validated.params.id, req.validated.body),
  });

// DELETE /api/v1/products/:id
export const remove = (req, res) => {
  service.remove(req.validated.params.id);

  // 204 : succès, pas de corps à renvoyer.
  res.status(204).end();
};

// POST /api/v1/products/:id/sales — Exercice 4.3
// Le contrôleur ne vérifie pas le stock : il délègue au service.
export const sell = (req, res) =>
  res.json({
    data: service.sell(req.validated.params.id, req.validated.body.quantity),
  });
