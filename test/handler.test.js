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

async function runFc3HttpEventCheck() {
  // 阿里云 FC3 HTTP 触发器常见事件结构：path/method 在 requestContext.http
  const result = await invoke({
    version: "v1",
    rawPath: "/api/v1/health/",
    headers: {
      host: "example.cn-hangzhou.fcapp.run",
    },
    queryParameters: {},
    body: "",
    isBase64Encoded: false,
    requestContext: {
      requestId: "1-fc3-health",
      http: {
        method: "GET",
        path: "/api/v1/health/",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "curl/8.0.0",
      },
    },
  });

  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "OK");
  assert.equal(payload.requestId, "1-fc3-health");
  assert.equal(payload.data.status, "up");

  // 仅有 requestContext.http，无顶层 path/httpMethod 时也应能路由
  const nestedOnly = await invoke({
    requestContext: {
      requestId: "1-fc3-nested-only",
      http: {
        method: "GET",
        path: "/api/v1/health",
      },
    },
  });
  assert.equal(nestedOnly.statusCode, 200);
  assert.equal(JSON.parse(nestedOnly.body).code, "OK");
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

  const missingCredentials = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify({ platform: "macos" }),
    requestContext: { requestId: "test-bootstrap-missing-account" },
  });
  assert.equal(missingCredentials.statusCode, 400);
  assert.equal(JSON.parse(missingCredentials.body).code, "BAD_REQUEST");

  const unauthorized = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify({ account: "admin", password: "wrong" }),
    requestContext: { requestId: "test-bootstrap-unauthorized" },
  });
  assert.equal(unauthorized.statusCode, 503);
  assert.equal(JSON.parse(unauthorized.body).code, "SERVICE_UNAVAILABLE");
}

async function runBootstrapCheck() {
  const result = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify({
      account: "admin",
      password: "123456",
      platform: "macos",
      appVersion: "0.1.0",
    }),
    requestContext: { requestId: "test-bootstrap" },
  });

  const payload = JSON.parse(result.body);

  if (hasStsEnv()) {
    assert.equal(result.statusCode, 200);
    assert.equal(payload.code, "OK");
    assert.equal(payload.data.oss.rootPrefix, "shared/");
    assert.equal(payload.data.user.userId, "admin");
    assert.equal(typeof payload.data.credentials.accessKeyId, "string");
    assert.match(payload.data.credentials.expiration, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(payload.data.constraints.multipartUploadThresholdBytes, 10485760);
    assert.equal(typeof payload.data.stsBroker.accessKeyId, "string");
    assert.equal(typeof payload.data.stsBroker.roleArn, "string");
    assert.equal(typeof payload.data.stsBroker.policy, "string");
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

async function runPasswordChangeValidationCheck() {
  const missingBody = await invoke({
    path: "/api/v1/session/password",
    httpMethod: "POST",
    requestContext: { requestId: "test-password-missing-body" },
  });
  assert.equal(missingBody.statusCode, 400);
  assert.equal(JSON.parse(missingBody.body).code, "BAD_REQUEST");

  const missingField = await invoke({
    path: "/api/v1/session/password",
    httpMethod: "POST",
    body: JSON.stringify({ account: "admin", currentPassword: "old" }),
    requestContext: { requestId: "test-password-missing-field" },
  });
  assert.equal(missingField.statusCode, 400);

  const shortPassword = await invoke({
    path: "/api/v1/session/password",
    httpMethod: "POST",
    body: JSON.stringify({
      account: "admin",
      currentPassword: "old",
      newPassword: "short",
    }),
    requestContext: { requestId: "test-password-short" },
  });
  assert.equal(shortPassword.statusCode, 400);
  assert.equal(JSON.parse(shortPassword.body).code, "BAD_REQUEST");
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
  assert.ok(policy.Statement[0].Action.includes("oss:ProcessObject"));
  assert.equal(
    policy.Statement[0].Resource[0],
    "acs:oss:*:*:private-domain-drive/shared/*"
  );
}

async function main() {
  runUtilityChecks();
  await runHealthCheck();
  await runFc3HttpEventCheck();
  await runBootstrapValidationCheck();
  await runBootstrapCheck();
  await runRefreshCheck();
  await runPasswordChangeValidationCheck();
  await runNotFoundCheck();
  console.log("All handler tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
