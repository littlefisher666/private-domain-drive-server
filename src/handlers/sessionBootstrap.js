const { getAppConfig } = require("../config/appConfig");
const {
  authenticateDemoUser,
  getCapabilitiesForRole,
} = require("../config/identity");
const {
  buildStsBrokerPayload,
  issueStsCredentials,
} = require("../services/stsService");
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

  const account = request.body.account;
  const password = request.body.password;
  if (typeof account !== "string" || typeof password !== "string") {
    return error({
      code: "BAD_REQUEST",
      message: "account and password are required",
      requestId: request.requestId,
    });
  }

  const identity = authenticateDemoUser(account, password);
  if (!identity) {
    return error({
      code: "UNAUTHORIZED",
      message: "账号或口令错误",
      requestId: request.requestId,
      statusCode: 401,
    });
  }

  let credentials;
  let stsBroker;

  try {
    credentials = await issueStsCredentials(config.sts);
    stsBroker = buildStsBrokerPayload(config.stsBroker);
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
      stsBroker,
      oss: config.oss,
      user: {
        userId: identity.userId,
        displayName: identity.displayName,
        role: identity.role,
        account: identity.account,
      },
      capabilities: getCapabilitiesForRole(identity.role),
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
