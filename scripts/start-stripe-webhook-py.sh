#!/usr/bin/env bash
# Continuous runner for Python Stripe Webhook Service

# Change to project root
dir="$(cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd)/.."
cd "$dir"

# Load environment variables
if [ -f ".env.local" ]; then
  echo "Loading environment from .env.local"
  export $(grep -v '^#' .env.local | xargs)
else
  echo "❌ .env.local not found!"
  exit 1
fi

# Create logs directory
mkdir -p logs

# Continuous loop to keep service running
while true; do
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting Stripe Webhook Service..."
  uvicorn scripts.stripe_webhook_service:app \
    --host 0.0.0.0 --port "$WEBHOOK_PORT" \
    --log-config logging_config.yaml >> logs/stripe_webhook.log 2>&1
  exit_code=$?
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Service exited with code $exit_code. Restarting in 5s..."
  sleep 5
done
