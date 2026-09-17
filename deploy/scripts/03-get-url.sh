#!/usr/bin/env bash
# Prints the current public IP / URL for the running frontend and backend
# tasks. Does not deploy or change anything - safe to run any time.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh
source ./lib.sh

BACKEND_IP="$(get_service_public_ip "$BACKEND_SERVICE")"
FRONTEND_IP="$(get_service_public_ip "$FRONTEND_SERVICE")"

echo "Cluster: $CLUSTER_NAME (region $AWS_REGION)"
echo ""
if [ -n "$BACKEND_IP" ]; then
  echo "Backend:  http://${BACKEND_IP}:${BACKEND_PORT}/api/todos"
  echo "          http://${BACKEND_IP}:${BACKEND_PORT}/api/health"
else
  echo "Backend:  no running task found (service not deployed yet, or still starting)"
fi

if [ -n "$FRONTEND_IP" ]; then
  echo "Frontend: http://${FRONTEND_IP}/"
else
  echo "Frontend: no running task found (service not deployed yet, or still starting)"
fi

echo ""
echo "Note: these IPs change whenever a task restarts or is redeployed"
echo "(no load balancer / static IP is used, to keep cost near zero)."
