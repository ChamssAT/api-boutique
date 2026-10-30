// =============================================================================
// exercices/blocage.js — Exercice 2.B (corrigé et commenté)
// -----------------------------------------------------------------------------
// But : voir de ses yeux ce qui se passe quand on bloque la boucle d'événements.
//
// Lancement :
//   Terminal 1 : node exercices/blocage.js
//   Terminal 2 : curl localhost:3000/lent
//   Terminal 3 : curl localhost:3000/       <-- attend ~5 s !
//
// La route "/" est "rapide", mais elle attend quand même 5 secondes parce que
// le handler de "/lent" monopolise le seul thread JavaScript. Toutes les
// requêtes de tous les utilisateurs sont bloquées.
//
// En production, on ne fait JAMAIS de calcul lourd ni de fs.readFileSync dans
// un handler. On utilise une version async, un worker thread, ou une file de
// traitement (BullMQ, etc.).
// =============================================================================
import http from 'node:http';

http
  .createServer((req, res) => {
    if (req.url === '/lent') {
      const fin = Date.now() + 5000;

      // Boucle de calcul synchrone : le thread JS tourne à vide pendant 5 s
      // et ne peut répondre à aucune autre requête pendant ce temps.
      while (Date.now() < fin) {
        // on tourne à vide exprès
      }

      return res.end('fini\n');
    }

    res.end('rapide\n');
  })
  .listen(3000, () => console.log('http://localhost:3000'));
