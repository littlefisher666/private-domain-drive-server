const { getAppConfig } = require("../config/appConfig");
const {
  getDemoIdentity,
  getMemberCapabilities,
} = require("../config/identity");
const { issueStsCredentials } = require("../services/stsService");
const { ConfigError } = require("../utils/configError");
const { error, serviceUnavailable, success } = require("../utils/response");

async function bootstrapSessionHandler(request) {
  const config = getAppConfig();

  if (!isPlainObject(request.body)) {
    return error({
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object",
      requestId: request.requestId,
    });
  }

  let credentials;

  try {
    credentials = await issueStsCredentials(config.sts);
  } catch (err) {
    if (err instanceof ConfigError) {
      return serviceUnavailable({
        message: err.message,
        requestId: request.requestId,
      });
    }

    throw err;
  }

  const identity = getDemoIdentity();

  return success(
    {
      credentials,
      oss: config.oss,
      user: {
        userId: identity.userId,
        displayName: identity.displayName,
        role: identity.role,
      },
      capabilities: getMemberCapabilities(),
      constraints: config.constraints,
    },
    request.requestId
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  bootstrapSessionHandler,
};
