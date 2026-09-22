const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in process.env)) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

loadDotEnv();

const { handler } = require("./src/handler");
const { getMissingRequiredVariables } = require("./src/config/appConfig");

const missingVariables = getMissingRequiredVariables();
if (missingVariables.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `[config] Missing required environment variables: ${missingVariables.join(", ")}\n` +
      "[config] Health check remains available, but session bootstrap will return 503 until they are set."
  );
}

const port = Number(process.env.PORT || 9000);

const server = http.createServer(async (req, res) => {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString("utf8");

    const event = {
      path: req.url || "/",
      httpMethod: req.method || "GET",
      headers: req.headers,
      body,
      isBase64Encoded: false,
      requestContext: {
        requestId: `local-${Date.now()}`,
      },
    };

    try {
      const response = await handler(event, {});
      res.writeHead(response.statusCode || 200, response.headers || {});
      res.end(response.body || "");
    } catch (error) {
      res.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(
        JSON.stringify({
          code: "INTERNAL_ERROR",
          message: error.message || "Unknown error",
          requestId: event.requestContext.requestId,
        })
      );
    }
  });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Local FC server listening on http://127.0.0.1:${port}`);
});
