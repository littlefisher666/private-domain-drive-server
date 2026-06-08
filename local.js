const http = require("node:http");

const { handler } = require("./src/handler");

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
