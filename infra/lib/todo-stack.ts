import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { NagSuppressions } from 'cdk-nag';

const API_PORT = 8080; // Spring Boot
const WEB_PORT = 8081; // nginx-unprivileged (8080 is taken by the api in the shared task network)
const APP_UID = 10001; // matches the user in backend/Dockerfile

export class TodoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const repoRoot = path.join(__dirname, '..', '..');

    // ---- Network: public subnets only, no NAT gateway (cost) ----
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
    });

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc, description: 'Public ALB' });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from the internet');

    const serviceSg = new ec2.SecurityGroup(this, 'ServiceSg', { vpc, description: 'Fargate task' });
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(WEB_PORT), 'nginx from ALB only');

    const efsSg = new ec2.SecurityGroup(this, 'EfsSg', { vpc, description: 'EFS mount targets', allowAllOutbound: false });
    efsSg.addIngressRule(serviceSg, ec2.Port.tcp(2049), 'NFS from the task only');

    // ---- Storage: encrypted EFS, retained on stack deletion ----
    const fileSystem = new efs.FileSystem(this, 'DataFs', {
      vpc,
      securityGroup: efsSg,
      encrypted: true,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      allowAnonymousAccess: false,
      enableAutomaticBackups: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    // Reject non-TLS NFS mounts
    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['*'],
        conditions: { Bool: { 'aws:SecureTransport': 'false' } },
      }),
    );

    const accessPoint = fileSystem.addAccessPoint('TodoAp', {
      path: '/todos',
      posixUser: { uid: String(APP_UID), gid: String(APP_UID) },
      createAcl: { ownerUid: String(APP_UID), ownerGid: String(APP_UID), permissions: '750' },
    });

    // ---- Logs ----
    const logGroup = new logs.LogGroup(this, 'Logs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ---- Task ----
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    taskDef.addVolume({
      name: 'data',
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: { accessPointId: accessPoint.accessPointId, iam: 'ENABLED' },
      },
    });

    // Task role: only what the EFS mount needs, only on this access point.
    taskDef.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['elasticfilesystem:ClientMount', 'elasticfilesystem:ClientWrite'],
        resources: [fileSystem.fileSystemArn],
        conditions: { StringEquals: { 'elasticfilesystem:AccessPointArn': accessPoint.accessPointArn } },
      }),
    );

    const api = taskDef.addContainer('api', {
      image: ecs.ContainerImage.fromAsset(path.join(repoRoot, 'backend'), { platform: Platform.LINUX_AMD64 }),
      memoryLimitMiB: 768,
      essential: true,
      command: ['--todo.data-file=/data/todos.txt'],
      portMappings: [{ containerPort: API_PORT }],
      readonlyRootFilesystem: false,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
      healthCheck: {
        // The JRE image has no curl; use bash's /dev/tcp to read Spring Actuator's health JSON.
        command: [
          'CMD-SHELL',
          `bash -c 'exec 3<>/dev/tcp/127.0.0.1/${API_PORT} && printf "GET /actuator/health HTTP/1.0\\r\\nHost: localhost\\r\\n\\r\\n" >&3 && grep -q "\\"status\\":\\"UP\\"" <&3' || exit 1`,
        ],
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });
    api.addMountPoints({ containerPath: '/data', sourceVolume: 'data', readOnly: false });

    const web = taskDef.addContainer('web', {
      image: ecs.ContainerImage.fromAsset(path.join(repoRoot, 'frontend'), { platform: Platform.LINUX_AMD64 }),
      memoryLimitMiB: 128,
      essential: true,
      portMappings: [{ containerPort: WEB_PORT }],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'web', logGroup }),
    });
    web.addContainerDependencies({ container: api, condition: ecs.ContainerDependencyCondition.HEALTHY });

    // ---- Cluster + service (single writer: never two tasks at once) ----
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      assignPublicIp: true,
      securityGroups: [serviceSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheckGracePeriod: cdk.Duration.seconds(90),
      circuitBreaker: { rollback: true },
    });

    // ---- ALB ----
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      dropInvalidHeaderFields: true,
    });
    const listener = alb.addListener('Http', { port: 80, open: false });
    listener.addTargets('Web', {
      port: WEB_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service.loadBalancerTarget({ containerName: 'web', containerPort: WEB_PORT })],
      healthCheck: { path: '/', healthyHttpCodes: '200', interval: cdk.Duration.seconds(30), timeout: cdk.Duration.seconds(5) },
      deregistrationDelay: cdk.Duration.seconds(15),
    });

    new cdk.CfnOutput(this, 'AppUrl', { value: `http://${alb.loadBalancerDnsName}`, description: 'Todo app URL (HTTP)' });
    new cdk.CfnOutput(this, 'DataFileSystemId', { value: fileSystem.fileSystemId, description: 'EFS holding todos.txt (RETAINED on destroy)' });
    new cdk.CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });

    // ---- cdk-nag suppressions (only active with -c nag=true); each one is a deliberate choice ----
    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-VPC7', reason: 'VPC flow logs skipped to keep cost low for a small demo app' },
      { id: 'AwsSolutions-ELB2', reason: 'ALB access logs need an S3 bucket; skipped for cost, enable when needed' },
      { id: 'AwsSolutions-EC23', reason: 'Public ALB on port 80 is the requested design; HTTPS needs a domain + ACM cert (see README)' },
      { id: 'AwsSolutions-ECS2', reason: 'Only non-secret configuration is passed as environment/command args' },
      { id: 'AwsSolutions-EFS1', reason: 'EFS is encrypted at rest (CMK not required for demo)' },
      { id: 'AwsSolutions-ECS4', reason: 'Container Insights disabled to avoid extra CloudWatch cost' },
    ]);
    NagSuppressions.addResourceSuppressions(
      taskDef,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcards are generated by CDK for ECR GetAuthorizationToken and log stream ARNs', appliesTo: ['Resource::*'] }],
      true,
    );
  }
}
