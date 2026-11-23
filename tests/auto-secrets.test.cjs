const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const crypto = require("node:crypto");
const nacl = require("../dashboard/vendor/nacl-fast.js");
const blake2b = require("../dashboard/vendor/blake2b-browser.js");
const secrets = require("../dashboard/secret-crypto.js");

test("bundled BLAKE2b-192 matches standard vectors (digest size, not truncation)", () => {
  const hex = value => Buffer.from(value).toString("hex");
  assert.equal(hex(blake2b(Buffer.from("abc"), null, 24)),
    "56a17e38cc371a46b12c32f18e0c61de2a84e9c2555b114e");
  assert.equal(hex(blake2b(Uint8Array.from({ length: 64 }, (_, i) => i), null, 24)),
    "aa054507b4916837a6d2b35b1ce7c525facdb7868ed55a8a");
});

test("GitHub Actions Secrets crypto_box_seal format decrypts using libsodium compatible box.open", () => {
  const recipient = nacl.box.keyPair();
  const publicKey = Buffer.from(recipient.publicKey).toString("base64");
  const plain = "Senha-com-acentos-🔐-exclusiva-para-um-app";
  const sealed = Buffer.from(secrets.seal(plain, publicKey, { nacl, blake2b }), "base64");
  assert.equal(sealed.length, 32 + 16 + Buffer.byteLength(plain));
  const ephemeralPublic = sealed.subarray(0, 32);
  const nonce = blake2b(Buffer.concat([ephemeralPublic, recipient.publicKey]), null, 24);
  const opened = nacl.box.open(sealed.subarray(32), nonce, ephemeralPublic, recipient.secretKey);
  assert.ok(opened, "sealed box must decrypt");
  assert.equal(Buffer.from(opened).toString("utf8"), plain);
  assert.equal(secrets.makePayload("value", {key_id:"example",key:publicKey}, {nacl,blake2b}).key_id, "example");
});

test("password generator uses secure randomness and 36 bytes entropy", () => {
  const a = secrets.generatePassword(crypto.webcrypto);
  const b = secrets.generatePassword(crypto.webcrypto);
  assert.equal(a.length, 48);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
  assert.throws(() => secrets.generatePassword({}), /HTTPS/);
});

test("bad public keys and empty secret values fail closed", () => {
  assert.throws(() => secrets.seal("anything", "", {nacl,blake2b}), /inválida/);
  assert.throws(() => secrets.seal("anything", Buffer.from("tiny").toString("base64"), {nacl,blake2b}), /32 bytes/);
  assert.throws(() => secrets.seal("", Buffer.alloc(32).toString("base64"), {nacl,blake2b}), /vazio/);
});

test("dashboard ships local crypto, checks existing secrets and encrypts before PUT", () => {
  const page = fs.readFileSync("dashboard/index.html","utf8");
  const wizard = fs.readFileSync("dashboard/signing-setup.js","utf8");
  const app = fs.readFileSync("dashboard/app.js","utf8");
  for (const name of ["nacl-fast.js","blake2b-browser.js","secret-crypto.js","signing-setup.js"])
    assert.ok(page.includes('src="./' + (name === "nacl-fast.js" || name === "blake2b-browser.js" ? "vendor/" : "") + name + '"'));
  for (const id of ["keygen-auto-start","keygen-confirm","keygen-saved-check",
    "keygen-password-save","keygen-backup-confirmed","keygen-auto-configure",
    "existing-key-file","existing-key-upload"])
    assert.match(page, new RegExp('id="' + id + '"'));
  assert.match(wizard, /\/actions\/secrets\/public-key/);
  assert.match(wizard, /\/actions\/secrets\?per_page=100/);
  assert.match(wizard, /makePayload\(value, publicKey\)/);
  assert.match(wizard, /if \(names\.has\("ANDROID_KEYSTORE_BASE64"\)\)/);
  assert.match(wizard, /ANDROID_KEYSTORE_BASE64", base64\)/);
  assert.match(app, /UniversalSigningSetup\.init/);
  assert.match(app, /UniversalSigningSetup\?\.onUnlock\(password\)/);
  assert.doesNotMatch(wizard, /localStorage|sessionStorage|console\.log\(/);
});
