// =============================================================================
// src/middlewares/error-handler.js — gestion centralisée des erreurs
// -----------------------------------------------------------------------------
// Toutes les erreurs de l'application finissent ici. Un seul format de réponse
// d'erreur pour toute l'API :
//
//   { "error": { "code": "...", "message": "...", "details": [...] } }
//
// Le client reçoit un code stable et un message propre. La pile d'erreur reste
// dans les logs du serveur, jamais dans la réponse HTTP.
// =============================================================================
import { AppError } from '../utils/app-error.js';

// Route inconnue : on construit une AppError 404 et on la passe à errorHandler.
export function notFound(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} introuvable`));
}

// Attention : Express reconnaît un gestionnaire d'erreurs grâce à ses
// QUATRE paramètres (err, req, res, next). Si on retire "next", il devient un
// middleware normal et ne reçoit plus les erreurs. C'est un piège classique.
export function errorHandler(err, req, res, next) {
  // Si les en-têtes sont déjà partis, on ne peut plus changer le statut :
  // on laisse Express terminer la réponse proprement.
  if (res.headersSent) return next(err);

  // Deux erreurs techniques d'Express qu'on traduit en erreurs maison.
  if (err.type === 'entity.parse.failed') {
    err = new AppError(400, 'INVALID_JSON', 'Corps JSON invalide');
  }
  if (err.type === 'entity.too.large') {
    err = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Corps trop volumineux');
  }

  // Une erreur "connue" est une erreur qu'on a levée volontairement.
  const known = err instanceof AppError;
  if (!known) console.error(err); // trace complète : logs serveur uniquement

  res.status(known ? err.statusCode : 500).json({
    error: {
      code: known ? err.code : 'INTERNAL_ERROR',
      message: known ? err.message : 'Une erreur interne est survenue',
      // On n'ajoute "details" que s'il y en a, pour ne pas polluer la réponse.
      ...(known && err.details ? { details: err.details } : {}),
    },
  });
}
