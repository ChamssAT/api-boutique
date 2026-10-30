// =============================================================================
// src/middlewares/validate.js — validation centralisée des entrées
// -----------------------------------------------------------------------------
// Un seul middleware pour le body, les params et la query.
// En cas d'erreur, on lève une AppError 400 : la requête est mal formée.
// En cas de succès, on range les données propres dans req.validated.
//
// Pourquoi req.validated et pas req.body directement ?
//   - on garde les données brutes intactes ;
//   - en Express 5, req.query est en LECTURE SEULE, on ne peut donc pas le
//     réécrire avec les valeurs converties par Zod.
// =============================================================================
import { AppError } from '../utils/app-error.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);

  if (!result.success) {
    // On renvoie un détail par champ pour que le frontend puisse afficher les
    // erreurs au bon endroit dans le formulaire.
    //
    // Cas particulier : Zod signale les champs inconnus (mass assignment) avec
    // un seul problème et un chemin vide. On éclate la liste "keys" pour avoir
    // une entrée par champ refusé, plus facile à afficher côté client.
    const details = result.error.issues.flatMap((issue) => {
      if (issue.code === 'unrecognized_keys') {
        return issue.keys.map((key) => ({
          field: key,
          message: 'Champ non autorisé',
        }));
      }

      return [
        {
          field: issue.path.join('.') || source,
          message: issue.message,
        },
      ];
    });

    throw new AppError(400, 'VALIDATION_ERROR', 'Données invalides', details);
  }

  // On fusionne avec ce qui existe déjà : si on a validé les params puis le
  // body, on ne veut pas écraser les params.
  req.validated = { ...req.validated, [source]: result.data };

  next();
};
