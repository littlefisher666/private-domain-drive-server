const { getAppConfig } = require("../config/appConfig");
const { issueStsCredentials } = require("../services/stsService");
const { ConfigError } = require("../utils/configError");
const { error, serviceUnavailable, success } = require("../utils/response");

async function bootstrapSessionHandler(request) {
  const config = getAppConfig();

  if (!request.body || typeof request.body !== "object") {
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

  return success(
    {
      credentials,
      oss: config.oss,
      user: {
        userId: "demo-user",
        displayName: "Demo User",
        role: "member",
      },
      capabilities: {
        list: true,
        download: true,
        upload: true,
        delete: false,
        preview: true,
      },
      constraints: config.constraints,
    },
    request.requestId
  );
}

module.exports = {
  bootstrapSessionHandler,
};
