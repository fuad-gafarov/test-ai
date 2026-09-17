#!/usr/bin/env bash
# Shared helper functions for the deploy scripts. Source this after config.sh.
set -euo pipefail

# Print to stderr with a prefix, so scripts' stdout stays clean for values
# other scripts may want to capture.
log() {
  echo "[deploy] $*" >&2
}

# Finds the account's default VPC and its subnets (used for the awsvpc
# network config on ECS services). Fails loudly if there is no default VPC -
# in that case, edit this function or pass VPC_ID/SUBNET_IDS explicitly.
resolve_default_vpc_and_subnets() {
  if [ -n "${VPC_ID:-}" ] && [ -n "${SUBNET_IDS:-}" ]; then
    return 0
  fi

  VPC_ID="$(aws ec2 describe-vpcs \
    --region "$AWS_REGION" \
    --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' --output text)"

  if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
    log "ERROR: no default VPC found in region $AWS_REGION."
    log "Set VPC_ID and SUBNET_IDS (comma-separated) env vars and re-run."
    exit 1
  fi

  SUBNET_IDS="$(aws ec2 describe-subnets \
    --region "$AWS_REGION" \
    --filters Name=vpc-id,Values="$VPC_ID" \
    --query 'Subnets[].SubnetId' --output text | tr '\t' ',')"

  export VPC_ID SUBNET_IDS
  log "Using VPC=$VPC_ID SUBNETS=$SUBNET_IDS"
}

# Looks up (or creates) the security group used by both services.
resolve_or_create_security_group() {
  resolve_default_vpc_and_subnets

  SG_ID="$(aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters Name=group-name,Values="$SG_NAME" Name=vpc-id,Values="$VPC_ID" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)"

  if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
    log "Creating security group $SG_NAME in $VPC_ID"
    SG_ID="$(aws ec2 create-security-group \
      --region "$AWS_REGION" \
      --group-name "$SG_NAME" \
      --description "Todo demo app - inbound 80 (frontend) and 8080 (backend) from anywhere" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' --output text)"

    aws ec2 authorize-security-group-ingress --region "$AWS_REGION" \
      --group-id "$SG_ID" --protocol tcp --port "$FRONTEND_PORT" --cidr 0.0.0.0/0 >/dev/null
    aws ec2 authorize-security-group-ingress --region "$AWS_REGION" \
      --group-id "$SG_ID" --protocol tcp --port "$BACKEND_PORT" --cidr 0.0.0.0/0 >/dev/null
    log "Created security group $SG_ID (ingress: tcp/$FRONTEND_PORT, tcp/$BACKEND_PORT from 0.0.0.0/0)"
  else
    log "Using existing security group $SG_ID"
  fi

  export SG_ID
}

service_exists() {
  local service_name="$1"
  local status
  status="$(aws ecs describe-services --region "$AWS_REGION" \
    --cluster "$CLUSTER_NAME" --services "$service_name" \
    --query 'services[0].status' --output text 2>/dev/null || true)"
  [ "$status" = "ACTIVE" ]
}

wait_for_service_stable() {
  local service_name="$1"
  log "Waiting for $service_name to reach steady state (this can take 1-3 minutes)..."
  aws ecs wait services-stable --region "$AWS_REGION" \
    --cluster "$CLUSTER_NAME" --services "$service_name"
  log "$service_name is stable."
}

# Prints the public IP of the (first) running task for a given service.
# Empty output if no running task / no public IP yet.
get_service_public_ip() {
  local service_name="$1"

  local task_arn
  task_arn="$(aws ecs list-tasks --region "$AWS_REGION" \
    --cluster "$CLUSTER_NAME" --service-name "$service_name" \
    --desired-status RUNNING --query 'taskArns[0]' --output text 2>/dev/null || true)"

  if [ -z "$task_arn" ] || [ "$task_arn" = "None" ]; then
    return 0
  fi

  local eni_id
  eni_id="$(aws ecs describe-tasks --region "$AWS_REGION" \
    --cluster "$CLUSTER_NAME" --tasks "$task_arn" \
    --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value | [0]' \
    --output text 2>/dev/null || true)"

  if [ -z "$eni_id" ] || [ "$eni_id" = "None" ]; then
    return 0
  fi

  aws ec2 describe-network-interfaces --region "$AWS_REGION" \
    --network-interface-ids "$eni_id" \
    --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null || true
}
