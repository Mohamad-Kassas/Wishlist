#!/usr/bin/env bash
set -euo pipefail

cd /Users/captainmk/Workspace/Personal/wishlist

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "1/4 Pushing ${BRANCH} to GitHub..."
git push origin "${BRANCH}"

echo "2/4 Syncing Wishlist source & docs to plex-server:~/wishlist/..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude 'tsconfig.tsbuildinfo' \
  ./ plex-server:~/wishlist/

echo "3/4 Seeding data/wishlist.json on plex-server (preserving existing server data)..."
rsync -az --ignore-existing data/ plex-server:~/wishlist/data/

echo "4/4 Rebuilding and restarting web container on plex-server..."
ssh plex-server 'cd ~/wishlist && docker compose -f deploy/docker-compose.yml up -d --build web'

echo "Deployed! Open http://plex-server:8089/"
