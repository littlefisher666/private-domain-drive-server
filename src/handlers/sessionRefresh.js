const { getAppConfig } = require("../config/appConfig");
const { issueStsCredentials } = require("../services/stsService");
const { ConfigError } = require("../utils/configError");
const { serviceUnavailable, success } = require("../utils/response");

async function refreshSessionHandler(request) {
  const config = getAppConfig();
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
    },
    request.requestId
  );
}

module.exports = {
  refreshSessionHandler,
};
