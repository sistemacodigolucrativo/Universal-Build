/* GitHub Actions secret encryption: libsodium crypto_box_seal compatible.
 * Never transmit plaintext keys/passwords; encryption happens in this browser.
 * Locally vendored TweetNaCl.js + blakejs, no CDN, no backend. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UniversalGithubSecrets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function decode64(encoded) {
    if (typeof encoded !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
        encoded.length % 4 !== 0) throw new Error("Chave pública do GitHub inválida.");
    const bytes = atob(encoded);
    return Uint8Array.from(bytes, c => c.charCodeAt(0));
  }
  function encode64(bytes) {
    let result = "";
    for (let i = 0; i < bytes.length; i += 8192)
      result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
  }
  function generatePassword(webcrypto = globalThis.crypto) {
    if (!webcrypto || !webcrypto.getRandomValues)
      throw new Error("HTTPS e geração segura de números aleatórios são obrigatórios.");
    const random = new Uint8Array(36);
    webcrypto.getRandomValues(random);
    const password = encode64(random).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    random.fill(0);
    return password;
  }
  function seal(plaintext, recipientPublicKey, libs = {}) {
    const nacl = libs.nacl || globalThis.nacl;
    const blake2b = libs.blake2b || globalThis.UniversalBlake2b;
    if (!nacl || !nacl.box || !blake2b)
      throw new Error("Bibliotecas locais de criptografia não carregadas. Atualize a página.");
    if (typeof plaintext !== "string" || !plaintext)
      throw new Error("O valor do secret não pode estar vazio.");
    const recipient = decode64(recipientPublicKey);
    if (recipient.length !== 32) throw new Error("Chave pública do GitHub deve ter 32 bytes.");
    const ephemeral = nacl.box.keyPair(); // WebCrypto-backed secure PRNG
    const data = new TextEncoder().encode(plaintext);
    try {
      const nonceSource = new Uint8Array(64);
      nonceSource.set(ephemeral.publicKey);
      nonceSource.set(recipient, 32);
      // The digest LENGTH is part of the BLAKE2b parameter block, not a truncated 64-byte digest.
      const nonce = blake2b(nonceSource, null, 24);
      const ciphertext = nacl.box(data, nonce, recipient, ephemeral.secretKey);
      const sealed = new Uint8Array(32 + ciphertext.length);
      sealed.set(ephemeral.publicKey);
      sealed.set(ciphertext, 32);
      nonceSource.fill(0);
      nonce.fill(0);
      return encode64(sealed); // crypto_box_seal: ephemeral_pk || MAC || encrypted_message
    } finally {
      data.fill(0);
      ephemeral.secretKey.fill(0);
    }
  }
  function makePayload(value, publicKey, libs) {
    if (!publicKey || typeof publicKey.key_id !== "string" || !publicKey.key_id ||
        typeof publicKey.key !== "string")
      throw new Error("GitHub não retornou uma chave pública válida de Secrets.");
    return {
      encrypted_value: seal(value, publicKey.key, libs),
      key_id: publicKey.key_id
    };
  }
  return { generatePassword, seal, makePayload, decode64, encode64 };
});
