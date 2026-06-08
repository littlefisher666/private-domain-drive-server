function getAppConfig() {
  return {
    oss: {
      bucket: process.env.OSS_BUCKET || "private-domain-drive",
      region: process.env.OSS_REGION || "cn-hangzhou",
      endpoint: process.env.OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com",
      rootPrefix: process.env.OSS_ROOT_PREFIX || "shared/",
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
      accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || "",
      accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || "",
      endpoint: process.env.STS_ENDPOINT || "sts.cn-hangzhou.aliyuncs.com",
      assumeRoleArn: process.env.STS_ASSUME_ROLE_ARN || "",
      roleSessionName:
        process.env.STS_ROLE_SESSION_NAME || "private-domain-drive-session",
      durationSeconds: Number(process.env.STS_DURATION_SECONDS || 3600),
      ossBucket: process.env.OSS_BUCKET || "private-domain-drive",
      ossRootPrefix: process.env.OSS_ROOT_PREFIX || "shared/",
    },
  };
}

module.exports = {
  getAppConfig,
};
