const assert = require("node:assert/strict");
const {
  hashPassword,
  verifyPassword,
} = require("../src/config/identity");

async function main() {
  const encoded = await hashPassword("correct horse battery staple");
  assert.match(encoded, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("wrong", encoded), false);
  assert.equal(await verifyPassword("anything", "plain-text-password"), false);
  assert.equal(await verifyPassword("anything", "scrypt$bad$not-a-hash"), false);
  assert.equal(await verifyPassword("anything", "scrypt$00112233445566778899aabbccddeeff$00"), false);
  console.log("Identity tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
