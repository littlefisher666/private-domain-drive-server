const { getAppConfig } = require("../config/appConfig");
const { changeUserPassword } = require("../config/identity");
const { ConfigError } = require("../utils/configError");
const { error, serviceUnavailable, success } = require("../utils/response");

async function changePasswordHandler(request) {
  if (!isPlainObject(request.body)) {
    return error({
      code: "BAD_REQUEST",
      message: "Request body must be a JSON object",
      requestId: request.requestId,
    });
  }

  const { account, currentPassword, newPassword } = request.body;
  if (
    typeof account !== "string" ||
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string"
  ) {
    return error({
      code: "BAD_REQUEST",
      message: "account, currentPassword and newPassword are required",
      requestId: request.requestId,
    });
  }
  if (newPassword.length < 8) {
    return error({
      code: "BAD_REQUEST",
      message: "newPassword must be at least 8 characters",
      requestId: request.requestId,
    });
  }

  try {
    const changed = await changeUserPassword(
      account,
      currentPassword,
      newPassword,
      getAppConfig().oss
    );
    if (!changed) {
      return error({
        code: "UNAUTHORIZED",
        message: "账号或当前口令错误",
        requestId: request.requestId,
        statusCode: 401,
      });
    }
    return success({ mustResetPassword: false }, request.requestId);
  } catch (err) {
    if (err instanceof ConfigError) {
      return serviceUnavailable({ message: err.message, requestId: request.requestId });
    }
    throw err;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = { changePasswordHandler };
