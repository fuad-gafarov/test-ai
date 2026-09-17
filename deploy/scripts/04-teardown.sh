#!/usr/bin/env bash
# Tears down everything this project created, so you stop being charged.
# Safe to re-run; skips anything already gone.
#
# Usage: ./04-teardown.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh
source ./lib.sh

read -r -p "This will delete the ECS services, cluster, ECR repos (and all images), IAM role, log groups, and security group for '$CLUSTER_NAME' in $AWS_REGION. Continue? [y/N] " confirm
if [ "${confirm:-}" != "y" ] && [ "${confirm:-}" != "Y" ]; then
  log "Aborted."
  exit 0
fi

delete_service() {
  local service_name="$1"
  if service_exists "$service_name"; then
    log "Scaling $service_name to 0 and deleting..."
    aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" \
      --service "$service_name" --desired-count 0 >/dev/null
    aws ecs delete-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" \
      --service "$service_name" --force >/dev/null
    log "Deleted service $service_name"
  else
    log "Service $service_name not found, skipping"
  fi
}

delete_service "$FRONTEND_SERVICE"
delete_service "$BACKEND_SERVICE"

log "Waiting for services to fully drain..."
aws ecs wait services-inactive --region "$AWS_REGION" --cluster "$CLUSTER_NAME" \
  --services "$FRONTEND_SERVICE" "$BACKEND_SERVICE" 2>/dev/null || true

log "Deleting ECS cluster $CLUSTER_NAME"
aws ecs delete-cluster --region "$AWS_REGION" --cluster "$CLUSTER_NAME" >/dev/null 2>&1 || \
  log "  (already gone or not empty - check ECS console if this failed)"

for repo in "$BACKEND_REPO" "$FRONTEND_REPO"; do
  log "Deleting ECR repo $repo (and all images)"
  aws ecr delete-repository --region "$AWS_REGION" --repository-name "$repo" --force >/dev/null 2>&1 || \
    log "  $repo already gone, skipping"
done

for group in "/ecs/todo-backend" "/ecs/todo-frontend"; do
  log "Deleting log group $group"
  aws logs delete-log-group --region "$AWS_REGION" --log-group-name "$group" >/dev/null 2>&1 || \
    log "  $group already gone, skipping"
done

log "Detaching and deleting IAM role $EXEC_ROLE_NAME"
aws iam detach-role-policy --role-name "$EXEC_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null 2>&1 || true
aws iam delete-role --role-name "$EXEC_ROLE_NAME" >/dev/null 2>&1 || \
  log "  $EXEC_ROLE_NAME already gone, skipping"

resolve_default_vpc_and_subnets || true
SG_ID="$(aws ec2 describe-security-groups --region "$AWS_REGION" \
  --filters Name=group-name,Values="$SG_NAME" Name=vpc-id,Values="$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"
if [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
  log "Deleting security group $SG_ID"
  aws ec2 delete-security-group --region "$AWS_REGION" --group-id "$SG_ID" >/dev/null 2>&1 || \
    log "  Could not delete $SG_ID yet (ENIs may still be detaching) - retry in a minute:"
  log "  aws ec2 delete-security-group --region $AWS_REGION --group-id $SG_ID"
fi

log ""
log "Teardown complete. Double-check the ECS/ECR/EC2 consoles for $AWS_REGION to confirm nothing is left running."
