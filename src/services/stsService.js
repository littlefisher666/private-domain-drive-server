const { ConfigError } = require("../utils/configError");

async function issueStsCredentials(stsConfig = {}) {
  validateStsConfig(stsConfig);

  const OpenApi = require("@alicloud/openapi-client");
  const Sts20150401 = require("@alicloud/sts20150401");

  const client = new Sts20150401.default(
    new OpenApi.Config({
      endpoint: stsConfig.endpoint,
      accessKeyId: stsConfig.accessKeyId,
      accessKeySecret: stsConfig.accessKeySecret,
    })
  );

  const request = new Sts20150401.AssumeRoleRequest({
    roleArn: stsConfig.assumeRoleArn,
    roleSessionName: stsConfig.roleSessionName,
    durationSeconds: stsConfig.durationSeconds,
    policy: buildOssScopedPolicy(stsConfig),
  });

  const response = await client.assumeRole(request);
  const credentials = response.body?.credentials;

  if (!credentials) {
    throw new Error("STS response did not contain credentials");
  }

  return {
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    securityToken: credentials.securityToken,
    expiration: credentials.expiration,
  };
}

function validateStsConfig(stsConfig) {
  if (!stsConfig.accessKeyId) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_ID");
  }

  if (!stsConfig.accessKeySecret) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  }

  if (!stsConfig.assumeRoleArn) {
    throw new ConfigError("Missing STS_ASSUME_ROLE_ARN");
  }

  if (!stsConfig.roleSessionName) {
    throw new ConfigError("Missing STS_ROLE_SESSION_NAME");
  }
}

function buildOssScopedPolicy(stsConfig) {
  const bucket = stsConfig.ossBucket;
  const rootPrefix = normalizeRootPrefix(stsConfig.ossRootPrefix);

  if (!bucket || !rootPrefix) {
    return "";
  }

  return JSON.stringify({
    Version: "1",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "oss:ListObjects",
          "oss:ListObjectVersions",
          "oss:GetObject",
          "oss:PutObject",
          "oss:DeleteObject",
          "oss:AbortMultipartUpload",
          "oss:ListParts",
        ],
        Resource: [`acs:oss:*:*:${bucket}/${rootPrefix}*`],
      },
      {
        Effect: "Allow",
        Action: ["oss:ListObjects"],
        Resource: [`acs:oss:*:*:${bucket}`],
        Condition: {
          StringLike: {
            "oss:Prefix": [`${rootPrefix}*`],
          },
        },
      },
    ],
  });
}

function normalizeRootPrefix(prefix) {
  if (!prefix) {
    return "";
  }

  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

module.exports = {
  issueStsCredentials,
};
