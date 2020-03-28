#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3Deployment from "@aws-cdk/aws-s3-deployment";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as certificatemanager from "@aws-cdk/aws-certificatemanager";
import * as route53 from "@aws-cdk/aws-route53";
import * as route53Targets from "@aws-cdk/aws-route53-targets";

const hostedZone = "lambdasawa.net";
const domain = "www.lambdasawa.net";

export class LambdasawaNetStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3Bucket = new s3.Bucket(this, "Bucket", {
      bucketName: domain,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      publicReadAccess: true
    });

    const certificate = new certificatemanager.Certificate(
      this,
      "Certificate",
      {
        domainName: domain,
        validationMethod: certificatemanager.ValidationMethod.DNS
      }
    );

    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "CloudFrontWebDistribution",
      {
        originConfigs: [
          {
            behaviors: [{ isDefaultBehavior: true }],
            customOriginSource: {
              domainName: s3Bucket.bucketWebsiteDomainName,
              originProtocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY
            }
          }
        ],
        viewerCertificate: cloudfront.ViewerCertificate.fromAcmCertificate(
          certificate,
          {
            aliases: [domain]
          }
        )
      }
    );

    new route53.ARecord(this, "ARecord", {
      zone: route53.HostedZone.fromLookup(this, "MyZone", {
        domainName: hostedZone
      }),
      recordName: domain,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      )
    });

    new s3Deployment.BucketDeployment(this, "DeployWithInvalidation", {
      sources: [s3Deployment.Source.asset(process.env.DEPLOY_PATH || "")],
      destinationBucket: s3Bucket,
      distribution,
      distributionPaths: ["/*"]
    });
  }
}

const app = new cdk.App();
new LambdasawaNetStack(app, "LambdasawaNetStack", {
  env: {
    account: process.env.AWS_ACCOUNT,
    region: "us-east-1"
  }
});
