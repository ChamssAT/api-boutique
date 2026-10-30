// =============================================================================
// src/utils/app-error.js — une erreur métier typée
// -----------------------------------------------------------------------------
// AppError transporte trois choses :
//   - un code HTTP (404, 409, 400...) ;
//   - un code stable pour le frontend ("PRODUCT_NOT_FOUND", "INSUFFICIENT_STOCK") ;
//   - un message lisible par un humain, et éventuellement des détails.
//
// Le frontend doit se baser sur error.code, JAMAIS sur le texte du message
// (le texte peut changer, être traduit, ou être reformulé).
// =============================================================================
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code; // code stable, exploitable par le frontend
    this.details = details; // ex. liste des champs invalides
  }
}
