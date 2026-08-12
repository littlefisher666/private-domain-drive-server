function getAppConfig() {
  const rootPrefix = normalizeRootPrefix(process.env.OSS_ROOT_PREFIX || "shared/");
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || "";
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || "";
  const assumeRoleArn = process.env.STS_ASSUME_ROLE_ARN || "";
  const roleSessionName =
    process.env.STS_ROLE_SESSION_NAME || "private-domain-drive-session";
  const durationSeconds = Number(process.env.STS_DURATION_SECONDS || 3600);
  const endpoint = process.env.STS_ENDPOINT || "sts.cn-hangzhou.aliyuncs.com";
  const bucket = process.env.OSS_BUCKET || "private-domain-drive";

  return {
    oss: {
      bucket,
      region: process.env.OSS_REGION || "cn-hangzhou",
      endpoint: process.env.OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com",
      rootPrefix,
    },
    constraints: {
      multipartUploadThresholdBytes: Number(
        process.env.MULTIPART_UPLOAD_THRESHOLD_BYTES || 10 * 1024 * 1024
      ),
      textPreviewMaxBytes: Number(
        process.env.TEXT_PREVIEW_MAX_BYTES || 512 * 1024
      ),
      allowedPreviewExtensions: (process.env.ALLOWED_PREVIEW_EXTENSIONS ||
        "jpg,jpeg,png,gif,pdf,txt,md")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    },
    sts: {
      accessKeyId,
      accessKeySecret,
      endpoint,
      assumeRoleArn,
      roleSessionName,
      durationSeconds,
      ossBucket: bucket,
      ossRootPrefix: rootPrefix,
    },
    // Client-side AssumeRole broker. Prefer dedicated limited AK; fallback to server AK.
    stsBroker: {
      accessKeyId: process.env.STS_BROKER_ACCESS_KEY_ID || accessKeyId,
      accessKeySecret:
        process.env.STS_BROKER_ACCESS_KEY_SECRET || accessKeySecret,
      endpoint,
      roleArn: assumeRoleArn,
      roleSessionName,
      durationSeconds,
      ossBucket: bucket,
      ossRootPrefix: rootPrefix,
    },
  };
}

function normalizeRootPrefix(prefix) {
  if (!prefix) {
    return "shared/";
  }

  return prefix.endsWith("/") ? prefix : prefix + "/";
}

module.exports = {
  getAppConfig,
};
