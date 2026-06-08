const assert = require("node:assert/strict");
const { handler } = require("../src/handler");

async function runHealthCheck() {
  const result = await handler(
    {
      path: "/api/v1/health",
      httpMethod: "GET",
      requestContext: {
        requestId: "test-health",
      },
    },
    {}
  );

  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "OK");
  assert.equal(payload.requestId, "test-health");
}

async function runBootstrapCheck() {
  const result = await handler(
    {
      path: "/api/v1/session/bootstrap",
      httpMethod: "POST",
      body: JSON.stringify({
        platform: "macos",
        appVersion: "0.1.0",
      }),
      requestContext: {
        requestId: "test-bootstrap",
      },
    },
    {}
  );

  const payload = JSON.parse(result.body);

  if (
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
    process.env.STS_ASSUME_ROLE_ARN
  ) {
    assert.equal(result.statusCode, 200);
    assert.equal(payload.code, "OK");
    assert.equal(payload.data.oss.rootPrefix, "shared/");
    return;
  }

  assert.equal(result.statusCode, 503);
  assert.equal(payload.code, "SERVICE_UNAVAILABLE");
}

async function runRefreshCheck() {
  const result = await handler(
    {
      path: "/api/v1/session/refresh",
      httpMethod: "POST",
      requestContext: {
        requestId: "test-refresh",
      },
    },
    {}
  );

  const payload = JSON.parse(result.body);

  if (
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
    process.env.STS_ASSUME_ROLE_ARN
  ) {
    assert.equal(result.statusCode, 200);
    assert.equal(payload.code, "OK");
    return;
  }

  assert.equal(result.statusCode, 503);
  assert.equal(payload.code, "SERVICE_UNAVAILABLE");
}

Promise.all([runHealthCheck(), runBootstrapCheck(), runRefreshCheck()]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
