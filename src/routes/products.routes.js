// =============================================================================
// src/routes/products.routes.js — le plan de l'API
// -----------------------------------------------------------------------------
// Une route = une URL + une méthode + une pile de middlewares.
// Ordre de lecture : validation du body/params/query, puis contrôleur.
// =============================================================================
import { Router } from 'express';
import * as ctrl from '../controllers/products.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  idParamSchema,
  listQuerySchema,
  saleSchema,
} from '../schemas/product.schema.js';

const router = Router();

// On valide l'id UNE seule fois, puis on réutilise ce middleware sur toutes
// les routes qui contiennent /:id.
const byId = validate(idParamSchema, 'params');

// --- Collection --------------------------------------------------------------
router.get('/', validate(listQuerySchema, 'query'), ctrl.list);
router.post('/', validate(createProductSchema), ctrl.create);

// --- Ressource unique --------------------------------------------------------
router.get('/:id', byId, ctrl.getOne);
router.patch('/:id', byId, validate(updateProductSchema), ctrl.update);
router.delete('/:id', byId, ctrl.remove);

// --- Action métier (Exercice 4.3) -------------------------------------------
// POST car on crée une vente. L'URL reste un nom (sales), pas un verbe.
router.post('/:id/sales', byId, validate(saleSchema), ctrl.sell);

export default router;
