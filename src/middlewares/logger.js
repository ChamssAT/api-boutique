// =============================================================================
// src/middlewares/logger.js — Exercice 4.1
// -----------------------------------------------------------------------------
// Une ligne par requête : méthode, URL, code de statut, durée en millisecondes.
// Exemple : GET /api/v1/products 200 4.2ms
//
// Point clé : au moment où le middleware démarre, on ne connaît pas encore le
// code de statut. On écoute donc l'événement "finish" de la réponse, qui est
// émis quand la réponse a été entièrement envoyée au client.
// =============================================================================
export function requestLogger(req, res, next) {
  const start = performance.now();

  res.on('finish', () => {
    const duree = (performance.now() - start).toFixed(1);

    // En production, on remplace console.log par un logger structuré JSON
    // (Pino, par exemple) pour pouvoir filtrer et alerter.
    // Règle d'or : jamais de mot de passe, de token ni de téléphone en clair
    // dans les logs.
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duree}ms`);
  });

  // On rend la main tout de suite : le reste de la chaîne s'exécute normalement.
  next();
}
