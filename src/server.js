// =============================================================================
// src/server.js — démarrage du serveur HTTP
// -----------------------------------------------------------------------------
// Ce fichier est le seul à ouvrir un port. Il gère aussi l'arrêt propre :
// on laisse finir les requêtes en cours avant de quitter le processus.
// =============================================================================
import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createApp().listen(env.PORT, () => {
  console.log(`API prête sur http://localhost:${env.PORT}`);
});

// Arrêt propre (déploiements sans coupure : Kubernetes, Render, Railway...).
// SIGTERM est envoyé par l'hébergeur, SIGINT par Ctrl+C.
const shutdown = (signal) => {
  console.log(`${signal} reçu, arrêt en cours…`);

  // On n'accepte plus de nouvelles connexions, on finit les requêtes en cours.
  server.close(() => process.exit(0));

  // Filet de sécurité : si une connexion reste bloquée, on force la sortie
  // au bout de 10 secondes. .unref() évite que ce timer maintienne le process
  // en vie tout seul.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
