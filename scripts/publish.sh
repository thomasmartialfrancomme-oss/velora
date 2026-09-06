#!/usr/bin/env bash
# Publish the current commit to GitHub and redeploy Render — one command, run by the owner.
#
#   GH_TOKEN=github_pat_xxx RENDER_API_KEY=rnd_xxx bash scripts/publish.sh
#
# Tokens are read from the environment only. Nothing is written to the repository,
# to .git/config or to disk: the remote is added for the duration of the push, then
# removed again. Both tokens are short-lived, single-purpose credentials — a fine-grained
# GitHub token with Contents:Read+Write on this one repository, and a Render API key.
#
# The script is safe to re-run and refuses to do anything half-done: it checks the token,
# pushes, waits for Render to report the new commit, then asserts the site answers.
set -euo pipefail

OWNER="thomasmartialfrancomme-oss"
REPO="velora"
BRANCH="main"
RENDER_SERVICE="${RENDER_SERVICE:-srv-daehm9dbedkc73daja0g}"
PUBLIC_URL="${PUBLIC_URL:-https://velora-w9gl.onrender.com}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${GH_TOKEN:?manquant — collez un token GitHub (fine-grained, Contents: Read & Write sur $OWNER/$REPO)}"
: "${RENDER_API_KEY:?manquant — collez une clé d'API Render (Account settings → API keys)}"

cd "$REPO_DIR"
SHA="$(git rev-parse --short HEAD)"
echo "── 1/4  $BRANCH @ $SHA, propre ? ──"
if [ -n "$(git status --porcelain)" ]; then
  echo "la copie de travail est sale : committez d'abord."; exit 1
fi

echo "── 2/4  poussée vers GitHub ──"
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git"
trap 'git remote remove origin 2>/dev/null || true' EXIT
git push "https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git" "HEAD:refs/heads/${BRANCH}"
git remote remove origin 2>/dev/null || true
trap - EXIT
echo "poussé ✓"

echo "── 3/4  redéploiement Render ──"
DEPLOY_ID=$(curl -sS -X POST "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json" \
  -d "{\"sha\":\"$(git rev-parse HEAD)\"}" | sed -n 's/.*"id":"\(d-[a-z0-9]*\)".*/\1/p')
if [ -z "${DEPLOY_ID}" ]; then
  echo "Render n'a pas répondu avec un identifiant de déploiement — vérifiez la clé et l'identifiant du service."
  exit 1
fi
echo "déploiement ${DEPLOY_ID} …"
for i in $(seq 1 60); do
  STATUS=$(curl -sS "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys/${DEPLOY_ID}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" | sed -n 's/.*"status":"\([a-z_]*\)".*/\1/p')
  printf '   %-18s\r' "${STATUS:-en attente}"
  case "${STATUS}" in
    live) echo; echo "en ligne ✓"; break ;;
    build_failed|canceled|update_failed) echo; curl -sS "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys/${DEPLOY_ID}" -H "Authorization: Bearer ${RENDER_API_KEY}" | head -c 600; echo; exit 1 ;;
  esac
  sleep 10
done

echo "── 4/4  ce que le visiteur voit ──"
for path in / /login /membership /privacy /terms /api/health; do
  code=$(curl -s -o /tmp/publish-check.html -w '%{http_code}' -m 90 \
    -H 'Accept-Language: fr-FR,fr;q=0.9' "${PUBLIC_URL}${path}")
  note=""
  case "$path" in
    /api/health) note="santé : $(head -c 120 /tmp/publish-check.html)" ;;
    *) grep -q 'lang="fr"' /tmp/publish-check.html && note="français ✓" || note="anglais (langue du visiteur non résolue)" ;;
  esac
  printf '  %s  %-14s %s\n' "$code" "$path" "$note"
done
echo "fait. les jetons n'ont été ni écrits ni commités — faites-les expirer maintenant."
