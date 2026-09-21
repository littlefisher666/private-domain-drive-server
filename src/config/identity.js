const { ConfigError } = require("../utils/configError");
const crypto = require("node:crypto");
const { getObjectText, putObjectText } = require("../services/ossService");

async function authenticateUser(account, password, ossConfig) {
  const users = await loadUsers(ossConfig);
  const key = String(account || "").trim();
  const user = users.find((item) => item.account === key);
  if (!user || !(await verifyPassword(password, user.password))) {
    return null;
  }

  return {
    userId: user.userId,
    displayName: user.displayName || key,
    account: key,
    mustResetPassword: user.mustResetPassword === true,
  };
}

async function changeUserPassword(account, currentPassword, newPassword, ossConfig) {
  const document = await loadUsersDocument(ossConfig);
  const user = document.users.find((item) => item.account === String(account || "").trim());
  if (!user || !(await verifyPassword(currentPassword, user.password))) {
    return false;
  }

  user.password = await hashPassword(newPassword);
  user.mustResetPassword = false;
  await putObjectText(
    ossConfig,
    ossConfig.usersObjectKey,
    JSON.stringify(document.source, null, 2) + "\n"
  );
  return true;
}

async function loadUsers(ossConfig) {
  const document = await loadUsersDocument(ossConfig);
  return document.users;
}

async function loadUsersDocument(ossConfig) {
  let raw;
  try {
    raw = await getObjectText(ossConfig, ossConfig.usersObjectKey);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw new ConfigError(`Unable to load users file from OSS: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`Invalid users JSON in OSS: ${error.message}`);
  }

  const users = Array.isArray(parsed) ? parsed : parsed?.users;
  if (!Array.isArray(users)) {
    throw new ConfigError("Users JSON must be an array or an object with a users array");
  }

  return {
    users: users.filter(
      (user) =>
        user &&
        typeof user.account === "string" &&
        typeof user.password === "string" &&
        typeof user.userId === "string"
    ),
    source: parsed,
  };
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") {
    return false;
  }
  const [algorithm, salt, expectedHex, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[0-9a-f]{32}$/i.test(salt || "") ||
    !/^[0-9a-f]{128}$/i.test(expectedHex || "") ||
    extra.length > 0
  ) {
    return false;
  }

  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      const expected = Buffer.from(expectedHex, "hex");
      resolve(crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}

function getDefaultCapabilities() {
  return {
    list: true,
    download: true,
    upload: true,
    delete: true,
    preview: true,
  };
}

module.exports = {
  authenticateUser,
  changeUserPassword,
  hashPassword,
  verifyPassword,
  loadUsers,
  getDefaultCapabilities,
};
