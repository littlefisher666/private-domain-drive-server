function getDemoIdentity() {
  return {
    userId: "demo-user",
    displayName: "Demo User",
    role: "member",
  };
}

const DEMO_USERS = {
  admin: {
    password: "123456",
    userId: "admin",
    displayName: "admin",
  },
  member: {
    password: "123456",
    userId: "member",
    displayName: "member",
  },
};

function authenticateDemoUser(account, password) {
  const key = String(account || "").trim();
  const user = DEMO_USERS[key];
  if (!user || user.password !== String(password || "")) {
    return null;
  }

  return {
    userId: user.userId,
    displayName: user.displayName,
    role: "member",
    account: key,
  };
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

function getMemberCapabilities() {
  return getDefaultCapabilities();
}

function getAdminCapabilities() {
  return getDefaultCapabilities();
}

function getCapabilitiesForRole() {
  return getDefaultCapabilities();
}

module.exports = {
  getDemoIdentity,
  authenticateDemoUser,
  getDefaultCapabilities,
  getMemberCapabilities,
  getAdminCapabilities,
  getCapabilitiesForRole,
};
