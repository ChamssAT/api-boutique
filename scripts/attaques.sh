#!/usr/bin/env bash
# =============================================================================
# scripts/attaques.sh — Exercice 4.4 : rejouer les attaques en ligne de commande
# -----------------------------------------------------------------------------
# Prérequis : l'API tourne sur http://localhost:3000 (npm run dev).
# Usage     : ./scripts/attaques.sh
#
# Le script affiche le code HTTP obtenu pour chaque attaque. Il ne modifie rien
# de façon permanente (sauf les produits de test créés).
# =============================================================================
set -u

BASE="${BASE:-http://localhost:3000}"
API="$BASE/api/v1/products"

# Petite fonction d'affichage lisible.
titre() {
  echo
  echo "=============================================================="
  echo "$1"
  echo "=============================================================="
}

# Vérifie que l'API répond avant de commencer.
if ! curl -s -o /dev/null "$BASE/health"; then
  echo "ERREUR : l'API ne répond pas sur $BASE. Lance d'abord : npm run dev"
  exit 1
fi

# -----------------------------------------------------------------------------
# 1) Mass assignment : on tente d'imposer "id" et "role"
#    Attendu : 400
# -----------------------------------------------------------------------------
titre "1) Mass assignment (attendu : 400)"
curl -s -o /tmp/attaque-mass.json -w "Code HTTP : %{http_code}\n" \
  -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"name":"Attaque","price":100,"category":"fruits","stock":1,"role":"admin","id":"force"}'
echo "Réponse :"
cat /tmp/attaque-mass.json
echo

# -----------------------------------------------------------------------------
# 2) Corps géant : 200 000 caractères dans "name"
#    Attendu : 413 (le corps dépasse la limite de 100 kb)
#    On passe par un fichier : un argument shell de 200 ko dépasse la limite
#    ARG_MAX de certains systèmes ("Liste d'arguments trop longue").
# -----------------------------------------------------------------------------
titre "2) Corps géant (attendu : 413)"
CORPS_GEANT="${TMPDIR:-/tmp}/attaque-gros-body.json"
{
  printf '{"name":"'
  head -c 200000 /dev/zero | tr '\0' 'a'
  printf '","price":100,"category":"fruits","stock":1}'
} > "$CORPS_GEANT"

curl -s -o /tmp/attaque-gros.json -w "Code HTTP : %{http_code}\n" \
  -X POST "$API" \
  -H "Content-Type: application/json" \
  --data-binary @"$CORPS_GEANT"
echo "Réponse :"
cat /tmp/attaque-gros.json
echo

# Nettoyage du fichier temporaire (200 ko, on ne le laisse pas traîner).
rm -f "$CORPS_GEANT"

# -----------------------------------------------------------------------------
# 3) Fuite d'informations : provoquer une 500
#    Attendu : 500 avec un message générique, sans pile d'erreur.
#    Pour tester, ajoute TEMPORAIREMENT dans un service :
#       throw new Error('boom');
#    puis relance l'API. Retire la ligne après le test !
# -----------------------------------------------------------------------------
titre "3) Fuite d'informations (à tester manuellement, voir commentaire)"
echo "Ajoute temporairement 'throw new Error(\"boom\")' dans un handler,"
echo "puis vérifie que la réponse 500 ne contient ni stack ni message interne."

# -----------------------------------------------------------------------------
# 4) Force brute : 105 requêtes, le rate limiter est à 100 / 15 min
#    Attendu : les premières en 200, puis 429 à partir de la 101e environ.
# -----------------------------------------------------------------------------
titre "4) Rate limiting (attendu : 200 puis 429)"
for _ in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" "$API"
done | sort | uniq -c

# -----------------------------------------------------------------------------
# 5) Vérification de l'en-tête X-Powered-By (Helmet doit le supprimer)
#    Attendu : aucune ligne "X-Powered-By"
# -----------------------------------------------------------------------------
titre "5) En-têtes de /health (attendu : pas de X-Powered-By)"
curl -s -I "$BASE/health" | grep -i "x-powered-by" \
  && echo "ECHEC : X-Powered-By est encore présent"
echo "OK si aucune ligne X-Powered-By n'apparaît au-dessus."
