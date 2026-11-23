/* Encrypt a generated upload keystore before putting it into a public Actions artifact.
   Output: ASCII UBKEY1 (6 bytes), salt (16), IV (12), GCM tag (16), ciphertext. */
"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");

const MAGIC = Buffer.from("UBKEY1", "ascii");
const ITERATIONS = 310000;
function encryptKeystore(keystore, passphrase, salt = crypto.randomBytes(16), iv = crypto.randomBytes(12)) {
  if (!Buffer.isBuffer(keystore) || keystore.length < 32 || keystore.length > 256 * 1024)
    throw new Error("Arquivo de chave inválido.");
  if (typeof passphrase !== "string" || [...passphrase].length < 20)
    throw new Error("Senha de assinatura deve ter pelo menos 20 caracteres.");
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(keystore), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
}
function decryptKeystore(bytes, passphrase) {
  const data = Buffer.from(bytes);
  if (data.length < 82 || !data.subarray(0, 6).equals(MAGIC)) throw new Error("Formato inválido.");
  const salt = data.subarray(6, 22), iv = data.subarray(22, 34), tag = data.subarray(34, 50);
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, "sha256");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(50)), decipher.final()]);
}
module.exports = { encryptKeystore, decryptKeystore, MAGIC, ITERATIONS };
if (require.main === module) {
  const input = process.env.UB_GENERATED_KEY;
  const output = process.env.UB_ENCRYPTED_OUTPUT;
  const password = process.env.UB_KEYSTORE_PASSWORD;
  if (!input || !output || !password) throw new Error("Parâmetros de geração ausentes.");
  const clear = fs.readFileSync(input);
  const encrypted = encryptKeystore(clear, password);
  fs.writeFileSync(output, encrypted, { mode: 0o600, flag: "wx" });
  clear.fill(0);
  console.log("Chave de upload protegida com AES-256-GCM; nenhuma chave privada foi publicada em texto claro.");
}
