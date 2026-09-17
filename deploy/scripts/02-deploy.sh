#!/usr/bin/env bash
# Day-to-day deploy: builds both Docker images, pushes them to ECR,
# registers new ECS task definition revisions, and creates the services (if
# they don't exist yet) or forces a new deployment (if they do).
#
# Because there is no load balancer, the frontend needs to know the
# backend's public IP. This script deploys the backend first, resolves its
# new public IP, and bakes that IP into the frontend task definition's
# API_BASE env var before deploying the frontend. This means every deploy
# re-points the frontend at whatever the backend's current IP is - if only
# the frontend changed, its task still gets redeployed so it keeps using a
# fresh/valid backend IP (also cheap, so no real downside).
#
# Usage: ./02-deploy.sh [--backend-only | --frontend-only]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh
source ./lib.sh

DO_BACKEND=1
DO_FRONTEND=1
case "${1:-}" in
  --backend-only) DO_FRONTEND=0 ;;
  --frontend-only) DO_BACKEND=0 ;;
  "") ;;
  *) echo "Usage: $0 [--backend-only | --frontend-only]" >&2; exit 1 ;;
esac

resolve_or_create_security_group

IMAGE_TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || date +%s)"
log "Image tag: $IMAGE_TAG"

ecr_login() {
  aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$ECR_REGISTRY" >/dev/null
}

render_task_def() {
  local template="$1" out="$2"
  shift 2
  local sed_args=()
  while [ "$#" -gt 0 ]; do
    sed_args+=(-e "s|$1|$2|g")
    shift 2
  done
  sed "${sed_args[@]}" "$template" > "$out"
}

network_config() {
  echo "awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}"
}

create_or_update_service() {
  local service_name="$1" task_def_arn="$2"

  if service_exists "$service_name"; then
    log "Updating service $service_name -> $task_def_arn"
    aws ecs update-service --region "$AWS_REGION" \
      --cluster "$CLUSTER_NAME" --service "$service_name" \
      --task-definition "$task_def_arn" \
      --force-new-deployment >/dev/null
  else
    log "Creating service $service_name"
    aws ecs create-service --region "$AWS_REGION" \
      --cluster "$CLUSTER_NAME" --service-name "$service_name" \
      --task-definition "$task_def_arn" \
      --desired-count 1 \
      --launch-type FARGATE \
      --network-configuration "$(network_config)" >/dev/null
  fi

  wait_for_service_stable "$service_name"
}

deploy_backend() {
  log "=== Backend: build & push ==="
  ecr_login
  docker build -t "${BACKEND_IMAGE_REPO_URI}:${IMAGE_TAG}" -t "${BACKEND_IMAGE_REPO_URI}:latest" \
    "${REPO_ROOT}/backend"
  docker push "${BACKEND_IMAGE_REPO_URI}:${IMAGE_TAG}"
  docker push "${BACKEND_IMAGE_REPO_URI}:latest"

  log "=== Backend: register task definition ==="
  render_task_def "${TASK_DEFS_DIR}/backend-task-def.json" "${RENDERED_DIR}/backend-task-def.json" \
    "__AWS_ACCOUNT_ID__" "$AWS_ACCOUNT_ID" \
    "__AWS_REGION__" "$AWS_REGION" \
    "__BACKEND_IMAGE__" "${BACKEND_IMAGE_REPO_URI}:${IMAGE_TAG}"

  local task_def_arn
  task_def_arn="$(aws ecs register-task-definition --region "$AWS_REGION" \
    --cli-input-json "file://${RENDERED_DIR}/backend-task-def.json" \
    --query 'taskDefinition.taskDefinitionArn' --output text)"
  log "Registered $task_def_arn"

  create_or_update_service "$BACKEND_SERVICE" "$task_def_arn"

  BACKEND_IP="$(get_service_public_ip "$BACKEND_SERVICE")"
  if [ -z "$BACKEND_IP" ]; then
    log "ERROR: could not resolve backend public IP after deployment."
    exit 1
  fi
  log "Backend public IP: $BACKEND_IP"
  export BACKEND_IP
}

deploy_frontend() {
  local api_base
  if [ -n "${BACKEND_IP:-}" ]; then
    api_base="http://${BACKEND_IP}:${BACKEND_PORT}/api/todos"
  else
    # --frontend-only run: reuse whatever backend is currently live.
    local ip
    ip="$(get_service_public_ip "$BACKEND_SERVICE")"
    if [ -z "$ip" ]; then
      log "ERROR: backend service has no running task with a public IP yet."
      log "Run a full deploy (./02-deploy.sh) or ./02-deploy.sh --backend-only first."
      exit 1
    fi
    api_base="http://${ip}:${BACKEND_PORT}/api/todos"
  fi
  log "Frontend will point at API_BASE=$api_base"

  log "=== Frontend: build & push ==="
  ecr_login
  docker build -t "${FRONTEND_IMAGE_REPO_URI}:${IMAGE_TAG}" -t "${FRONTEND_IMAGE_REPO_URI}:latest" \
    "${REPO_ROOT}/frontend"
  docker push "${FRONTEND_IMAGE_REPO_URI}:${IMAGE_TAG}"
  docker push "${FRONTEND_IMAGE_REPO_URI}:latest"

  log "=== Frontend: register task definition ==="
  render_task_def "${TASK_DEFS_DIR}/frontend-task-def.json" "${RENDERED_DIR}/frontend-task-def.json" \
    "__AWS_ACCOUNT_ID__" "$AWS_ACCOUNT_ID" \
    "__AWS_REGION__" "$AWS_REGION" \
    "__FRONTEND_IMAGE__" "${FRONTEND_IMAGE_REPO_URI}:${IMAGE_TAG}" \
    "__API_BASE__" "$api_base"

  local task_def_arn
  task_def_arn="$(aws ecs register-task-definition --region "$AWS_REGION" \
    --cli-input-json "file://${RENDERED_DIR}/frontend-task-def.json" \
    --query 'taskDefinition.taskDefinitionArn' --output text)"
  log "Registered $task_def_arn"

  create_or_update_service "$FRONTEND_SERVICE" "$task_def_arn"

  FRONTEND_IP="$(get_service_public_ip "$FRONTEND_SERVICE")"
  log "Frontend public IP: $FRONTEND_IP"
}

[ "$DO_BACKEND" = 1 ] && deploy_backend
[ "$DO_FRONTEND" = 1 ] && deploy_frontend

log ""
log "=== Deploy complete ==="
[ -n "${BACKEND_IP:-}" ] && log "Backend:  http://${BACKEND_IP}:${BACKEND_PORT}/api/todos  (health: /api/health)"
[ -n "${FRONTEND_IP:-}" ] && log "Frontend: http://${FRONTEND_IP}/"
log "(Run ./03-get-url.sh any time to look these up again.)"
