const { getAppConfig } = require("../config/appConfig");
const { success } = require("../utils/response");

function getCapabilitiesHandler(request) {
  const config = getAppConfig();

  return success(
    {
      userId: "demo-user",
      role: "member",
      rootPrefix: config.oss.rootPrefix,
      capabilities: {
        list: true,
        download: true,
        upload: true,
        delete: false,
        preview: true,
      },
    },
    request.requestId
  );
}

module.exports = {
  getCapabilitiesHandler,
};
