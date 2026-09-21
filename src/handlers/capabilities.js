const { getAppConfig } = require("../config/appConfig");
const { getDefaultCapabilities } = require("../config/identity");
const { success } = require("../utils/response");

function getCapabilitiesHandler(request) {
  const config = getAppConfig();
  return success(
    {
      userId: null,
      rootPrefix: config.oss.rootPrefix,
      capabilities: getDefaultCapabilities(),
    },
    request.requestId
  );
}

module.exports = {
  getCapabilitiesHandler,
};
