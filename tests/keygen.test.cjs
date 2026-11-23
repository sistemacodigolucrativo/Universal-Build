const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { encryptKeystore, decryptKeystore } = require("../scripts/keygen-encrypt.cjs");
const { decrypt, toBase64 } = require("../dashboard/keygen-client.js");
const pass = "this-is-a-long-stored-secret-for-test-ONLY!";
const key = crypto.randomBytes(253);
function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
test("JKS recovery works in browser WebCrypto with no private keys published in clear", async () => {
  const encrypted = encryptKeystore(key, pass);
  assert.equal(encrypted.subarray(0, 6).toString(), "UBKEY1");
  assert.ok(!encrypted.includes(key));
  assert.deepEqual(decryptKeystore(encrypted, pass), key);
  const decoded = await decrypt(toArrayBuffer(encrypted), pass, crypto.webcrypto);
  assert.deepEqual(Buffer.from(decoded), key);
  assert.equal(Buffer.from(toBase64(decoded), "base64").toString("hex"), key.toString("hex"));
});
test("encrypted artifacts reject wrong password, tampering and invalid formats", async () => {
  const encrypted = encryptKeystore(key, pass);
  assert.throws(() => decryptKeystore(encrypted, "incorrect-passphrase-long-enough"), /auth|authenticate/i);
  await assert.rejects(decrypt(toArrayBuffer(encrypted), "incorrect-passphrase-long-enough", crypto.webcrypto), /incorreta/);
  const tampered = Buffer.from(encrypted);
  tampered[60] ^= 0x40;
  await assert.rejects(decrypt(toArrayBuffer(tampered), pass, crypto.webcrypto), /danificado/);
  await assert.rejects(decrypt(toArrayBuffer(Buffer.from("garbage")), pass, crypto.webcrypto), /inválido/);
  assert.throws(() => encryptKeystore(key, "weak"), /20 caracteres/);
});
test("keygen requires secrets and never uploads a plaintext keystore", () => {
  const yml = fs.readFileSync("templates/android-keygen.yml", "utf8");
  const runner = fs.readFileSync(".github/workflows/keygen-reusable.yml", "utf8");
  const html = fs.readFileSync("dashboard/index.html", "utf8");
  const js = fs.readFileSync("dashboard/app.js", "utf8");
  assert.match(yml, /workflow_dispatch:/);
  assert.match(runner, /ANDROID_KEYSTORE_PASSWORD:/);
  assert.match(runner, /EXISTING_UPLOAD_KEY/);
  assert.match(runner, /-storetype PKCS12/);
  assert.match(runner, /upload-key\.jks\.ubenc/);
  assert.match(runner, /upload-certificate\.pem/);
  assert.doesNotMatch(runner, /upload-artifact[\s\S]*path: [^\n]*upload-key\.jks(?!\.ubenc)/);
  assert.match(html, /keygen-recovered/);
  assert.match(js, /ensureKeygenWorkflow/);
  assert.match(js, /ensureSignWorkflow/);
});
