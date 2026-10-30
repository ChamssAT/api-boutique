// =============================================================================
// exercices/ordre.js — Exercice 2.A (corrigé et commenté)
// -----------------------------------------------------------------------------
// Question : dans quel ordre ces lignes s'affichent-elles ?
//
// Réponse attendue : 1, 5, 4, 3, 2
//
// Le déroulé exact :
//   1. "1. début"          -> code synchrone, exécuté immédiatement
//   2. "5. fin"            -> toujours synchrone, donc juste après
//   3. "4. nextTick"       -> file nextTick, vidée avant les microtâches
//   4. "3. promesse"       -> microtâche (le .then d'une promesse résolue)
//   5. "2. timeout"        -> timer, même avec un délai de 0 ms
//
// À retenir : setTimeout(..., 0) ne veut PAS dire "tout de suite".
// Une promesse déjà résolue passe toujours avant un timer.
//
// Lancement : node exercices/ordre.js
// =============================================================================

console.log('1. début');

setTimeout(() => console.log('2. timeout'), 0);

Promise.resolve().then(() => console.log('3. promesse'));

process.nextTick(() => console.log('4. nextTick'));

console.log('5. fin');
