const { json } = require("../utils/response");
const { healthHandler } = require("../handlers/health");
const { bootstrapSessionHandler } = require("../handlers/sessionBootstrap");
const { refreshSessionHandler } = require("../handlers/sessionRefresh");
const { getCapabilitiesHandler } = require("../handlers/capabilities");

async function routeRequest(request) {
  const { path, method } = request;

  if (path === "/api/v1/health" && method === "GET") {
    return healthHandler(request);
  }

  if (path === "/api/v1/session/bootstrap" && method === "POST") {
    return bootstrapSessionHandler(request);
  }

  if (path === "/api/v1/session/refresh" && method === "POST") {
    return refreshSessionHandler(request);
  }

  if (path === "/api/v1/me/capabilities" && method === "GET") {
    return getCapabilitiesHandler(request);
  }

  return json(
    {
      code: "NOT_FOUND",
      message: "Route not found",
      requestId: request.requestId,
    },
    404
  );
}

module.exports = {
  routeRequest,
};
