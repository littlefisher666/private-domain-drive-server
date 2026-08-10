const assert = require("node:assert/strict");
const { handler } = require("../src/handler");
const { formatDateTime } = require("../src/utils/time");
const {
  buildOssScopedPolicy,
  normalizeRootPrefix,
} = require("../src/services/stsService");

function hasStsEnv() {
  return Boolean(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
      process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
      process.env.STS_ASSUME_ROLE_ARN
  );
}

async function invoke(event, context = {}) {
  return handler(event, context);
}

async function runHealthCheck() {
  const result = await invoke({
    path: "/api/v1/health?probe=1",
    httpMethod: "GET",
    requestContext: { requestId: "test-health" },
  });

  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "OK");
  assert.equal(payload.message, "success");
  assert.equal(payload.requestId, "test-health");
  assert.equal(payload.data.status, "up");
  assert.equal(payload.data.version, "0.1.0");
  assert.equal(payload.data.runtime, "nodejs20");
}

async function runCapabilitiesCheck() {
  const result = await invoke({
    path: "/api/v1/me/capabilities",
    httpMethod: "GET",
    requestContext: { requestId: "test-capabilities" },
  });

  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "OK");
  assert.equal(payload.requestId, "test-capabilities");
  assert.equal(payload.data.userId, "demo-user");
  assert.equal(payload.data.role, "member");
  assert.equal(payload.data.rootPrefix, "shared/");
  assert.deepEqual(payload.data.capabilities, {
    list: true,
    download: true,
    upload: true,
    delete: false,
    preview: true,
  });
}

async function runBootstrapValidationCheck() {
  const missingBody = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    requestContext: { requestId: "test-bootstrap-missing-body" },
  });
  assert.equal(missingBody.statusCode, 400);
  const missingPayload = JSON.parse(missingBody.body);
  assert.equal(missingPayload.code, "BAD_REQUEST");
  assert.equal(missingPayload.message, "Request body must be a JSON object");

  const arrayBody = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify(["macos"]),
    requestContext: { requestId: "test-bootstrap-array-body" },
  });
  assert.equal(arrayBody.statusCode, 400);
  assert.equal(JSON.parse(arrayBody.body).code, "BAD_REQUEST");
}

async function runBootstrapCheck() {
  const result = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify({ platform: "macos", appVersion: "0.1.0" }),
    requestContext: { requestId: "test-bootstrap" },
  });

  const payload = JSON.parse(result.body);

  if (hasStsEnv()) {
    assert.equal(result.statusCode, 200);
    assert.equal(payload.code, "OK");
    assert.equal(payload.data.oss.rootPrefix, "shared/");
    assert.equal(payload.data.user.userId, "demo-user");
    assert.equal(typeof payload.data.credentials.accessKeyId, "string");
    assert.match(payload.data.credentials.expiration, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(payload.data.constraints.multipartUploadThresholdBytes, 10485760);
    return;
  }

  assert.equal(result.statusCode, 503);
  assert.equal(payload.code, "SERVICE_UNAVAILABLE");
  assert.match(payload.message, /^Missing /);
}

async function runRefreshCheck() {
  const result = await invoke({
    path: "/api/v1/session/refresh",
    httpMethod: "POST",
    requestContext: { requestId: "test-refresh" },
  });

  const payload = JSON.parse(result.body);

  if (hasStsEnv()) {
    assert.equal(result.statusCode, 200);
    assert.equal(payload.code, "OK");
    assert.equal(typeof payload.data.credentials.securityToken, "string");
    assert.match(payload.data.credentials.expiration, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    return;
  }

  assert.equal(result.statusCode, 503);
  assert.equal(payload.code, "SERVICE_UNAVAILABLE");
}

async function runNotFoundCheck() {
  const result = await invoke({
    path: "/api/v1/unknown",
    httpMethod: "GET",
    requestContext: { requestId: "test-not-found" },
  });

  assert.equal(result.statusCode, 404);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "NOT_FOUND");
  assert.equal(payload.requestId, "test-not-found");
}

function runUtilityChecks() {
  assert.equal(formatDateTime("2026-06-05T12:00:00Z"), "2026-06-05 12:00:00");
  assert.equal(normalizeRootPrefix("shared"), "shared/");

  const policy = JSON.parse(
    buildOssScopedPolicy({
      ossBucket: "private-domain-drive",
      ossRootPrefix: "shared/",
    })
  );
  assert.equal(policy.Version, "1");
  assert.equal(policy.Statement.length, 2);
  assert.equal(
    policy.Statement[0].Resource[0],
    "acs:oss:*:*:private-domain-drive/shared/*"
  );
}

async function main() {
  runUtilityChecks();
  await runHealthCheck();
  await runCapabilitiesCheck();
  await runBootstrapValidationCheck();
  await runBootstrapCheck();
  await runRefreshCheck();
  await runNotFoundCheck();
  console.log("All handler tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
