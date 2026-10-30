// =============================================================================
// src/schemas/product.schema.js — les contrats de validation (Zod 4)
// -----------------------------------------------------------------------------
// Toute entrée qui vient du client passe par un de ces schémas :
//   body   -> createProductSchema / updateProductSchema / saleSchema
//   params -> idParamSchema
//   query  -> listQuerySchema
//
// Zod valide ET nettoie : "  Mil  " devient "Mil", "12" devient 12.
// =============================================================================
import { z } from 'zod';

// Liste unique des catégories autorisées. Une seule source de vérité.
export const CATEGORIES = ['cereales', 'legumes', 'fruits', 'boissons'];

// -----------------------------------------------------------------------------
// Petit helper pour les nombres passés dans la query string
// -----------------------------------------------------------------------------
// Dans une URL, tout est du texte : ?minPrice=10000 arrive sous la forme "10000".
// On accepte uniquement des chiffres :
//   - "abc" -> 400
//   - ""    -> 400 (z.coerce.number() transformerait "" en 0, ce qui est piégeux)
//   - "1.5" -> 400 (pas d'entier)
//   - "10"  -> 10
// Le .optional() doit rester en dernier : si le paramètre est absent, Zod
// s'arrête là et renvoie undefined sans valider le reste.
const optionalPositiveInt = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Nombre entier positif attendu')
  .transform(Number)
  .optional();

// -----------------------------------------------------------------------------
// Création d'un produit
// -----------------------------------------------------------------------------
// z.strictObject rejette les champs inconnus : c'est notre protection contre
// le mass assignment. Un client qui ajoute "role": "admin" ou "id": "..." au
// corps reçoit une 400 au lieu de voir son champ ignoré silencieusement.
export const createProductSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  // Prix en FCFA : entier, jamais négatif, plafonné pour éviter les absurdités.
  price: z.number().int().nonnegative().max(100_000_000),
  category: z.enum(CATEGORIES),
  stock: z.number().int().min(0),
});

// PATCH : tous les champs deviennent optionnels, mais restent stricts.
export const updateProductSchema = createProductSchema.partial();

// L'id doit être un UUID valide, sinon 400 avant même d'atteindre le service.
export const idParamSchema = z.object({ id: z.uuid() });

// -----------------------------------------------------------------------------
// Query de la liste (Exercice 4.2)
// -----------------------------------------------------------------------------
export const listQuerySchema = z
  .object({
    category: z.enum(CATEGORIES).optional(),
    minPrice: optionalPositiveInt,
    maxPrice: optionalPositiveInt,
    sort: z.enum(['price', '-price']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    // max(100) : personne ne peut demander un million de lignes d'un coup.
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  // Règle transversale : minPrice doit être <= maxPrice.
  // .refine() s'applique à l'objet complet, pas à un champ isolé.
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

// -----------------------------------------------------------------------------
// Exercice 4.3 — corps de la vente
// -----------------------------------------------------------------------------
// Entier strictement positif : 0, -2, 1.5 et "3" sont refusés (400).
export const saleSchema = z.strictObject({
  quantity: z.number().int().positive().max(1_000_000),
});
