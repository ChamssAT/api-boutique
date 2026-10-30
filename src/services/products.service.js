// =============================================================================
// src/services/products.service.js — la couche métier
// -----------------------------------------------------------------------------
// Règle importante : ici, AUCUNE notion de req/res, aucun import d'Express.
// Le service ne sait pas qu'il est appelé par HTTP. On peut donc le réutiliser
// dans un test, un script de migration ou un job planifié.
//
// Les données sont en mémoire pour la séance 1. À la séance 2, on remplace la
// Map par PostgreSQL sans toucher aux routes ni aux contrôleurs.
// =============================================================================
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/app-error.js';

// Map<id, produit> : accès rapide par identifiant.
const products = new Map();

// -----------------------------------------------------------------------------
// Lister les produits, avec filtres, tri et pagination (Exercice 4.2)
// -----------------------------------------------------------------------------
// @param {object} options
// @param {string} [options.category]  filtre par catégorie
// @param {number} [options.minPrice]  prix minimum (FCFA)
// @param {number} [options.maxPrice]  prix maximum (FCFA)
// @param {'price'|'-price'} [options.sort] tri croissant ou décroissant
// @param {number} options.page         page demandée (commence à 1)
// @param {number} options.limit        nombre maximum de résultats
export function list({ category, minPrice, maxPrice, sort, page, limit }) {
  // On travaille sur une copie : on ne veut pas trier la Map d'origine.
  let items = [...products.values()];

  // --- Les filtres ---------------------------------------------------------
  if (category) {
    items = items.filter((produit) => produit.category === category);
  }

  // minPrice/maxPrice valent undefined quand ils ne sont pas fournis.
  // Attention : 0 est une valeur valide, donc on teste "!== undefined",
  // pas "if (minPrice)".
  if (minPrice !== undefined) {
    items = items.filter((produit) => produit.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    items = items.filter((produit) => produit.price <= maxPrice);
  }

  // --- Le tri (AVANT la pagination, sinon on trie seulement la page) ------
  if (sort === 'price') {
    items.sort((a, b) => a.price - b.price);
  } else if (sort === '-price') {
    items.sort((a, b) => b.price - a.price);
  }

  // --- La pagination -------------------------------------------------------
  const total = items.length;
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return { data, meta: { total, page, limit } };
}

// -----------------------------------------------------------------------------
// Récupérer un produit par son id, ou lever une 404
// -----------------------------------------------------------------------------
export function getById(id) {
  const produit = products.get(id);

  if (!produit) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable');
  }

  return produit;
}

// -----------------------------------------------------------------------------
// Créer un produit
// -----------------------------------------------------------------------------
// Les champs sont déjà validés et nettoyés par Zod : on peut faire confiance
// à "input". On ajoute nous-mêmes l'id et les dates, jamais le client.
export function create(input) {
  const maintenant = new Date().toISOString();

  const produit = {
    id: randomUUID(), // UUID : impossible à deviner en incrémentant l'URL
    ...input,
    createdAt: maintenant,
    updatedAt: maintenant,
  };

  products.set(produit.id, produit);
  return produit;
}

// -----------------------------------------------------------------------------
// Modifier partiellement un produit (PATCH)
// -----------------------------------------------------------------------------
export function update(id, changes) {
  // getById lève une 404 si le produit n'existe pas.
  const produit = getById(id);

  const misAJour = {
    ...produit,
    ...changes,
    // On réécrit updatedAt APRÈS le spread : un client ne doit pas pouvoir
    // imposer sa propre date (le schéma strict le bloque déjà, mais on assure).
    updatedAt: new Date().toISOString(),
  };

  products.set(id, misAJour);
  return misAJour;
}

// -----------------------------------------------------------------------------
// Supprimer un produit
// -----------------------------------------------------------------------------
export function remove(id) {
  getById(id); // lève une 404 si absent, avant toute suppression
  products.delete(id);
}

// -----------------------------------------------------------------------------
// Exercice 4.3 — vendre une quantité et décrémenter le stock
// -----------------------------------------------------------------------------
// La règle métier vit ICI, pas dans le contrôleur :
//   - quantité déjà validée par Zod (entier > 0) ;
//   - stock suffisant ? sinon 409 Conflict ;
//   - on renvoie le produit mis à jour.
//
// Pourquoi 409 et pas 400 ?
//   La requête est bien formée (quantity: 3 est valide). C'est l'ÉTAT de la
//   ressource (stock = 2) qui empêche l'opération. 409 = conflit d'état.
//
// Note pour la suite : en mémoire et sur un seul thread, deux ventes ne peuvent
// pas s'exécuter en même temps. Avec PostgreSQL, il faudra une transaction et
// un verrou (SELECT ... FOR UPDATE) ou un UPDATE conditionnel :
//   UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1;
export function sell(id, quantity) {
  const produit = getById(id);

  if (quantity > produit.stock) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Stock insuffisant : il reste ${produit.stock} unité(s)`,
      { available: produit.stock, requested: quantity },
    );
  }

  const misAJour = {
    ...produit,
    stock: produit.stock - quantity,
    updatedAt: new Date().toISOString(),
  };

  products.set(id, misAJour);
  return misAJour;
}
