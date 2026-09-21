const crypto = require("node:crypto");
const https = require("node:https");
const http = require("node:http");
const { ConfigError } = require("../utils/configError");

function getObjectText(ossConfig, objectKey) {
  if (!ossConfig?.accessKeyId) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_ID");
  }
  if (!ossConfig?.accessKeySecret) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  }
  if (!ossConfig?.bucket || !objectKey) {
    throw new ConfigError("Missing OSS users object configuration");
  }

  const endpoint = new URL(
    ossConfig.endpoint.startsWith("http")
      ? ossConfig.endpoint
      : `https://${ossConfig.endpoint}`
  );
  const key = String(objectKey).replace(/^\/+/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const resource = `/${ossConfig.bucket}/${key}`;
  const date = new Date().toUTCString();
  const signature = crypto
    .createHmac("sha1", ossConfig.accessKeySecret)
    .update(`GET\n\n\n${date}\n${resource}`)
    .digest("base64");

  return new Promise((resolve, reject) => {
    const transport = endpoint.protocol === "http:" ? http : https;
    const request = transport.request(
      {
        method: "GET",
        hostname: `${ossConfig.bucket}.${endpoint.hostname}`,
        port: endpoint.port || undefined,
        path: `/${encodedKey}`,
        headers: {
          Date: date,
          Authorization: `OSS ${ossConfig.accessKeyId}:${signature}`,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (response.statusCode !== 200) {
            reject(new Error(`OSS users file request failed (${response.statusCode})`));
            return;
          }
          resolve(body);
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

function putObjectText(ossConfig, objectKey, text) {
  if (!ossConfig?.accessKeyId) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_ID");
  }
  if (!ossConfig?.accessKeySecret) {
    throw new ConfigError("Missing ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  }
  if (!ossConfig?.bucket || !objectKey) {
    throw new ConfigError("Missing OSS users object configuration");
  }

  const endpoint = new URL(
    ossConfig.endpoint.startsWith("http")
      ? ossConfig.endpoint
      : `https://${ossConfig.endpoint}`
  );
  const key = String(objectKey).replace(/^\/+/, "");
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const resource = `/${ossConfig.bucket}/${key}`;
  const date = new Date().toUTCString();
  const contentType = "application/json; charset=utf-8";
  const signature = crypto
    .createHmac("sha1", ossConfig.accessKeySecret)
    .update(`PUT\n\n${contentType}\n${date}\n${resource}`)
    .digest("base64");
  const body = Buffer.from(text, "utf8");

  return new Promise((resolve, reject) => {
    const transport = endpoint.protocol === "http:" ? http : https;
    const request = transport.request(
      {
        method: "PUT",
        hostname: `${ossConfig.bucket}.${endpoint.hostname}`,
        port: endpoint.port || undefined,
        path: `/${encodedKey}`,
        headers: {
          Date: date,
          "Content-Type": contentType,
          "Content-Length": body.length,
          Authorization: `OSS ${ossConfig.accessKeyId}:${signature}`,
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`OSS users file update failed (${response.statusCode})`));
            return;
          }
          resolve();
        });
      }
    );
    request.on("error", reject);
    request.end(body);
  });
}

module.exports = { getObjectText, putObjectText };
