const { ConfigError } = require("../utils/configError");

function getAppConfig() {
  const rootPrefix = normalizeRootPrefix(
    process.env.PDD_OSS_ROOT_PREFIX || "shared/"
  );

  return {
    oss: {
      bucket: process.env.PDD_OSS_BUCKET || "private-domain-drive",
      region: process.env.PDD_OSS_REGION || "cn-hangzhou",
      endpoint:
        process.env.PDD_OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com",
      rootPrefix,
      usersObjectKey: "config/users.json",
      accessKeyId: process.env.PDD_SERVER_OSS_ACCESS_KEY_ID || "",
      accessKeySecret: process.env.PDD_SERVER_OSS_ACCESS_KEY_SECRET || "",
    },
    clientCredentials: {
      accessKeyId: process.env.PDD_CLIENT_OSS_ACCESS_KEY_ID || "",
      accessKeySecret: process.env.PDD_CLIENT_OSS_ACCESS_KEY_SECRET || "",
    },
    constraints: {
      multipartUploadThresholdBytes: Number(
        process.env.PDD_MULTIPART_UPLOAD_THRESHOLD_BYTES || 10 * 1024 * 1024
      ),
      textPreviewMaxBytes: Number(
        process.env.PDD_TEXT_PREVIEW_MAX_BYTES || 512 * 1024
      ),
      allowedPreviewExtensions: (
        process.env.PDD_ALLOWED_PREVIEW_EXTENSIONS ||
        "jpg,jpeg,png,gif,pdf,txt,md"
      )
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    },
  };
}

function getMissingRequiredVariables() {
  const required = [
    "PDD_SERVER_OSS_ACCESS_KEY_ID",
    "PDD_SERVER_OSS_ACCESS_KEY_SECRET",
    "PDD_CLIENT_OSS_ACCESS_KEY_ID",
    "PDD_CLIENT_OSS_ACCESS_KEY_SECRET",
  ];
  return required.filter((name) => !process.env[name]);
}

function validateAppConfig() {
  const missing = getMissingRequiredVariables();
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function normalizeRootPrefix(prefix) {
  if (!prefix) {
    return "shared/";
  }

  return prefix.endsWith("/") ? prefix : prefix + "/";
}

module.exports = {
  getAppConfig,
  getMissingRequiredVariables,
  validateAppConfig,
  normalizeRootPrefix,
};
