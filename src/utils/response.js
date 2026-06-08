function json(payload, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

function success(data, requestId, statusCode = 200) {
  return json(
    {
      code: "OK",
      message: "success",
      requestId,
      data,
    },
    statusCode
  );
}

function error({ code, message, requestId, statusCode = 400 }) {
  return json(
    {
      code,
      message,
      requestId,
    },
    statusCode
  );
}

function serviceUnavailable({ message = "Service unavailable", requestId }) {
  return error({
    code: "SERVICE_UNAVAILABLE",
    message,
    requestId,
    statusCode: 503,
  });
}

function internalError({ message = "Internal server error", requestId }) {
  return error({
    code: "INTERNAL_ERROR",
    message,
    requestId,
    statusCode: 500,
  });
}

module.exports = {
  json,
  success,
  error,
  serviceUnavailable,
  internalError,
};
