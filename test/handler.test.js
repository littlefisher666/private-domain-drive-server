const assert = require("node:assert/strict");
const http = require("node:http");
const { handler } = require("../src/handler");
const { formatDateTime } = require("../src/utils/time");
const { normalizeRootPrefix } = require("../src/config/appConfig");
const {
  hashPassword,
  verifyPassword,
  authenticateUser,
} = require("../src/config/identity");

const MOCK_OSS_PORT = 0; // random free port, resolved after listen
let mockUsersBody = null;
let lastPutBody = null;

const previousEnv = {};
const requiredVars = [
  "PDD_SERVER_OSS_ACCESS_KEY_ID",
  "PDD_SERVER_OSS_ACCESS_KEY_SECRET",
  "PDD_CLIENT_OSS_ACCESS_KEY_ID",
  "PDD_CLIENT_OSS_ACCESS_KEY_SECRET",
  "PDD_OSS_BUCKET",
  "PDD_OSS_REGION",
  "PDD_OSS_ENDPOINT",
  "PDD_OSS_ROOT_PREFIX",
];

function setTestEnv(endpoint) {
  process.env.PDD_SERVER_OSS_ACCESS_KEY_ID = "LTAItestserverkeyid";
  process.env.PDD_SERVER_OSS_ACCESS_KEY_SECRET = "test-server-secret";
  process.env.PDD_CLIENT_OSS_ACCESS_KEY_ID = "LTAItestclientkeyid";
  process.env.PDD_CLIENT_OSS_ACCESS_KEY_SECRET = "test-client-secret";
  process.env.PDD_OSS_BUCKET = "private-domain-drive";
  process.env.PDD_OSS_REGION = "cn-hangzhou";
  process.env.PDD_OSS_ENDPOINT = endpoint;
  process.env.PDD_OSS_ROOT_PREFIX = "shared/";
}

function clearRequiredVars() {
  for (const name of requiredVars) {
    previousEnv[name] = process.env[name];
    delete process.env[name];
  }
}

function restoreRequiredVars() {
  for (const name of requiredVars) {
    if (previousEnv[name] !== undefined) {
      process.env[name] = previousEnv[name];
    } else {
      delete process.env[name];
    }
  }
}

function currentUsersBody() {
  return mockUsersBody;
}

function startMockOssServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const url = req.url.split("?")[0];
        if (req.method === "GET" && url.endsWith("/config/users.json")) {
          const body = Buffer.from(currentUsersBody(), "utf8");
          res.writeHead(200, {
            "content-type": "application/json",
            etag: '"mock-etag"',
            "content-length": body.length,
          });
          res.end(body);
          return;
        }
        if (req.method === "PUT" && url.endsWith("/config/users.json")) {
          lastPutBody = Buffer.concat(chunks).toString("utf8");
          mockUsersBody = lastPutBody;
          res.writeHead(200, { etag: '"mock-etag-put"' });
          res.end();
          return;
        }
        res.writeHead(404, { "content-length": 0 });
        res.end();
      });
    });
    server.listen(MOCK_OSS_PORT, "127.0.0.1", () => resolve(server));
  });
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
}

async function runBootstrapUnauthorizedCheck() {
  const unauthorized = await invoke({
    path: "/api/v1/session/bootstrap",
    httpMethod: "POST",
    body: JSON.stringify({ account: "admin", password: "wrong" }),
    requestContext: { requestId: "test-bootstrap-unauthorized" },
  });
  assert.equal(unauthorized.statusCode, 401);
  const payload = JSON.parse(unauthorized.body);
  assert.equal(payload.code, "UNAUTHORIZED");
  assert.equal(payload.data, undefined);
}

async function runBootstrapMissingConfigCheck() {
  clearRequiredVars();
  try {
    const result = await invoke({
      path: "/api/v1/session/bootstrap",
      httpMethod: "POST",
      body: JSON.stringify({ account: "admin", password: "123456" }),
      requestContext: { requestId: "test-bootstrap-missing-config" },
    });
    assert.equal(result.statusCode, 503);
    const payload = JSON.parse(result.body);
    assert.equal(payload.code, "SERVICE_UNAVAILABLE");
    assert.match(payload.message, /^Missing required environment variables: /);
    assert.ok(!JSON.stringify(payload).includes("test-client-secret"));
  } finally {
    restoreRequiredVars();
  }
}

async function runBootstrapSuccessCheck() {
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

  assert.equal(result.statusCode, 200);
  const payload = JSON.parse(result.body);
  assert.equal(payload.code, "OK");
  assert.equal(payload.data.user.userId, "admin");
  assert.equal(payload.data.oss.rootPrefix, "shared/");
  assert.equal(payload.data.oss.bucket, "private-domain-drive");
  assert.equal(payload.data.oss.region, "cn-hangzhou");
  assert.equal(payload.data.oss.endpoint.startsWith("http://127.0.0.1"), true);
  assert.equal(payload.data.clientCredentials.accessKeyId, "LTAItestclientkeyid");
  assert.equal(payload.data.clientCredentials.accessKeySecret, "test-client-secret");
  assert.equal(payload.data.constraints.multipartUploadThresholdBytes, 10485760);
  assert.equal(payload.data.constraints.textPreviewMaxBytes, 524288);
  assert.deepEqual(payload.data.constraints.allowedPreviewExtensions, [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "pdf",
    "txt",
    "md",
  ]);

  // BREAKING：响应不再包含 STS 临时凭证与 stsBroker
  const serialized = JSON.stringify(payload.data);
  assert.equal(serialized.includes("securityToken"), false);
  assert.equal(serialized.includes("stsBroker"), false);
  assert.equal(serialized.includes("expiration"), false);
  assert.equal(payload.data.credentials, undefined);
  assert.ok(!serialized.includes("test-server-secret"));
}

async function runRefreshRouteRemovedCheck() {
  const result = await invoke({
    path: "/api/v1/session/refresh",
    httpMethod: "POST",
    requestContext: { requestId: "test-refresh" },
  });

  assert.equal(result.statusCode, 404);
  assert.equal(JSON.parse(result.body).code, "NOT_FOUND");
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

async function runPasswordChangeRoundTripCheck() {
  const result = await invoke({
    path: "/api/v1/session/password",
    httpMethod: "POST",
    body: JSON.stringify({
      account: "admin",
      currentPassword: "123456",
      newPassword: "new-password-123",
    }),
    requestContext: { requestId: "test-password-change" },
  });
  assert.equal(result.statusCode, 200);
  assert.ok(lastPutBody, "changePassword should write users.json back to OSS");
  const document = JSON.parse(lastPutBody);
  const user = document.users.find((item) => item.account === "admin");
  assert.equal(user.mustResetPassword, false);
  assert.equal(await verifyPassword("new-password-123", user.password), true);
  assert.equal(await verifyPassword("123456", user.password), false);

  const loginAgain = await authenticateUser(
    "admin",
    "new-password-123",
    globalThis.__testOssConfig
  );
  assert.equal(loginAgain?.userId, "admin");
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
}

async function main() {
  runUtilityChecks();

  const passwordHash = await hashPassword("123456");
  const document = {
    users: [
      {
        userId: "admin",
        account: "admin",
        displayName: "admin",
        password: passwordHash,
        mustResetPassword: true,
      },
    ],
  };
  mockUsersBody = JSON.stringify(document);

  const server = await startMockOssServer();
  const { port } = server.address();
  setTestEnv(`http://127.0.0.1:${port}`);

  globalThis.__testOssConfig = {
    bucket: "private-domain-drive",
    region: "cn-hangzhou",
    endpoint: `http://127.0.0.1:${port}`,
    rootPrefix: "shared/",
    usersObjectKey: "config/users.json",
    accessKeyId: "LTAItestserverkeyid",
    accessKeySecret: "test-server-secret",
  };

  try {
    await runHealthCheck();
    await runFc3HttpEventCheck();
    await runBootstrapValidationCheck();
    await runBootstrapUnauthorizedCheck();
    await runBootstrapMissingConfigCheck();
    await runBootstrapSuccessCheck();
    await runRefreshRouteRemovedCheck();
    await runPasswordChangeValidationCheck();
    await runPasswordChangeRoundTripCheck();
    await runNotFoundCheck();
    console.log("All handler tests passed");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
