const { ConfigError } = require("../utils/configError");

let cachedClient = null;
let cachedClientConfig = null;

function getOssClient(ossConfig) {
  validateOssConfig(ossConfig);

  const fingerprint = [
    ossConfig.accessKeyId,
    ossConfig.accessKeySecret,
    ossConfig.region,
    ossConfig.bucket,
  ].join("|");

  if (cachedClient && cachedClientConfig === fingerprint) {
    return cachedClient;
  }

  const OSS = require("ali-oss");
  try {
    cachedClient = new OSS({
      region: `oss-${ossConfig.region}`,
      accessKeyId: ossConfig.accessKeyId,
      accessKeySecret: ossConfig.accessKeySecret,
      bucket: ossConfig.bucket,
      endpoint: ossConfig.endpoint.startsWith("http")
        ? ossConfig.endpoint
        : `https://${ossConfig.endpoint}`,
    });
  } catch (error) {
    cachedClient = null;
    cachedClientConfig = null;
    throw new ConfigError(
      `OSS client initialization failed: ${sanitize(error)}`
    );
  }
  cachedClientConfig = fingerprint;
  return cachedClient;
}

async function getObjectText(ossConfig, objectKey) {
  const client = getOssClient(ossConfig);
  try {
    const result = await client.get(String(objectKey).replace(/^\/+/, ""));
    return result.content.toString("utf8");
  } catch (error) {
    throw new ConfigError(
      `Unable to load users file from OSS: ${sanitize(error)}`
    );
  }
}

async function putObjectText(ossConfig, objectKey, text) {
  const client = getOssClient(ossConfig);
  try {
    await client.put(
      String(objectKey).replace(/^\/+/, ""),
      Buffer.from(text, "utf8")
    );
  } catch (error) {
    throw new ConfigError(
      `Unable to update users file in OSS: ${sanitize(error)}`
    );
  }
}

function validateOssConfig(ossConfig) {
  if (!ossConfig?.accessKeyId) {
    throw new ConfigError("Missing PDD_SERVER_OSS_ACCESS_KEY_ID");
  }
  if (!ossConfig?.accessKeySecret) {
    throw new ConfigError("Missing PDD_SERVER_OSS_ACCESS_KEY_SECRET");
  }
  if (!ossConfig?.bucket || !ossConfig?.region) {
    throw new ConfigError("Missing OSS users object configuration");
  }
}

function sanitize(error) {
  const message = error?.message || String(error);
  return message.replace(/\bLTAI[\w-]{8,}\b/g, "***");
}

module.exports = { getObjectText, putObjectText };
