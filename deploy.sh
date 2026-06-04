#!/bin/bash
# dream-server VPS deploy script

set -e

echo ">>> Pulling latest code..."
cd ~/dream-server && git pull || git clone https://github.com/suqing-su/dream-server.git ~/dream-server && cd ~/dream-server

echo ">>> Building Docker image..."
docker build -t dream-server .

echo ">>> Stopping old container..."
docker stop dream-server 2>/dev/null || true
docker rm dream-server 2>/dev/null || true

echo ">>> Starting new container..."
docker run -d \
  --name dream-server \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e CLAUDE_KEY="${CLAUDE_KEY}" \
  dream-server

echo ">>> Done! App running on port 3000"
