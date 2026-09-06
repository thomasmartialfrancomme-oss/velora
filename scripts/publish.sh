#!/usr/bin/env bash
# Publish the current commit to GitHub and bring Render to it — one command, run by the owner.
#
#   GH_TOKEN=github_pat_xxx bash scripts/publish.sh
#   GH_TOKEN=… RENDER_API_KEY=rnd_… bash scripts/publish.sh   # also drives and reads the deploy
#
# Tokens come from the environment only. Nothing is written to the repository or to
# .git/config: the authenticated remote exists between two lines and is removed in a
# trap, so a token cannot survive the run in a file a snapshot might keep.
#
# With the Render key the script starts the deploy itself and follows it to `live`.
# Without it, the push is still enough for Render to rebuild on its own, so the script
# polls the public URL until the translated build answers. Both paths end by printing
# what a French-speaking visitor actually receives.
set -euo pipefail

OWNER="thomasmartialfrancomme-oss"
REPO="velora"
BRANCH="main"
RENDER_SERVICE="${RENDER_SERVICE:-srv-daehm9dbedkc73daja0g}"
PUBLIC_URL="${PUBLIC_URL:-https://velora-w9gl.onrender.com}"
RENDER_API_KEY="${RENDER_API_KEY:-}"
GH_TOKEN="${GH_TOKEN:-}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN manquant — un token GitHub fine-grained, Contents: Read & Write sur $OWNER/$REPO."
  echo "Créez-le sur https://github.com/settings/personal-access-tokens/new, faites-le expirer dans une heure."
  exit 2
fi

cd "$REPO_DIR"
SHA="$(git rev-parse --short HEAD)"
FULL_SHA="$(git rev-parse HEAD)"

echo "── 1/4  $BRANCH @ $SHA ──"
if [ -n "$(git status --porcelain)" ]; then
  echo "la copie de travail est sale : committez d'abord (le push publierait autre chose que ce qui a été testé)."
  exit 1
fi
echo "   arbre propre ✓"

echo "── 2/4  poussée vers GitHub ──"
git remote remove origin 2>/dev/null || true
trap 'git remote remove origin 2>/dev/null || true' EXIT
git push "https://x-access-token:${GH_TOKEN}@github.com/${OWNER}/${REPO}.git" "HEAD:refs/heads/${BRANCH}"
git remote remove origin 2>/dev/null || true
trap - EXIT
echo "   $FULL_SHA est sur $OWNER/$REPO ✓"

echo "── 3/4  Render ──"
if [ -z "$RENDER_API_KEY" ]; then
  echo "   aucune clé d'API Render : auto-déploiement supposé, on attend le build traduit (10 min max)."
  ready=0
  for attempt in $(seq 1 40); do
    sleep 15
    if curl -s -m 60 -H 'Accept-Language: fr-FR,fr;q=0.9' "$PUBLIC_URL/" | grep -q 'lang="fr"'; then
      echo "   le site public sert la version traduite ✓"
      ready=1
      break
    fi
    printf '   attente (%s/40)\r' "$attempt"
  done
  echo
  [ "$ready" = "1" ] || echo "   timeout : le build n'est pas encore visible — vérifiez le journal sur Render."
else
  DEPLOY_ID=$(curl -sS -X POST "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json" \
    -d "{\"sha\":\"${FULL_SHA}\"}" | sed -n 's/.*"id":"\(d-[a-z0-9]*\)".*/\1/p')
  if [ -z "${DEPLOY_ID}" ]; then
    echo "   Render n'a pas renvoyé d'identifiant de déploiement — vérifiez la clé et RENDER_SERVICE."
    exit 1
  fi
  echo "   déploiement ${DEPLOY_ID} lancé, statut :"
  for attempt in $(seq 1 60); do
    STATUS=$(curl -sS "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys/${DEPLOY_ID}" \
      -H "Authorization: Bearer ${RENDER_API_KEY}" | sed -n 's/.*"status":"\([a-z_]*\)".*/\1/p')
    printf '   %-20s\r' "${STATUS:-en attente}"
    case "${STATUS}" in
      live)
        echo "   en ligne ✓"
        break
        ;;
      build_failed | canceled | update_failed)
        echo
        curl -sS "https://api.render.com/v1/services/${RENDER_SERVICE}/deploys/${DEPLOY_ID}" -H "Authorization: Bearer ${RENDER_API_KEY}" | head -c 600
        echo
        exit 1
        ;;
    esac
    sleep 10
  done
  echo
fi

echo "── 4/4  ce que le visiteur voit ──"
for path in / /login /membership /privacy /terms /api/health; do
  code=$(curl -s -o /tmp/publish-check.html -w '%{http_code}' -m 90 \
    -H 'Accept-Language: fr-FR,fr;q=0.9' "${PUBLIC_URL}${path}" || echo 000)
  note=""
  case "$path" in
    /api/health) note="santé : $(head -c 120 /tmp/publish-check.html)" ;;
    *)
      if grep -q 'lang="fr"' /tmp/publish-check.html; then
        note="français ✓"
      else
        note="anglais (langue du visiteur non résolue, ou build pas encore servi)"
      fi
      ;;
  esac
  printf '   %s  %-14s %s\n' "$code" "$path" "$note"
done
echo "fait. les jetons n'ont été écrits ni dans le dépôt ni dans .git/config — faites-les expirer maintenant."
