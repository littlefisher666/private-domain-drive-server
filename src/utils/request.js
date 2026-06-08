function parseHttpRequest(event, context) {
  const normalizedEvent = normalizeEvent(event);
  const path = normalizedEvent.path || normalizedEvent.rawPath || "/";
  const method = (normalizedEvent.httpMethod || normalizedEvent.method || "GET").toUpperCase();
  const headers = normalizedEvent.headers || {};
  const requestId =
    normalizedEvent.requestContext?.requestId ||
    normalizedEvent.requestId ||
    context?.requestId ||
    `req-${Date.now()}`;

  return {
    path,
    method,
    headers,
    requestId,
    body: parseBody(normalizedEvent.body, normalizedEvent.isBase64Encoded),
    rawBody: normalizedEvent.body || "",
    query: normalizedEvent.queryParameters || normalizedEvent.query || {},
  };
}

function normalizeEvent(event) {
  if (!event) {
    return {};
  }

  if (typeof event === "string") {
    try {
      return JSON.parse(event);
    } catch (_) {
      return {
        body: event,
      };
    }
  }

  return event;
}

function parseBody(body, isBase64Encoded) {
  if (!body) {
    return null;
  }

  const raw = isBase64Encoded
    ? Buffer.from(body, "base64").toString("utf8")
    : body;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

module.exports = {
  parseHttpRequest,
};
