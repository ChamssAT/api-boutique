// =============================================================================
// src/config/env.js — configuration validée au démarrage
// -----------------------------------------------------------------------------
// On lit process.env UNE seule fois, au tout début. Si une variable manque ou
// n'a pas le bon type, on préfère planter tout de suite avec un message clair,
// plutôt que de découvrir le problème trois jours plus tard en production.
// =============================================================================
import { z } from 'zod';

// Le schéma décrit exactement ce que l'application attend.
const schema = z.object({
  // Trois environnements possibles, "development" par défaut.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // z.coerce.number() transforme "3000" (texte) en 3000 (nombre).
  PORT: z.coerce.number().int().positive().default(3000),

  // Liste d'origines autorisées pour CORS, séparées par des virgules.
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

// safeParse ne jette pas : on décide nous-mêmes quoi faire de l'erreur.
if (!parsed.success) {
  console.error('Configuration invalide :', parsed.error.issues);
  process.exit(1); // échouer vite plutôt que tourner mal configuré
}

export const env = Object.freeze({
  ...parsed.data,

  // On transforme "http://a,http://b" en tableau propre pour le middleware CORS.
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origine) => origine.trim()),
});
