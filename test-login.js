// test-login.js
import bcrypt from "bcryptjs";

// --- CONFIG: replace with your new password and hash ---
const TEST_PASSWORD = "ilOVJUoLsxwX9gttrwx6OSM9j9Eo9KKWbzb9xtCFOS9pjMHQf0xJ33xs9BCnr6sVoDzhiVBfiOLBUAOt7ZYM1Ne0W0eIGvoSS1ZTxQuP1pmbY9KK0ezmxiHjspeVoF3C";
const TEST_HASH     = "$2b$12$CO7ynzHtk.sX9loyhiggWOFYxf73umRxd8DqqGMcVxZMG6hXRahwq"; // copy exactly
// ------------------------------

/**
 * Simulates verifyPassword from security.js
 */
async function verifyPassword(plaintext) {
  const hash = TEST_HASH;
  if (!hash || (!hash.startsWith("$2b$") && !hash.startsWith("$2a$"))) {
    return false;
  }
  return bcrypt.compare(plaintext, hash);
}

async function runTest() {
  const result = await verifyPassword(TEST_PASSWORD);
  console.log("Password verification result:", result); // true/false
}

runTest();
