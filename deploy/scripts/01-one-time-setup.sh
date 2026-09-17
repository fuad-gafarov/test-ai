#!/usr/bin/env bash
# One-time setup: ECR repos, ECS cluster, task execution IAM role, log
# groups, and the shared security group. Safe to re-run (everything is
# idempotent / checks for existing resources first).
#
# Usage: ./01-one-time-setup.sh
#
# Requires: aws cli v2, configured credentials with sufficient permissions
# (ECR, ECS, IAM, EC2, CloudWatch Logs).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./config.sh
source ./lib.sh

log "Account: $AWS_ACCOUNT_ID  Region: $AWS_REGION"

# --- ECR repositories -----------------------------------------------------
for repo in "$BACKEND_REPO" "$FRONTEND_REPO"; do
  if aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$repo" >/dev/null 2>&1; then
    log "ECR repo $repo already exists"
  else
    log "Creating ECR repo $repo"
    aws ecr create-repository \
      --region "$AWS_REGION" \
      --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true \
      --image-tag-mutability MUTABLE >/dev/null
  fi
done

# --- ECS cluster ------------------------------------------------------------
if aws ecs describe-clusters --region "$AWS_REGION" --clusters "$CLUSTER_NAME" \
    --query 'clusters[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  log "ECS cluster $CLUSTER_NAME already exists"
else
  log "Creating ECS cluster $CLUSTER_NAME"
  aws ecs create-cluster --region "$AWS_REGION" --cluster-name "$CLUSTER_NAME" >/dev/null
fi

# --- IAM task execution role -----------------------------------------------
if aws iam get-role --role-name "$EXEC_ROLE_NAME" >/dev/null 2>&1; then
  log "IAM role $EXEC_ROLE_NAME already exists"
else
  log "Creating IAM role $EXEC_ROLE_NAME"
  trust_policy=$(cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)
  aws iam create-role \
    --role-name "$EXEC_ROLE_NAME" \
    --assume-role-policy-document "$trust_policy" \
    --description "ECS task execution role for the todo demo app (pull from ECR, write logs)" >/dev/null

  aws iam attach-role-policy \
    --role-name "$EXEC_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  log "Waiting a few seconds for IAM role propagation..."
  sleep 10
fi

# --- CloudWatch log groups ---------------------------------------------------
for group in "/ecs/todo-backend" "/ecs/todo-frontend"; do
  if aws logs describe-log-groups --region "$AWS_REGION" --log-group-name-prefix "$group" \
      --query "logGroups[?logGroupName=='$group'] | length(@)" --output text | grep -qv '^0$'; then
    log "Log group $group already exists"
  else
    log "Creating log group $group"
    aws logs create-log-group --region "$AWS_REGION" --log-group-name "$group" >/dev/null || true
  fi
done

# --- Security group ---------------------------------------------------------
resolve_or_create_security_group

log ""
log "One-time setup complete."
log "  Cluster:         $CLUSTER_NAME"
log "  ECR backend:      $BACKEND_IMAGE_REPO_URI"
log "  ECR frontend:     $FRONTEND_IMAGE_REPO_URI"
log "  Execution role:   arn:aws:iam::${AWS_ACCOUNT_ID}:role/${EXEC_ROLE_NAME}"
log "  Security group:   $SG_ID"
log "  VPC / Subnets:    $VPC_ID / $SUBNET_IDS"
log ""
log "Next: run ./02-deploy.sh to build, push, and deploy both services."
