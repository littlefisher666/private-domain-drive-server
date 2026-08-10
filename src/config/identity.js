function getDemoIdentity() {
  return {
    userId: "demo-user",
    displayName: "Demo User",
    role: "member",
  };
}

function getMemberCapabilities() {
  return {
    list: true,
    download: true,
    upload: true,
    delete: false,
    preview: true,
  };
}

module.exports = {
  getDemoIdentity,
  getMemberCapabilities,
};
