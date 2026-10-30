// =============================================================================
// src/app.js — on CONSTRUIT l'application, on ne la démarre pas
// -----------------------------------------------------------------------------
// Pourquoi séparer app.js et server.js ?
//   - app.js renvoie une application Express testable (supertest, node:test) ;
//   - server.js ouvre un vrai port et gère l'arrêt propre.
// Ainsi, un test peut démarrer l'app sur un port libre (listen(0)) sans
// dépendre du port 3000 ni d'un serveur déjà lancé.
//
// L'ORDRE des middlewares compte : Express les exécute de haut en bas.
// =============================================================================
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import productsRouter from './routes/products.routes.js';
import { requestLogger } from './middlewares/logger.js';
import { notFound, errorHandler } from './middlewares/error-handler.js';

export function createApp() {
  const app = express();

  // Derrière un reverse proxy (Nginx, Render, Railway...), on fait confiance
  // à UN seul niveau de proxy pour récupérer la vraie IP du client.
  // Ne JAMAIS l'activer en local : l'IP deviendrait falsifiable.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  // 1. Le logger en premier : il voit TOUTES les requêtes, même celles qui
  //    seront rejetées plus bas (400, 404, 429...).
  app.use(requestLogger);

  // 2. Helmet : en-têtes de sécurité + suppression de X-Powered-By.
  app.use(helmet());

  // 3. CORS restreint : seules les origines déclarées dans .env peuvent
  //    appeler l'API depuis un navigateur. "origin: [...]" accepte une liste.
  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );

  // 4. Rate limiting AVANT le parseur JSON : inutile de dépenser du CPU à
  //    parser le corps d'un abuseur. 100 requêtes / 15 min / IP.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  // 5. Parseur JSON avec limite de taille. Un corps > 100 kb est refusé
  //    (413) par Express, avant même d'atteindre nos schémas Zod.
  app.use(express.json({ limit: '100kb' }));

  // 6. Les routes.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1/products', productsRouter);

  // 7. Toujours dans cet ordre : 404 puis gestionnaire d'erreurs, en dernier.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
