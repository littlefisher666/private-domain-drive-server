function parseHttpRequest(event, context) {
  const normalizedEvent = normalizeEvent(event);
  const path = normalizePath(extractPath(normalizedEvent));
  const method = extractMethod(normalizedEvent);
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

function extractPath(event) {
  const candidates = [
    event.path,
    event.rawPath,
    event.rawHttpPath,
    event.requestContext?.http?.path,
    event.requestContext?.path,
    event.requestUri,
    event.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "/";
}

function extractMethod(event) {
  const candidates = [
    event.httpMethod,
    event.method,
    event.requestContext?.http?.method,
    event.requestContext?.httpMethod,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }

  return "GET";
}

function normalizePath(path) {
  if (!path || typeof path !== "string") {
    return "/";
  }

  let value = path.trim();

  // 兼容完整 URL 或 FC 代理路径里带 host 的情况
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname || "/";
    } catch (_) {
      // keep original value
    }
  }

  const queryIndex = value.indexOf("?");
  if (queryIndex >= 0) {
    value = value.slice(0, queryIndex) || "/";
  }

  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  // 统一去掉末尾斜杠，避免 /api/v1/health/ 匹配失败
  if (value.length > 1 && value.endsWith("/")) {
    value = value.slice(0, -1);
  }

  return value || "/";
}

function normalizeEvent(event) {
  if (!event) {
    return {};
  }

  if (Buffer.isBuffer(event)) {
    event = event.toString("utf8");
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
