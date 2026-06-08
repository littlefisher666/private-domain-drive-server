const { routeRequest } = require("./routes");
const { parseHttpRequest } = require("./utils/request");
const { internalError } = require("./utils/response");

async function handler(event, context) {
  try {
    const request = parseHttpRequest(event, context);
    return await routeRequest(request);
  } catch (error) {
    return internalError({
      message: error.message || "Unexpected server error",
      requestId: context?.requestId || "unknown-request",
    });
  }
}

module.exports = {
  handler,
};
