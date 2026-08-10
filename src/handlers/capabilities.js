const { getAppConfig } = require("../config/appConfig");
const {
  getDemoIdentity,
  getMemberCapabilities,
} = require("../config/identity");
const { success } = require("../utils/response");

function getCapabilitiesHandler(request) {
  const config = getAppConfig();
  const identity = getDemoIdentity();

  return success(
    {
      userId: identity.userId,
      role: identity.role,
      rootPrefix: config.oss.rootPrefix,
      capabilities: getMemberCapabilities(),
    },
    request.requestId
  );
}

module.exports = {
  getCapabilitiesHandler,
};
