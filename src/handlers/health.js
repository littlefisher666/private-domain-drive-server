const { success } = require("../utils/response");

function healthHandler(request) {
  return success(
    {
      status: "up",
      version: "0.1.0",
      runtime: "nodejs20",
    },
    request.requestId
  );
}

module.exports = {
  healthHandler,
};
